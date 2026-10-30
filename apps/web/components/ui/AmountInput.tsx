"use client";
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
	return (
		<label>
			<span className="row">
				Amount (stNEAR)
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
				inputMode="decimal"
				onChange={(e) => onChange(e.target.value)}
				placeholder="0.0"
				value={value}
			/>
		</label>
	);
}
