"use client";
import { useState } from "react";
import AmountInput from "@/components/ui/AmountInput";
import TxStatus from "@/components/ui/TxStatus";
import { useChainData } from "@/hooks/useChainData";
import { usePosition } from "@/hooks/usePosition";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { bet } from "@/lib/actions";
import type { MarketWithId } from "@/lib/chain";
import { contracts, GET_STNEAR_URL } from "@/lib/config";
import { parseAmount } from "@/lib/format";
import { MAX_RATE_AGE, Side } from "@/lib/markets";
import { projectBet } from "@/lib/payout";
import ProjectionView from "./ProjectionView";
import SidePicker from "./SidePicker";

export default function BetForm({ m, now }: { m: MarketWithId; now: number }) {
	const { wallet, connect } = useWallet();
	const { oracle } = useChainData();
	const { account } = usePosition(m.id);
	const tx = useTx();
	const [side, setSide] = useState<number>(Side.Yes);
	const [input, setInput] = useState("");

	const value = parseAmount(input);
	const rate = oracle?.rate ?? 0n;
	const fresh = oracle !== null && rate > 0n && now - oracle.updatedAt <= MAX_RATE_AGE;
	const tooMuch = value !== null && account !== null && value > account.balance;
	const [pick, other] = side === Side.Yes ? [m.yes, m.no] : [m.no, m.yes];
	const projection =
		value && fresh
			? projectBet({
					amount: value,
					rate,
					now: BigInt(now),
					closeTime: m.closeTime,
					pick,
					other,
					sponsored: m.sponsored,
				})
			: null;
	const label = !fresh
		? "Waiting for a fresh rate"
		: tooMuch
			? "Not enough stNEAR"
			: "Approve and bet";

	const submit = async () => {
		const markets = contracts.markets;
		if (!wallet || !markets || !value) return;
		if (await tx.run(() => bet(wallet, markets, m.id, side, value))) setInput("");
	};

	return (
		<div className="card form">
			<h2>Place a bet</h2>
			<SidePicker onChange={setSide} side={side} />
			<AmountInput balance={account?.balance ?? null} onChange={setInput} value={input} />
			{projection && <ProjectionView p={projection} sideLabel={side === Side.Yes ? "Yes" : "No"} />}
			{wallet ? (
				<button
					className="button"
					disabled={!value || !fresh || tooMuch || tx.pending}
					onClick={submit}
					type="button"
				>
					{label}
				</button>
			) : (
				<button className="button" onClick={connect} type="button">
					Connect wallet
				</button>
			)}
			{account?.balance === 0n && (
				<a className="small" href={GET_STNEAR_URL} rel="noreferrer" target="_blank">
					Get stNEAR at Meta Pool
				</a>
			)}
			<TxStatus {...tx} />
		</div>
	);
}
