import { type Address, defineChain, getAddress } from "viem";
import { aurora, auroraTestnet, foundry } from "viem/chains";

/**
 * Networks the app runs on. Aurora's explorers are Blockscout, where the contracts are
 * verified; stNEAR is the bridged token verified on chain (DESIGN.md §2). `foundry` is the
 * local anvil from `pnpm dev:local`, whose mock stNEAR address comes from the env.
 */
const NETWORKS = {
	[aurora.id]: {
		base: aurora,
		explorer: "https://explorer.mainnet.aurora.dev",
		stNear: "0x07f9f7f963c5cd2bbffd30ccfb964be114332e30",
	},
	[auroraTestnet.id]: {
		base: auroraTestnet,
		explorer: "https://explorer.testnet.aurora.dev",
		stNear: "0x2137df2e54abd6bf1c1a8c1739f2ea6a8c15f144",
	},
	[foundry.id]: { base: foundry, explorer: "http://127.0.0.1:8545", stNear: null },
} as const;

const network =
	NETWORKS[Number(process.env.NEXT_PUBLIC_CHAIN_ID) as keyof typeof NETWORKS] ??
	NETWORKS[auroraTestnet.id];

/** NEXT_PUBLIC_RPC_URL overrides the network's public RPC. */
const rpc = process.env.NEXT_PUBLIC_RPC_URL?.trim();

export const chain = defineChain({
	...network.base,
	...(rpc && { rpcUrls: { default: { http: [rpc] } } }),
	blockExplorers: { default: { name: "Blockscout", url: network.explorer } },
});

function address(raw: string | null | undefined): Address | null {
	return raw?.trim() ? getAddress(raw.trim()) : null;
}

const stNear = address(process.env.NEXT_PUBLIC_STNEAR || network.stNear);
if (!stNear) throw new Error("NEXT_PUBLIC_STNEAR is required on a local chain");

/** Contract addresses, baked in at build time from contracts/deployments/<chainId>.json. */
export const contracts = {
	markets: address(process.env.NEXT_PUBLIC_MARKETS),
	oracle: address(process.env.NEXT_PUBLIC_ORACLE),
	stNear,
};

/** The Ponder indexer (apps/indexer); null means the app reads the chain only. */
export const INDEXER_URL = process.env.NEXT_PUBLIC_INDEXER_URL?.trim().replace(/\/$/, "") || null;

export const explorerAddress = (a: Address) => `${chain.blockExplorers.default.url}/address/${a}`;
export const explorerTx = (hash: string) => `${chain.blockExplorers.default.url}/tx/${hash}`;

/** Where users get stNEAR: stake NEAR at Meta Pool, then bridge it to Aurora. */
export const GET_STNEAR_URL = "https://www.metapool.app/stake/?token=near";

export const POLL_MS = 15_000;
