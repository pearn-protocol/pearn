// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev A NEP-141 token bridged to Aurora (stNEAR, wNEAR): 24 decimals, open mint for tests.
contract MockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function decimals() public pure override returns (uint8) {
        return 24;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
