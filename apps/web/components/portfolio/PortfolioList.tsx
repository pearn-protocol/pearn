"use client";
import Link from "next/link";
import { useState } from "react";
import NotDeployed from "@/components/ui/NotDeployed";
import PhaseChip from "@/components/ui/PhaseChip";
import Stat from "@/components/ui/Stat";
import { useChainData } from "@/hooks/useChainData";
import { useNow } from "@/hooks/useNow";
import { usePoll } from "@/hooks/usePoll";
import { useWallet } from "@/hooks/useWallet";
import { type MarketWithId, type Position, readPosition } from "@/lib/chain";
import { contracts, INDEXER_URL, POLL_MS } from "@/lib/config";
import { readAccountMarkets } from "@/lib/indexer";
import { phaseOf } from "@/lib/markets";

type Row = { m: MarketWithId; p: Position };

/**
 * The markets an account touched: the indexer says which, so only those positions are read
 * from the chain. Without an indexer (or if it fails) every market is checked.
 */
async function candidates(markets: MarketWithId[], account: `0x${string}`) {
	if (!INDEXER_URL) return markets;
	try {
		const ids = new Set(await readAccountMarkets(INDEXER_URL, account));
		return markets.filter((m) => ids.has(m.id));
	} catch {
		return markets;
	}
}

/** Every market the connected account bet on or sponsored. */
export default function PortfolioList() {
	const { address, connect } = useWallet();
	const { markets, version } = useChainData();
	const now = useNow(10_000);
	const [rows, setRows] = useState<Row[] | null>(null);

	usePoll(
		async () => {
			const pearn = contracts.markets;
			if (!pearn || !address || !markets) return;
			const touched = await candidates(markets, address);
			const all = await Promise.all(
				touched.map(async (m) => ({ m, p: await readPosition(pearn, m.id, address) })),
			);
			setRows(all.filter(({ p }) => p.yes.staked + p.no.staked + p.sponsored > 0n));
		},
		POLL_MS,
		`${address}:${version}`,
	);

	if (!contracts.markets) return <NotDeployed />;
	if (!address) {
		return (
			<div className="card notice">
				<p className="muted">Connect a wallet to see your bets.</p>
				<button className="button" onClick={connect} type="button">
					Connect wallet
				</button>
			</div>
		);
	}
	if (!rows) return <p className="muted">Loading your positions…</p>;
	if (rows.length === 0)
		return <p className="muted">No bets yet. Pick a market and bet the yield.</p>;

	return (
		<div className="table">
			{rows.map(({ m, p }) => (
				<Link className="card portfolio-row" href={`/market/?id=${m.id}`} key={m.id}>
					<div>
						<PhaseChip outcome={m.outcome} phase={phaseOf(m, now)} />
						<h3>{m.question}</h3>
					</div>
					<dl className="stats">
						{p.yes.staked > 0n && <Stat label="On Yes" value={p.yes.staked} />}
						{p.no.staked > 0n && <Stat label="On No" value={p.no.staked} />}
						{p.sponsored > 0n && <Stat label="Sponsored" value={p.sponsored} />}
						{p.claimable > 0n && <Stat label="Claimable" value={p.claimable} />}
					</dl>
				</Link>
			))}
		</div>
	);
}
