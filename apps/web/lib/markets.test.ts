import assert from "node:assert/strict";
import { test } from "node:test";
import { CHALLENGE_WINDOW, Outcome, phaseOf, RESOLVE_TIMEOUT, yesPercent } from "./markets.ts";

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
