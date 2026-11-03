import assert from "node:assert/strict";
import { test } from "node:test";
import { usd } from "./price.ts";

const ONE = 10n ** 24n;

test("usd", () => {
	assert.equal(usd(0n, 5.91), "$0.00");
	assert.equal(usd(1234n * ONE, 5.91), "$7,292.94");
	assert.equal(usd(ONE / 2n, 3.89), "$1.95");
	assert.equal(usd(1n, 5.91), "< $0.01");
});
