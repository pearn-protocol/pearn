import type { Address, Hash } from "viem";

/**
 * Reads from the Ponder indexer (apps/indexer). Everything here is history and lookup; balances
 * and payouts always come from the chain, and every caller works without the indexer.
 */

export type Activity = {
	kind: "create" | "bet" | "sponsor" | "resolve" | "override" | "claim";
	account: Address | null;
	/** Side for bets (0 Yes, 1 No); outcome for resolve and override. */
	side: number | null;
	amount: bigint | null;
	timestamp: number;
	txHash: Hash;
};

type RawActivity = Omit<Activity, "amount" | "timestamp"> & {
	amount: string | null;
	timestamp: string;
};

async function gql<T>(url: string, query: string, variables: Record<string, unknown>): Promise<T> {
	const r = await fetch(`${url}/graphql`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query, variables }),
	});
	if (!r.ok) throw new Error(`indexer answered ${r.status}`);
	const { data, errors } = await r.json();
	if (errors?.length) throw new Error(errors[0].message);
	return data as T;
}

export const parseActivity = (a: RawActivity): Activity => ({
	...a,
	amount: a.amount === null ? null : BigInt(a.amount),
	timestamp: Number(a.timestamp),
});

/** A market's events, newest first. */
export async function readActivity(url: string, marketId: bigint, limit = 20): Promise<Activity[]> {
	const data = await gql<{ activitys: { items: RawActivity[] } }>(
		url,
		`query ($id: BigInt!, $limit: Int!) {
			activitys(where: { marketId: $id }, orderBy: "timestamp", orderDirection: "desc", limit: $limit) {
				items { kind account side amount timestamp txHash }
			}
		}`,
		{ id: marketId.toString(), limit },
	);
	return data.activitys.items.map(parseActivity);
}

/** Ids of the markets an account bet on or sponsored. */
export async function readAccountMarkets(url: string, account: Address): Promise<bigint[]> {
	const data = await gql<{ participants: { items: { marketId: string }[] } }>(
		url,
		`query ($account: String!) {
			participants(where: { account: $account }, limit: 1000) { items { marketId } }
		}`,
		{ account: account.toLowerCase() },
	);
	return data.participants.items.map((p) => BigInt(p.marketId));
}
