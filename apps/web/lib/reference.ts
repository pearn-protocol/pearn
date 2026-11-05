/** Polymarket's public market data (Gamma); the app reads prices and volume, nothing else. */
export const GAMMA = "https://gamma-api.polymarket.com";

/** Polymarket's price history (CLOB), for the chart. */
export const CLOB = "https://clob.polymarket.com";

/** Polymarket's Yes chance (0–100), lifetime volume in USD and the Yes token (for history). */
export type Reference = { yes: number; volume: number; token?: string };

type GammaMarket = {
	slug: string;
	outcomePrices?: string;
	volumeNum?: number;
	clobTokenIds?: string;
};

/** Gamma's market list to slug → reference; markets without a usable price are left out. */
export function parseReferences(rows: GammaMarket[]): Map<string, Reference> {
	const out = new Map<string, Reference>();
	for (const r of rows) {
		const yes = Number(JSON.parse(r.outcomePrices ?? "[]")[0]);
		const token: string | undefined = JSON.parse(r.clobTokenIds ?? "[]")[0];
		if (Number.isFinite(yes))
			out.set(r.slug, { yes: Math.round(yes * 100), volume: r.volumeNum ?? 0, token });
	}
	return out;
}

export async function fetchReferences(url: string): Promise<Map<string, Reference>> {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`Polymarket answered ${r.status}`);
	return parseReferences(await r.json());
}

type History = { history: { t: number; p: number }[] };

async function history(token: string, query: string): Promise<History["history"]> {
	const r = await fetch(`${CLOB}/prices-history?market=${encodeURIComponent(token)}&${query}`);
	if (!r.ok) throw new Error(`Polymarket answered ${r.status}`);
	return ((await r.json()) as History).history;
}

/** Fine points override coarse ones from the first fine point on; prices become percents. */
export const mergeHistory = (coarse: History["history"], fine: History["history"]) => {
	const from = fine[0]?.t ?? Number.POSITIVE_INFINITY;
	return [...coarse.filter((h) => h.t < from), ...fine]
		.filter((h) => Number.isFinite(h.t) && Number.isFinite(h.p))
		.map((h) => ({ t: h.t, p: h.p * 100 }));
};

/**
 * The Yes token's price history: the whole life every 12 hours (finer is cut to a month by
 * the CLOB) and the last week every 15 minutes, for the short ranges.
 */
export async function fetchHistory(token: string) {
	const [coarse, fine] = await Promise.all([
		history(token, "interval=max&fidelity=720"),
		history(token, "interval=1w&fidelity=15"),
	]);
	return mergeHistory(coarse, fine);
}

/** "$37.3M", "$850K", "$900". */
export const usdCompact = (v: number) =>
	`$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
