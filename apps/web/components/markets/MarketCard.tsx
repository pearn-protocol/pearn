import Link from "next/link";
import Amount from "@/components/ui/Amount";
import OddsBar from "@/components/ui/OddsBar";
import PhaseChip from "@/components/ui/PhaseChip";
import type { MarketWithId } from "@/lib/chain";
import { duration } from "@/lib/format";
import { phaseOf, potAt } from "@/lib/markets";

export default function MarketCard({
	m,
	rate,
	now,
}: {
	m: MarketWithId;
	rate: bigint;
	now: number;
}) {
	const phase = phaseOf(m, now);
	return (
		<Link className="card market-card" href={`/market/?id=${m.id}`}>
			<div className="row">
				<PhaseChip outcome={m.outcome} phase={phase} />
				{phase === "open" && (
					<span className="muted">closes in {duration(Number(m.closeTime) - now)}</span>
				)}
			</div>
			<h3>{m.question}</h3>
			<OddsBar m={m} />
			<dl className="stats">
				<div>
					<dt>Pot</dt>
					<dd>
						<Amount value={potAt(m, rate)} />
					</dd>
				</div>
				<div>
					<dt>Staked</dt>
					<dd>
						<Amount value={m.yes.staked + m.no.staked} />
					</dd>
				</div>
			</dl>
		</Link>
	);
}
