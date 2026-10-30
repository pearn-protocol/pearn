"use client";
import { useChainData } from "@/hooks/useChainData";
import { useNow } from "@/hooks/useNow";
import { useTx } from "@/hooks/useTx";
import { useWallet } from "@/hooks/useWallet";
import { syncRate } from "@/lib/actions";
import { contracts } from "@/lib/config";
import { amount, duration } from "@/lib/format";
import { MAX_RATE_AGE } from "@/lib/markets";
import TxStatus from "./TxStatus";

/** The stNEAR rate from Meta Pool, its age, and a sync button anyone can press. */
export default function RateInfo() {
	const { oracle } = useChainData();
	const { wallet } = useWallet();
	const now = useNow(10_000);
	const tx = useTx();
	if (!oracle || !contracts.oracle || now === 0) return null;

	const oracleAddress = contracts.oracle;
	const age = now - oracle.updatedAt;
	const stale = oracle.rate === 0n || age > MAX_RATE_AGE;
	return (
		<div className={`rate ${stale ? "stale" : ""}`}>
			<span>
				1 stNEAR = <b>{oracle.rate === 0n ? "?" : amount(oracle.rate, 6)}</b> NEAR
			</span>
			<span className="muted">
				{oracle.updatedAt === 0 ? "never synced" : `synced ${duration(age)} ago`}
				{stale && ", betting paused until the next sync"}
			</span>
			{wallet && (
				<button
					className="button ghost small"
					disabled={tx.pending}
					onClick={() => tx.run(() => syncRate(wallet, oracleAddress))}
					type="button"
				>
					Sync rate
				</button>
			)}
			<TxStatus {...tx} />
		</div>
	);
}
