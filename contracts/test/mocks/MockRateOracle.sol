// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IRateOracle} from "../../src/interfaces/IRateOracle.sol";

/// @dev Settable oracle; `set` stamps the current block time like a real sync.
contract MockRateOracle is IRateOracle {
    uint256 public rate;
    uint64 public updatedAt;

    function set(uint256 rate_) external {
        rate = rate_;
        updatedAt = uint64(block.timestamp);
    }
}
