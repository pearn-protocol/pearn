// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Market, Outcome, Side, Stake} from "../types/Market.sol";

/// @title IPearnMarkets
/// @notice No-loss prediction markets on stNEAR: bettors risk only the staking yield.
interface IPearnMarkets {
    event MarketCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed resolver,
        uint64 closeTime,
        string question
    );
    event BetPlaced(
        uint256 indexed id,
        address indexed bettor,
        Side side,
        uint256 staked,
        uint256 principal,
        uint256 weight
    );
    event Sponsored(uint256 indexed id, address indexed sponsor, uint256 amount);
    event MarketResolved(uint256 indexed id, Outcome outcome, uint256 settlementRate, uint256 pot);
    event OutcomeOverridden(uint256 indexed id, Outcome previous);
    event Claimed(uint256 indexed id, address indexed bettor, uint256 amount);

    error ZeroAddress();
    error ZeroAmount();
    error InvalidQuestion();
    error InvalidCloseTime();
    error InvalidOutcome();
    error MarketNotFound(uint256 id);
    error MarketClosed(uint256 id);
    error MarketNotClosed(uint256 id);
    error MarketResolvedAlready(uint256 id);
    error MarketNotResolved(uint256 id);
    error NotResolver();
    error NotGuardian();
    error RateUnavailable();
    error RateStale(uint64 updatedAt);
    error RateNotSyncedSinceClose(uint64 updatedAt, uint64 closeTime);
    error ResolveTimeoutNotReached(uint256 id);
    error ChallengeWindowOpen(uint256 id);
    error ChallengeWindowOver(uint256 id);
    error AlreadyClaimed(uint256 id, address bettor);
    error NothingToClaim(uint256 id, address bettor);

    /// @notice Opens a market. Anyone may create one; `resolver` reports the outcome.
    /// @return id The new market's id.
    function createMarket(string calldata question, uint64 closeTime, address resolver)
        external
        returns (uint256 id);

    /// @notice Bets `amount` stNEAR on `side`. Requires a prior `approve`.
    function bet(uint256 id, Side side, uint128 amount) external;

    /// @notice Adds `amount` stNEAR to the market's pot. Sponsors get nothing back.
    function sponsor(uint256 id, uint128 amount) external;

    /// @notice Reports the outcome once the market has closed and the oracle synced after close.
    function resolve(uint256 id, Outcome outcome) external;

    /// @notice Settles an abandoned market as `Invalid` once the resolve timeout has passed.
    function voidExpired(uint256 id) external;

    /// @notice Lets the guardian turn a settled outcome into `Invalid` during the challenge window.
    function overrideInvalid(uint256 id) external;

    /// @notice Pays the caller's principal plus any winnings once the outcome is final.
    function claim(uint256 id) external returns (uint256 amount);

    /// @notice What `bettor` would receive from `claim` now (0 before finality or once claimed).
    function claimable(uint256 id, address bettor) external view returns (uint256);

    function getMarket(uint256 id) external view returns (Market memory);

    function positionOf(uint256 id, address bettor, Side side) external view returns (Stake memory);

    function marketCount() external view returns (uint256);
}
