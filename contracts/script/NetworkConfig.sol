// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Addresses Pearn needs on each Aurora network. Verified on chain on 2026-10-30
///         (`get_erc20_from_nep141` on the `aurora` engine; see DESIGN.md §2).
struct NetworkConfig {
    address stNear;
    address wNear;
    string metaPool;
    string engine;
}

library NetworkConfigs {
    uint256 internal constant AURORA_MAINNET = 1_313_161_554;
    uint256 internal constant AURORA_TESTNET = 1_313_161_555;

    error UnsupportedChain(uint256 chainId);

    function forChain(uint256 chainId) internal pure returns (NetworkConfig memory) {
        if (chainId == AURORA_MAINNET) {
            return NetworkConfig({
                stNear: 0x07F9F7f963C5cD2BBFFd30CcfB964Be114332E30,
                wNear: 0xC42C30aC6Cc15faC9bD938618BcaA1a1FaE8501d,
                metaPool: "meta-pool.near",
                engine: "aurora"
            });
        }
        if (chainId == AURORA_TESTNET) {
            return NetworkConfig({
                stNear: 0x2137df2e54abd6bF1c1a8c1739f2EA6A8C15F144,
                wNear: 0x4861825E75ab14553E5aF711EbbE6873d369d146,
                metaPool: "meta-v2.pool.testnet",
                engine: "aurora"
            });
        }
        revert UnsupportedChain(chainId);
    }
}
