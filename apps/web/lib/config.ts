import { type Address, defineChain, getAddress } from "viem";
import { aurora, auroraTestnet } from "viem/chains";

/** Aurora's Blockscout explorers; contracts are verified there (DESIGN.md §2). */
const EXPLORERS = {
	[aurora.id]: "https://explorer.mainnet.aurora.dev",
	[auroraTestnet.id]: "https://explorer.testnet.aurora.dev",
} as const;

/** Bridged stNEAR on Aurora, verified on chain (DESIGN.md §2). */
const ST_NEAR = {
	[aurora.id]: "0x07f9f7f963c5cd2bbffd30ccfb964be114332e30",
	[auroraTestnet.id]: "0x2137df2e54abd6bf1c1a8c1739f2ea6a8c15f144",
} as const;

const base = Number(process.env.NEXT_PUBLIC_CHAIN_ID) === aurora.id ? aurora : auroraTestnet;

export const chain = defineChain({
	...base,
	blockExplorers: { default: { name: "Blockscout", url: EXPLORERS[base.id] } },
});

function address(raw: string | undefined): Address | null {
	return raw?.trim() ? getAddress(raw.trim()) : null;
}

/** Contract addresses, baked in at build time from contracts/deployments/<chainId>.json. */
export const contracts = {
	markets: address(process.env.NEXT_PUBLIC_MARKETS),
	oracle: address(process.env.NEXT_PUBLIC_ORACLE),
	stNear: getAddress(ST_NEAR[chain.id]),
};

export const explorerAddress = (a: Address) => `${chain.blockExplorers.default.url}/address/${a}`;
export const explorerTx = (hash: string) => `${chain.blockExplorers.default.url}/tx/${hash}`;

/** Where users get stNEAR: stake NEAR at Meta Pool, then bridge it to Aurora. */
export const GET_STNEAR_URL = "https://www.metapool.app/stake/?token=near";

export const POLL_MS = 15_000;
