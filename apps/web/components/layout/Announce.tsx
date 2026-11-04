"use client";
import Link from "next/link";
import { useChainData } from "@/hooks/useChainData";
import { useNow } from "@/hooks/useNow";
import { byInterest, listed } from "@/lib/home";
import { phaseOf } from "@/lib/markets";

/** The top strip: a ticker of open markets and their chance, each linking to its page. */
export default function Announce() {
	const { markets, references } = useChainData();
	const now = useNow();
	const items = (markets ?? [])
		.filter((m) => phaseOf(m, now) === "open")
		.map((m) => listed(m, references))
		.sort((a, b) => byInterest(a, b, now));
	if (items.length === 0) return null;

	const run = (copy: number) =>
		items.map(({ m, topic, chance, chanceLabel }) => (
			<Link
				aria-hidden={copy > 0 || undefined}
				href={`/market/?id=${m.id}`}
				key={`${copy}:${m.id}`}
				tabIndex={copy > 0 ? -1 : undefined}
			>
				<span className="announce__topic">{topic}</span> {m.question}
				{chance !== null && (
					<b>
						{" "}
						{chance}% {chanceLabel}
					</b>
				)}
			</Link>
		));
	// Two copies scroll as one loop; the second is for looks only.
	return (
		<nav aria-label="Market news" className="announce">
			<div className="announce__track">
				{run(0)}
				{run(1)}
			</div>
		</nav>
	);
}
