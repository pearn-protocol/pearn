// Copies the icons and manifest from packages/brand into public/, so the brand has one source.
import { cpSync, mkdirSync, readdirSync } from "node:fs";

const src = new URL("../../../packages/brand/", import.meta.url);
const pub = new URL("../public/", import.meta.url);
mkdirSync(pub, { recursive: true });
for (const name of readdirSync(src)) {
	if (/\.(png|ico|webmanifest)$/.test(name)) cpSync(new URL(name, src), new URL(name, pub));
}
