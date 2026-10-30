// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PearnMarkets} from "../src/PearnMarkets.sol";
import {IPearnMarkets} from "../src/interfaces/IPearnMarkets.sol";
import {IRateOracle} from "../src/interfaces/IRateOracle.sol";
import {Market, Outcome, Side, Stake} from "../src/types/Market.sol";
import {PearnMarketsBase} from "./PearnMarketsBase.t.sol";
import {MockRateOracle} from "./mocks/MockRateOracle.sol";

contract PearnMarketsTest is PearnMarketsBase {
    uint256 internal constant SETTLE_RATE = 1.53e24; // +2% over the market's life

    // ─── constructor & createMarket ──────────────────────────────────────────

    function test_constructor_rejectsZeroAddresses() public {
        vm.expectRevert(IPearnMarkets.ZeroAddress.selector);
        new PearnMarkets(stNear, IRateOracle(address(0)), guardian);
    }

    function test_createMarket_storesMarketAndEmits() public {
        uint64 close = uint64(block.timestamp) + 2 days;
        vm.expectEmit(address(markets));
        emit IPearnMarkets.MarketCreated(1, alice, resolver, close, "Q?");
        vm.prank(alice);
        uint256 newId = markets.createMarket("Q?", close, resolver);

        Market memory m = markets.getMarket(newId);
        assertEq(newId, 1);
        assertEq(markets.marketCount(), 2);
        assertEq(m.creator, alice);
        assertEq(m.resolver, resolver);
        assertEq(m.closeTime, close);
        assertEq(m.question, "Q?");
        assertEq(uint8(m.outcome), uint8(Outcome.Unresolved));
    }

    function test_createMarket_rejectsBadInput() public {
        uint64 close = uint64(block.timestamp) + 2 days;

        vm.expectRevert(IPearnMarkets.InvalidQuestion.selector);
        markets.createMarket("", close, resolver);

        vm.expectRevert(IPearnMarkets.InvalidQuestion.selector);
        markets.createMarket(string(new bytes(281)), close, resolver);

        vm.expectRevert(IPearnMarkets.InvalidCloseTime.selector);
        markets.createMarket("Q?", uint64(block.timestamp) + 1 hours - 1, resolver);

        vm.expectRevert(IPearnMarkets.ZeroAddress.selector);
        markets.createMarket("Q?", close, address(0));
    }

    // ─── bet ─────────────────────────────────────────────────────────────────

    function test_bet_recordsPrincipalAndTimeWeight() public {
        uint256 amount = 10 * ONE;
        uint256 principal = 15 * ONE;
        uint256 weight = principal * DURATION;

        _fund(alice, amount);
        vm.expectEmit(address(markets));
        emit IPearnMarkets.BetPlaced(id, alice, Side.Yes, amount, principal, weight);
        vm.prank(alice);
        markets.bet(id, Side.Yes, uint128(amount));

        Stake memory p = markets.positionOf(id, alice, Side.Yes);
        assertEq(p.staked, amount);
        assertEq(p.principal, principal);
        assertEq(p.weight, weight);
        assertEq(markets.getMarket(id).yes.weight, weight);
        assertEq(stNear.balanceOf(address(markets)), amount);
    }

    function test_bet_accumulatesRepeatBets() public {
        _bet(alice, Side.No, ONE);
        _warpAndSync(block.timestamp + 10 days, RATE);
        _bet(alice, Side.No, ONE);

        Stake memory p = markets.positionOf(id, alice, Side.No);
        assertEq(p.staked, 2 * ONE);
        assertEq(p.weight, 1.5e24 * 30 days + 1.5e24 * 20 days);
    }

    function test_bet_rejectsZeroUnknownAndClosed() public {
        vm.expectRevert(IPearnMarkets.ZeroAmount.selector);
        markets.bet(id, Side.Yes, 0);

        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.MarketNotFound.selector, 9));
        markets.bet(9, Side.Yes, 1);

        vm.warp(closeTime);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.MarketClosed.selector, id));
        markets.bet(id, Side.Yes, 1);
    }

    function test_bet_rejectsStaleOrMissingRate() public {
        vm.warp(block.timestamp + markets.MAX_RATE_AGE() + 1);
        _fund(alice, ONE);
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(IPearnMarkets.RateStale.selector, oracle.updatedAt())
        );
        markets.bet(id, Side.Yes, uint128(ONE));

        PearnMarkets fresh = new PearnMarkets(stNear, new MockRateOracle(), guardian);
        uint256 freshId = fresh.createMarket("Q?", closeTime + 30 days, resolver);
        vm.expectRevert(IPearnMarkets.RateUnavailable.selector);
        fresh.bet(freshId, Side.Yes, 1);
    }

    // ─── payouts ─────────────────────────────────────────────────────────────

    function test_loserGetsPrincipalBack_winnerTakesTheYield() public {
        _bet(alice, Side.Yes, 100 * ONE);
        _bet(bob, Side.No, 100 * ONE);
        _settle(Outcome.Yes, SETTLE_RATE);

        uint256 bobGot = _claim(bob);
        uint256 aliceGot = _claim(alice);

        // Bob's refund is worth his 150 NEAR at the settlement rate (minus rounding).
        assertApproxEqAbs(bobGot * SETTLE_RATE / ONE, 150 * ONE, 2);
        // Alice gets her own principal back plus everything else.
        assertApproxEqAbs(aliceGot, 200 * ONE - bobGot, 2);
        assertGt(aliceGot, 100 * ONE);
        assertLe(aliceGot + bobGot, 200 * ONE);
    }

    function test_lateBetEarnsLess() public {
        _bet(alice, Side.Yes, 100 * ONE);
        _warpAndSync(closeTime - 3 days, RATE);
        _bet(bob, Side.Yes, 100 * ONE);
        _bet(carol, Side.No, 100 * ONE);
        _settle(Outcome.Yes, SETTLE_RATE);

        uint256 refund = 150 * ONE * ONE / SETTLE_RATE;
        uint256 aliceWin = _claim(alice) - refund;
        uint256 bobWin = _claim(bob) - refund;
        // Weights 30 days vs 3 days.
        assertApproxEqRel(aliceWin, bobWin * 10, 1e12);
    }

    function test_sponsorshipGoesToWinners() public {
        _bet(alice, Side.Yes, 100 * ONE);
        _bet(bob, Side.No, 100 * ONE);
        _sponsor(carol, 50 * ONE);
        _settle(Outcome.No, RATE); // no yield at all: the pot is only the sponsorship

        assertApproxEqAbs(_claim(bob), 150 * ONE, 1);
        assertApproxEqAbs(_claim(alice), 100 * ONE, 1);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.NothingToClaim.selector, id, carol));
        markets.claim(id);
    }

    function test_invalidSharesThePotAcrossEveryone() public {
        _bet(alice, Side.Yes, 100 * ONE);
        _bet(bob, Side.No, 300 * ONE);
        _sponsor(carol, 40 * ONE);
        _settle(Outcome.Invalid, RATE);

        assertApproxEqAbs(_claim(alice), 110 * ONE, 1);
        assertApproxEqAbs(_claim(bob), 330 * ONE, 1);
    }

    function test_emptyWinningSideSharesThePotAcrossEveryone() public {
        _bet(alice, Side.Yes, 100 * ONE);
        _sponsor(carol, 10 * ONE);
        _settle(Outcome.No, RATE);

        assertApproxEqAbs(_claim(alice), 110 * ONE, 1);
    }

    function test_noBets_sponsorTakesItBack() public {
        _sponsor(carol, 10 * ONE);
        _settle(Outcome.Yes, RATE);

        assertEq(_claim(carol), 10 * ONE);
    }

    // ─── resolve, void, override ─────────────────────────────────────────────

    function test_resolve_rejectsBadCalls() public {
        vm.expectRevert(IPearnMarkets.NotResolver.selector);
        markets.resolve(id, Outcome.Yes);

        vm.startPrank(resolver);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.MarketNotClosed.selector, id));
        markets.resolve(id, Outcome.Yes);

        vm.warp(closeTime);
        vm.expectRevert(IPearnMarkets.InvalidOutcome.selector);
        markets.resolve(id, Outcome.Unresolved);

        uint64 synced = oracle.updatedAt();
        vm.expectRevert(
            abi.encodeWithSelector(
                IPearnMarkets.RateNotSyncedSinceClose.selector, synced, closeTime
            )
        );
        markets.resolve(id, Outcome.Yes);

        oracle.set(RATE);
        markets.resolve(id, Outcome.Yes);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.MarketResolvedAlready.selector, id));
        markets.resolve(id, Outcome.No);
        vm.stopPrank();
    }

    function test_voidExpired_onlyAfterTimeout() public {
        _bet(alice, Side.Yes, ONE);
        vm.warp(uint256(closeTime) + markets.RESOLVE_TIMEOUT() - 1);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.ResolveTimeoutNotReached.selector, id));
        markets.voidExpired(id);

        vm.warp(block.timestamp + 1);
        markets.voidExpired(id);
        assertEq(uint8(markets.getMarket(id).outcome), uint8(Outcome.Invalid));
    }

    function test_overrideInvalid_reroutesThePot() public {
        _bet(alice, Side.Yes, 100 * ONE);
        _bet(bob, Side.No, 100 * ONE);
        _sponsor(carol, 20 * ONE);
        _warpAndSync(closeTime, RATE);
        vm.prank(resolver);
        markets.resolve(id, Outcome.Yes);

        vm.expectRevert(IPearnMarkets.NotGuardian.selector);
        markets.overrideInvalid(id);

        vm.expectEmit(address(markets));
        emit IPearnMarkets.OutcomeOverridden(id, Outcome.Yes);
        vm.prank(guardian);
        markets.overrideInvalid(id);

        vm.prank(guardian);
        vm.expectRevert(IPearnMarkets.InvalidOutcome.selector);
        markets.overrideInvalid(id);

        vm.warp(block.timestamp + markets.CHALLENGE_WINDOW());
        assertApproxEqAbs(_claim(alice), 110 * ONE, 1);
        assertApproxEqAbs(_claim(bob), 110 * ONE, 1);
    }

    function test_overrideInvalid_closesWithTheWindow() public {
        _settle(Outcome.Yes, RATE);
        vm.prank(guardian);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.ChallengeWindowOver.selector, id));
        markets.overrideInvalid(id);
    }

    // ─── claim ───────────────────────────────────────────────────────────────

    function test_claim_waitsForTheWindowAndPaysOnce() public {
        _bet(alice, Side.Yes, ONE);
        _warpAndSync(closeTime, RATE);
        vm.prank(resolver);
        markets.resolve(id, Outcome.Yes);

        assertEq(markets.claimable(id, alice), 0);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.ChallengeWindowOpen.selector, id));
        markets.claim(id);

        vm.warp(block.timestamp + markets.CHALLENGE_WINDOW());
        uint256 expected = markets.claimable(id, alice);
        assertEq(_claim(alice), expected);
        assertEq(stNear.balanceOf(alice), expected);
        assertTrue(markets.hasClaimed(id, alice));
        assertEq(markets.claimable(id, alice), 0);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.AlreadyClaimed.selector, id, alice));
        markets.claim(id);
    }

    function test_claim_rejectsUnresolvedAndStrangers() public {
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.MarketNotResolved.selector, id));
        markets.claim(id);

        _bet(alice, Side.Yes, ONE);
        _settle(Outcome.Yes, RATE);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.NothingToClaim.selector, id, bob));
        markets.claim(id);
    }

    function test_sponsor_rejectedOnceResolved() public {
        _settle(Outcome.Yes, RATE);
        _fund(carol, ONE);
        vm.prank(carol);
        vm.expectRevert(abi.encodeWithSelector(IPearnMarkets.MarketResolvedAlready.selector, id));
        markets.sponsor(id, uint128(ONE));
    }
}
