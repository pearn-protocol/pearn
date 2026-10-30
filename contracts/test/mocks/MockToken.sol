// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Bridged stNEAR stand-in: 24 decimals, open mint for tests.
contract MockStNear is ERC20("Staked NEAR", "STNEAR") {
    function decimals() public pure override returns (uint8) {
        return 24;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
