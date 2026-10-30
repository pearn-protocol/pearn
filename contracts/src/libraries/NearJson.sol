// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title NearJson
/// @notice Parses the JSON that NEAR view methods return.
library NearJson {
    error InvalidU128Json();

    /// @notice Parses a near-sdk `U128`, which serializes as a quoted decimal string: `"123"`.
    function parseU128(bytes memory json) internal pure returns (uint128) {
        uint256 length = json.length;
        if (length < 3 || length > 41 || json[0] != '"' || json[length - 1] != '"') {
            revert InvalidU128Json();
        }

        // At most 39 digits, so `value` cannot overflow uint256; SafeCast catches > uint128.
        uint256 value = 0;
        bool digitsOnly = true;
        for (uint256 i = 1; i < length - 1; ++i) {
            uint8 char = uint8(json[i]);
            bool isDigit = char >= 0x30 && char <= 0x39;
            digitsOnly = digitsOnly && isDigit;
            if (isDigit) value = value * 10 + (char - 0x30);
        }
        if (!digitsOnly) revert InvalidU128Json();
        return SafeCast.toUint128(value);
    }
}
