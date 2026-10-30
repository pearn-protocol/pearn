"use client";
import Amount from "@/components/ui/Amount";
import Stat from "@/components/ui/Stat";
import TxStatus from "@/components/ui/TxStatus";
import { usePosition } from "@/hooks/usePosition";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { claim } from "@/lib/actions";
import type { MarketWithId } from "@/lib/chain";
import { contracts } from "@/lib/config";
import { duration } from "@/lib/format";
import { CHALLENGE_WINDOW, phaseOf } from "@/lib/markets";

/** The connected account's stake in this market and, once final, its claim. */
export default function PositionPanel({ m, now }: { m: MarketWithId; now: number }) {
	const { wallet } = useWallet();
	const { position } = usePosition(m.id);
	const tx = useTx();
	if (!wallet || !position) return null;

	const { yes, no, sponsored, claimable, claimed } = position;
	if (yes.staked + no.staked + sponsored === 0n) return null;
	const phase = phaseOf(m, now);
	const markets = contracts.markets;

	return (
		<div className="card form">
			<h2>Your position</h2>
			<dl className="stats">
				{yes.staked > 0n && <Stat label="On Yes" value={yes.staked} />}
				{no.staked > 0n && <Stat label="On No" value={no.staked} />}
				{sponsored > 0n && <Stat label="Sponsored" value={sponsored} />}
				{yes.principal + no.principal > 0n && (
					<Stat label="Principal (NEAR)" unit="NEAR" value={yes.principal + no.principal} />
				)}
			</dl>
			{phase === "challenge" && (
				<p className="muted small">
					Claims open in {duration(Number(m.resolvedAt) + CHALLENGE_WINDOW - now)}, after the
					challenge window.
				</p>
			)}
			{phase === "final" &&
				(claimed ? (
					<p className="status ok">Claimed.</p>
				) : claimable > 0n ? (
					<button
						className="button"
						disabled={tx.pending || !markets}
						onClick={() => markets && tx.run(() => claim(wallet, markets, m.id))}
						type="button"
					>
						Claim <Amount value={claimable} />
					</button>
				) : (
					<p className="muted small">Nothing to claim.</p>
				))}
			<TxStatus {...tx} />
		</div>
	);
}
