"use client";
import Link from "next/link";
import { useState } from "react";
import { useNow } from "@/hooks/useNow";
import { short } from "@/lib/format";
import type { Listed } from "@/lib/home";
import { phaseOf } from "@/lib/markets";
import Glyph from "./Glyph";

const MAX = 5;
const CELLS = 24;

/** The chance as a row of ASCII cells: accent `#` for YES, dim `.` for the rest. */
function Cells({ yes }: { yes: number | null }) {
	const n = Math.round(((yes ?? 0) / 100) * CELLS);
	return (
		<p aria-hidden="true" className="pbar">
			{Array.from({ length: CELLS }, (_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: fixed cells, position is the identity
				<span className={i < n ? "is-yes" : undefined} key={i}>
					{i < n ? "#" : "."}
				</span>
			))}
		</p>
	);
}

/**
 * The open markets with the most Polymarket volume, one at a time, with the ASCII mark beside
 * them, and prev/next/dot controls. Never auto-advances.
 */
export default function Featured({
	items,
	mark,
	loading,
}: {
	/** Already sorted by interest. */
	items: Listed[];
	mark: string;
	loading: boolean;
}) {
	const now = useNow(10_000);
	const open = items.filter((x) => phaseOf(x.m, now) === "open").slice(0, MAX);
	const [i, setI] = useState(0);
	const k = Math.min(i, open.length - 1);
	const it = open[k];
	const go = (d: number) => setI((k + d + open.length) % open.length);

	return (
		<section aria-label="Featured market" aria-roledescription="carousel" className="feat">
			<div className="feat__card">
				<div className="feat__body">
					{it ? (
						<>
							<p className="feat__cat">
								<Glyph mirror={it.mirror} topic={it.topic} /> {it.topic}
							</p>
							<h2 className="feat__title">
								<Link href={`/market/?id=${it.m.id}`}>{it.m.question}</Link>
							</h2>
							<ul className="feat__rows">
								<li>
									<Link href={`/market/?id=${it.m.id}&side=yes`}>Yes</Link>
									<span>{it.chance === null ? "—" : `${it.chance}%`}</span>
								</li>
								<li>
									<Link href={`/market/?id=${it.m.id}&side=no`}>No</Link>
									<span>{it.chance === null ? "—" : `${100 - it.chance}%`}</span>
								</li>
							</ul>
							<Cells yes={it.chance} />
							<footer className="mmeta">
								<span
									className="mmeta__chip"
									title="Every bettor gets their principal's NEAR value back"
								>
									Principal: returned
								</span>
								<span className="mmeta__chip" title="Win or lose, the stake comes back">
									No-loss
								</span>
								<span className="mmeta__badge">
									{it.mirror ? "Resolves per Polymarket" : `Resolver ${short(it.m.resolver)}`}
								</span>
							</footer>
						</>
					) : (
						<p className="muted">{loading ? "Loading markets…" : "No open market right now."}</p>
					)}
				</div>
				<pre aria-hidden="true" className="feat__visual">
					{mark}
				</pre>
			</div>
			{/* Always there (empty while loading), so the controls never push the page down. */}
			<div className="feat__nav">
				{open.length > 1 && (
					<>
						<button aria-label="Previous featured market" onClick={() => go(-1)} type="button">
							←
						</button>
						{open.map((x, n) => (
							<button
								aria-current={n === k}
								aria-label={`Featured market ${n + 1} of ${open.length}`}
								className="feat__dot"
								key={x.m.id}
								onClick={() => setI(n)}
								type="button"
							/>
						))}
						<button aria-label="Next featured market" onClick={() => go(1)} type="button">
							→
						</button>
					</>
				)}
			</div>
		</section>
	);
}
