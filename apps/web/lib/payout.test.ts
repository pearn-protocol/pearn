import assert from "node:assert/strict";
import { test } from "node:test";
import {
	ONE,
	potOf,
	principalOf,
	projectBet,
	projectedRate,
	refundOf,
	reserveOf,
	shareOf,
	weightOf,
} from "./payout.ts";

// Same numbers as contracts/test/unit/PayoutMath.t.sol.
test("matches PayoutMath.sol", () => {
	assert.equal(principalOf(2n * ONE, 15n * 10n ** 23n), 3n * ONE);
	assert.equal(weightOf(10n, 100n, 160n), 600n);
	assert.equal(weightOf(10n, 160n, 160n), 0n);
	assert.equal(reserveOf(1n, 3n * ONE), 1n);
	assert.equal(refundOf(1n, 3n * ONE), 0n);
	assert.equal(potOf(100n, 90n, 5n), 15n);
	assert.equal(potOf(90n, 100n, 5n), 5n);
	assert.equal(shareOf(100n, 0n, 0n), 0n);
	assert.equal(shareOf(100n, 1n, 3n), 33n);
});

test("projectedRate grows 4.5% over a year", () => {
	assert.equal(projectedRate(ONE, 365n * 24n * 3600n), ONE + (ONE * 45n) / 1000n);
	assert.equal(projectedRate(ONE, 0n), ONE);
});

test("projectBet: a lone bettor wins the whole pot, sponsors included", () => {
	const empty = { staked: 0n, principal: 0n, weight: 0n };
	const year = 365n * 24n * 3600n;
	const p = projectBet({
		amount: 100n * ONE,
		rate: ONE,
		now: 0n,
		closeTime: year,
		pick: empty,
		other: empty,
		sponsored: 10n * ONE,
	});
	assert.equal(p.principal, 100n * ONE);
	assert.equal(p.winnings, p.pot);
	// 100 stNEAR at a 4.5% higher rate frees ≈4.31 stNEAR of yield, plus 10 sponsored.
	assert.ok(p.pot > 14n * ONE && p.pot < 15n * ONE);
});

test("projectBet: a late bet earns a small share", () => {
	const early = { staked: 100n * ONE, principal: 100n * ONE, weight: 100n * ONE * 1000n };
	const empty = { staked: 0n, principal: 0n, weight: 0n };
	const p = projectBet({
		amount: 100n * ONE,
		rate: ONE,
		now: 990n,
		closeTime: 1000n,
		pick: early,
		other: empty,
		sponsored: ONE,
	});
	// Weight 10 s vs 1000 s: under 1% of the pot.
	assert.ok(p.winnings * 100n < p.pot);
});
