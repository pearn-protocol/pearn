// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PromiseResultStatus} from "aurora-sdk/Types.sol";

import {PearnMarkets} from "../../src/PearnMarkets.sol";
import {StNearRateOracle} from "../../src/StNearRateOracle.sol";
import {IPearnMarkets} from "../../src/interfaces/IPearnMarkets.sol";
import {Outcome, Side} from "../../src/types/Market.sol";
import {MockToken} from "../mocks/MockToken.sol";
import {AuroraXcc} from "../utils/AuroraXcc.sol";

/// @notice PearnMarkets wired to the real StNearRateOracle; only Aurora's precompiles are mocked.
///         Follows one market from the first keeper sync to the last claim.
contract MarketLifecycleTest is AuroraXcc {
    uint256 internal constant ONE = 1e24;
    uint64 internal constant T0 = 1_800_000_000;
    uint64 internal constant CLOSE = T0 + 30 days;

    MockToken internal wNear;
    MockToken internal stNear;
    StNearRateOracle internal oracle;
    PearnMarkets internal markets;

    address internal keeper = makeAddr("keeper");
    address internal guardian = makeAddr("guardian");
    address internal resolver = makeAddr("resolverDao");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal dave = makeAddr("dave");
    address internal sponsorAccount = makeAddr("sponsor");

    function setUp() public {
        vm.warp(T0);
        _mockAuroraPrecompiles();

        wNear = new MockToken("Wrapped NEAR", "wNEAR");
        stNear = new MockToken("Staked NEAR", "STNEAR");
        oracle = new StNearRateOracle(wNear, "meta-pool.near", ENGINE);
        markets = new PearnMarkets(stNear, oracle, guardian);

        // The first sync pays the XCC account's 2 NEAR storage.
        wNear.mint(keeper, 2 * ONE);
        vm.prank(keeper);
        wNear.approve(address(oracle), 2 * ONE);
        _keeperSync(1.5e24);
    }

    function test_fullLifecycle_noLossForLosers_yieldAndPotForWinners() public {
        uint256 id = markets.createMarket("Will NEAR ship X by Q1?", CLOSE, resolver);

        _bet(alice, id, Side.Yes, 100 * ONE);
        _bet(bob, id, Side.No, 100 * ONE);
        _sponsorPot(id, 10 * ONE);

        vm.warp(T0 + 15 days);
        _keeperSync(1.51e24);
        _bet(dave, id, Side.Yes, 100 * ONE); // late, half the weight of alice's bet

        vm.warp(CLOSE);
        vm.prank(resolver);
        vm.expectRevert(
            abi.encodeWithSelector(
                IPearnMarkets.RateNotSyncedSinceClose.selector, T0 + 15 days, CLOSE
            )
        );
        markets.resolve(id, Outcome.Yes);

        _keeperSync(1.53e24);
        vm.prank(resolver);
        markets.resolve(id, Outcome.Yes);

        // A lower reading after settlement is rejected and changes nothing.
        _keeperSync(1.4e24);
        assertEq(oracle.rate(), 1.53e24);

        vm.warp(CLOSE + markets.CHALLENGE_WINDOW());
        uint256 bobGot = _claim(bob, id);
        uint256 aliceGot = _claim(alice, id);
        uint256 daveGot = _claim(dave, id);

        // Bob lost and still holds his 150 NEAR of value.
        assertApproxEqAbs(bobGot * 1.53e24 / ONE, 150 * ONE, 2);
        // Alice and Dave get their principal back plus the pot, 2:1 by time weight.
        uint256 aliceWin = aliceGot - 150 * ONE * ONE / 1.53e24;
        uint256 daveWin = daveGot - 151 * ONE * ONE / 1.53e24;
        assertApproxEqRel(aliceWin * 151, daveWin * 2 * 150, 1e12);
        // Solvent: everything paid came from deposits; each floored refund or share can leave
        // at most 1 yocto behind (3 refunds + 2 shares).
        uint256 paid = aliceGot + bobGot + daveGot;
        assertLe(paid, 310 * ONE);
        assertEq(stNear.balanceOf(address(markets)), 310 * ONE - paid);
        assertLe(stNear.balanceOf(address(markets)), 5);
    }

    function test_staleOracle_blocksBetsUntilTheKeeperSyncs() public {
        uint256 id = markets.createMarket("Q?", CLOSE, resolver);
        vm.warp(T0 + markets.MAX_RATE_AGE() + 1);

        stNear.mint(alice, ONE);
        vm.startPrank(alice);
        stNear.approve(address(markets), ONE);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.RateStale.selector, T0));
        markets.bet(id, Side.Yes, uint128(ONE));
        vm.stopPrank();

        // A failed view is not a fresh reading.
        vm.prank(keeper);
        oracle.sync();
        _deliver(oracle, PromiseResultStatus.Failed, "");
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.RateStale.selector, T0));
        markets.bet(id, Side.Yes, uint128(ONE));

        _keeperSync(1.5e24);
        vm.prank(alice);
        markets.bet(id, Side.Yes, uint128(ONE));
        assertEq(markets.positionOf(id, alice, Side.Yes).principal, 1.5e24);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    /// @dev What the keeper does every epoch: `sync`, then the XCC router answers.
    function _keeperSync(uint256 rate) internal {
        vm.prank(keeper);
        oracle.sync();
        _deliverRate(oracle, rate);
    }

    function _bet(address who, uint256 id, Side side, uint256 amount) internal {
        stNear.mint(who, amount);
        vm.startPrank(who);
        stNear.approve(address(markets), amount);
        markets.bet(id, side, uint128(amount));
        vm.stopPrank();
    }

    function _sponsorPot(uint256 id, uint256 amount) internal {
        stNear.mint(sponsorAccount, amount);
        vm.startPrank(sponsorAccount);
        stNear.approve(address(markets), amount);
        markets.sponsor(id, uint128(amount));
        vm.stopPrank();
    }

    function _claim(address who, uint256 id) internal returns (uint256) {
        vm.prank(who);
        return markets.claim(id);
    }
}
