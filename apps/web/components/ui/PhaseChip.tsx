import { OUTCOME_LABEL, PHASE_LABEL, type Phase } from "@/lib/markets";

/** The market's phase; settled markets show their outcome. */
export default function PhaseChip({ phase, outcome }: { phase: Phase; outcome: number }) {
	const label = phase === "final" ? `Settled: ${OUTCOME_LABEL[outcome]}` : PHASE_LABEL[phase];
	return <span className={`chip ${phase}`}>{label}</span>;
}
