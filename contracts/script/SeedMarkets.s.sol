// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Script} from "forge-std/Script.sol";

import {PearnMarkets} from "../src/PearnMarkets.sol";
import {Side} from "../src/types/Market.sol";

/// @notice Opens the testnet demo markets from deployments/<chainId>.json and places small bets
///         with the deployer's bridged stNEAR. The deployer resolves them; a DAO should on mainnet.
/// @dev Simulate, then replay through NEAR (no Aurora ETH needed):
///      forge script script/SeedMarkets.s.sol --rpc-url aurora_testnet --legacy
///      node ../scripts/aurora-submit.mjs broadcast/SeedMarkets.s.sol/1313161555/dry-run/run-latest.json
contract SeedMarkets is Script {
    uint128 internal constant TENTH = 1e23; // 0.1 stNEAR

    function run() external {
        uint256 key = vm.envUint("WALLET_PK");
        address deployer = vm.addr(key);
        string memory json =
            vm.readFile(string.concat("deployments/", vm.toString(block.chainid), ".json"));
        PearnMarkets markets = PearnMarkets(vm.parseJsonAddress(json, ".markets"));
        IERC20 stNear = markets.stNear();
        uint64 nowTs = uint64(block.timestamp);

        vm.startBroadcast(key);
        stNear.approve(address(markets), 10 * TENTH);
        uint256 near = markets.createMarket(
            "Will NEAR trade above $3 on CoinGecko at 2026-11-14 12:00 UTC?",
            1_794_657_600,
            deployer
        );
        uint256 hackathon = markets.createMarket(
            "Will NEAR HACKATHON 2026 announce its results by 2026-11-18?", 1_794_960_000, deployer
        );
        // Closes in two hours, so the whole lifecycle (resolve, window, claim) runs before judging.
        uint256 quick = markets.createMarket(
            "Lifecycle demo: will this market resolve YES?", nowTs + 2 hours, deployer
        );
        markets.bet(near, Side.Yes, 3 * TENTH);
        markets.bet(hackathon, Side.Yes, 2 * TENTH);
        markets.bet(quick, Side.Yes, TENTH);
        markets.bet(quick, Side.No, TENTH);
        markets.sponsor(quick, 2 * TENTH);
        vm.stopBroadcast();
    }
}
