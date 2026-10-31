// Every internal /docs/ link in the content must point at a page that exists.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";

const dir = new URL("../content/docs/", import.meta.url);
const pages = readdirSync(dir).filter((f) => f.endsWith(".mdx"));

test("internal docs links resolve", () => {
	const broken = [];
	for (const page of pages) {
		const text = readFileSync(new URL(page, dir), "utf8");
		for (const [, slug] of text
			.matchAll(/\(\/docs\/([a-z0-9-]*)\/?\)|href="\/docs\/([a-z0-9-]*)\/?"/g)
			.map((m) => [m[0], m[1] ?? m[2]])) {
			const target = slug === "" ? "index.mdx" : `${slug}.mdx`;
			if (!existsSync(new URL(target, dir))) broken.push(`${page} → /docs/${slug}/`);
		}
	}
	assert.deepEqual(broken, []);
});

test("meta.json lists every page", () => {
	const meta = JSON.parse(readFileSync(new URL("meta.json", dir), "utf8"));
	const listed = new Set(meta.pages.filter((p) => !p.startsWith("---")));
	for (const page of pages)
		assert.ok(listed.has(page.replace(/\.mdx$/, "")), `${page} missing from meta.json`);
});
