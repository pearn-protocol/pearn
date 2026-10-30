// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {XCC_PRECOMPILE} from "aurora-sdk/AuroraSdk.sol";
import {Codec} from "aurora-sdk/Codec.sol";
import {
    ExecutionMode,
    PromiseCreateArgs,
    PromiseResultStatus,
    PromiseWithCallback
} from "aurora-sdk/Types.sol";

import {StNearRateOracle} from "../../src/StNearRateOracle.sol";
import {MockToken} from "../mocks/MockToken.sol";
import {AuroraXcc} from "../utils/AuroraXcc.sol";

contract StNearRateOracleTest is AuroraXcc {
    string internal constant META_POOL = "meta-pool.near";
    uint256 internal constant STORAGE = 2e24;
    uint256 internal constant T0 = 1_800_000_000;

    MockToken internal wNear;
    StNearRateOracle internal oracle;
    address internal keeper = makeAddr("keeper");

    function setUp() public {
        vm.warp(T0);
        _mockAuroraPrecompiles();

        wNear = new MockToken("Wrapped NEAR", "wNEAR");
        oracle = new StNearRateOracle(wNear, META_POOL, ENGINE);
    }

    // ─── setup ───────────────────────────────────────────────────────────────

    function test_constructor_approvesPrecompileAndDerivesCallbackCaller() public view {
        assertEq(wNear.allowance(address(oracle), XCC_PRECOMPILE), type(uint256).max);
        assertEq(oracle.metaPool(), META_POOL);
        assertEq(oracle.callbackCaller(), _xccImplicitAddress(address(oracle)));
        assertEq(oracle.rate(), 0);
    }

    function test_constructor_rejectsEmptyAccountIds() public {
        vm.expectRevert(StNearRateOracle.EmptyAccountId.selector);
        new StNearRateOracle(wNear, "", ENGINE);
        vm.expectRevert(StNearRateOracle.EmptyAccountId.selector);
        new StNearRateOracle(wNear, META_POOL, "");
    }

    // ─── sync ────────────────────────────────────────────────────────────────

    function test_sync_schedulesViewWithCallback() public {
        _fundFirstSync();
        vm.expectCall(XCC_PRECOMPILE, _expectedXccInput());
        vm.expectEmit(address(oracle));
        emit StNearRateOracle.SyncRequested(keeper);
        vm.prank(keeper);
        oracle.sync();
    }

    function test_sync_firstCallerPaysXccStorageOnce() public {
        _fundFirstSync();
        vm.prank(keeper);
        oracle.sync();
        assertEq(wNear.balanceOf(address(oracle)), STORAGE);
        assertEq(wNear.balanceOf(keeper), 0);

        vm.prank(makeAddr("anyone"));
        oracle.sync(); // no wNEAR, no approval: later syncs are free
    }

    function test_sync_revertsWithoutStorageFunds() public {
        vm.expectRevert();
        oracle.sync();
    }

    // ─── onRate ──────────────────────────────────────────────────────────────

    function test_onRate_storesReading() public {
        _deliver(oracle, PromiseResultStatus.Successful, '"1512824781611009660067554"');
        assertEq(oracle.rate(), 1_512_824_781_611_009_660_067_554);
        assertEq(oracle.updatedAt(), block.timestamp);
    }

    function test_onRate_onlyFromOwnXccAccount() public {
        vm.expectRevert(StNearRateOracle.NotCallback.selector);
        oracle.onRate();
    }

    function test_onRate_neverDecreases() public {
        _deliver(oracle, PromiseResultStatus.Successful, '"1500"');
        uint64 syncedAt = oracle.updatedAt();
        vm.warp(T0 + 1 days);

        vm.expectEmit(address(oracle));
        emit StNearRateOracle.RateRejected(1499, 1500);
        _deliver(oracle, PromiseResultStatus.Successful, '"1499"');
        assertEq(oracle.rate(), 1500);
        assertEq(oracle.updatedAt(), syncedAt);
    }

    function test_onRate_equalReadingRefreshesTimestamp() public {
        _deliver(oracle, PromiseResultStatus.Successful, '"1500"');
        uint256 later = T0 + 1 days;
        vm.warp(later);
        _deliver(oracle, PromiseResultStatus.Successful, '"1500"');
        assertEq(oracle.updatedAt(), later);
    }

    function test_onRate_failedViewLeavesRate() public {
        _deliver(oracle, PromiseResultStatus.Successful, '"1500"');
        vm.expectEmit(address(oracle));
        emit StNearRateOracle.SyncFailed();
        _deliver(oracle, PromiseResultStatus.Failed, "");
        assertEq(oracle.rate(), 1500);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    function _fundFirstSync() internal {
        wNear.mint(keeper, STORAGE);
        vm.prank(keeper);
        wNear.approve(address(oracle), STORAGE);
    }

    function _expectedXccInput() internal view returns (bytes memory) {
        PromiseCreateArgs memory query =
            PromiseCreateArgs(META_POOL, "get_st_near_price", "{}", 0, oracle.VIEW_GAS());
        bytes memory callData = abi.encodeCall(StNearRateOracle.onRate, ());
        PromiseCreateArgs memory callback = PromiseCreateArgs(
            ENGINE,
            "call",
            abi.encodePacked(uint8(0), address(oracle), uint256(0), Codec.encode(callData)),
            0,
            oracle.CALLBACK_GAS()
        );
        return Codec.encodeCrossContractCallArgs(
            PromiseWithCallback(query, callback), ExecutionMode.Eager
        );
    }
}
