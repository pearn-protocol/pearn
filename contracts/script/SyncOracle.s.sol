// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script, console2} from "forge-std/Script.sol";

import {StNearRateOracle} from "../src/StNearRateOracle.sol";
import {NetworkConfig, NetworkConfigs} from "./NetworkConfig.sol";

/// @notice One keeper sync. The very first one also approves the 2 wNEAR XCC storage deposit.
/// @dev forge script script/SyncOracle.s.sol --rpc-url aurora_testnet --broadcast
///      Env: WALLET_PK, ORACLE (defaults to deployments/<chainId>.json).
contract SyncOracle is Script {
    uint256 internal constant XCC_STORAGE = 2e24;

    function run() external {
        uint256 key = vm.envUint("WALLET_PK");
        StNearRateOracle oracle = StNearRateOracle(vm.envOr("ORACLE", _deployedOracle()));
        NetworkConfig memory cfg = NetworkConfigs.forChain(block.chainid);
        bool firstSync = !_xccInitialized(oracle);

        vm.startBroadcast(key);
        if (firstSync) IERC20(cfg.wNear).approve(address(oracle), XCC_STORAGE);
        oracle.sync();
        vm.stopBroadcast();

        console2.log("sync requested; first sync:", firstSync);
    }

    function _xccInitialized(StNearRateOracle oracle) private view returns (bool initialized) {
        (initialized,) = oracle.near();
    }

    function _deployedOracle() private view returns (address) {
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        return vm.parseJsonAddress(vm.readFile(path), ".oracle");
    }
}
