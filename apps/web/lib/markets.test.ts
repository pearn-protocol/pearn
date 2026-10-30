import assert from "node:assert/strict";
import { test } from "node:test";
import {
	CHALLENGE_WINDOW,
	Outcome,
	phaseOf,
	potAt,
	RESOLVE_TIMEOUT,
	yesPercent,
} from "./markets.ts";

const close = 1_000;
const unresolved = { outcome: Outcome.Unresolved, closeTime: BigInt(close), resolvedAt: 0n };

test("phaseOf walks the lifecycle", () => {
	assert.equal(phaseOf(unresolved, close - 1), "open");
	assert.equal(phaseOf(unresolved, close), "closed");
	assert.equal(phaseOf(unresolved, close + RESOLVE_TIMEOUT), "voidable");

	const resolved = { ...unresolved, outcome: Outcome.Yes, resolvedAt: 2_000n };
	assert.equal(phaseOf(resolved, 2_000), "challenge");
	assert.equal(phaseOf(resolved, 2_000 + CHALLENGE_WINDOW), "final");
});

test("yesPercent", () => {
	const stake = (principal: bigint) => ({ staked: principal, principal, weight: 0n });
	assert.equal(yesPercent({ yes: stake(0n), no: stake(0n) }), 50);
	assert.equal(yesPercent({ yes: stake(3n), no: stake(1n) }), 75);
});

test("potAt: live yield before settlement, the stored pot after", () => {
	const ONE = 10n ** 24n;
	// 10 stNEAR bet at rate 1.0 is worth 10 NEAR; at 1.1 the reserve is ceil(10/1.1) stNEAR.
	const m = {
		outcome: Outcome.Unresolved,
		pot: 0n,
		yes: { staked: 10n * ONE, principal: 10n * ONE, weight: 1n },
		no: { staked: 0n, principal: 0n, weight: 0n },
		sponsored: ONE,
	};
	const rate = (11n * ONE) / 10n;
	const reserve = (10n * ONE * ONE + rate - 1n) / rate;
	assert.equal(potAt(m, rate), 10n * ONE - reserve + ONE);
	assert.equal(potAt({ ...m, outcome: Outcome.Yes, pot: 7n }, rate), 7n);
	assert.equal(potAt(m, 0n), ONE);
});
