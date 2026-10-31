// Just enough Chrome DevTools Protocol to drive the static app in headless Chrome.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROMES = [
	process.env.CHROME,
	"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
	"/usr/bin/google-chrome",
	"/usr/bin/chromium",
];

export async function launchChrome(port = 9333) {
	const bin = CHROMES.find((c) => c && existsSync(c));
	if (!bin) throw new Error("No Chrome found; set CHROME");
	// Own process group: on Linux `google-chrome` is a wrapper script, so killing only its pid
	// would leave the browser (and its CDP socket) alive.
	const proc = spawn(
		bin,
		[
			"--headless=new",
			"--disable-gpu",
			"--no-first-run",
			"--no-sandbox",
			`--remote-debugging-port=${port}`,
			`--user-data-dir=${mkdtempSync(join(tmpdir(), "pearn-e2e-"))}`,
			"about:blank",
		],
		{ detached: true, stdio: ["ignore", "ignore", "pipe"] },
	);
	let stderr = "";
	proc.stderr.on("data", (d) => {
		stderr = (stderr + d).slice(-2000);
	});
	const close = () => {
		try {
			process.kill(-proc.pid, "SIGKILL");
		} catch {
			// already gone
		}
	};
	// A cold Chrome on a CI runner, right after a Next build, can take well over 10 s.
	for (let i = 0; i < 150; i++) {
		try {
			await fetch(`http://127.0.0.1:${port}/json/version`);
			return { port, close };
		} catch {
			await sleep(200);
		}
	}
	close();
	throw new Error(`Chrome did not start in 30 s. Its stderr:\n${stderr}`);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A new tab with `script` running before any page script, on every navigation. */
export async function openTab(port, script) {
	const target = await (
		await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })
	).json();
	const ws = new WebSocket(target.webSocketDebuggerUrl);
	await new Promise((r) => ws.addEventListener("open", r, { once: true }));
	let id = 0;
	const pending = new Map();
	ws.addEventListener("message", (e) => {
		const msg = JSON.parse(e.data);
		const p = pending.get(msg.id);
		if (!p) return;
		pending.delete(msg.id);
		msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
	});
	const send = (method, params = {}) =>
		new Promise((resolve, reject) => {
			pending.set(++id, { resolve, reject });
			ws.send(JSON.stringify({ id, method, params }));
		});

	await send("Page.enable");
	await send("Page.addScriptToEvaluateOnNewDocument", { source: script });

	const evaluate = async (expression) => {
		const r = await send("Runtime.evaluate", {
			expression,
			awaitPromise: true,
			returnByValue: true,
		});
		if (r.exceptionDetails)
			throw new Error(r.exceptionDetails.exception?.description ?? "evaluate failed");
		return r.result.value;
	};

	/** Polls `expression` until it is truthy. */
	const waitFor = async (expression, ms = 20_000) => {
		const end = Date.now() + ms;
		while (Date.now() < end) {
			if (await evaluate(`!!(${expression})`).catch(() => false)) return;
			await sleep(200);
		}
		const text = await evaluate("document.body.innerText").catch(() => "");
		throw new Error(`Timed out waiting for ${expression}\n--- page ---\n${text}`);
	};

	const buttonByText = (text) =>
		`[...document.querySelectorAll("button")].find((b) => b.innerText.trim().startsWith(${JSON.stringify(text)}))`;

	return {
		goto: (url) => send("Page.navigate", { url }),
		evaluate,
		waitFor,
		waitForText: (text, ms) =>
			waitFor(`document.body.innerText.includes(${JSON.stringify(text)})`, ms),
		/** Clicks the first enabled button whose label starts with `text`. */
		click: async (text) => {
			await waitFor(`${buttonByText(text)} && !${buttonByText(text)}.disabled`);
			await evaluate(`${buttonByText(text)}.click()`);
		},
		/** Focuses the input matching `selector` and types `text` like a user. */
		type: async (selector, text) => {
			await waitFor(`document.querySelector(${JSON.stringify(selector)})`);
			await evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`);
			await send("Input.insertText", { text });
		},
		/** Raw CDP command, for anything the helpers above don't cover. */
		send,
		close: () => ws.close(),
	};
}
