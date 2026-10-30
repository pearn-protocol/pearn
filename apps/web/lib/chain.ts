import { type Address, createPublicClient, erc20Abi, http } from "viem";
import { pearnMarketsAbi, rateOracleAbi } from "./abi.ts";
import { chain, contracts } from "./config.ts";
import { type Market, Side } from "./markets.ts";

export const publicClient = createPublicClient({ chain, transport: http() });

export type MarketWithId = Market & { id: bigint };

/** Every market, newest first. */
// ponytail: one read per market; an indexer or a paged view when there are hundreds.
export async function readMarkets(markets: Address): Promise<MarketWithId[]> {
	const count = await publicClient.readContract({
		address: markets,
		abi: pearnMarketsAbi,
		functionName: "marketCount",
	});
	const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i)).reverse();
	return Promise.all(ids.map((id) => readMarket(markets, id)));
}

export async function readMarket(markets: Address, id: bigint): Promise<MarketWithId> {
	const m = await publicClient.readContract({
		address: markets,
		abi: pearnMarketsAbi,
		functionName: "getMarket",
		args: [id],
	});
	return { ...m, id };
}

export type OracleState = { rate: bigint; updatedAt: number };

export async function readOracle(oracle: Address): Promise<OracleState> {
	const [rate, updatedAt] = await Promise.all([
		publicClient.readContract({ address: oracle, abi: rateOracleAbi, functionName: "rate" }),
		publicClient.readContract({ address: oracle, abi: rateOracleAbi, functionName: "updatedAt" }),
	]);
	return { rate, updatedAt: Number(updatedAt) };
}

export type Account = { balance: bigint; allowance: bigint };

export async function readAccount(markets: Address, owner: Address): Promise<Account> {
	const token = { address: contracts.stNear, abi: erc20Abi } as const;
	const [balance, allowance] = await Promise.all([
		publicClient.readContract({ ...token, functionName: "balanceOf", args: [owner] }),
		publicClient.readContract({ ...token, functionName: "allowance", args: [owner, markets] }),
	]);
	return { balance, allowance };
}

export type Position = Awaited<ReturnType<typeof readPosition>>;

/** One account's stake, sponsorship and payout in one market. */
export async function readPosition(markets: Address, id: bigint, owner: Address) {
	const c = { address: markets, abi: pearnMarketsAbi } as const;
	const [yes, no, sponsored, claimable, claimed] = await Promise.all([
		publicClient.readContract({ ...c, functionName: "positionOf", args: [id, owner, Side.Yes] }),
		publicClient.readContract({ ...c, functionName: "positionOf", args: [id, owner, Side.No] }),
		publicClient.readContract({ ...c, functionName: "sponsorshipOf", args: [id, owner] }),
		publicClient.readContract({ ...c, functionName: "claimable", args: [id, owner] }),
		publicClient.readContract({ ...c, functionName: "hasClaimed", args: [id, owner] }),
	]);
	return { yes, no, sponsored, claimable, claimed };
}

export async function readGuardian(markets: Address): Promise<Address> {
	return publicClient.readContract({
		address: markets,
		abi: pearnMarketsAbi,
		functionName: "guardian",
	});
}
