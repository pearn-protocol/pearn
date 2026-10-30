// Anvil seeded by DevChain, the static app built against it, and a tiny file server.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sleep } from "./cdp.mjs";

export const RPC = "http://127.0.0.1:8645";
export const APP = "http://127.0.0.1:4173";
/** anvil's default accounts 0–2; DevChain minted 1000 stNEAR to each. */
export const ACCOUNTS = [
	"0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
	"0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
	"0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
];

const web = fileURLToPath(new URL("..", import.meta.url));
const contracts = fileURLToPath(new URL("../../../contracts/", import.meta.url));
const TYPES = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".png": "image/png",
};

export async function rpc(method, params = []) {
	const r = await fetch(RPC, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
	});
	const j = await r.json();
	if (j.error) throw new Error(j.error.message);
	return j.result;
}

/** Moves chain time forward and mines a block. */
export async function warp(seconds) {
	await rpc("evm_increaseTime", [seconds]);
	await rpc("evm_mine");
}

export async function startStack() {
	const anvil = spawn("anvil", ["--silent", "--port", "8645"], { stdio: "inherit" });
	for (let i = 0; ; i++) {
		try {
			await rpc("eth_chainId");
			break;
		} catch {
			if (i === 50) throw new Error("anvil did not start");
			await sleep(200);
		}
	}
	execFileSync(
		"forge",
		["script", "script/DevChain.s.sol", "--rpc-url", RPC, "--broadcast", "--silent"],
		{
			cwd: contracts,
			stdio: "inherit",
		},
	);
	const deployment = JSON.parse(readFileSync(join(contracts, "deployments/31337.json"), "utf8"));

	execFileSync("pnpm", ["build"], {
		cwd: web,
		stdio: "ignore",
		env: {
			...process.env,
			NEXT_PUBLIC_CHAIN_ID: "31337",
			NEXT_PUBLIC_RPC_URL: RPC,
			NEXT_PUBLIC_STNEAR: deployment.stNear,
			NEXT_PUBLIC_ORACLE: deployment.oracle,
			NEXT_PUBLIC_MARKETS: deployment.markets,
		},
	});

	const out = join(web, "out");
	const server = createServer((req, res) => {
		const path = decodeURIComponent(new URL(req.url, APP).pathname);
		const file = join(out, path.endsWith("/") ? `${path}index.html` : path);
		try {
			res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
			res.end(readFileSync(file));
		} catch {
			res.writeHead(404).end();
		}
	});
	await new Promise((r) => server.listen(4173, "127.0.0.1", r));

	return {
		deployment,
		stop: () => {
			server.close();
			anvil.kill();
		},
	};
}

/**
 * Script injected before the app loads: an EIP-1193 wallet that signs as `account` through
 * anvil's unlocked accounts, and a browser clock that follows chain time after a warp.
 */
export async function walletScript(account) {
	const block = await rpc("eth_getBlockByNumber", ["latest", false]);
	const offsetMs = Number(block.timestamp) * 1000 - Date.now();
	return `(() => {
		const realNow = Date.now.bind(Date);
		Date.now = () => realNow() + ${offsetMs};
		const account = ${JSON.stringify(account)};
		let id = 0;
		window.ethereum = {
			async request({ method, params }) {
				if (method === "eth_accounts" || method === "eth_requestAccounts") return [account];
				const r = await fetch(${JSON.stringify(RPC)}, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
				});
				const j = await r.json();
				if (j.error) throw Object.assign(new Error(j.error.message), { code: j.error.code });
				return j.result;
			},
			on() {},
			removeListener() {},
		};
	})();`;
}
