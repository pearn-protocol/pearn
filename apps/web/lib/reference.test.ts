import assert from "node:assert/strict";
import { test } from "node:test";
import { parseReferences, usdCompact } from "./reference.ts";

test("parseReferences keeps the Yes price as a whole percent", () => {
	const refs = parseReferences([
		{ slug: "a", outcomePrices: '["0.1345", "0.8655"]', volumeNum: 18_252_711.27 },
		{ slug: "b", outcomePrices: "[]" },
	]);
	assert.deepEqual(refs.get("a"), { yes: 13, volume: 18_252_711.27 });
	assert.equal(refs.has("b"), false);
});

test("usdCompact", () => {
	assert.equal(usdCompact(37_300_000), "$37.3M");
	assert.equal(usdCompact(850_000), "$850K");
	assert.equal(usdCompact(900), "$900");
});
