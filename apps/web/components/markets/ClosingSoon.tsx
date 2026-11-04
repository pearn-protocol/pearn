import Link from "next/link";
import { duration } from "@/lib/format";
import type { Listed } from "@/lib/home";

const MAX = 5;

/** Open markets by how soon betting closes. */
export default function ClosingSoon({ items, now }: { items: Listed[]; now: number }) {
	const list = items
		.filter(({ m }) => m.outcome === 0 && now < Number(m.closeTime))
		.sort((a, b) => Number(a.m.closeTime) - Number(b.m.closeTime))
		.slice(0, MAX);
	return (
		<section aria-labelledby="soon-title" className="soon">
			<h2 className="soon__title" id="soon-title">
				Closing soon
			</h2>
			<ol>
				{list.map(({ m, chance }, k) => (
					<li key={m.id}>
						<Link className="soon__row" href={`/market/?id=${m.id}`}>
							<span className="soon__n">{k + 1}</span>
							<span className="soon__q">{m.question}</span>
							<span className="soon__meta">
								{chance === null ? "—" : `${chance}%`}
								<small>{duration(Number(m.closeTime) - now)}</small>
							</span>
						</Link>
					</li>
				))}
			</ol>
		</section>
	);
}
