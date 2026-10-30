"use client";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import TxStatus from "@/components/ui/TxStatus";
import { useChainData } from "@/hooks/useChainData";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { overrideInvalid, resolve, voidExpired } from "@/lib/actions";
import { type MarketWithId, readGuardian } from "@/lib/chain";
import { contracts } from "@/lib/config";
import { Outcome, phaseOf } from "@/lib/markets";

/**
 * The settlement actions this account may take: the resolver reports the outcome, anyone voids
 * a market whose resolver timed out, and the guardian can force Invalid during the window.
 */
export default function ResolvePanel({ m, now }: { m: MarketWithId; now: number }) {
	const { wallet, address } = useWallet();
	const { oracle } = useChainData();
	const tx = useTx();
	const [guardian, setGuardian] = useState<Address | null>(null);
	const markets = contracts.markets;

	// The guardian is immutable: one read is enough.
	useEffect(() => {
		if (contracts.markets)
			readGuardian(contracts.markets).then(setGuardian, () => setGuardian(null));
	}, []);

	if (!wallet || !markets) return null;
	const phase = phaseOf(m, now);
	const isResolver = address === m.resolver;
	const isGuardian = address === guardian;

	if (phase === "closed" && isResolver) {
		const synced = oracle !== null && oracle.updatedAt >= Number(m.closeTime);
		return (
			<div className="card form">
				<h2>Resolve this market</h2>
				{!synced && (
					<p className="muted small">
						Sync the rate first: resolving needs a reading taken after close.
					</p>
				)}
				<div className="toggle">
					{(
						[
							["Yes", Outcome.Yes, "yes"],
							["No", Outcome.No, "no"],
							["Invalid", Outcome.Invalid, "ghost"],
						] as const
					).map(([label, outcome, style]) => (
						<button
							className={`button ${style}`}
							disabled={!synced || tx.pending}
							key={label}
							onClick={() => tx.run(() => resolve(wallet, markets, m.id, outcome))}
							type="button"
						>
							{label}
						</button>
					))}
				</div>
				<TxStatus {...tx} />
			</div>
		);
	}

	if (phase === "voidable") {
		return (
			<div className="card form">
				<h2>Resolver timed out</h2>
				<p className="muted small">
					Nobody resolved this market within 7 days of close. Anyone can void it: everyone gets
					their principal back and the yield is shared across all bettors.
				</p>
				<button
					className="button ghost"
					disabled={tx.pending}
					onClick={() => tx.run(() => voidExpired(wallet, markets, m.id))}
					type="button"
				>
					Void market
				</button>
				<TxStatus {...tx} />
			</div>
		);
	}

	if (phase === "challenge" && isGuardian && m.outcome !== Outcome.Invalid) {
		return (
			<div className="card form">
				<h2>Guardian</h2>
				<p className="muted small">Override a wrong outcome to Invalid before the window closes.</p>
				<button
					className="button no"
					disabled={tx.pending}
					onClick={() => tx.run(() => overrideInvalid(wallet, markets, m.id))}
					type="button"
				>
					Override to Invalid
				</button>
				<TxStatus {...tx} />
			</div>
		);
	}

	return null;
}
