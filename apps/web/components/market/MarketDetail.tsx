"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Amount from "@/components/ui/Amount";
import NotDeployed from "@/components/ui/NotDeployed";
import OddsBar from "@/components/ui/OddsBar";
import PhaseChip from "@/components/ui/PhaseChip";
import RateInfo from "@/components/ui/RateInfo";
import { useChainData } from "@/hooks/useChainData";
import { useNow } from "@/hooks/useNow";
import { contracts, explorerAddress } from "@/lib/config";
import { dateTime, duration, short } from "@/lib/format";
import { Outcome, phaseOf, potAt } from "@/lib/markets";
import BetForm from "./BetForm";
import PositionPanel from "./PositionPanel";
import ResolvePanel from "./ResolvePanel";
import SponsorForm from "./SponsorForm";

export default function MarketDetail() {
	const raw = useSearchParams().get("id");
	const { markets, oracle, error } = useChainData();
	const now = useNow();

	if (!contracts.markets) return <NotDeployed />;
	if (!markets) return <p className="muted">{error ?? "Loading market…"}</p>;
	const m =
		raw !== null && /^\d+$/.test(raw) ? markets.find((x) => x.id === BigInt(raw)) : undefined;
	if (!m) {
		return (
			<div className="card notice">
				<h2>Market not found</h2>
				<Link href="/">Back to all markets</Link>
			</div>
		);
	}

	const phase = phaseOf(m, now);
	const rate = oracle?.rate ?? 0n;
	return (
		<div className="detail">
			<section className="detail-main">
				<Link className="muted" href="/">
					← All markets
				</Link>
				<div className="card detail-head">
					<PhaseChip outcome={m.outcome} phase={phase} />
					<h1>{m.question}</h1>
					<p className="muted">
						{phase === "open"
							? `Closes in ${duration(Number(m.closeTime) - now)}, ${dateTime(m.closeTime)}`
							: `Closed ${dateTime(m.closeTime)}`}
					</p>
					<OddsBar m={m} />
					<dl className="stats">
						<Stat
							label={m.outcome === Outcome.Unresolved ? "Pot so far" : "Pot"}
							value={potAt(m, rate)}
						/>
						<Stat label="On Yes" value={m.yes.staked} />
						<Stat label="On No" value={m.no.staked} />
						<Stat label="Sponsored" value={m.sponsored} />
					</dl>
					<p className="muted small">
						Created by <Addr a={m.creator} />, resolved by <Addr a={m.resolver} />
					</p>
				</div>
				<RateInfo />
				<ResolvePanel m={m} now={now} />
			</section>
			<aside className="detail-side">
				{phase === "open" && <BetForm m={m} now={now} />}
				<PositionPanel m={m} now={now} />
				{m.outcome === Outcome.Unresolved && <SponsorForm m={m} />}
			</aside>
		</div>
	);
}

function Stat({ label, value }: { label: string; value: bigint }) {
	return (
		<div>
			<dt>{label}</dt>
			<dd>
				<Amount value={value} />
			</dd>
		</div>
	);
}

function Addr({ a }: { a: `0x${string}` }) {
	return (
		<a className="mono" href={explorerAddress(a)} rel="noreferrer" target="_blank">
			{short(a)}
		</a>
	);
}
