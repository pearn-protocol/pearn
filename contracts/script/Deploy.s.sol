// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script, console2} from "forge-std/Script.sol";

import {PearnMarkets} from "../src/PearnMarkets.sol";
import {StNearRateOracle} from "../src/StNearRateOracle.sol";
import {NetworkConfig, NetworkConfigs} from "./NetworkConfig.sol";

/// @notice Deploys StNearRateOracle and PearnMarkets and records them in deployments/.
/// @dev `pnpm rpc:testnet`, then:
///      forge script script/Deploy.s.sol --rpc-url aurora_testnet --broadcast
///      Env: WALLET_PK (deployer key), GUARDIAN (optional, defaults to the deployer).
contract Deploy is Script {
    function run() external returns (StNearRateOracle oracle, PearnMarkets markets) {
        uint256 deployerKey = vm.envUint("WALLET_PK");
        address deployer = vm.addr(deployerKey);
        address guardian = vm.envOr("GUARDIAN", deployer);
        NetworkConfig memory cfg = NetworkConfigs.forChain(block.chainid);

        vm.startBroadcast(deployerKey);
        oracle = new StNearRateOracle(IERC20(cfg.wNear), cfg.metaPool, cfg.engine);
        markets = new PearnMarkets(IERC20(cfg.stNear), oracle, guardian);
        vm.stopBroadcast();

        console2.log("StNearRateOracle", address(oracle));
        console2.log("PearnMarkets    ", address(markets));
        console2.log("guardian        ", guardian);
        _record(oracle, markets, guardian, cfg);
    }

    function _record(
        StNearRateOracle oracle,
        PearnMarkets markets,
        address guardian,
        NetworkConfig memory cfg
    ) private {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "stNear", cfg.stNear);
        vm.serializeAddress(key, "guardian", guardian);
        vm.serializeAddress(key, "oracle", address(oracle));
        string memory json = vm.serializeAddress(key, "markets", address(markets));
        vm.writeJson(json, string.concat("deployments/", vm.toString(block.chainid), ".json"));
    }
}
