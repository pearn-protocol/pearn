// Cuts footage/*.mp4 into out/pearn-demo.mp4 as src/cut.mjs says: each shot gets a caption band
// (what it shows, and whether it is live or local), cards open and close the cut. Bands and
// cards are HTML rendered by headless Chrome in the sites' own type and colours; ffmpeg only
// stacks and joins. Hard cuts, no music.
// Usage: pnpm render   (after pnpm capture; needs Chrome and ffmpeg)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { launchChrome, openTab, sleep } from "../../web/e2e/cdp.mjs";
import { cut, LIVE } from "../src/cut.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FOOTAGE = join(ROOT, "footage");
const OUT = join(ROOT, "out");
const WORK = join(OUT, "work");
const W = 1920;
const FOOT_H = 1080;
const BAND_H = 150;
const H = FOOT_H + BAND_H;

const require = createRequire(import.meta.url);
const font = (weight) =>
	pathToFileURL(
		require.resolve(`@fontsource/jetbrains-mono/files/jetbrains-mono-latin-${weight}-normal.woff2`),
	).href;
const tokens = pathToFileURL(require.resolve("@pearn/brand/tokens.css")).href;

const html = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const page = (body, css) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${tokens}">
<style>
@font-face { font-family: "JetBrains Mono"; font-weight: 500; src: url("${font(500)}") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 700; src: url("${font(700)}") format("woff2"); }
* { box-sizing: border-box; margin: 0; }
html, body { width: ${W}px; background: var(--bg); color: var(--ink); font: 500 32px/1.4 var(--font); }
${css}
</style></head><body>${body}</body></html>`;

/** The strip under a shot: the caption, and a tag saying where it was recorded. */
const band = ({ caption, where }) =>
	page(
		`<div class="band"><p>${html(caption)}</p><span class="${where === LIVE ? "live" : "local"}">■ ${html(where)}</span></div>`,
		`.band { height: ${BAND_H}px; display: flex; align-items: center; justify-content: space-between;
			gap: 48px; padding: 0 64px; border-top: 2px solid var(--line); }
		p { font-size: 34px; letter-spacing: -0.02em; }
		span { flex: none; font-size: 22px; text-transform: uppercase; letter-spacing: 0.04em; }
		.live { color: var(--accent); } .local { color: var(--muted); }`,
	);

/** Opening and closing cards: highlighter strips like the landing's hero. */
const card = ({ lines, sub }) =>
	page(
		`<div class="card"><h1>${lines.map((l) => `<span>${html(l)}</span>`).join("")}</h1><p>${html(sub)}</p></div>`,
		`.card { height: ${H}px; display: grid; place-content: center; justify-items: center; gap: 56px; }
		h1 { display: grid; justify-items: center; gap: 8px; font-weight: 500; font-size: 76px; letter-spacing: -0.02em; }
		h1 span { padding: 4px 20px; background: var(--accent); color: var(--on-accent); }
		p { color: var(--muted); font-size: 30px; }`,
	);

async function screenshot(tab, html, file, height) {
	const path = join(WORK, `${file}.html`);
	writeFileSync(path, html);
	await tab.send("Emulation.setDeviceMetricsOverride", {
		width: W,
		height,
		deviceScaleFactor: 1,
		mobile: false,
	});
	await tab.goto(pathToFileURL(path).href);
	await tab.waitFor("document.fonts.status === 'loaded' && document.body");
	await sleep(300);
	const { data } = await tab.send("Page.captureScreenshot", {
		clip: { x: 0, y: 0, width: W, height, scale: 1 },
	});
	writeFileSync(join(WORK, `${file}.png`), Buffer.from(data, "base64"));
	return join(WORK, `${file}.png`);
}

const ffmpeg = (...args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const duration = (file) =>
	execFileSync("ffprobe", [
		"-v",
		"error",
		"-show_entries",
		"format=duration",
		"-of",
		"csv=p=0",
		file,
	])
		.toString()
		.trim();
const ENCODE = ["-r", "30", "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p"];

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
const chrome = await launchChrome(9456);
const segments = [];
try {
	const tab = await openTab(chrome.port, "");
	for (const [i, shot] of cut.entries()) {
		const seg = join(WORK, `${String(i).padStart(2, "0")}-${shot.name}.mp4`);
		if (shot.card) {
			const png = await screenshot(tab, card(shot.card), shot.name, H);
			ffmpeg("-loop", "1", "-t", String(shot.seconds), "-i", png, ...ENCODE, seg);
		} else {
			const png = await screenshot(tab, band(shot), shot.name, BAND_H);
			const footage = join(FOOTAGE, `${shot.name}.mp4`);
			// The looped band is bounded by the footage's length: -shortest does not end a looped
			// input inside a filter graph.
			ffmpeg(
				"-i",
				footage,
				"-loop",
				"1",
				"-t",
				duration(footage),
				"-i",
				png,
				"-filter_complex",
				`[0:v]scale=${W}:${FOOT_H}[f];[f][1:v]vstack=inputs=2,format=yuv420p[v]`,
				"-map",
				"[v]",
				...ENCODE,
				seg,
			);
		}
		segments.push(seg);
		console.log(`${shot.name}: ok`);
	}
	tab.close();
} finally {
	chrome.close();
}

const list = join(WORK, "segments.txt");
writeFileSync(list, segments.map((s) => `file '${s}'`).join("\n"));
ffmpeg(
	"-f",
	"concat",
	"-safe",
	"0",
	"-i",
	list,
	"-c",
	"copy",
	"-movflags",
	"+faststart",
	join(OUT, "pearn-demo.mp4"),
);
rmSync(WORK, { recursive: true, force: true });
console.log(
	`out/pearn-demo.mp4: ${W}×${H}, ${Number(duration(join(OUT, "pearn-demo.mp4"))).toFixed(1)} s`,
);
