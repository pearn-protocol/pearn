import catalog from "@pearn/catalog/markets.json";
import { GAMMA } from "./reference.ts";

/** A market mirrored from Polymarket (packages/catalog, scripts/polymarket-catalog.mjs). */
export type Mirror = (typeof catalog)[number];

const byId = new Map(catalog.flatMap((c) => (c.id === null ? [] : [[c.id, c] as const])));

/** The Polymarket market `id` mirrors, if any. */
export const mirrorOf = (id: bigint): Mirror | undefined => byId.get(Number(id));

/** Every market's topic: a mirror's Polymarket topic, "Pearn" for markets made here. */
export const topicOf = (id: bigint) => mirrorOf(id)?.topic ?? "Pearn";

export const polymarketUrl = (m: Mirror) => `https://polymarket.com/market/${m.slug}`;

/** One Gamma query for the live price and volume of every mirror. */
export const REFERENCE_URL = `${GAMMA}/markets?${catalog
	.filter((c) => c.id !== null)
	.map((c) => `slug=${c.slug}`)
	.join("&")}`;
