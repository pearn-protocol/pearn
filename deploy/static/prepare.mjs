// Build step for the static web image.
// 1. Writes csp.caddy (imported by the Caddyfile): a self-only CSP that allows the build's inline
//    scripts and styles by sha256 hash, never 'unsafe-inline', and connects only to the RPC.
// 2. Precompresses text assets to .br and .gz so Caddy serves them without CPU per request.
//    --inline-styles (the docs image only) allows runtime inline styles, which Fumadocs sets;
//    scripts stay hash-only either way.
// Usage: node prepare.mjs [--inline-styles] <site dir> <csp.caddy out> [connect-src origins, comma separated]
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

const argv = process.argv.slice(2);
const inlineStyles = argv.includes("--inline-styles");
const [dir, out, connect = ""] = argv.filter((a) => a !== "--inline-styles");
if (!dir || !out) throw new Error("usage: prepare.mjs <site dir> <csp.caddy out> [origins]");

const files = readdirSync(dir, { recursive: true, withFileTypes: true })
	.filter((e) => e.isFile())
	.map((e) => join(e.parentPath, e.name));

const hash = (s) => `'sha256-${createHash("sha256").update(s).digest("base64")}'`;
// Attribute values are hashed after the parser decodes entities.
const decode = (s) =>
	s
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&amp;", "&");

const scripts = new Set();
const styles = new Set();
const attrs = new Set();
for (const f of files.filter((f) => f.endsWith(".html"))) {
	const html = readFileSync(f, "utf8");
	for (const [, body] of html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/g))
		if (body) scripts.add(hash(body));
	for (const [, body] of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) styles.add(hash(body));
	for (const [, v] of html.matchAll(/\sstyle="([^"]*)"/g)) attrs.add(hash(decode(v)));
}

const origins = connect.split(",").filter(Boolean);
for (const o of origins) if (new URL(o).origin !== o) throw new Error(`not an origin: ${o}`);

const policy = [
	"default-src 'none'",
	`script-src 'self' ${[...scripts].join(" ")}`,
	// A hash in the list would make browsers ignore 'unsafe-inline', so it is one or the other.
	inlineStyles
		? "style-src 'self' 'unsafe-inline'"
		: `style-src 'self' ${[...styles, ...attrs].join(" ")}${attrs.size ? " 'unsafe-hashes'" : ""}`,
	"img-src 'self'",
	"font-src 'self'",
	"manifest-src 'self'",
	`connect-src 'self' ${origins.join(" ")}`,
	"base-uri 'none'",
	"form-action 'none'",
	"frame-ancestors 'none'",
]
	.map((d) => d.trim())
	.join("; ");
writeFileSync(out, `header Content-Security-Policy "${policy}"\n`);

for (const f of files.filter((f) => /\.(html|js|css|txt|json|svg|webmanifest)$/.test(f))) {
	const buf = readFileSync(f);
	if (buf.length < 1024) continue;
	writeFileSync(
		`${f}.br`,
		brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
	);
	writeFileSync(`${f}.gz`, gzipSync(buf, { level: 9 }));
}
