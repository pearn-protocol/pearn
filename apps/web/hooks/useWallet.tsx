"use client";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { type Address, getAddress } from "viem";
import { errorMessage, injected, type Wallet, walletFor } from "@/lib/wallet";

type WalletState = {
	address: Address | null;
	wallet: Wallet | null;
	/** False when the browser has no injected wallet at all. */
	available: boolean;
	error: string | null;
	connect: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
	const [address, setAddress] = useState<Address | null>(null);
	const [available, setAvailable] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const adopt = useCallback((accounts: unknown) => {
		const first = Array.isArray(accounts) ? accounts[0] : undefined;
		setAddress(typeof first === "string" ? getAddress(first) : null);
	}, []);

	// Picks up an already-authorised account and follows account switches in the wallet.
	useEffect(() => {
		const provider = injected();
		setAvailable(provider !== null);
		if (!provider) return;
		provider.request({ method: "eth_accounts" }).then(adopt, () => {
			// a locked wallet stays disconnected until the user connects
		});
		provider.on("accountsChanged", adopt);
		return () => provider.removeListener("accountsChanged", adopt);
	}, [adopt]);

	const connect = useCallback(async () => {
		const provider = injected();
		if (!provider) return setAvailable(false);
		setError(null);
		try {
			adopt(await provider.request({ method: "eth_requestAccounts" }));
		} catch (e) {
			setError(errorMessage(e));
		}
	}, [adopt]);

	const provider = injected();
	const wallet = provider && address ? walletFor(provider, address) : null;

	return (
		<WalletContext.Provider value={{ address, wallet, available, error, connect }}>
			{children}
		</WalletContext.Provider>
	);
}

export function useWallet(): WalletState {
	const ctx = useContext(WalletContext);
	if (!ctx) throw new Error("useWallet outside WalletProvider");
	return ctx;
}
