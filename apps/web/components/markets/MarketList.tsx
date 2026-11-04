"use client";
import NotDeployed from "@/components/ui/NotDeployed";
import { useChainData } from "@/hooks/useChainData";
import { useNow } from "@/hooks/useNow";
import { contracts } from "@/lib/config";
import MarketCard from "./MarketCard";

export default function MarketList() {
	const { markets, oracle, error } = useChainData();
	const now = useNow(10_000);

	if (!contracts.markets) return <NotDeployed />;
	if (!markets) return <p className="muted">{error ?? "Loading markets…"}</p>;
	if (markets.length === 0) return <p className="muted">No markets yet. Create the first one.</p>;
	return (
		<div className="grid">
			{markets.map((m) => (
				<MarketCard key={m.id} m={m} now={now} rate={oracle?.rate ?? 0n} />
			))}
		</div>
	);
}
