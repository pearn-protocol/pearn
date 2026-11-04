import { type Mirror, mirrorOf, topicOf } from "./catalog.ts";
import type { MarketWithId } from "./chain.ts";
import { yesPercent } from "./markets.ts";
import type { Reference } from "./reference.ts";

/** A market as the home page shows it: its mirror and Polymarket's live price, if any. */
export type Listed = {
	m: MarketWithId;
	mirror?: Mirror;
	ref?: Reference;
	topic: string;
	/**
	 * The chance the card shows: Polymarket's Yes price for a mirror, else YES's share of the
	 * stake here; null for an unmirrored market nobody bet on yet.
	 */
	chance: number | null;
	chanceLabel: string;
};

export function listed(m: MarketWithId, references: Map<string, Reference>): Listed {
	const mirror = mirrorOf(m.id);
	const ref = mirror && references.get(mirror.slug);
	const staked = m.yes.principal + m.no.principal > 0n;
	return {
		m,
		mirror,
		ref,
		topic: topicOf(m.id),
		chance: ref ? ref.yes : staked ? yesPercent(m) : null,
		chanceLabel: ref ? "chance" : "on yes",
	};
}

/** Open markets first, then by Polymarket volume (mirrors), then newest. */
export function byInterest(a: Listed, b: Listed, now: number): number {
	const open = (x: Listed) => (now < Number(x.m.closeTime) && x.m.outcome === 0 ? 0 : 1);
	return (
		open(a) - open(b) ||
		(b.ref?.volume ?? 0) - (a.ref?.volume ?? 0) ||
		Number(b.m.id) - Number(a.m.id)
	);
}
