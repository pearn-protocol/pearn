// Integration: anvil seeded by DevChain.s.sol, the indexer pointed at it, then GraphQL checks
// after the seed and after a resolve + claim. Usage: pnpm test (needs Foundry).
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

const RPC = "http://127.0.0.1:8745";
const API = "http://127.0.0.1:42169";
const ONE = 10n ** 24n;
const DEPLOYER = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const BETTOR = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // anvil account 2
const contracts = new URL("../../../contracts/", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cast = (...args) =>
	execFileSync("cast", [...args, "--rpc-url", RPC], { encoding: "utf8" }).trim();

let anvil;
let indexer;
let markets;
let oracle;

async function until(check, what, ms = 60_000) {
	const end = Date.now() + ms;
	while (Date.now() < end) {
		if (await check().catch(() => false)) return;
		await sleep(500);
	}
	throw new Error(`timed out waiting for ${what}`);
}

async function gql(query) {
	const r = await fetch(`${API}/graphql`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ query }),
	});
	const { data, errors } = await r.json();
	if (errors) throw new Error(JSON.stringify(errors));
	return data;
}

before(async () => {
	anvil = spawn("anvil", ["--silent", "--port", "8745"], { stdio: "inherit" });
	await until(async () => cast("chain-id") === "31337", "anvil");
	execFileSync(
		"forge",
		["script", "script/DevChain.s.sol", "--rpc-url", RPC, "--broadcast", "--silent"],
		{
			cwd: contracts,
			stdio: "inherit",
		},
	);
	const d = JSON.parse(
		execFileSync("cat", ["deployments/31337.json"], { cwd: contracts, encoding: "utf8" }),
	);
	markets = d.markets;
	oracle = d.oracle;

	indexer = spawn(
		"pnpm",
		["exec", "ponder", "start", "--schema", `test_${Date.now()}`, "--port", "42169"],
		{
			cwd: new URL("..", import.meta.url),
			env: {
				...process.env,
				PONDER_CHAIN_ID: "31337",
				PONDER_RPC_URL: RPC,
				PONDER_START_BLOCK: "0",
				PONDER_PGLITE_DIR: mkdtempSync(join(tmpdir(), "pearn-indexer-")),
			},
			stdio: ["ignore", "ignore", "inherit"],
			detached: true,
		},
	);
	await until(async () => (await fetch(`${API}/ready`)).ok, "indexer ready", 120_000);
	// Ready means the historical sync is done; the last blocks can still be indexing.
	await until(
		async () => (await gql("{ activitys { totalCount } }")).activitys.totalCount === 8,
		"seed indexed",
	);
});

after(() => {
	if (indexer) process.kill(-indexer.pid, "SIGKILL");
	anvil?.kill();
});

test("indexes DevChain's markets, bets and sponsorship", async () => {
	const data = await gql(`{
		markets(orderBy: "id") { items { id yesStaked noStaked sponsored bets outcome } }
		activitys { totalCount }
		participant(marketId: "0", account: "${BETTOR.toLowerCase()}") { noStaked }
	}`);
	const [m0, , m2] = data.markets.items;
	assert.equal(data.markets.items.length, 3);
	assert.deepEqual(
		[BigInt(m0.yesStaked), BigInt(m0.noStaked), m0.bets],
		[120n * ONE, 80n * ONE, 2],
	);
	assert.equal(BigInt(m2.sponsored), 100n * ONE);
	// 3 creates, 4 bets, 1 sponsorship (also what `before` waited for).
	assert.equal(data.activitys.totalCount, 8);
	assert.equal(BigInt(data.participant.noStaked), 80n * ONE);
});

test("follows a resolve and a claim", async () => {
	cast("rpc", "evm_increaseTime", "86460");
	cast("rpc", "evm_mine");
	cast(
		"send",
		oracle,
		"set(uint256)",
		(16n * 10n ** 23n).toString(),
		"--unlocked",
		"--from",
		DEPLOYER,
	);
	cast("send", markets, "resolve(uint256,uint8)", "2", "1", "--unlocked", "--from", DEPLOYER);
	cast("rpc", "evm_increaseTime", "86460");
	cast("rpc", "evm_mine");
	cast("send", markets, "claim(uint256)", "2", "--unlocked", "--from", BETTOR);

	await until(
		async () => (await gql(`{ market(id: "2") { outcome } }`)).market.outcome === 1,
		"resolve",
	);
	await until(
		async () =>
			(await gql(`{ participant(marketId: "2", account: "${BETTOR.toLowerCase()}") { claimed } }`))
				.participant.claimed,
		"claim",
	);
	const { market, participant } = await gql(`{
		market(id: "2") { pot settlementRate }
		participant(marketId: "2", account: "${BETTOR.toLowerCase()}") { yesStaked claimed }
	}`);
	assert.equal(BigInt(market.settlementRate), 16n * 10n ** 23n);
	// The only YES bettor takes back their principal plus the whole pot.
	assert.ok(BigInt(participant.claimed) > BigInt(participant.yesStaked));
	assert.ok(BigInt(participant.claimed) <= BigInt(participant.yesStaked) + BigInt(market.pot));
});
