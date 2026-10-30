// The whole app on one machine: anvil, the DevChain script, then `next dev` pointed at it.
// Usage: pnpm dev:local (needs Foundry). Ctrl-C stops everything.
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const RPC = "http://127.0.0.1:8545";
const contracts = new URL("../../../contracts/", import.meta.url);

const anvil = spawn("anvil", ["--silent"], { stdio: "inherit" });
const stop = () => anvil.kill();
process.on("exit", stop);
process.on("SIGINT", () => process.exit(0));

for (let i = 0; ; i++) {
	try {
		execFileSync("cast", ["chain-id", "-r", RPC], { stdio: "ignore" });
		break;
	} catch {
		if (i === 30) throw new Error("anvil did not start");
		await new Promise((r) => setTimeout(r, 300));
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
const d = JSON.parse(readFileSync(new URL("deployments/31337.json", contracts), "utf8"));

spawn("pnpm", ["dev"], {
	stdio: "inherit",
	env: {
		...process.env,
		NEXT_PUBLIC_CHAIN_ID: "31337",
		NEXT_PUBLIC_STNEAR: d.stNear,
		NEXT_PUBLIC_ORACLE: d.oracle,
		NEXT_PUBLIC_MARKETS: d.markets,
	},
}).on("exit", (code) => process.exit(code ?? 0));
