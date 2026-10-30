import type { TxState } from "@/hooks/useTx";
import { explorerTx } from "@/lib/config";

/** One line under a form: waiting, the error, or a link to the landed transaction. */
export default function TxStatus({ pending, error, hash }: TxState) {
	if (pending) return <p className="status">Confirm in your wallet, then wait for Aurora…</p>;
	if (error) return <p className="status error">{error}</p>;
	if (hash) {
		return (
			<p className="status ok">
				Done.{" "}
				<a href={explorerTx(hash)} rel="noreferrer" target="_blank">
					View transaction
				</a>
			</p>
		);
	}
	return null;
}
