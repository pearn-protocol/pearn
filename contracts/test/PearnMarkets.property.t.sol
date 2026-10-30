// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Outcome, Side, Stake} from "../src/types/Market.sol";
import {PearnMarketsBase} from "./PearnMarketsBase.t.sol";

/// @notice Whole-lifecycle properties over random bets, sponsors, timings and rising rates.
contract PearnMarketsPropertyTest is PearnMarketsBase {
    struct BetInput {
        uint8 bettor;
        bool yes;
        uint96 amount;
        uint32 delay;
        uint64 rateRise;
    }

    address internal sponsorAccount = makeAddr("sponsor");
    address[4] internal bettors;

    function setUp() public override {
        super.setUp();
        bettors = [alice, bob, carol, makeAddr("dave")];
    }

    /// Every claim succeeds, every bettor gets at least their principal's NEAR value back,
    /// and the contract never pays out more than it received.
    function testFuzz_noLossAndSolvent(
        BetInput[6] calldata inputs,
        uint96 sponsorAmount,
        uint8 outcomeSeed,
        uint64 finalRise
    ) public {
        uint256 rate = RATE;
        uint256 at = closeTime - DURATION;
        uint256 totalIn;

        for (uint256 i; i < inputs.length; ++i) {
            BetInput calldata input = inputs[i];
            at += bound(input.delay, 0, DURATION / 7);
            rate += bound(input.rateRise, 0, 1e21);
            _warpAndSync(at, rate);

            uint256 amount = bound(input.amount, 1e18, 1e30);
            _bet(bettors[input.bettor % 4], input.yes ? Side.Yes : Side.No, amount);
            totalIn += amount;
        }

        uint256 sponsored = bound(sponsorAmount, 0, 1e28);
        if (sponsored != 0) {
            _sponsor(sponsorAccount, sponsored);
            totalIn += sponsored;
        }

        uint256 settlementRate = rate + bound(finalRise, 0, 1e23);
        _settle(Outcome(bound(outcomeSeed, 1, 3)), settlementRate);

        uint256 totalPaid;
        for (uint256 i; i < bettors.length; ++i) {
            uint256 principal = _principalOf(bettors[i]);
            if (principal == 0) continue;

            uint256 expected = markets.claimable(id, bettors[i]);
            uint256 paid = _claim(bettors[i]);
            assertEq(paid, expected, "claim == claimable");
            assertGe(paid * settlementRate / ONE + 2, principal, "principal value returned");
            totalPaid += paid;
        }

        assertLe(totalPaid, totalIn, "never pays out more than it holds");
        assertEq(stNear.balanceOf(address(markets)), totalIn - totalPaid);
    }

    function _principalOf(address bettor) internal view returns (uint256) {
        Stake memory yes = markets.positionOf(id, bettor, Side.Yes);
        Stake memory no = markets.positionOf(id, bettor, Side.No);
        return uint256(yes.principal) + no.principal;
    }
}
