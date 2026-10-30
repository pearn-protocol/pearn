import { type Address, erc20Abi, getContract, type Hash } from "viem";
import { pearnMarketsAbi, rateOracleAbi } from "./abi.ts";
import { publicClient } from "./chain.ts";
import { contracts } from "./config.ts";
import { ensureChain, type Wallet } from "./wallet.ts";

/**
 * Every write the app makes. Each switches the wallet to Aurora, sends, and waits for the
 * receipt; a reverted receipt throws.
 */
async function send(wallet: Wallet, write: () => Promise<Hash>): Promise<Hash> {
	await ensureChain(wallet);
	const hash = await write();
	const receipt = await publicClient.waitForTransactionReceipt({ hash });
	if (receipt.status !== "success") throw new Error(`Transaction ${hash} reverted`);
	return hash;
}

const marketsOf = (wallet: Wallet, address: Address) =>
	getContract({ address, abi: pearnMarketsAbi, client: wallet }).write;

/** Approves exactly `amount` stNEAR to the markets contract when the allowance is short. */
async function approveIfNeeded(wallet: Wallet, markets: Address, amount: bigint) {
	const token = getContract({
		address: contracts.stNear,
		abi: erc20Abi,
		client: { public: publicClient, wallet },
	});
	if ((await token.read.allowance([wallet.account.address, markets])) >= amount) return;
	await send(wallet, () => token.write.approve([markets, amount]));
}

export async function bet(
	wallet: Wallet,
	markets: Address,
	id: bigint,
	side: number,
	amount: bigint,
) {
	await approveIfNeeded(wallet, markets, amount);
	return send(wallet, () => marketsOf(wallet, markets).bet([id, side, amount]));
}

export async function sponsor(wallet: Wallet, markets: Address, id: bigint, amount: bigint) {
	await approveIfNeeded(wallet, markets, amount);
	return send(wallet, () => marketsOf(wallet, markets).sponsor([id, amount]));
}

export const createMarket = (
	wallet: Wallet,
	markets: Address,
	question: string,
	closeTime: bigint,
	resolver: Address,
) => send(wallet, () => marketsOf(wallet, markets).createMarket([question, closeTime, resolver]));

export const resolve = (wallet: Wallet, markets: Address, id: bigint, outcome: number) =>
	send(wallet, () => marketsOf(wallet, markets).resolve([id, outcome]));

export const voidExpired = (wallet: Wallet, markets: Address, id: bigint) =>
	send(wallet, () => marketsOf(wallet, markets).voidExpired([id]));

export const overrideInvalid = (wallet: Wallet, markets: Address, id: bigint) =>
	send(wallet, () => marketsOf(wallet, markets).overrideInvalid([id]));

export const claim = (wallet: Wallet, markets: Address, id: bigint) =>
	send(wallet, () => marketsOf(wallet, markets).claim([id]));

/** Asks the oracle for a fresh rate. Free after the oracle's first sync (DESIGN.md §2). */
export const syncRate = (wallet: Wallet, oracle: Address) =>
	send(wallet, () =>
		getContract({ address: oracle, abi: rateOracleAbi, client: wallet }).write.sync(),
	);
