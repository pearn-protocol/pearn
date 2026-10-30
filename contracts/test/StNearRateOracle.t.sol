// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {
    CURRENT_ACCOUNT_ID_PRECOMPILE,
    PROMISE_RESULT_PRECOMPILE,
    XCC_PRECOMPILE
} from "aurora-sdk/AuroraSdk.sol";
import {Codec} from "aurora-sdk/Codec.sol";
import {
    ExecutionMode,
    PromiseCreateArgs,
    PromiseResultStatus,
    PromiseWithCallback
} from "aurora-sdk/Types.sol";
import {Test} from "forge-std/Test.sol";

import {StNearRateOracle} from "../src/StNearRateOracle.sol";
import {MockToken} from "./mocks/MockToken.sol";

contract StNearRateOracleTest is Test {
    string internal constant META_POOL = "meta-pool.near";
    string internal constant ENGINE = "aurora";
    uint256 internal constant STORAGE = 2e24;
    uint256 internal constant T0 = 1_800_000_000;

    MockToken internal wNear;
    StNearRateOracle internal oracle;
    address internal keeper = makeAddr("keeper");

    function setUp() public {
        vm.warp(T0);
        // The precompiles exist only on Aurora: give them code and canned answers.
        vm.etch(XCC_PRECOMPILE, hex"00");
        vm.etch(CURRENT_ACCOUNT_ID_PRECOMPILE, hex"00");
        vm.etch(PROMISE_RESULT_PRECOMPILE, hex"00");
        vm.mockCall(XCC_PRECOMPILE, bytes(""), bytes(""));
        vm.mockCall(CURRENT_ACCOUNT_ID_PRECOMPILE, bytes(""), bytes(ENGINE));

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
        _deliver(PromiseResultStatus.Successful, '"1512824781611009660067554"');
        assertEq(oracle.rate(), 1_512_824_781_611_009_660_067_554);
        assertEq(oracle.updatedAt(), block.timestamp);
    }

    function test_onRate_onlyFromOwnXccAccount() public {
        vm.expectRevert(StNearRateOracle.NotCallback.selector);
        oracle.onRate();
    }

    function test_onRate_neverDecreases() public {
        _deliver(PromiseResultStatus.Successful, '"1500"');
        uint64 syncedAt = oracle.updatedAt();
        vm.warp(T0 + 1 days);

        vm.expectEmit(address(oracle));
        emit StNearRateOracle.RateRejected(1499, 1500);
        _deliver(PromiseResultStatus.Successful, '"1499"');
        assertEq(oracle.rate(), 1500);
        assertEq(oracle.updatedAt(), syncedAt);
    }

    function test_onRate_equalReadingRefreshesTimestamp() public {
        _deliver(PromiseResultStatus.Successful, '"1500"');
        uint256 later = T0 + 1 days;
        vm.warp(later);
        _deliver(PromiseResultStatus.Successful, '"1500"');
        assertEq(oracle.updatedAt(), later);
    }

    function test_onRate_failedViewLeavesRate() public {
        _deliver(PromiseResultStatus.Successful, '"1500"');
        vm.expectEmit(address(oracle));
        emit StNearRateOracle.SyncFailed();
        _deliver(PromiseResultStatus.Failed, "");
        assertEq(oracle.rate(), 1500);
    }

    // ─── helpers ─────────────────────────────────────────────────────────────

    function _fundFirstSync() internal {
        wNear.mint(keeper, STORAGE);
        vm.prank(keeper);
        wNear.approve(address(oracle), STORAGE);
    }

    /// @dev Calls `onRate` as the XCC router would, with one promise result in Borsh.
    function _deliver(PromiseResultStatus status, bytes memory output) internal {
        bytes memory result = abi.encodePacked(bytes4(0x01000000), uint8(status));
        if (status == PromiseResultStatus.Successful) {
            result = abi.encodePacked(result, _u32le(output.length), output);
        }
        vm.mockCall(PROMISE_RESULT_PRECOMPILE, bytes(""), result);
        vm.prank(oracle.callbackCaller());
        oracle.onRate();
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

    /// @dev keccak of "<lowercase hex address>.aurora", last 20 bytes: Aurora's XCC account.
    function _xccImplicitAddress(address account) internal pure returns (address) {
        bytes memory hex0x = bytes(Strings.toHexString(account));
        bytes memory hexNoPrefix = new bytes(40);
        for (uint256 i; i < 40; ++i) {
            hexNoPrefix[i] = hex0x[i + 2];
        }
        return address(uint160(uint256(keccak256(abi.encodePacked(hexNoPrefix, ".", ENGINE)))));
    }

    function _u32le(uint256 value) internal pure returns (bytes4) {
        return bytes4(
            uint32(
                (value & 0xff) << 24 | (value >> 8 & 0xff) << 16 | (value >> 16 & 0xff) << 8
                    | (value >> 24 & 0xff)
            )
        );
    }
}
