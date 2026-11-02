import assert from "node:assert/strict";
import { test } from "node:test";
import { type RawMarket, stNear, toCard } from "./markets.ts";

const E24 = 10n ** 24n;
const raw = (over: Partial<RawMarket>): RawMarket => ({
	id: "0",
	question: "Q?",
	closeTime: "1000",
	outcome: 0,
	yesStaked: "0",
	noStaked: "0",
	sponsored: "0",
	bets: 0,
	...over,
});

test("stNear rounds down to hundredths", () => {
	assert.equal(stNear(0n), "0.00");
	assert.equal(stNear((E24 * 123n) / 100n + 1n), "1.23");
	assert.equal(stNear(E24 * 12n + E24 / 20n), "12.05");
});

test("status follows outcome, then close time", () => {
	assert.equal(toCard(raw({}), 999).status, "Open");
	assert.equal(toCard(raw({}), 1000).status, "Awaiting result");
	assert.equal(toCard(raw({ outcome: 1 }), 0).status, "Resolved YES");
	assert.equal(toCard(raw({ outcome: 2 }), 0).status, "Resolved NO");
	assert.equal(toCard(raw({ outcome: 3 }), 0).status, "Invalid");
});

test("YES share and total include sponsorship only in the total", () => {
	const c = toCard(
		raw({ yesStaked: String(3n * E24), noStaked: String(E24), sponsored: String(E24) }),
		0,
	);
	assert.equal(c.yes, 75);
	assert.equal(c.staked, "5.00");
	assert.equal(toCard(raw({ sponsored: String(E24) }), 0).yes, null);
});
