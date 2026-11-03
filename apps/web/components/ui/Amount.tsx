"use client";
import { useChainData } from "@/hooks/useChainData";
import { amount } from "@/lib/format";
import { usd } from "@/lib/price";

/** A stNEAR (or NEAR) amount with its unit and USD value; the exact raw value on hover. */
export default function Amount({
	value,
	unit = "stNEAR",
}: {
	value: bigint;
	unit?: "stNEAR" | "NEAR";
}) {
	const { prices } = useChainData();
	return (
		<span className="amount" title={`${value} raw units`}>
			{amount(value)} <small>{unit}</small>
			{prices && (
				<small className="usd" title="At mainnet market prices">
					{" "}
					≈ {usd(value, prices[unit])}
				</small>
			)}
		</span>
	);
}
