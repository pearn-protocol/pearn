const R = 20;
const C = 2 * Math.PI * R;

/** A percentage as a square-capped ring with the number inside. */
export default function ChanceRing({ pct, label }: { pct: number | null; label: string }) {
	return (
		<div className="ring">
			<svg aria-hidden="true" className="ring__svg" viewBox="0 0 48 48">
				<circle className="ring__track" cx="24" cy="24" r={R} />
				<circle
					className="ring__val"
					cx="24"
					cy="24"
					r={R}
					strokeDasharray={`${((pct ?? 0) / 100) * C} ${C}`}
					transform="rotate(-90 24 24)"
				/>
			</svg>
			<p className="ring__text">
				<span className="ring__pct">{pct === null ? "—" : `${pct}%`}</span>
				<span className="ring__label">{label}</span>
			</p>
		</div>
	);
}
