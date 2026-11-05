"use client";
import { useRef, useState } from "react";
import { type Account, type Position, readAccount, readPosition } from "@/lib/chain";
import { contracts, POLL_MS } from "@/lib/config";
import { useChainData } from "./useChainData";
import { usePoll } from "./usePoll";
import { useWallet } from "./useWallet";

/** The connected account's stNEAR and its position in market `id`; re-read after every refresh. */
export function usePosition(id: bigint | null) {
	const { address } = useWallet();
	const { version } = useChainData();
	// Reads are tagged with whose position they are, so after a switch of account or market
	// neither the old values nor a late answer for the old key is ever shown.
	const key = `${address}:${id}`;
	const [read, setRead] = useState<{ key: string; account: Account; position: Position | null }>();
	const seq = useRef(0);

	usePoll(
		async () => {
			if (!contracts.markets || !address) return;
			const mine = ++seq.current;
			const [account, position] = await Promise.all([
				readAccount(contracts.markets, address),
				id === null ? null : readPosition(contracts.markets, id, address),
			]);
			if (mine === seq.current) setRead({ key, account, position });
		},
		POLL_MS,
		`${key}:${version}`,
	);

	const current = read?.key === key ? read : undefined;
	return { account: current?.account ?? null, position: current?.position ?? null };
}
