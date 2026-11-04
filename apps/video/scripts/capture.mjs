// Records the footage for the demo: headless Chrome screencasts of the live landing, the app on a
// local chain (the e2e stack: anvil + DevChain + the real app build), and live on-chain proof.
// Each shot becomes footage/<name>.mp4 (1920×1080, 30 fps); src/cut.mjs orders and captions them.
// Usage: pnpm capture   (needs Foundry, Chrome and ffmpeg; about two minutes)
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseUnits } from "viem";
import { launchChrome, openTab, sleep } from "../../web/e2e/cdp.mjs";
import { ACCOUNTS, APP, rpc, startStack, walletScript, warp } from "../../web/e2e/stack.mjs";

const FOOTAGE = fileURLToPath(new URL("../footage/", import.meta.url));
const CLAIM_TX =
	"https://explorer.testnet.aurora.dev/tx/0xc8ef84622bcb243e2095dbb23bbdf3ccaa3579a4d317a71fc7d2bfc13c9eaf53";
const W = 1280;
const H = 720;
const SCALE = 1.5; // 1920×1080 frames

/** Screencasts `act` into footage/<name>.mp4, holding each frame until the next one arrives. */
async function record(tab, name, act) {
	const dir = join(FOOTAGE, name);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	const frames = [];
	const off = tab.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
		const file = `${String(frames.length).padStart(5, "0")}.jpg`;
		writeFileSync(join(dir, file), Buffer.from(data, "base64"));
		frames.push({ file, t: metadata.timestamp });
		// A late ack after the screencast stopped is harmless.
		tab.send("Page.screencastFrameAck", { sessionId }).catch(() => undefined);
	});
	await tab.send("Page.startScreencast", {
		format: "jpeg",
		quality: 92,
		maxWidth: W * SCALE,
		maxHeight: H * SCALE,
	});
	await act();
	const end = Date.now() / 1000;
	await tab.send("Page.stopScreencast");
	off();
	if (!frames.length) throw new Error(`${name}: no frames`);

	// ffconcat with each frame's real duration, so pauses in the page stay pauses on screen.
	const list = frames.map((f, i) => {
		const next = frames[i + 1]?.t ?? end;
		return `file '${f.file}'\nduration ${Math.max(next - f.t, 1 / 30).toFixed(4)}`;
	});
	writeFileSync(
		join(dir, "list.ffconcat"),
		`ffconcat version 1.0\n${list.join("\n")}\nfile '${frames.at(-1).file}'\n`,
	);
	execFileSync("ffmpeg", [
		"-v",
		"error",
		"-y",
		"-f",
		"concat",
		"-safe",
		"0",
		"-i",
		join(dir, "list.ffconcat"),
		"-vf",
		`scale=${W * SCALE}:${H * SCALE}:force_original_aspect_ratio=decrease,pad=${W * SCALE}:${H * SCALE}:(ow-iw)/2:(oh-ih)/2:color=0x050505,fps=30,format=yuv420p`,
		"-c:v",
		"libx264",
		"-crf",
		"18",
		join(FOOTAGE, `${name}.mp4`),
	]);
	rmSync(dir, { recursive: true, force: true });
	console.log(`${name}: ${frames.length} frames`);
}

async function tab(chrome, script = "") {
	const t = await openTab(chrome.port, script);
	await t.send("Emulation.setDeviceMetricsOverride", {
		width: W,
		height: H,
		deviceScaleFactor: SCALE,
		mobile: false,
	});
	return t;
}

/** Smooth scroll to an element, like a person reading on. */
async function scrollTo(t, selector, ms = 1400) {
	await t.evaluate(
		`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ behavior: "smooth" })`,
	);
	await sleep(ms);
}

/** Types like a person: one key at a time. */
async function typeSlowly(t, selector, text) {
	await t.waitFor(`document.querySelector(${JSON.stringify(selector)})`);
	await t.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
	for (const ch of text) {
		await t.send("Input.insertText", { text: ch });
		await sleep(180);
	}
}

/** A tab signed in as `account` on the local stack, already showing its address. */
async function asAccount(chrome, account, path) {
	const t = await tab(chrome, await walletScript(account));
	await t.goto(`${APP}${path}`);
	await t.waitForText(`${account.slice(0, 6)}…${account.slice(-4)}`);
	await sleep(600);
	return t;
}

mkdirSync(FOOTAGE, { recursive: true });
const stack = await startStack();
const chrome = await launchChrome(9455);
try {
	// ── Live: the landing at pearn.site ─────────────────────────────────────────
	const landing = await tab(chrome);
	await landing.goto("https://pearn.site/");
	await landing.waitForText("Bet the yield.");
	await record(landing, "landing", async () => {
		await sleep(3200);
		await scrollTo(landing, "#how", 2600);
		await scrollTo(landing, "#markets", 1200);
		await landing.waitForText("chance on Polymarket", 15_000);
		await sleep(2200);
	});
	landing.close();

	// ── Local chain: bet, resolve, claim in the real app ────────────────────────
	const bettor = await asAccount(chrome, ACCOUNTS[1], "/market/?id=0");
	await record(bettor, "bet-form", async () => {
		await sleep(1500);
		await typeSlowly(bettor, "input[inputmode=decimal]", "5");
		await bettor.waitForText("Principal, returned in full");
		await sleep(3000);
	});
	await record(bettor, "bet-send", async () => {
		await bettor.click("Approve and bet");
		await bettor.waitForText("Done.");
		await sleep(2500);
	});
	bettor.close();

	// Market 2 closes a day in: a later oracle reading, as the keeper would bring.
	await warp(86_400 + 60);
	await rpc("eth_sendTransaction", [
		{
			from: ACCOUNTS[0],
			to: stack.deployment.oracle,
			data: `0x60fe47b1${parseUnits("1.6", 24).toString(16).padStart(64, "0")}`,
		},
	]);
	const resolver = await asAccount(chrome, ACCOUNTS[0], "/market/?id=2");
	await resolver.waitForText("Resolve this market");
	await record(resolver, "resolve", async () => {
		await sleep(1800);
		await resolver.click("Yes");
		await resolver.waitForText("Challenge window");
		await sleep(2600);
	});
	resolver.close();

	await warp(86_400 + 60);
	const winner = await asAccount(chrome, ACCOUNTS[2], "/market/?id=2");
	await record(winner, "claim", async () => {
		await sleep(2200);
		await winner.click("Claim");
		await winner.waitForText("Claimed.");
		await sleep(2800);
	});
	winner.close();

	// ── Live: proof on Aurora testnet ───────────────────────────────────────────
	const explorer = await tab(chrome);
	await explorer.goto(CLAIM_TX);
	await explorer.waitForText("Success", 30_000);
	await sleep(1500);
	await record(explorer, "proof-claim", () => sleep(5200));
	explorer.close();

	const docs = await tab(chrome);
	await docs.goto("https://docs.pearn.site/docs/oracle/");
	await docs.waitForText("get_st_near_price", 30_000);
	await sleep(800);
	await record(docs, "proof-oracle", async () => {
		await sleep(2400);
		await docs.evaluate("scrollBy({ top: 420, behavior: 'smooth' })");
		await sleep(3000);
	});
	docs.close();
} finally {
	chrome.close();
	stack.stop();
}
