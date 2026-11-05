import assert from "node:assert/strict";
import { test } from "node:test";
import { inRange, stakeShare, valueAt, xTicks, yTicks } from "./chart.ts";

const pts = [
	{ t: 100, p: 40 },
	{ t: 200, p: 55 },
	{ t: 300, p: 60 },
];

test("valueAt steps: last price at or before t, null before the first", () => {
	assert.equal(valueAt(pts, 50), null);
	assert.equal(valueAt(pts, 250), 55);
	assert.equal(valueAt(pts, 999), 60);
});

test("inRange starts the line at the window edge with the last earlier price", () => {
	assert.deepEqual(inRange(pts, 150, 300), [
		{ t: 150, p: 40 },
		{ t: 200, p: 55 },
		{ t: 300, p: 60 },
	]);
});

test("yTicks pads to tens, at least 20 wide, within 0..100", () => {
	assert.deepEqual(yTicks([40, 60]), { lo: 30, hi: 70, ticks: [30, 40, 50, 60, 70] });
	assert.equal(yTicks([99]).hi, 100);
	assert.equal(yTicks([1]).lo, 0);
});

test("xTicks stays within range with at most ~7 labels", () => {
	const t1 = 1_790_000_000;
	for (const span of [3_600, 86_400, 30 * 86_400, 200 * 86_400]) {
		const ticks = xTicks(t1 - span, t1);
		assert.ok(ticks.length >= 1 && ticks.length <= 8, `span ${span}: ${ticks.length}`);
		assert.ok(ticks.every((k) => k.t >= t1 - span && k.t <= t1));
	}
});

test("stakeShare: Yes share of the bets' NEAR value after each bet, oldest first", () => {
	const e = 10n ** 24n;
	const bet = (side: number, n: bigint, timestamp: number) => ({
		kind: "bet",
		side,
		principal: n * e,
		timestamp,
	});
	assert.deepEqual(
		stakeShare([
			bet(1, 1n, 30),
			{ kind: "claim", side: null, principal: null, timestamp: 40 },
			bet(0, 3n, 10),
			bet(0, 1n, 20),
		]),
		[
			{ t: 10, p: 100 },
			{ t: 20, p: 100 },
			{ t: 30, p: 80 },
		],
	);
});
