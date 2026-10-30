import { amount } from "@/lib/format";

/** A stNEAR (or NEAR) amount with its unit; the exact raw value on hover. */
export default function Amount({ value, unit = "stNEAR" }: { value: bigint; unit?: string }) {
	return (
		<span className="amount" title={`${value} raw units`}>
			{amount(value)} <small>{unit}</small>
		</span>
	);
}
