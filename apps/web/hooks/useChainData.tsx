"use client";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { type MarketWithId, type OracleState, readMarkets, readOracle } from "@/lib/chain";
import { contracts, POLL_MS } from "@/lib/config";
import { usePoll } from "./usePoll";

type ChainData = {
	markets: MarketWithId[] | null;
	oracle: OracleState | null;
	error: string | null;
	/** Bumps on every successful read, so per-account reads can follow along. */
	version: number;
	/** Re-reads now, e.g. right after a transaction. */
	refresh: () => Promise<void>;
};

const ChainDataContext = createContext<ChainData | null>(null);

/** Every market and the oracle, polled for the whole app. Idle until the contracts exist. */
export function ChainDataProvider({ children }: { children: ReactNode }) {
	const [markets, setMarkets] = useState<MarketWithId[] | null>(null);
	const [oracle, setOracle] = useState<OracleState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState(0);

	const refresh = useCallback(async () => {
		if (!contracts.markets || !contracts.oracle) return;
		try {
			const [m, o] = await Promise.all([
				readMarkets(contracts.markets),
				readOracle(contracts.oracle),
			]);
			setMarkets(m);
			setOracle(o);
			setError(null);
			setVersion((v) => v + 1);
		} catch {
			setError("Aurora RPC did not answer; retrying.");
		}
	}, []);

	usePoll(refresh, POLL_MS);

	return (
		<ChainDataContext.Provider value={{ markets, oracle, error, version, refresh }}>
			{children}
		</ChainDataContext.Provider>
	);
}

export function useChainData(): ChainData {
	const ctx = useContext(ChainDataContext);
	if (!ctx) throw new Error("useChainData outside ChainDataProvider");
	return ctx;
}
