// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Test} from "forge-std/Test.sol";

import {PearnMarkets} from "../../src/PearnMarkets.sol";
import {Outcome, Side} from "../../src/types/Market.sol";
import {MockRateOracle} from "../mocks/MockRateOracle.sol";

/// @notice Runs a market against the real bridged stNEAR ERC-20 on an Aurora fork, pinning the
///         token behaviour PearnMarkets relies on (transferFrom, transfer, balances).
/// @dev Needs `pnpm rpc:testnet` / `pnpm rpc:mainnet` (see foundry.toml). Aurora's precompiles
///      do not run on a fork, so the oracle is the mock; the real oracle is covered by the unit
///      and integration suites.
abstract contract BridgedStNearFork is Test {
    uint256 internal constant ONE = 1e24;

    IERC20 internal stNear;
    MockRateOracle internal oracle;
    PearnMarkets internal markets;

    address internal resolver = makeAddr("resolver");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    function _rpcAlias() internal pure virtual returns (string memory);
    function _stNear() internal pure virtual returns (address);

    function setUp() public {
        vm.createSelectFork(_rpcAlias());
        stNear = IERC20(_stNear());
        oracle = new MockRateOracle();
        oracle.set(1.5e24);
        markets = new PearnMarkets(stNear, oracle, makeAddr("guardian"));
    }

    function test_bridgedToken_isLive() public view {
        assertGt(address(stNear).code.length, 0);
        assertGt(stNear.totalSupply(), 0);
    }

    function test_marketRoundTripsTheRealToken() public {
        uint64 close = uint64(block.timestamp) + 7 days;
        uint256 id = markets.createMarket("Fork round trip", close, resolver);
        _bet(alice, id, Side.Yes, 3 * ONE);
        _bet(bob, id, Side.No, 2 * ONE);
        assertEq(stNear.balanceOf(address(markets)), 5 * ONE);

        vm.warp(close);
        oracle.set(1.501e24);
        vm.prank(resolver);
        markets.resolve(id, Outcome.Yes);
        vm.warp(uint256(close) + markets.CHALLENGE_WINDOW());

        vm.prank(alice);
        uint256 alicePaid = markets.claim(id);
        vm.prank(bob);
        uint256 bobPaid = markets.claim(id);

        assertEq(stNear.balanceOf(alice), alicePaid);
        assertEq(stNear.balanceOf(bob), bobPaid);
        assertGt(alicePaid, 3 * ONE);
        assertLe(alicePaid + bobPaid, 5 * ONE);
    }

    function _bet(address who, uint256 id, Side side, uint256 amount) internal {
        deal(address(stNear), who, amount);
        vm.startPrank(who);
        stNear.approve(address(markets), amount);
        markets.bet(id, side, uint128(amount));
        vm.stopPrank();
    }
}

contract AuroraTestnetStNearFork is BridgedStNearFork {
    function _rpcAlias() internal pure override returns (string memory) {
        return "aurora_testnet";
    }

    function _stNear() internal pure override returns (address) {
        return 0x2137df2e54abd6bF1c1a8c1739f2EA6A8C15F144;
    }
}

contract AuroraMainnetStNearFork is BridgedStNearFork {
    function _rpcAlias() internal pure override returns (string memory) {
        return "aurora";
    }

    function _stNear() internal pure override returns (address) {
        return 0x07F9F7f963C5cD2BBFFd30CcfB964Be114332E30;
    }
}
