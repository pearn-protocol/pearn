import Amount from "./Amount";

/** One labelled amount inside a `<dl className="stats">`. */
export default function Stat({
	label,
	value,
	unit,
}: {
	label: string;
	value: bigint;
	unit?: string;
}) {
	return (
		<div>
			<dt>{label}</dt>
			<dd>
				<Amount unit={unit} value={value} />
			</dd>
		</div>
	);
}
