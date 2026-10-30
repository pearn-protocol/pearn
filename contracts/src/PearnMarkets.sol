// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

import {IPearnMarkets} from "./interfaces/IPearnMarkets.sol";
import {IRateOracle} from "./interfaces/IRateOracle.sol";
import {PayoutMath} from "./libraries/PayoutMath.sol";
import {Market, Outcome, Side, Stake} from "./types/Market.sol";

/// @title PearnMarkets
/// @notice No-loss prediction markets on stNEAR. Every bettor gets their principal's NEAR value
///         back; the winning side splits the staking yield of the whole market plus sponsors.
/// @dev There is no owner and no upgrade path. The guardian can only turn an outcome into
///      `Invalid` during the challenge window. See DESIGN.md §5 for the accounting.
contract PearnMarkets is IPearnMarkets, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using SafeCast for uint256;

    /// @notice Shortest time between creating a market and its close.
    uint64 public constant MIN_DURATION = 1 hours;
    /// @notice Time after resolution in which the guardian may override to `Invalid`.
    uint64 public constant CHALLENGE_WINDOW = 1 days;
    /// @notice Time after close after which anyone may void an unresolved market.
    uint64 public constant RESOLVE_TIMEOUT = 7 days;
    /// @notice Oldest oracle reading a bet accepts. The keeper syncs every epoch (~12 h).
    uint64 public constant MAX_RATE_AGE = 2 days;
    /// @notice Longest question in bytes.
    uint256 public constant MAX_QUESTION_LENGTH = 280;

    IERC20 public immutable stNear;
    IRateOracle public immutable oracle;
    address public immutable guardian;

    Market[] private _markets;
    mapping(uint256 id => mapping(address bettor => mapping(Side side => Stake))) private
        _positions;
    mapping(uint256 id => mapping(address sponsor => uint256 amount)) private _sponsorships;
    mapping(uint256 id => mapping(address account => bool)) private _claimed;

    constructor(IERC20 stNear_, IRateOracle oracle_, address guardian_) {
        if (
            address(stNear_) == address(0) || address(oracle_) == address(0)
                || guardian_ == address(0)
        ) {
            revert ZeroAddress();
        }
        stNear = stNear_;
        oracle = oracle_;
        guardian = guardian_;
    }

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    /// @inheritdoc IPearnMarkets
    function createMarket(string calldata question, uint64 closeTime, address resolver)
        external
        returns (uint256 id)
    {
        uint256 length = bytes(question).length;
        if (length == 0 || length > MAX_QUESTION_LENGTH) revert InvalidQuestion();
        if (closeTime < block.timestamp + MIN_DURATION) revert InvalidCloseTime();
        if (resolver == address(0)) revert ZeroAddress();

        id = _markets.length;
        Market storage m = _markets.push();
        m.creator = msg.sender;
        m.resolver = resolver;
        m.closeTime = closeTime;
        m.question = question;

        emit MarketCreated(id, msg.sender, resolver, closeTime, question);
    }

    /// @inheritdoc IPearnMarkets
    function bet(uint256 id, Side side, uint128 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Market storage m = _openMarket(id);

        uint256 principal = PayoutMath.principalOf(amount, _freshRate());
        uint256 weight = PayoutMath.weightOf(principal, block.timestamp, m.closeTime);
        if (weight == 0) revert ZeroAmount();

        _addStake(side == Side.Yes ? m.yes : m.no, amount, principal, weight);
        _addStake(_positions[id][msg.sender][side], amount, principal, weight);

        // Only view calls to the immutable oracle precede this event; there is no reentry point.
        // forge-lint: disable-next-line(reentrancy-events)
        emit BetPlaced(id, msg.sender, side, amount, principal, weight);
        stNear.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IPearnMarkets
    function sponsor(uint256 id, uint128 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Market storage m = _unresolvedMarket(id);

        m.sponsored += amount;
        _sponsorships[id][msg.sender] += amount;

        emit Sponsored(id, msg.sender, amount);
        stNear.safeTransferFrom(msg.sender, address(this), amount);
    }

    /// @inheritdoc IPearnMarkets
    function resolve(uint256 id, Outcome outcome) external {
        Market storage m = _unresolvedMarket(id);
        if (msg.sender != m.resolver) revert NotResolver();
        if (outcome == Outcome.Unresolved) revert InvalidOutcome();
        if (block.timestamp < m.closeTime) revert MarketNotClosed(id);

        uint64 syncedAt = oracle.updatedAt();
        if (syncedAt < m.closeTime) revert RateNotSyncedSinceClose(syncedAt, m.closeTime);

        _settle(id, m, outcome);
    }

    /// @inheritdoc IPearnMarkets
    function voidExpired(uint256 id) external {
        Market storage m = _unresolvedMarket(id);
        if (block.timestamp < uint256(m.closeTime) + RESOLVE_TIMEOUT) {
            revert ResolveTimeoutNotReached(id);
        }
        _settle(id, m, Outcome.Invalid);
    }

    /// @inheritdoc IPearnMarkets
    function overrideInvalid(uint256 id) external {
        if (msg.sender != guardian) revert NotGuardian();
        Market storage m = _resolvedMarket(id);
        if (block.timestamp >= uint256(m.resolvedAt) + CHALLENGE_WINDOW) {
            revert ChallengeWindowOver(id);
        }

        Outcome previous = m.outcome;
        if (previous == Outcome.Invalid) revert InvalidOutcome();
        m.outcome = Outcome.Invalid;

        emit OutcomeOverridden(id, previous);
    }

    /// @inheritdoc IPearnMarkets
    function claim(uint256 id) external nonReentrant returns (uint256 amount) {
        Market storage m = _finalMarket(id);
        if (_claimed[id][msg.sender]) revert AlreadyClaimed(id, msg.sender);

        amount = _payoutOf(id, m, msg.sender);
        if (amount == 0) revert NothingToClaim(id, msg.sender);
        _claimed[id][msg.sender] = true;

        // No external call precedes this event; the transfer below is the only one.
        // forge-lint: disable-next-line(reentrancy-events)
        emit Claimed(id, msg.sender, amount);
        stNear.safeTransfer(msg.sender, amount);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    /// @inheritdoc IPearnMarkets
    function claimable(uint256 id, address bettor) external view returns (uint256) {
        Market storage m = _market(id);
        if (!_isFinal(m) || _claimed[id][bettor]) return 0;
        return _payoutOf(id, m, bettor);
    }

    /// @inheritdoc IPearnMarkets
    function getMarket(uint256 id) external view returns (Market memory) {
        return _market(id);
    }

    /// @inheritdoc IPearnMarkets
    function positionOf(uint256 id, address bettor, Side side)
        external
        view
        returns (Stake memory)
    {
        return _positions[id][bettor][side];
    }

    /// @inheritdoc IPearnMarkets
    function sponsorshipOf(uint256 id, address sponsor_) external view returns (uint256) {
        return _sponsorships[id][sponsor_];
    }

    /// @inheritdoc IPearnMarkets
    function hasClaimed(uint256 id, address account) external view returns (bool) {
        return _claimed[id][account];
    }

    /// @inheritdoc IPearnMarkets
    function marketCount() external view returns (uint256) {
        return _markets.length;
    }

    // ─── Internals ───────────────────────────────────────────────────────────

    /// @dev Fixes the settlement rate and the pot. Payouts depend only on these and the stakes,
    ///      so a later guardian override changes who shares the pot, never its size.
    function _settle(uint256 id, Market storage m, Outcome outcome) private {
        uint256 rate = oracle.rate();
        uint256 totalPrincipal = uint256(m.yes.principal) + m.no.principal;
        if (totalPrincipal != 0 && rate == 0) revert RateUnavailable();
        uint256 reserve = totalPrincipal == 0 ? 0 : PayoutMath.reserveOf(totalPrincipal, rate);
        uint256 pot = PayoutMath.potOf(uint256(m.yes.staked) + m.no.staked, reserve, m.sponsored);

        m.outcome = outcome;
        m.resolvedAt = block.timestamp.toUint64();
        m.settlementRate = rate;
        m.pot = pot.toUint128();

        // Only view calls to the immutable oracle precede this event; there is no reentry point.
        // forge-lint: disable-next-line(reentrancy-events)
        emit MarketResolved(id, outcome, rate, pot);
    }

    /// @dev Principal refund plus the bettor's share of the pot. If nobody bet at all, the pot is
    ///      just the sponsorships, so each sponsor takes theirs back.
    function _payoutOf(uint256 id, Market storage m, address account)
        private
        view
        returns (uint256 amount)
    {
        Stake storage yes = _positions[id][account][Side.Yes];
        Stake storage no = _positions[id][account][Side.No];

        uint256 principal = uint256(yes.principal) + no.principal;
        if (principal != 0) amount = PayoutMath.refundOf(principal, m.settlementRate);

        (uint256 weight, uint256 totalWeight) = _shareBasis(m, yes.weight, no.weight);
        if (totalWeight == 0) return amount + _sponsorships[id][account];
        return amount + PayoutMath.shareOf(m.pot, weight, totalWeight);
    }

    /// @dev Winners split by their weight on the winning side. `Invalid`, or a winning side
    ///      nobody bet on, shares the pot across everyone's weight.
    function _shareBasis(Market storage m, uint256 yesWeight, uint256 noWeight)
        private
        view
        returns (uint256 weight, uint256 totalWeight)
    {
        if (m.outcome == Outcome.Yes && m.yes.weight != 0) return (yesWeight, m.yes.weight);
        if (m.outcome == Outcome.No && m.no.weight != 0) return (noWeight, m.no.weight);
        return (yesWeight + noWeight, m.yes.weight + m.no.weight);
    }

    function _addStake(Stake storage s, uint128 staked, uint256 principal, uint256 weight) private {
        s.staked += staked;
        s.principal += principal.toUint128();
        s.weight += weight;
    }

    /// @dev Reverts unless the oracle has a recent reading. A stale rate would under-count
    ///      the bettor's own principal, so this protects the bettor, not the pool.
    function _freshRate() private view returns (uint256 rate) {
        rate = oracle.rate();
        if (rate == 0) revert RateUnavailable();
        uint64 updatedAt = oracle.updatedAt();
        if (block.timestamp > uint256(updatedAt) + MAX_RATE_AGE) revert RateStale(updatedAt);
    }

    function _market(uint256 id) private view returns (Market storage) {
        if (id >= _markets.length) revert MarketNotFound(id);
        return _markets[id];
    }

    function _unresolvedMarket(uint256 id) private view returns (Market storage m) {
        m = _market(id);
        if (m.outcome != Outcome.Unresolved) revert MarketResolvedAlready(id);
    }

    function _openMarket(uint256 id) private view returns (Market storage m) {
        m = _unresolvedMarket(id);
        if (block.timestamp >= m.closeTime) revert MarketClosed(id);
    }

    function _resolvedMarket(uint256 id) private view returns (Market storage m) {
        m = _market(id);
        if (m.outcome == Outcome.Unresolved) revert MarketNotResolved(id);
    }

    function _finalMarket(uint256 id) private view returns (Market storage m) {
        m = _resolvedMarket(id);
        if (!_isFinal(m)) revert ChallengeWindowOpen(id);
    }

    function _isFinal(Market storage m) private view returns (bool) {
        return m.outcome != Outcome.Unresolved
            && block.timestamp >= uint256(m.resolvedAt) + CHALLENGE_WINDOW;
    }
}
