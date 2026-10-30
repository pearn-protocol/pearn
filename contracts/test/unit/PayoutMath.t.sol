// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {PayoutMath} from "../../src/libraries/PayoutMath.sol";
import {Test} from "forge-std/Test.sol";

contract PayoutMathTest is Test {
    uint256 internal constant ONE = 1e24;
    uint256 internal constant MAX_STAKED = 1e33; // 1e9 stNEAR
    uint256 internal constant MIN_RATE = 1e24; // stNEAR never trades below 1 NEAR
    uint256 internal constant MAX_RATE = 1e26;

    function test_principalOf_scalesByRate() public pure {
        assertEq(PayoutMath.principalOf(2 * ONE, 1.5e24), 3 * ONE);
    }

    function test_weightOf_isPrincipalTimesSecondsLeft() public pure {
        assertEq(PayoutMath.weightOf(10, 100, 160), 600);
        assertEq(PayoutMath.weightOf(10, 160, 160), 0);
    }

    function test_reserveOf_roundsUp_refundOf_roundsDown() public pure {
        // 1 yocto principal at rate 3 NEAR: exact value is 1/3 yocto-stNEAR.
        assertEq(PayoutMath.reserveOf(1, 3e24), 1);
        assertEq(PayoutMath.refundOf(1, 3e24), 0);
    }

    function test_potOf_addsSponsorsAndClampsAtZero() public pure {
        assertEq(PayoutMath.potOf(100, 90, 5), 15);
        assertEq(PayoutMath.potOf(90, 100, 5), 5);
    }

    function test_shareOf_zeroTotalWeightPaysNothing() public pure {
        assertEq(PayoutMath.shareOf(100, 0, 0), 0);
        assertEq(PayoutMath.shareOf(100, 1, 3), 33);
    }

    /// A bet's refund never exceeds what it staked while the rate only rises.
    function testFuzz_refundNeverExceedsStaked(uint256 staked, uint256 betRate, uint256 rise)
        public
        pure
    {
        staked = bound(staked, 1, MAX_STAKED);
        betRate = bound(betRate, MIN_RATE, MAX_RATE);
        uint256 settlementRate = betRate + bound(rise, 0, MAX_RATE);

        uint256 principal = PayoutMath.principalOf(staked, betRate);
        assertLe(PayoutMath.refundOf(principal, settlementRate), staked);
    }

    /// The reserve covers every individual refund, so floor(Σ) ≤ ceil(Σ).
    function testFuzz_reserveCoversRefunds(uint256 a, uint256 b, uint256 c, uint256 rate)
        public
        pure
    {
        a = bound(a, 0, MAX_STAKED);
        b = bound(b, 0, MAX_STAKED);
        c = bound(c, 0, MAX_STAKED);
        rate = bound(rate, MIN_RATE, MAX_RATE);

        uint256 refunds = PayoutMath.refundOf(a, rate) + PayoutMath.refundOf(b, rate)
            + PayoutMath.refundOf(c, rate);
        assertLe(refunds, PayoutMath.reserveOf(a + b + c, rate));
    }

    /// Shares of a pot never sum past the pot.
    function testFuzz_sharesNeverExceedPot(uint256 pot, uint256 w1, uint256 w2) public pure {
        pot = bound(pot, 0, MAX_STAKED);
        w1 = bound(w1, 0, type(uint128).max);
        w2 = bound(w2, 0, type(uint128).max);
        uint256 total = w1 + w2;

        assertLe(PayoutMath.shareOf(pot, w1, total) + PayoutMath.shareOf(pot, w2, total), pot);
    }
}
