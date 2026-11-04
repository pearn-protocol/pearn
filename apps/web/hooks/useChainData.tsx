"use client";
import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { REFERENCE_URL } from "@/lib/catalog";
import { type MarketWithId, type OracleState, readMarkets, readOracle } from "@/lib/chain";
import { contracts, POLL_MS } from "@/lib/config";
import { fetchPrices, type Prices } from "@/lib/price";
import { fetchReferences, type Reference } from "@/lib/reference";
import { usePoll } from "./usePoll";

type ChainData = {
	markets: MarketWithId[] | null;
	oracle: OracleState | null;
	error: string | null;
	/** Mainnet USD prices, null until (or if never) the price feed answers. */
	prices: Prices | null;
	/** Polymarket's live price and volume per mirrored market slug; empty until it answers. */
	references: Map<string, Reference>;
	/** Bumps on every successful read, so per-account reads can follow along. */
	version: number;
	/** Re-reads now, e.g. right after a transaction. */
	refresh: () => Promise<void>;
};

const PRICE_MS = 5 * 60_000;

const ChainDataContext = createContext<ChainData | null>(null);

/** Every market and the oracle, polled for the whole app. Idle until the contracts exist. */
export function ChainDataProvider({ children }: { children: ReactNode }) {
	const [markets, setMarkets] = useState<MarketWithId[] | null>(null);
	const [oracle, setOracle] = useState<OracleState | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState(0);
	const [prices, setPrices] = useState<Prices | null>(null);
	const [references, setReferences] = useState<Map<string, Reference>>(new Map());

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
	// A failed price read keeps the last prices; amounts just lose their USD line meanwhile.
	usePoll(async () => setPrices(await fetchPrices()), PRICE_MS);
	usePoll(async () => setReferences(await fetchReferences(REFERENCE_URL)), PRICE_MS);

	return (
		<ChainDataContext.Provider
			value={{ markets, oracle, error, prices, references, version, refresh }}
		>
			{children}
		</ChainDataContext.Provider>
	);
}

export function useChainData(): ChainData {
	const ctx = useContext(ChainDataContext);
	if (!ctx) throw new Error("useChainData outside ChainDataProvider");
	return ctx;
}
