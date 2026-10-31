import { readFileSync } from "node:fs";
import { pearnMarketsAbi } from "@pearn/abi";
import { createConfig } from "ponder";

/**
 * Aurora testnet by default. PONDER_CHAIN_ID=31337 points it at a local anvil seeded by
 * DevChain.s.sol (the integration test does that). Addresses come from the deployment file.
 */
const chainId = Number(process.env.PONDER_CHAIN_ID ?? 1313161555);
const rpc = process.env.PONDER_RPC_URL ?? "https://testnet.aurora.dev";
/** The block PearnMarkets was created in on Aurora testnet (tx 0x1a2cfab0…). */
const startBlock = Number(process.env.PONDER_START_BLOCK ?? 275552040);

const deployment = JSON.parse(
	readFileSync(new URL(`../../contracts/deployments/${chainId}.json`, import.meta.url), "utf8"),
) as { markets: `0x${string}` };

export default createConfig({
	// PGlite on disk; PONDER_PGLITE_DIR gives each test run its own database.
	database: { kind: "pglite", directory: process.env.PONDER_PGLITE_DIR ?? ".ponder/pglite" },
	chains: { aurora: { id: chainId, rpc } },
	contracts: {
		PearnMarkets: {
			abi: pearnMarketsAbi,
			chain: "aurora",
			address: deployment.markets,
			startBlock,
		},
	},
});
