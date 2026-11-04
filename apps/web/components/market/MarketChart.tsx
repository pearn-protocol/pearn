"use client";
import { useState } from "react";
import { useChainData } from "@/hooks/useChainData";
import { usePoll } from "@/hooks/usePoll";
import { mirrorOf } from "@/lib/catalog";
import { type Point, type Series, stakeShare } from "@/lib/chart";
import { INDEXER_URL, POLL_MS } from "@/lib/config";
import { readActivity } from "@/lib/indexer";
import { fetchHistory } from "@/lib/reference";
import PriceChart from "./PriceChart";

const HISTORY_MS = 5 * 60_000;

/**
 * Yes over time: Polymarket's price for a mirrored market, and Pearn's own Yes share of the
 * stake after each bet (from the indexer). Either source failing just leaves its line out.
 */
export default function MarketChart({ id }: { id: bigint }) {
	const { references, version } = useChainData();
	const mirror = mirrorOf(id);
	const token = mirror && references.get(mirror.slug)?.token;
	const [poly, setPoly] = useState<{ token: string; points: Point[] }>();
	const [own, setOwn] = useState<{ id: bigint; points: Point[] }>();

	usePoll(
		async () => {
			if (token) setPoly({ token, points: await fetchHistory(token) });
		},
		HISTORY_MS,
		token,
	);
	usePoll(
		async () => {
			// ponytail: one page of 1000 events; page through the indexer if a market outgrows it.
			if (INDEXER_URL)
				setOwn({ id, points: stakeShare(await readActivity(INDEXER_URL, id, 1000)) });
		},
		POLL_MS,
		`${id}:${version}`,
	);

	const series: Series[] = [];
	if (own?.id === id && own.points.length)
		series.push({ key: "pearn", label: "Pearn stake on Yes", tone: "accent", points: own.points });
	if (token && poly?.token === token && poly.points.length)
		series.push({ key: "poly", label: "Polymarket Yes", tone: "ink", points: poly.points });

	return (
		<section className="card">
			<h2>Yes over time</h2>
			<PriceChart key={String(id)} series={series} />
		</section>
	);
}
