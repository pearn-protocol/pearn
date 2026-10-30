import { type Market, yesPercent } from "@/lib/markets";

/** YES vs NO by principal staked. */
export default function OddsBar({ m }: { m: Pick<Market, "yes" | "no"> }) {
	const yes = yesPercent(m);
	return (
		<div className="odds">
			<div aria-label={`Yes ${yes}%, No ${100 - yes}%`} className="odds-bar" role="img">
				<span className="yes" style={{ width: `${yes}%` }} />
				<span className="no" style={{ width: `${100 - yes}%` }} />
			</div>
			<div className="row">
				<span className="yes-text">Yes {yes}%</span>
				<span className="no-text">No {100 - yes}%</span>
			</div>
		</div>
	);
}
