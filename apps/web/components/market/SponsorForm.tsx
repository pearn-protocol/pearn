"use client";
import { useState } from "react";
import AmountInput from "@/components/ui/AmountInput";
import TxStatus from "@/components/ui/TxStatus";
import { usePosition } from "@/hooks/usePosition";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { sponsor } from "@/lib/actions";
import type { MarketWithId } from "@/lib/chain";
import { contracts } from "@/lib/config";
import { parseAmount } from "@/lib/format";

/** Adds stNEAR to the pot. Sponsors get it back only if nobody bets at all. */
export default function SponsorForm({ m }: { m: MarketWithId }) {
	const { wallet } = useWallet();
	const { account } = usePosition(m.id);
	const tx = useTx();
	const [input, setInput] = useState("");
	const value = parseAmount(input);
	if (!wallet) return null;

	const submit = async () => {
		const markets = contracts.markets;
		if (!markets || !value) return;
		if (await tx.run(() => sponsor(wallet, markets, m.id, value))) setInput("");
	};

	return (
		<div className="card form">
			<h2>Sponsor the pot</h2>
			<p className="muted small">
				Sponsored stNEAR goes to the winners. It comes back to you only if nobody bets.
			</p>
			<AmountInput balance={account?.balance ?? null} onChange={setInput} value={input} />
			<button
				className="button ghost"
				disabled={!value || (account !== null && value > account.balance) || tx.pending}
				onClick={submit}
				type="button"
			>
				Approve and sponsor
			</button>
			<TxStatus {...tx} />
		</div>
	);
}
