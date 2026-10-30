import { Side } from "@/lib/markets";

/** Yes / No toggle. */
export default function SidePicker({
	side,
	onChange,
}: {
	side: number;
	onChange: (s: number) => void;
}) {
	return (
		<fieldset className="toggle">
			<legend className="sr-only">Side</legend>
			{[Side.Yes, Side.No].map((s) => (
				<button
					aria-pressed={side === s}
					className={`button ${side === s ? (s === Side.Yes ? "yes" : "no") : "ghost"}`}
					key={s}
					onClick={() => onChange(s)}
					type="button"
				>
					{s === Side.Yes ? "Yes" : "No"}
				</button>
			))}
		</fieldset>
	);
}
