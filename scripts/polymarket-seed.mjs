// Creates the catalog's new markets (id: null in packages/catalog/markets.json) on PearnMarkets,
// with the keeper's wallet as resolver, through NEAR (scripts/aurora-submit.mjs, gas price 0).
// Ids are assigned up front from marketCount() and checked against the chain afterwards.
//
//   node --env-file=.env scripts/polymarket-seed.mjs
// Env: WALLET_PK (the creator), KEEPER_PK (only its address is used: the resolver),
//      NEAR_SIGNER, NEAR_CLI, AURORA_RPC as for aurora-submit.mjs.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cast, readMarket } from "./polymarket.mjs";

const root = new URL("../", import.meta.url).pathname;
const FILE = join(root, "packages/catalog/markets.json");
const RPC = process.env.AURORA_RPC ?? "https://testnet.aurora.dev";
const { WALLET_PK, KEEPER_PK } = process.env;
if (!WALLET_PK || !KEEPER_PK) throw new Error("WALLET_PK and KEEPER_PK must be set");

const chainId = cast("chain-id", "--rpc-url", RPC);
const { markets } = JSON.parse(readFileSync(join(root, `contracts/deployments/${chainId}.json`)));
const from = cast("wallet", "address", WALLET_PK);
const resolver = cast("wallet", "address", KEEPER_PK);

const catalog = JSON.parse(readFileSync(FILE, "utf8"));
const todo = catalog.filter((c) => c.id === null);
if (!todo.length) {
	console.log("nothing to create");
	process.exit(0);
}
const first = Number(cast("call", markets, "marketCount()(uint256)", "--rpc-url", RPC));
const nonce = BigInt(cast("nonce", from, "--rpc-url", RPC));
const transactions = todo.map((c, i) => {
	const input = cast(
		"calldata",
		"createMarket(string,uint64,address)",
		c.question,
		String(c.closeTime),
		resolver,
	);
	const gas = cast("estimate", markets, input, "--from", from, "--rpc-url", RPC);
	c.id = first + i;
	return {
		function: `createMarket #${c.id}`,
		transaction: {
			from,
			to: markets,
			gas: `0x${BigInt(gas).toString(16)}`,
			input,
			nonce: `0x${(nonce + BigInt(i)).toString(16)}`,
		},
	};
});
const run = join(tmpdir(), "pearn-polymarket-seed.json");
writeFileSync(run, JSON.stringify({ transactions }));
execFileSync(process.execPath, [join(root, "scripts/aurora-submit.mjs"), run], {
	stdio: "inherit",
});

// Created, and with the ids we wrote down?
for (const c of todo) {
	const m = readMarket(markets, c.id, RPC);
	if (m.question !== c.question || m.resolver.toLowerCase() !== resolver.toLowerCase())
		throw new Error(`market ${c.id} is not "${c.question}" resolved by the keeper`);
}
writeFileSync(FILE, `${JSON.stringify(catalog, null, "\t")}\n`);
console.log(`created markets ${first}–${first + todo.length - 1}`);
