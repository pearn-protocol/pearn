import assert from "node:assert/strict";
import { test } from "node:test";
import { parseActivity } from "./indexer.ts";

test("parseActivity turns GraphQL strings into bigint and number", () => {
	const a = parseActivity({
		id: "179342333200000013131615500000000275552600000000000000000",
		kind: "bet",
		account: "0x3b4f0135465d444a5bd06ab90fc59b73916c85f5",
		side: 0,
		amount: "100000000000000000000000",
		principal: "320000000000000000000000",
		timestamp: "1793423332",
		txHash: "0x29c63ec347e2c778b134b0e18179aa64432775b9f948143a2408a8e02c4aeda2",
	});
	assert.equal(a.amount, 10n ** 23n);
	assert.equal(a.principal, 32n * 10n ** 22n);
	assert.equal(a.timestamp, 1793423332);
	assert.equal(parseActivity({ ...a, amount: null, principal: null, timestamp: "1" }).amount, null);
});
