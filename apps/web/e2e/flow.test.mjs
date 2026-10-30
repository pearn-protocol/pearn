// End to end on a local chain: bet through the UI, resolve, then claim principal + winnings.
// Usage: pnpm e2e (needs Foundry and Chrome).
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createPublicClient, erc20Abi, http, parseUnits } from "viem";
import { foundry } from "viem/chains";
import { pearnMarketsAbi } from "../lib/abi.ts";
import { launchChrome, openTab } from "./cdp.mjs";
import { ACCOUNTS, APP, RPC, rpc, startStack, walletScript, warp } from "./stack.mjs";

const client = createPublicClient({ chain: foundry, transport: http(RPC) });
let stack;
let chrome;

before(async () => {
	stack = await startStack();
	chrome = await launchChrome();
});

after(() => {
	chrome?.close();
	stack?.stop();
});

const tabAs = async (account) => openTab(chrome.port, await walletScript(account));

const position = (id, account, side) =>
	client.readContract({
		address: stack.deployment.markets,
		abi: pearnMarketsAbi,
		functionName: "positionOf",
		args: [id, account, side],
	});

test("bet on YES from the market page", async () => {
	const tab = await tabAs(ACCOUNTS[1]);
	await tab.goto(`${APP}/market/?id=0`);
	await tab.click("Connect wallet");
	await tab.waitForText("0x7099");
	await tab.type("input[inputmode=decimal]", "5");
	await tab.waitForText("Principal, returned in full");
	await tab.click("Approve and bet");
	await tab.waitForText("Done.");
	tab.close();

	// DevChain bet 120 on YES from this account; the UI added 5.
	const yes = await position(0n, ACCOUNTS[1], 0);
	assert.equal(yes.staked, parseUnits("125", 24));
});

test("resolve, wait out the challenge window, claim", async () => {
	// Market 2 closes in a day: account 2 bet 25 on YES, the deployer sponsored 100.
	await warp(86_400 + 60);
	await rpc("eth_sendTransaction", [
		{
			from: ACCOUNTS[0],
			to: stack.deployment.oracle,
			// MockRateOracle.set(1.6e24): a later reading, as a keeper sync would bring.
			data: `0x60fe47b1${parseUnits("1.6", 24).toString(16).padStart(64, "0")}`,
		},
	]);

	const resolver = await tabAs(ACCOUNTS[0]);
	await resolver.goto(`${APP}/market/?id=2`);
	await resolver.click("Connect wallet");
	await resolver.waitForText("Resolve this market");
	await resolver.click("Yes");
	await resolver.waitForText("Challenge window");
	resolver.close();

	await warp(86_400 + 60);
	const bettor = await tabAs(ACCOUNTS[2]);
	await bettor.goto(`${APP}/market/?id=2`);
	await bettor.click("Connect wallet");
	await bettor.click("Claim");
	await bettor.waitForText("Claimed.");
	bettor.close();

	const claimed = await client.readContract({
		address: stack.deployment.markets,
		abi: pearnMarketsAbi,
		functionName: "hasClaimed",
		args: [2n, ACCOUNTS[2]],
	});
	assert.equal(claimed, true);

	// 895 left after DevChain's two bets (80 on market 0, 25 here). The claim pays the bet's
	// NEAR value back at the new rate plus the whole pot (its yield and the 100 sponsored):
	// 25 + 100 stNEAR, less rounding dust.
	const balance = await client.readContract({
		address: stack.deployment.stNear,
		abi: erc20Abi,
		functionName: "balanceOf",
		args: [ACCOUNTS[2]],
	});
	assert.ok(
		balance > parseUnits("1019.99", 24) && balance <= parseUnits("1020", 24),
		String(balance),
	);
});
