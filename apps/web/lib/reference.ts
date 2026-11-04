/** Polymarket's public market data (Gamma); the app reads prices and volume, nothing else. */
export const GAMMA = "https://gamma-api.polymarket.com";

/** Polymarket's Yes chance (0–100) and lifetime volume in USD. */
export type Reference = { yes: number; volume: number };

type GammaMarket = { slug: string; outcomePrices?: string; volumeNum?: number };

/** Gamma's market list to slug → reference; markets without a usable price are left out. */
export function parseReferences(rows: GammaMarket[]): Map<string, Reference> {
	const out = new Map<string, Reference>();
	for (const r of rows) {
		const yes = Number(JSON.parse(r.outcomePrices ?? "[]")[0]);
		if (Number.isFinite(yes))
			out.set(r.slug, { yes: Math.round(yes * 100), volume: r.volumeNum ?? 0 });
	}
	return out;
}

export async function fetchReferences(url: string): Promise<Map<string, Reference>> {
	const r = await fetch(url);
	if (!r.ok) throw new Error(`Polymarket answered ${r.status}`);
	return parseReferences(await r.json());
}

/** "$37.3M", "$850K", "$900". */
export const usdCompact = (v: number) =>
	`$${new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v)}`;
