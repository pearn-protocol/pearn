import {
	type Address,
	BaseError,
	createWalletClient,
	custom,
	type EIP1193Provider,
	UserRejectedRequestError,
} from "viem";
import { chain } from "./config.ts";

declare global {
	interface Window {
		ethereum?: EIP1193Provider;
	}
}

/** The injected wallet (MetaMask or any EIP-1193 extension), or null if there is none. */
export const injected = () => (typeof window === "undefined" ? null : (window.ethereum ?? null));

export const walletFor = (provider: EIP1193Provider, address: Address) =>
	createWalletClient({ account: address, chain, transport: custom(provider) });

export type Wallet = ReturnType<typeof walletFor>;

/** Switches the wallet to the app's Aurora network, adding it first if the wallet lacks it. */
export async function ensureChain(wallet: Wallet) {
	if ((await wallet.getChainId()) === chain.id) return;
	try {
		await wallet.switchChain({ id: chain.id });
	} catch (e) {
		// 4902: the wallet does not know the chain yet.
		if ((e as { code?: number }).code !== 4902 && !String(e).includes("4902")) throw e;
		await wallet.addChain({ chain });
	}
}

/** One short line for a failed call: viem's short message, or "Rejected in wallet". */
export function errorMessage(e: unknown): string {
	if (e instanceof BaseError) {
		if (e.walk((x) => x instanceof UserRejectedRequestError)) return "Rejected in wallet";
		return e.shortMessage;
	}
	return e instanceof Error ? e.message : String(e);
}
