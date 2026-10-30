"use client";
import { useCallback, useState } from "react";
import type { Hash } from "viem";
import { errorMessage } from "@/lib/wallet";
import { useChainData } from "./useChainData";

export type TxState = { pending: boolean; error: string | null; hash: Hash | null };

/** Runs one write at a time, keeps its outcome, and refreshes chain data when it lands. */
export function useTx() {
	const { refresh } = useChainData();
	const [state, setState] = useState<TxState>({ pending: false, error: null, hash: null });

	const run = useCallback(
		async (write: () => Promise<Hash>) => {
			setState({ pending: true, error: null, hash: null });
			try {
				const hash = await write();
				setState({ pending: false, error: null, hash });
				await refresh();
				return true;
			} catch (e) {
				setState({ pending: false, error: errorMessage(e), hash: null });
				return false;
			}
		},
		[refresh],
	);

	return { ...state, run };
}
