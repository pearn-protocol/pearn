import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeHistory, parseReferences, usdCompact } from "./reference.ts";

test("parseReferences keeps the Yes price as a whole percent", () => {
	const refs = parseReferences([
		{
			slug: "a",
			outcomePrices: '["0.1345", "0.8655"]',
			volumeNum: 18_252_711.27,
			clobTokenIds: '["111", "222"]',
		},
		{ slug: "b", outcomePrices: "[]" },
	]);
	assert.deepEqual(refs.get("a"), { yes: 13, volume: 18_252_711.27, token: "111" });
	assert.equal(refs.has("b"), false);
});

test("usdCompact", () => {
	assert.equal(usdCompact(37_300_000), "$37.3M");
	assert.equal(usdCompact(850_000), "$850K");
	assert.equal(usdCompact(900), "$900");
});

test("mergeHistory keeps coarse points only before the fine ones, as percents", () => {
	const coarse = [
		{ t: 0, p: 0.1 },
		{ t: 100, p: 0.2 },
		{ t: 200, p: 0.3 },
	];
	assert.deepEqual(mergeHistory(coarse, [{ t: 150, p: 0.25 }]), [
		{ t: 0, p: 10 },
		{ t: 100, p: 20 },
		{ t: 150, p: 25 },
	]);
	assert.equal(mergeHistory(coarse, []).length, 3);
});
