"use client";
import { useState } from "react";
import type { Listed } from "@/lib/home";
import MarketCard from "./MarketCard";

const GHOSTS = ["a", "b", "c", "d"];

/** "All markets": topic tabs, a search box, and the card grid. */
export default function AllMarkets({
	items,
	rate,
	now,
	loading,
}: {
	/** Already sorted by interest. */
	items: Listed[];
	rate: bigint;
	now: number;
	/** Before the first chain read: placeholder cards hold the grid's height. */
	loading: boolean;
}) {
	const [tab, setTab] = useState("All");
	const [query, setQuery] = useState("");
	const counts = new Map<string, number>();
	for (const it of items) counts.set(it.topic, (counts.get(it.topic) ?? 0) + 1);
	const topics = ["All", ...[...counts].sort((a, b) => b[1] - a[1]).map(([t]) => t)];
	const q = query.trim().toLowerCase();
	const shown = items.filter(
		(it) => (tab === "All" || it.topic === tab) && (!q || it.m.question.toLowerCase().includes(q)),
	);

	return (
		<section aria-labelledby="all-title" className="all" id="markets">
			<header className="all__head">
				<h2 className="all__title" id="all-title">
					All markets
				</h2>
				<label className="all__search">
					<span className="sr-only">Search markets</span>
					<input
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search markets"
						type="search"
						value={query}
					/>
				</label>
			</header>
			<fieldset className="all__tabs">
				<legend className="sr-only">Topics</legend>
				{topics.map((t) => (
					<button aria-pressed={tab === t} key={t} onClick={() => setTab(t)} type="button">
						{t}
					</button>
				))}
			</fieldset>
			<div className="all__grid">
				{loading &&
					GHOSTS.map((k) => <div aria-hidden="true" className="mcard mcard--ghost" key={k} />)}
				{shown.map((it) => (
					<MarketCard item={it} key={it.m.id} now={now} rate={rate} />
				))}
			</div>
			{!loading && shown.length === 0 && <p className="muted">No market matches.</p>}
		</section>
	);
}
