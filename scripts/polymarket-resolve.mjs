// Keeper step: resolves every mirrored market whose betting has closed once Polymarket has
// settled it (outcomeOf in polymarket.mjs), from the keeper's wallet (each market's resolver),
// through NEAR (aurora-submit.mjs, gas price 0). Run after oracle.sync(): resolve needs a rate
// read after close. Markets Polymarket has not settled are left for the next run. A market
// that fails (Gamma down, a changed conditionId) is skipped and fails the run at the end, so
// it never blocks the others from resolving before the 7-day timeout voids them.
//
//   node scripts/polymarket-resolve.mjs
// Env: WALLET_PK (the keeper), NEAR_SIGNER, NEAR_PRIVATE_KEY, AURORA_RPC as for aurora-submit.mjs.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cast, GAMMA, OUTCOME, outcomeOf, readMarket } from "./polymarket.mjs";

const root = new URL("../", import.meta.url).pathname;
const RPC = process.env.AURORA_RPC ?? "https://testnet.aurora.dev";
const { WALLET_PK } = process.env;
if (!WALLET_PK) throw new Error("WALLET_PK must be set");

const chainId = cast("chain-id", "--rpc-url", RPC);
const { markets, oracle } = JSON.parse(
	readFileSync(join(root, `contracts/deployments/${chainId}.json`)),
);
const catalog = JSON.parse(readFileSync(join(root, "packages/catalog/markets.json"), "utf8"));
const keeper = cast("wallet", "address", WALLET_PK);
const rateAt = Number(cast("call", oracle, "updatedAt()(uint64)", "--rpc-url", RPC).split(" ")[0]);
const now = Date.now() / 1000;

const transactions = [];
let nonce = BigInt(cast("nonce", keeper, "--rpc-url", RPC));
const failed = [];
for (const c of catalog.filter((x) => x.id !== null)) {
	try {
		const tx = await resolveTx(c);
		if (!tx) continue;
		transactions.push({
			...tx,
			transaction: { ...tx.transaction, nonce: `0x${nonce.toString(16)}` },
		});
		nonce++;
	} catch (e) {
		console.log(`::error::#${c.id} ${c.slug}: ${e.message}`);
		failed.push(c.id);
	}
}

/** The resolve transaction for catalog entry `c` (without its nonce), or null if not due. */
async function resolveTx(c) {
	const m = readMarket(markets, c.id, RPC);
	if (m.outcome !== OUTCOME.Unresolved || now < m.closeTime) return null;
	// The catalog is not tied to a deployment: a redeploy reuses ids for other questions.
	if (m.question !== c.question) throw new Error("the question on chain differs from the catalog");
	if (m.resolver.toLowerCase() !== keeper.toLowerCase()) {
		console.log(`#${c.id}: resolver is ${m.resolver}, not the keeper; skipped`);
		return null;
	}
	if (rateAt < m.closeTime) {
		console.log(`#${c.id}: waiting for a rate read after close`);
		return null;
	}
	const r = await fetch(`${GAMMA}/markets/slug/${c.slug}`, { signal: AbortSignal.timeout(20_000) });
	if (!r.ok) throw new Error(`Gamma answered ${r.status}`);
	const g = await r.json();
	if (g.conditionId !== c.conditionId) throw new Error("conditionId changed");
	const outcome = outcomeOf(g);
	if (outcome === null) {
		console.log(`#${c.id}: Polymarket has not settled yet`);
		return null;
	}
	const input = cast("calldata", "resolve(uint256,uint8)", String(c.id), String(outcome));
	const gas = cast("estimate", markets, input, "--from", keeper, "--rpc-url", RPC);
	return {
		function: `resolve #${c.id} → ${Object.keys(OUTCOME)[outcome]}`,
		transaction: { from: keeper, to: markets, gas: `0x${BigInt(gas).toString(16)}`, input },
	};
}
if (!transactions.length) {
	console.log("nothing to resolve");
} else {
	const run = join(tmpdir(), "pearn-polymarket-resolve.json");
	writeFileSync(run, JSON.stringify({ transactions }));
	execFileSync(process.execPath, [join(root, "scripts/aurora-submit.mjs"), run], {
		stdio: "inherit",
	});
}
if (failed.length) {
	console.log(`::error::${failed.length} market(s) failed: ${failed.join(", ")}`);
	process.exitCode = 1;
}
