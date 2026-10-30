// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {Test} from "forge-std/Test.sol";

import {NearJson} from "../../src/libraries/NearJson.sol";

/// @dev External entry point so reverts surface to `expectRevert`.
contract NearJsonHarness {
    function parseU128(bytes memory json) external pure returns (uint128) {
        return NearJson.parseU128(json);
    }
}

contract NearJsonTest is Test {
    NearJsonHarness internal harness = new NearJsonHarness();

    function test_parseU128_readsQuotedDecimal() public view {
        assertEq(
            harness.parseU128('"1512824781611009660067554"'), 1_512_824_781_611_009_660_067_554
        );
        assertEq(harness.parseU128('"0"'), 0);
        assertEq(harness.parseU128('"340282366920938463463374607431768211455"'), type(uint128).max);
    }

    function test_parseU128_rejectsMalformed() public {
        bytes[5] memory bad = [bytes(""), bytes('""'), bytes("123"), bytes('"12a"'), bytes('"-1"')];
        for (uint256 i; i < bad.length; ++i) {
            vm.expectRevert(NearJson.InvalidU128Json.selector);
            harness.parseU128(bad[i]);
        }
    }

    function test_parseU128_rejectsOverflow() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeCast.SafeCastOverflowedUintDowncast.selector,
                128,
                uint256(type(uint128).max) + 1
            )
        );
        harness.parseU128('"340282366920938463463374607431768211456"');
    }

    function testFuzz_parseU128_roundTrips(uint128 value) public view {
        assertEq(harness.parseU128(abi.encodePacked('"', vm.toString(uint256(value)), '"')), value);
    }
}
