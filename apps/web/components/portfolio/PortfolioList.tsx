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
import { contracts, POLL_MS } from "@/lib/config";
import { phaseOf } from "@/lib/markets";

type Row = { m: MarketWithId; p: Position };

/** Every market the connected account bet on or sponsored. */
export default function PortfolioList() {
	const { address, connect } = useWallet();
	const { markets, version } = useChainData();
	const now = useNow(10_000);
	const [read, setRead] = useState<{ address: string; rows: Row[] }>();

	// ponytail: one position read per market, straight from the chain. The indexer lags a few
	// blocks and rebuilds after each redeploy, so it would hide fresh bets. Filter by the
	// indexer's participant list once there are too many markets to read, and still read the
	// markets newer than its last indexed block.
	usePoll(
		async () => {
			const pearn = contracts.markets;
			if (!pearn || !address || !markets) return;
			const all = await Promise.all(
				markets.map(async (m) => ({ m, p: await readPosition(pearn, m.id, address) })),
			);
			setRead({
				address,
				rows: all.filter(({ p }) => p.yes.staked + p.no.staked + p.sponsored > 0n),
			});
		},
		POLL_MS,
		`${address}:${version}`,
	);
	const rows = read?.address === address ? read.rows : null;

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
		return <p className="muted">No bets yet. Pick a market: win or lose, your stake comes back.</p>;

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
