/** The newest markets from the Ponder indexer, shaped for the landing's cards. */
import catalog from "@pearn/catalog/markets.json" with { type: "json" };

export type RawMarket = {
	id: string;
	question: string;
	closeTime: string;
	outcome: number;
	/** Unix seconds, null until resolved. */
	resolvedAt: string | null;
	yesStaked: string;
	noStaked: string;
	yesPrincipal: string;
	noPrincipal: string;
	sponsored: string;
	bets: number;
};

export type Card = {
	id: string;
	question: string;
	status: string;
	/** YES share of the principal (NEAR value at bet time), 0–100, as in the app; null before the first bet. */
	yes: number | null;
	staked: string;
	/** The same total in USD at stNEAR's mainnet price, null without a price. */
	usd: string | null;
	bets: number;
	/** The mirrored Polymarket market's topic, "Pearn" for markets made on Pearn. */
	topic: string;
	/** Its image under /markets/, null for markets made on Pearn. */
	image: string | null;
	/** Polymarket's Yes chance, 0–100, for a mirror once Polymarket answered. */
	chance: number | null;
};

const OUTCOMES = ["", "Resolved YES", "Resolved NO", "Invalid"];
const UNIT = 10n ** 24n;
/** PearnMarkets.CHALLENGE_WINDOW: the guardian may still turn the outcome into Invalid. */
const CHALLENGE_WINDOW = 86_400;

export const PRICE_URL =
	"https://api.coingecko.com/api/v3/simple/price?ids=staked-near&vs_currencies=usd";

/** stNEAR raw units at `price` USD each: "$2.36", "< $0.01" for dust. */
export function usd(raw: bigint, price: number): string {
	const value = (Number(raw) / 1e24) * price;
	if (value > 0 && value < 0.01) return "< $0.01";
	return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export const GAMMA = "https://gamma-api.polymarket.com";
const mirrors = new Map(
	catalog.flatMap((c) => (c.id === null ? [] : [[String(c.id), c] as const])),
);

/** Gamma's market list to slug → Yes chance in whole percent. */
export function chances(rows: { slug: string; outcomePrices?: string }[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const r of rows) {
		const yes = Number(JSON.parse(r.outcomePrices ?? "[]")[0]);
		if (Number.isFinite(yes)) out.set(r.slug, Math.round(yes * 100));
	}
	return out;
}

export const QUERY = `{
	markets(orderBy: "id", orderDirection: "desc", limit: 3) {
		items { id question closeTime outcome resolvedAt yesStaked noStaked yesPrincipal noPrincipal sponsored bets }
	}
}`;

/** stNEAR raw units (1e24) to "1.23". */
export function stNear(raw: bigint): string {
	const hundredths = (raw * 100n) / UNIT;
	return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}

function statusOf(m: RawMarket, now: number): string {
	if (m.outcome === 0) return Number(m.closeTime) > now ? "Open" : "Awaiting result";
	if (now < Number(m.resolvedAt ?? 0) + CHALLENGE_WINDOW) return "Challenge window";
	return OUTCOMES[m.outcome];
}

export function toCard(
	m: RawMarket,
	now: number,
	price: number | null = null,
	polymarket: Map<string, number> = new Map(),
): Card {
	const mirror = mirrors.get(m.id);
	const yes = BigInt(m.yesPrincipal);
	const principal = yes + BigInt(m.noPrincipal);
	const total = BigInt(m.yesStaked) + BigInt(m.noStaked) + BigInt(m.sponsored);
	return {
		id: m.id,
		question: m.question,
		status: statusOf(m, now),
		yes: principal === 0n ? null : Number((yes * 100n) / principal),
		staked: stNear(total),
		usd: price === null ? null : usd(total, price),
		bets: m.bets,
		topic: mirror?.topic ?? "Pearn",
		image: mirror ? `/markets/${mirror.image}` : null,
		chance: mirror ? (polymarket.get(mirror.slug) ?? null) : null,
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
	const items = data.markets.items;
	const [price, polymarket] = await Promise.all([
		fetchPrice().catch(() => null),
		fetchChances(items.flatMap((m) => mirrors.get(m.id)?.slug ?? [])).catch(() => new Map()),
	]);
	return items.map((m) => toCard(m, now, price, polymarket));
}

/** Polymarket's live Yes chance for the mirrored markets among the cards. */
async function fetchChances(slugs: string[]): Promise<Map<string, number>> {
	if (!slugs.length) return new Map();
	const r = await fetch(`${GAMMA}/markets?${slugs.map((s) => `slug=${s}`).join("&")}`);
	if (!r.ok) throw new Error(`Polymarket answered ${r.status}`);
	return chances(await r.json());
}

/** stNEAR's mainnet price in USD; testnet stNEAR has no market of its own. */
async function fetchPrice(): Promise<number> {
	const r = await fetch(PRICE_URL);
	const price = ((await r.json()) as { "staked-near"?: { usd?: number } })["staked-near"]?.usd;
	if (!r.ok || !price) throw new Error("no price");
	return price;
}
