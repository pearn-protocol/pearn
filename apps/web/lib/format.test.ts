import assert from "node:assert/strict";
import { test } from "node:test";
import { amount, duration, parseAmount, percent, short } from "./format.ts";

const ONE = 10n ** 24n;

test("amount", () => {
	assert.equal(amount(0n), "0");
	assert.equal(amount(1234n * ONE + ONE / 2n), "1,234.5");
	assert.equal(amount(1n), "< 0.0001");
});

test("parseAmount", () => {
	assert.equal(parseAmount("1.5"), (3n * ONE) / 2n);
	assert.equal(parseAmount(".5"), ONE / 2n);
	assert.equal(parseAmount("2."), 2n * ONE);
	for (const bad of ["", "0", "-1", "1e3", "abc", "1.2.3"]) assert.equal(parseAmount(bad), null);
});

test("duration", () => {
	assert.equal(duration(3 * 86400 + 4 * 3600 + 5), "3d 4h");
	assert.equal(duration(2 * 3600 + 15 * 60), "2h 15m");
	assert.equal(duration(45), "45s");
	assert.equal(duration(-5), "0s");
});

test("short and percent", () => {
	assert.equal(short("0x3B4f0135465d444a5bD06Ab90fC59B73916C85F5"), "0x3B4f…85F5");
	assert.equal(percent(1n, 4n), 25);
	assert.equal(percent(0n, 0n), 50);
});
