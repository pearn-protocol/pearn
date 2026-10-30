// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

import {PearnMarkets} from "../src/PearnMarkets.sol";
import {Outcome, Side} from "../src/types/Market.sol";
import {MockRateOracle} from "./mocks/MockRateOracle.sol";
import {MockStNear} from "./mocks/MockStNear.sol";

/// @dev Shared fixture: one market closing in 30 days at a 1.5 NEAR stNEAR rate.
abstract contract PearnMarketsBase is Test {
    uint256 internal constant ONE = 1e24;
    uint256 internal constant RATE = 1.5e24;
    uint64 internal constant DURATION = 30 days;

    MockStNear internal stNear;
    MockRateOracle internal oracle;
    PearnMarkets internal markets;

    address internal guardian = makeAddr("guardian");
    address internal resolver = makeAddr("resolver");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal id;
    uint64 internal closeTime;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        stNear = new MockStNear();
        oracle = new MockRateOracle();
        oracle.set(RATE);
        markets = new PearnMarkets(stNear, oracle, guardian);

        closeTime = uint64(block.timestamp) + DURATION;
        id = markets.createMarket("Will NEAR ship X by Q1?", closeTime, resolver);
    }

    function _fund(address who, uint256 amount) internal {
        stNear.mint(who, amount);
        vm.prank(who);
        stNear.approve(address(markets), type(uint256).max);
    }

    function _bet(address who, Side side, uint256 amount) internal {
        _fund(who, amount);
        vm.prank(who);
        markets.bet(id, side, uint128(amount));
    }

    function _sponsor(address who, uint256 amount) internal {
        _fund(who, amount);
        vm.prank(who);
        markets.sponsor(id, uint128(amount));
    }

    /// @dev Moves time forward the way production does: the keeper re-syncs the oracle.
    function _warpAndSync(uint256 timestamp, uint256 rate) internal {
        vm.warp(timestamp);
        oracle.set(rate);
    }

    /// @dev Close, sync the oracle at `rate`, resolve and wait out the challenge window.
    function _settle(Outcome outcome, uint256 rate) internal {
        _warpAndSync(closeTime, rate);
        vm.prank(resolver);
        markets.resolve(id, outcome);
        vm.warp(block.timestamp + markets.CHALLENGE_WINDOW());
    }

    function _claim(address who) internal returns (uint256) {
        vm.prank(who);
        return markets.claim(id);
    }
}

