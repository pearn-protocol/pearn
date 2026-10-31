// The `idea` draft in SUBMISSION.md must fit the submission API (20-2000 characters).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("SUBMISSION.md idea fits 20-2000 characters", () => {
	const md = readFileSync(new URL("../SUBMISSION.md", import.meta.url), "utf8");
	const idea = md.split("<!-- IDEA START -->")[1].split("<!-- IDEA END -->")[0].trim();
	assert.ok(idea.length >= 20 && idea.length <= 2000, `idea is ${idea.length} characters`);
});
