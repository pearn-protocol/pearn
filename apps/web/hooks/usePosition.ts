"use client";
import { useState } from "react";
import { type Account, type Position, readAccount, readPosition } from "@/lib/chain";
import { contracts, POLL_MS } from "@/lib/config";
import { useChainData } from "./useChainData";
import { usePoll } from "./usePoll";
import { useWallet } from "./useWallet";

/** The connected account's stNEAR and its position in market `id`; re-read after every refresh. */
export function usePosition(id: bigint | null) {
	const { address } = useWallet();
	const { version } = useChainData();
	const [account, setAccount] = useState<Account | null>(null);
	const [position, setPosition] = useState<Position | null>(null);

	usePoll(
		async () => {
			if (!contracts.markets || !address) return;
			const [a, p] = await Promise.all([
				readAccount(contracts.markets, address),
				id === null ? null : readPosition(contracts.markets, id, address),
			]);
			setAccount(a);
			setPosition(p);
		},
		POLL_MS,
		`${address}:${id}:${version}`,
	);

	return { account, position };
}
