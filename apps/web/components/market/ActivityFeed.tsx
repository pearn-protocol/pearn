"use client";
import { useState } from "react";
import { getAddress } from "viem";
import Amount from "@/components/ui/Amount";
import { useChainData } from "@/hooks/useChainData";
import { usePoll } from "@/hooks/usePoll";
import { explorerTx, INDEXER_URL, POLL_MS } from "@/lib/config";
import { duration, short } from "@/lib/format";
import { type Activity, readActivity } from "@/lib/indexer";
import { OUTCOME_LABEL } from "@/lib/markets";

const VERB: Record<Activity["kind"], (a: Activity) => string> = {
	create: () => "created the market",
	bet: (a) => `bet ${a.side === 0 ? "Yes" : "No"}`,
	sponsor: () => "sponsored",
	resolve: (a) => `resolved ${OUTCOME_LABEL[a.side ?? 0]}`,
	override: () => "overrode to Invalid",
	claim: () => "claimed",
};

/** The market's recent events from the indexer. Hidden when there is no indexer. */
export default function ActivityFeed({ id, now }: { id: bigint; now: number }) {
	const { version } = useChainData();
	const [items, setItems] = useState<Activity[] | null>(null);

	usePoll(
		async () => {
			if (INDEXER_URL) setItems(await readActivity(INDEXER_URL, id));
		},
		POLL_MS,
		`${id}:${version}`,
	);

	if (!INDEXER_URL || !items?.length) return null;
	return (
		<div className="card form">
			<h2>Activity</h2>
			<ul className="activity">
				{items.map((a) => (
					<li key={`${a.txHash}:${a.kind}:${a.account}`}>
						<span>
							<span className="mono">{a.account ? short(getAddress(a.account)) : "someone"}</span>{" "}
							{VERB[a.kind](a)}
							{a.amount !== null && a.kind !== "create" && (
								<>
									{" "}
									<Amount value={a.amount} />
								</>
							)}
						</span>
						<a className="muted small" href={explorerTx(a.txHash)} rel="noreferrer" target="_blank">
							{now ? `${duration(now - a.timestamp)} ago` : "tx"}
						</a>
					</li>
				))}
			</ul>
		</div>
	);
}
