// Smoke test of the built site (run by `build`): the key routes exist with a title, every local
// href/src resolves to a built file or, for "#id", to an element on that page, and no page loads
// anything from another origin (the only cross-origin request is the indexer fetch at runtime).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist/", import.meta.url).pathname;
const ROUTES = ["index.html", "404.html"];

const bad = [];
const pages = readdirSync(DIST, { recursive: true }).filter((p) => p.endsWith(".html"));

for (const r of ROUTES) if (!pages.includes(r)) bad.push(`missing route ${r}`);
for (const page of pages) {
	const html = readFileSync(join(DIST, page), "utf8");
	if (!/<title>[^<]+<\/title>/.test(html)) bad.push(`${page}: no <title>`);
	const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
	for (const [tag] of html.matchAll(/<(script|link|img)\b[^>]*>/g)) {
		const url = tag.match(/\s(?:src|href)="(https?:[^"]+)"/)?.[1];
		if (url && !tag.includes('rel="canonical"')) bad.push(`${page}: loads ${url}`);
	}
	for (const [, attr, url] of html.matchAll(/\s(href|src)="([^"]+)"/g)) {
		if (/^(https?:|mailto:|data:)/.test(url)) continue;
		if (url.startsWith("#")) {
			if (url.length > 1 && !ids.has(url.slice(1)))
				bad.push(`${page}: ${attr}="${url}" (no such id)`);
			continue;
		}
		const path = url.split(/[?#]/)[0];
		const file = path.startsWith("/") ? path.slice(1) : join(page, "..", path);
		if (!existsSync(join(DIST, file.endsWith("/") || file === "" ? `${file}index.html` : file)))
			bad.push(`${page}: ${attr}="${url}" (not built)`);
	}
}

if (bad.length) {
	console.error(`smoke: ${bad.length} problem(s) in dist/\n${bad.join("\n")}`);
	process.exit(1);
}
console.log(`smoke: ${pages.length} pages, routes and local links resolve, no third-party loads`);
