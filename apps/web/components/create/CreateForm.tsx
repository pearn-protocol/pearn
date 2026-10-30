"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import NotDeployed from "@/components/ui/NotDeployed";
import TxStatus from "@/components/ui/TxStatus";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { createMarket } from "@/lib/actions";
import { contracts } from "@/lib/config";
import { checkDraft, type Draft } from "@/lib/create";
import { MAX_QUESTION_LENGTH } from "@/lib/markets";

export default function CreateForm() {
	const { wallet, address, connect } = useWallet();
	const router = useRouter();
	const tx = useTx();
	const [draft, setDraft] = useState<Draft>({ question: "", close: "", resolver: "" });
	const [problem, setProblem] = useState<string | null>(null);
	const markets = contracts.markets;
	if (!markets) return <NotDeployed />;

	const set = (key: keyof Draft) => (e: { target: { value: string } }) =>
		setDraft({ ...draft, [key]: e.target.value });

	const submit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!wallet) return connect();
		const checked = checkDraft(
			{ ...draft, resolver: draft.resolver || (address ?? "") },
			Math.floor(Date.now() / 1000),
		);
		if (typeof checked === "string") return setProblem(checked);
		setProblem(null);
		const { question, closeTime, resolver } = checked;
		if (await tx.run(() => createMarket(wallet, markets, question, closeTime, resolver)))
			router.push("/");
	};

	return (
		<form className="card form" onSubmit={submit}>
			<label>
				Question
				<textarea
					maxLength={MAX_QUESTION_LENGTH}
					onChange={set("question")}
					placeholder="Will NEAR trade above $5 on December 1, 2026?"
					rows={3}
					value={draft.question}
				/>
			</label>
			<label>
				Betting closes
				<input onChange={set("close")} type="datetime-local" value={draft.close} />
			</label>
			<label>
				Resolver address
				<input
					autoComplete="off"
					className="mono"
					onChange={set("resolver")}
					placeholder={address ?? "0x…"}
					value={draft.resolver}
				/>
				<span className="small">Leave empty to resolve it yourself.</span>
			</label>
			{problem && <p className="status error">{problem}</p>}
			<button className="button" disabled={tx.pending} type="submit">
				{wallet ? "Create market" : "Connect wallet"}
			</button>
			<TxStatus {...tx} />
		</form>
	);
}
