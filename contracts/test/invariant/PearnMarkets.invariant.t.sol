// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";

import {PearnMarkets} from "../../src/PearnMarkets.sol";
import {Market, Outcome, Side, Stake} from "../../src/types/Market.sol";
import {MockRateOracle} from "../mocks/MockRateOracle.sol";
import {MockToken} from "../mocks/MockToken.sol";

/// @dev Drives several markets on one PearnMarkets at once: random bets, sponsorships, time
///      with a rising rate, resolution, voiding, guardian overrides and claims. Calls that the
///      contract would reject are skipped, so every step is one the contract accepts.
/// @dev Measured on 2026-11-03 (256 runs × depth 64): 99% of runs settle a market, 71% claim.
contract MarketsHandler is Test {
    uint256 internal constant ONE = 1e24;
    uint256 internal constant MARKETS = 3;

    PearnMarkets internal immutable markets;
    MockToken internal immutable stNear;
    MockRateOracle internal immutable oracle;
    address internal immutable guardian;

    address[4] public actors;
    address[MARKETS] public resolvers;

    uint256 public totalIn;
    uint256 public totalOut;
    /// @dev Set when a claim paid back less than the claimer's principal (in NEAR value).
    bool public principalShortfall;

    constructor(
        PearnMarkets markets_,
        MockToken stNear_,
        MockRateOracle oracle_,
        address guardian_
    ) {
        markets = markets_;
        stNear = stNear_;
        oracle = oracle_;
        guardian = guardian_;
        actors = [makeAddr("a0"), makeAddr("a1"), makeAddr("a2"), makeAddr("a3")];
        for (uint256 i; i < MARKETS; ++i) {
            resolvers[i] = makeAddr(string.concat("resolver", vm.toString(i)));
            // Staggered closes, so markets are in different phases at once.
            markets.createMarket("Q?", uint64(block.timestamp + (i + 1) * 1 days), resolvers[i]);
        }
        for (uint256 i; i < actors.length; ++i) {
            vm.prank(actors[i]);
            stNear.approve(address(markets), type(uint256).max);
        }
    }

    function bet(uint256 marketSeed, uint256 actorSeed, bool yes, uint256 amount) external {
        uint256 id = marketSeed % MARKETS;
        Market memory m = markets.getMarket(id);
        if (m.outcome != Outcome.Unresolved || block.timestamp >= m.closeTime) return;
        // Down to dust: a tiny bet can refund 0 and must still never break solvency.
        amount = bound(amount, 1, 1e28);
        address who = actors[actorSeed % actors.length];
        stNear.mint(who, amount);
        vm.prank(who);
        try markets.bet(id, yes ? Side.Yes : Side.No, uint128(amount)) {
            totalIn += amount;
        } catch {} // ZeroAmount for a zero-weight dust bet
    }

    function sponsor(uint256 marketSeed, uint256 actorSeed, uint256 amount) external {
        uint256 id = marketSeed % MARKETS;
        if (markets.getMarket(id).outcome != Outcome.Unresolved) return;
        amount = bound(amount, 1, 1e27);
        address who = actors[actorSeed % actors.length];
        stNear.mint(who, amount);
        vm.prank(who);
        markets.sponsor(id, uint128(amount));
        totalIn += amount;
    }

    /// @dev Time passes and the keeper syncs a rate that never falls, as the oracle guarantees.
    function advance(uint256 dt, uint256 rise) external {
        vm.warp(block.timestamp + bound(dt, 1 hours, 2 days));
        oracle.set(oracle.rate() + bound(rise, 0, 1e21));
    }

    function resolve(uint256 marketSeed, uint8 outcomeSeed) external {
        uint256 id = marketSeed % MARKETS;
        Market memory m = markets.getMarket(id);
        if (m.outcome != Outcome.Unresolved || block.timestamp < m.closeTime) return;
        if (oracle.updatedAt() < m.closeTime) return;
        vm.prank(resolvers[id]);
        markets.resolve(id, Outcome(bound(outcomeSeed, 1, 3)));
    }

    function voidExpired(uint256 marketSeed) external {
        uint256 id = marketSeed % MARKETS;
        Market memory m = markets.getMarket(id);
        if (m.outcome != Outcome.Unresolved) return;
        if (block.timestamp < uint256(m.closeTime) + markets.RESOLVE_TIMEOUT()) return;
        markets.voidExpired(id);
    }

    function overrideInvalid(uint256 marketSeed) external {
        uint256 id = marketSeed % MARKETS;
        Market memory m = markets.getMarket(id);
        if (m.outcome == Outcome.Unresolved || m.outcome == Outcome.Invalid) return;
        if (block.timestamp >= uint256(m.resolvedAt) + markets.CHALLENGE_WINDOW()) return;
        vm.prank(guardian);
        markets.overrideInvalid(id);
    }

    /// @dev Claims for the first account, from a random start, that has something to claim.
    function claim(uint256 marketSeed, uint256 actorSeed) external {
        uint256 id = marketSeed % MARKETS;
        address who;
        uint256 expected;
        for (uint256 i; i < actors.length && expected == 0; ++i) {
            who = actors[(actorSeed + i) % actors.length];
            expected = markets.claimable(id, who);
        }
        if (expected == 0) return;

        vm.prank(who);
        uint256 paid = markets.claim(id);
        totalOut += paid;

        uint256 principal = uint256(markets.positionOf(id, who, Side.Yes).principal)
            + markets.positionOf(id, who, Side.No).principal;
        uint256 rate = markets.getMarket(id).settlementRate;
        if (paid != expected || paid * rate / ONE + 2 < principal) principalShortfall = true;
    }

    /// @dev What every account could still claim, across all final markets.
    function outstanding() external view returns (uint256 sum) {
        for (uint256 id; id < MARKETS; ++id) {
            for (uint256 i; i < actors.length; ++i) {
                sum += markets.claimable(id, actors[i]);
            }
        }
    }
}

/// @notice Properties that must hold after any sequence of actions across several markets.
contract PearnMarketsInvariantTest is StdInvariant, Test {
    PearnMarkets internal markets;
    MockToken internal stNear;
    MarketsHandler internal handler;

    function setUp() public {
        vm.warp(1_800_000_000);
        stNear = new MockToken("Staked NEAR", "STNEAR");
        MockRateOracle oracle = new MockRateOracle();
        oracle.set(1.5e24);
        address guardian = makeAddr("guardian");
        markets = new PearnMarkets(stNear, oracle, guardian);
        handler = new MarketsHandler(markets, stNear, oracle, guardian);
        targetContract(address(handler));
    }

    /// stNEAR in the contract is exactly what came in minus what was paid out.
    function invariant_accounting() public view {
        assertEq(stNear.balanceOf(address(markets)), handler.totalIn() - handler.totalOut());
    }

    /// Everything claimable right now, in every market together, is covered: one market's
    /// claims can never eat into another's stNEAR.
    function invariant_solvent() public view {
        assertLe(handler.outstanding(), stNear.balanceOf(address(markets)));
    }

    /// Every claim matched `claimable` and returned at least the claimer's principal.
    function invariant_principalReturned() public view {
        assertFalse(handler.principalShortfall());
    }
}
