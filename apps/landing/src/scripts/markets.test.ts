import assert from "node:assert/strict";
import { test } from "node:test";
import catalog from "@pearn/catalog/markets.json" with { type: "json" };
import { chances, type RawMarket, stNear, toCard, usd } from "./markets.ts";

const E24 = 10n ** 24n;
const raw = (over: Partial<RawMarket>): RawMarket => ({
	id: "0",
	question: "Q?",
	closeTime: "1000",
	outcome: 0,
	resolvedAt: null,
	yesStaked: "0",
	noStaked: "0",
	yesPrincipal: "0",
	noPrincipal: "0",
	sponsored: "0",
	bets: 0,
	...over,
});

test("stNear rounds down to hundredths", () => {
	assert.equal(stNear(0n), "0.00");
	assert.equal(stNear((E24 * 123n) / 100n + 1n), "1.23");
	assert.equal(stNear(E24 * 12n + E24 / 20n), "12.05");
});

test("status follows close time, then the challenge window, then the outcome", () => {
	assert.equal(toCard(raw({}), 999).status, "Open");
	assert.equal(toCard(raw({}), 1000).status, "Awaiting result");
	const resolved = { resolvedAt: "2000" };
	assert.equal(toCard(raw({ outcome: 1, ...resolved }), 2000 + 86_399).status, "Challenge window");
	assert.equal(toCard(raw({ outcome: 1, ...resolved }), 2000 + 86_400).status, "Resolved YES");
	assert.equal(toCard(raw({ outcome: 2, ...resolved }), 1e9).status, "Resolved NO");
	assert.equal(toCard(raw({ outcome: 3, ...resolved }), 1e9).status, "Invalid");
});

test("YES share is by principal, like the app; the total is stake plus sponsorship", () => {
	// Equal stNEAR on both sides, but the YES bet came in at a higher rate.
	const c = toCard(
		raw({
			yesStaked: String(E24),
			noStaked: String(E24),
			yesPrincipal: String(3n * E24),
			noPrincipal: String(E24),
			sponsored: String(E24),
		}),
		0,
	);
	assert.equal(c.yes, 75);
	assert.equal(c.staked, "3.00");
	assert.equal(toCard(raw({ sponsored: String(E24) }), 0).yes, null);
});

test("usd values the total at the stNEAR price", () => {
	assert.equal(usd(0n, 5.91), "$0.00");
	assert.equal(usd((E24 * 2n) / 5n, 5.91), "$2.36");
	assert.equal(usd(1n, 5.91), "< $0.01");
	const c = toCard(
		raw({ yesStaked: (E24 / 5n).toString(), sponsored: (E24 / 5n).toString() }),
		0,
		5.91,
	);
	assert.equal(c.usd, "$2.36");
	assert.equal(toCard(raw({}), 0).usd, null);
});

test("a mirrored market shows its topic, image and Polymarket's chance", () => {
	assert.deepEqual(
		chances([{ slug: "a", outcomePrices: '["0.1345", "0.8655"]' }, { slug: "b" }]),
		new Map([["a", 13]]),
	);
	const pearn = toCard(raw({ id: "0" }), 0);
	assert.equal(pearn.topic, "Pearn");
	assert.equal(pearn.image, null);
	assert.equal(pearn.chance, null);
	const mirror = toCard(raw({ id: "3" }), 0, null, new Map([[catalog[0].slug, 42]]));
	assert.equal(mirror.topic, catalog[0].topic);
	assert.equal(mirror.image, `/markets/${catalog[0].image}`);
	assert.equal(mirror.chance, 42);
});
