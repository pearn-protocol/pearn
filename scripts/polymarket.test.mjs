import assert from "node:assert/strict";
import { test } from "node:test";
import { OUTCOME, outcomeOf } from "./polymarket.mjs";

const m = (over) => ({
	closed: true,
	umaResolutionStatus: "resolved",
	outcomes: '["Yes", "No"]',
	outcomePrices: '["1", "0"]',
	...over,
});

test("outcomeOf waits until Polymarket has settled", () => {
	assert.equal(outcomeOf(m({ closed: false })), null);
	assert.equal(outcomeOf(m({ umaResolutionStatus: "proposed" })), null);
	assert.equal(outcomeOf(m({ umaResolutionStatus: "disputed" })), null);
});

test("outcomeOf maps a settlement to Yes, No or Invalid", () => {
	assert.equal(outcomeOf(m({})), OUTCOME.Yes);
	assert.equal(outcomeOf(m({ outcomePrices: '["0", "1"]' })), OUTCOME.No);
	assert.equal(outcomeOf(m({ outcomePrices: '["0.5", "0.5"]' })), OUTCOME.Invalid);
	assert.equal(outcomeOf(m({ outcomes: '["Up", "Down"]' })), OUTCOME.Invalid);
});
