import Link from "next/link";
import Amount from "@/components/ui/Amount";
import { duration } from "@/lib/format";
import type { Listed } from "@/lib/home";
import { OUTCOME_LABEL, PHASE_LABEL, phaseOf, potAt } from "@/lib/markets";
import { usdCompact } from "@/lib/reference";
import ChanceRing from "./ChanceRing";
import Glyph from "./Glyph";

/** A market card: badge, question, chance ring, Bet Yes / Bet No, then pot and volume. */
export default function MarketCard({
	item: { m, mirror, ref, topic, chance, chanceLabel },
	rate,
	now,
}: {
	item: Listed;
	rate: bigint;
	now: number;
}) {
	const href = `/market/?id=${m.id}`;
	const phase = phaseOf(m, now);
	return (
		<article className="mcard">
			<header className="mcard__head">
				<Glyph mirror={mirror} topic={topic} />
				<h3 className="mcard__q">
					<Link href={href}>{m.question}</Link>
				</h3>
				<ChanceRing label={chanceLabel} pct={chance} />
			</header>
			{phase === "open" ? (
				<div className="prices">
					<Link className="price price--yes" href={`${href}&side=yes`}>
						Bet Yes <span aria-hidden="true">→</span>
					</Link>
					<Link className="price price--no" href={`${href}&side=no`}>
						Bet No <span aria-hidden="true">→</span>
					</Link>
				</div>
			) : (
				<p className="mcard__state">
					■ {phase === "final" ? `Settled: ${OUTCOME_LABEL[m.outcome]}` : PHASE_LABEL[phase]}
				</p>
			)}
			<footer className="mcard__foot">
				<span>
					Pot <Amount value={potAt(m, rate)} />
				</span>
				<span>
					{ref
						? `${usdCompact(ref.volume)} Polymarket vol.`
						: phase === "open"
							? `closes in ${duration(Number(m.closeTime) - now)}`
							: ""}
				</span>
			</footer>
		</article>
	);
}
