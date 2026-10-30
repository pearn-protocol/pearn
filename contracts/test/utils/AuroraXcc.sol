// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {
    CURRENT_ACCOUNT_ID_PRECOMPILE,
    PROMISE_RESULT_PRECOMPILE,
    XCC_PRECOMPILE
} from "aurora-sdk/AuroraSdk.sol";
import {PromiseResultStatus} from "aurora-sdk/Types.sol";
import {Test} from "forge-std/Test.sol";

import {StNearRateOracle} from "../../src/StNearRateOracle.sol";

/// @dev Stands in for Aurora's precompiles, which exist only on Aurora itself, and plays the
///      XCC router's part: delivering a NEAR promise result to `onRate`.
abstract contract AuroraXcc is Test {
    string internal constant ENGINE = "aurora";

    function _mockAuroraPrecompiles() internal {
        vm.etch(XCC_PRECOMPILE, hex"00");
        vm.etch(CURRENT_ACCOUNT_ID_PRECOMPILE, hex"00");
        vm.etch(PROMISE_RESULT_PRECOMPILE, hex"00");
        vm.mockCall(XCC_PRECOMPILE, bytes(""), bytes(""));
        vm.mockCall(CURRENT_ACCOUNT_ID_PRECOMPILE, bytes(""), bytes(ENGINE));
    }

    /// @dev Calls `onRate` as the XCC router would, with one promise result in Borsh.
    function _deliver(StNearRateOracle oracle, PromiseResultStatus status, bytes memory output)
        internal
    {
        bytes memory result = abi.encodePacked(bytes4(0x01000000), uint8(status));
        if (status == PromiseResultStatus.Successful) {
            result = abi.encodePacked(result, _u32le(output.length), output);
        }
        vm.mockCall(PROMISE_RESULT_PRECOMPILE, bytes(""), result);
        vm.prank(oracle.callbackCaller());
        oracle.onRate();
    }

    /// @dev A successful `get_st_near_price` answer of `rate`.
    function _deliverRate(StNearRateOracle oracle, uint256 rate) internal {
        _deliver(
            oracle, PromiseResultStatus.Successful, abi.encodePacked('"', vm.toString(rate), '"')
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
