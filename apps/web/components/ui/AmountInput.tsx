"use client";
import { useId } from "react";
import { formatUnits } from "viem";
import { DECIMALS } from "@/lib/format";
import Amount from "./Amount";

/** A stNEAR amount field with the wallet balance and a Max button. */
export default function AmountInput({
	value,
	onChange,
	balance,
}: {
	value: string;
	onChange: (v: string) => void;
	balance: bigint | null;
}) {
	const id = useId();
	// The Balance button sits outside the <label>: inside it, a click on the label text would press it.
	return (
		<div className="field">
			<span className="row">
				<label htmlFor={id}>Amount (stNEAR)</label>
				{balance !== null && (
					<button
						className="link"
						onClick={() => onChange(formatUnits(balance, DECIMALS))}
						type="button"
					>
						Balance <Amount value={balance} />
					</button>
				)}
			</span>
			<input
				autoComplete="off"
				id={id}
				inputMode="decimal"
				onChange={(e) => onChange(e.target.value)}
				placeholder="0.0"
				value={value}
			/>
		</div>
	);
}
