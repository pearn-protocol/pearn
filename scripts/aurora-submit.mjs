// Replays a Forge script run on Aurora through NEAR: each transaction is signed with gas price 0
// and handed to the Aurora engine's `submit` method by a NEAR account, which pays the NEAR gas.
// No Aurora ETH needed. Resumable: transactions whose nonce is already used are skipped.
//
// Usage:
//   forge script <script> --rpc-url aurora_testnet --legacy        # simulate only, no --broadcast
//   node scripts/aurora-submit.mjs contracts/broadcast/<script>/<chainId>/dry-run/run-latest.json
// Env: WALLET_PK (the Aurora signer), NEAR_SIGNER (the NEAR account paying NEAR gas),
//      NEAR_PRIVATE_KEY (optional: its key, e.g. a function-call key for aurora.submit only;
//      without it near-cli signs from the legacy keychain), NEAR_CLI (near-cli-rs binary,
//      default `near`), NEAR_NETWORK (default testnet), AURORA_RPC (default testnet RPC).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const [file] = process.argv.slice(2);
const { WALLET_PK, NEAR_SIGNER } = process.env;
if (!file || !WALLET_PK || !NEAR_SIGNER) {
	throw new Error("usage: WALLET_PK=… NEAR_SIGNER=… node scripts/aurora-submit.mjs <run.json>");
}
const NEAR = process.env.NEAR_CLI ?? "near";
const NEAR_KEY = process.env.NEAR_PRIVATE_KEY;
const NETWORK = process.env.NEAR_NETWORK ?? "testnet";
const RPC = process.env.AURORA_RPC ?? "https://testnet.aurora.dev";
/** The Aurora engine's NEAR account, on mainnet and testnet alike. */
const ENGINE = "aurora";
/** Headroom over Forge's estimate; unused gas costs nothing at price 0. */
const GAS_MARGIN = 13n;

const cast = (...args) => execFileSync("cast", args, { encoding: "utf8" }).trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** The signed raw transaction for one Forge transaction, at gas price 0. */
function sign(tx, chainId) {
	const gas = (BigInt(tx.gas) * GAS_MARGIN) / 10n;
	const common = [
		"mktx",
		"--legacy",
		"--gas-price",
		"0",
		"--gas-limit",
		gas.toString(),
		"--nonce",
		BigInt(tx.nonce).toString(),
		"--chain",
		chainId.toString(),
		"--value",
		BigInt(tx.value ?? 0).toString(),
		"--private-key",
		WALLET_PK,
	];
	const data = tx.input ?? tx.data ?? "0x";
	return tx.to ? cast(...common, tx.to, data) : cast(...common, "--create", data);
}

function submit(raw) {
	const args = Buffer.from(raw.slice(2), "hex").toString("base64");
	execFileSync(
		NEAR,
		[
			"contract",
			"call-function",
			"as-transaction",
			ENGINE,
			"submit",
			"base64-args",
			args,
			"prepaid-gas",
			"300 Tgas",
			"attached-deposit",
			"0 NEAR",
			"sign-as",
			NEAR_SIGNER,
			"network-config",
			NETWORK,
			...(NEAR_KEY ? ["sign-with-plaintext-private-key", NEAR_KEY] : ["sign-with-legacy-keychain"]),
			"send",
		],
		{ stdio: "ignore" },
	);
}

async function receipt(hash) {
	for (let i = 0; i < 30; i++) {
		try {
			return cast("receipt", hash, "status", "--rpc-url", RPC);
		} catch {
			await sleep(2000);
		}
	}
	throw new Error(`no receipt for ${hash}`);
}

const run = JSON.parse(readFileSync(file, "utf8"));
const chainId = Number(cast("chain-id", "--rpc-url", RPC));
for (const { transaction: tx, contractName, contractAddress, function: fn } of run.transactions) {
	const label = contractName ? `${contractName}${fn ? `.${fn}` : ""}` : (fn ?? tx.to);
	const used = BigInt(cast("nonce", tx.from, "--rpc-url", RPC));
	if (BigInt(tx.nonce) < used) {
		console.log(`skip  ${label} (nonce ${BigInt(tx.nonce)} already used)`);
		continue;
	}
	if (BigInt(tx.nonce) > used)
		throw new Error(`nonce gap: account at ${used}, next tx wants ${BigInt(tx.nonce)}`);

	const raw = sign(tx, chainId);
	const hash = cast("keccak", raw);
	submit(raw);
	const status = await receipt(hash);
	if (status !== "true") throw new Error(`${label} reverted: ${hash}`);
	console.log(`ok    ${label} ${contractAddress ?? ""} ${hash}`);
}
