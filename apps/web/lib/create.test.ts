import assert from "node:assert/strict";
import { test } from "node:test";
import { checkDraft } from "./create.ts";

const now = Math.floor(Date.parse("2026-11-01T00:00:00") / 1000);
const ok = {
	question: "  Will NEAR trade above $5 on Dec 1?  ",
	close: "2026-12-01T00:00",
	resolver: "0x3b4f0135465d444a5bd06ab90fc59b73916c85f5",
};

test("checkDraft accepts a valid draft and normalises it", () => {
	const r = checkDraft(ok, now);
	assert.ok(typeof r !== "string");
	assert.equal(r.question, "Will NEAR trade above $5 on Dec 1?");
	assert.equal(r.resolver, "0x3B4f0135465d444a5bD06Ab90fC59B73916C85F5");
	assert.equal(r.closeTime, BigInt(Date.parse("2026-12-01T00:00") / 1000));
});

test("checkDraft rejects what the contract would", () => {
	assert.equal(checkDraft({ ...ok, question: " " }, now), "Write the question.");
	assert.match(String(checkDraft({ ...ok, question: "é".repeat(141) }, now)), /280 bytes/);
	assert.equal(checkDraft({ ...ok, close: "" }, now), "Pick a close time.");
	assert.equal(
		checkDraft({ ...ok, close: "2026-11-01T00:30" }, now),
		"Close at least an hour from now.",
	);
	assert.equal(
		checkDraft({ ...ok, resolver: "0x123" }, now),
		"The resolver must be an Aurora address.",
	);
});
