import assert from "node:assert/strict";
import { test } from "node:test";

import { fixRequest } from "./aurora-rpc.mjs";

const HASH = `0x${"ab".repeat(32)}`;
const ADDRESS = `0x${"11".repeat(20)}`;

test("a bare block hash becomes the EIP-1898 object Aurora accepts", () => {
	const fixed = fixRequest({ id: 1, method: "eth_getBalance", params: [ADDRESS, HASH] });
	assert.deepEqual(fixed.params, [ADDRESS, { blockHash: HASH }]);
});

test("block numbers, tags and objects pass through unchanged", () => {
	for (const block of ["latest", "0x10", { blockNumber: "0x10" }]) {
		const request = { id: 1, method: "eth_getCode", params: [ADDRESS, block] };
		assert.equal(fixRequest(request), request);
	}
});

test("a hash that is the only parameter is left alone", () => {
	const request = { id: 1, method: "eth_getTransactionByHash", params: [HASH] };
	assert.equal(fixRequest(request), request);
});
