// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console2} from "forge-std/Script.sol";

import {PearnMarkets} from "../src/PearnMarkets.sol";
import {Side} from "../src/types/Market.sol";
import {MockRateOracle} from "../test/mocks/MockRateOracle.sol";
import {MockToken} from "../test/mocks/MockToken.sol";

/// @notice A local Pearn for the web app: mock stNEAR and oracle, PearnMarkets, three markets
///         with bets from anvil's first accounts, recorded in deployments/31337.json.
///         Never for a real network.
/// @dev anvil, then: forge script script/DevChain.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///      `pnpm dev:local` in apps/web does all of it.
contract DevChain is Script {
    /// anvil's public test mnemonic.
    string internal constant MNEMONIC =
        "test test test test test test test test test test test junk";
    uint256 internal constant ONE = 1e24;
    uint256 internal constant RATE = 1.5128e24;

    function run() external {
        require(block.chainid == 31_337, "DevChain: local anvil only");
        uint256 deployerKey = vm.deriveKey(MNEMONIC, 0);
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);
        MockToken stNear = new MockToken("Staked NEAR", "stNEAR");
        MockRateOracle oracle = new MockRateOracle();
        oracle.set(RATE);
        PearnMarkets markets = new PearnMarkets(stNear, oracle, deployer);
        for (uint32 i; i < 3; ++i) {
            stNear.mint(vm.addr(vm.deriveKey(MNEMONIC, i)), 1000 * ONE);
        }
        uint64 day = 1 days;
        markets.createMarket(
            "Will NEAR trade above $5 on December 1, 2026?", _in(30 * day), deployer
        );
        markets.createMarket(
            "Will Aurora pass 1M transactions in a day before 2027?", _in(60 * day), deployer
        );
        uint256 soon = markets.createMarket("Will it rain in Jakarta tomorrow?", _in(day), deployer);
        stNear.approve(address(markets), 100 * ONE);
        markets.sponsor(soon, uint128(100 * ONE));
        vm.stopBroadcast();

        _bet(markets, stNear, 1, 0, Side.Yes, 120 * ONE);
        _bet(markets, stNear, 2, 0, Side.No, 80 * ONE);
        _bet(markets, stNear, 1, 1, Side.No, 40 * ONE);
        _bet(markets, stNear, 2, soon, Side.Yes, 25 * ONE);

        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "stNear", address(stNear));
        vm.serializeAddress(key, "guardian", deployer);
        vm.serializeAddress(key, "oracle", address(oracle));
        string memory json = vm.serializeAddress(key, "markets", address(markets));
        vm.writeJson(json, "deployments/31337.json");
        console2.log("PearnMarkets", address(markets));
    }

    function _bet(
        PearnMarkets markets,
        MockToken stNear,
        uint32 account,
        uint256 id,
        Side side,
        uint256 amount
    ) private {
        vm.startBroadcast(vm.deriveKey(MNEMONIC, account));
        stNear.approve(address(markets), amount);
        markets.bet(id, side, uint128(amount));
        vm.stopBroadcast();
    }

    function _in(uint64 seconds_) private view returns (uint64) {
        return uint64(block.timestamp) + seconds_;
    }
}
