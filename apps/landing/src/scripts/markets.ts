/** The newest markets from the Ponder indexer, shaped for the landing's cards. */

export type RawMarket = {
	id: string;
	question: string;
	closeTime: string;
	outcome: number;
	yesStaked: string;
	noStaked: string;
	sponsored: string;
	bets: number;
};

export type Card = {
	id: string;
	question: string;
	status: string;
	/** YES share of the staked stNEAR, 0–100, or null before the first bet. */
	yes: number | null;
	staked: string;
	bets: number;
};

const OUTCOMES = ["", "Resolved YES", "Resolved NO", "Invalid"];
const UNIT = 10n ** 24n;

export const QUERY = `{
	markets(orderBy: "id", orderDirection: "desc", limit: 3) {
		items { id question closeTime outcome yesStaked noStaked sponsored bets }
	}
}`;

/** stNEAR raw units (1e24) to "1.23". */
export function stNear(raw: bigint): string {
	const hundredths = (raw * 100n) / UNIT;
	return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}

export function toCard(m: RawMarket, now: number): Card {
	const yes = BigInt(m.yesStaked);
	const total = yes + BigInt(m.noStaked);
	const status =
		m.outcome !== 0 ? OUTCOMES[m.outcome] : Number(m.closeTime) > now ? "Open" : "Awaiting result";
	return {
		id: m.id,
		question: m.question,
		status,
		yes: total === 0n ? null : Number((yes * 100n) / total),
		staked: stNear(total + BigInt(m.sponsored)),
		bets: m.bets,
	};
}

export async function fetchCards(indexer: string, now = Date.now() / 1000): Promise<Card[]> {
	const r = await fetch(`${indexer}/graphql`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query: QUERY }),
	});
	if (!r.ok) throw new Error(`indexer answered ${r.status}`);
	const { data } = (await r.json()) as { data?: { markets: { items: RawMarket[] } } };
	if (!data) throw new Error("indexer returned no data");
	return data.markets.items.map((m) => toCard(m, now));
}
