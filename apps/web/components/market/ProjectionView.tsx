import Amount from "@/components/ui/Amount";
import { ASSUMED_APY_BPS, type Projection } from "@/lib/payout";

/** Principal back for sure, and the estimated winnings if the picked side wins. */
export default function ProjectionView({ p, sideLabel }: { p: Projection; sideLabel: string }) {
	return (
		<dl className="projection">
			<div>
				<dt>Principal, returned in full</dt>
				<dd>
					<Amount unit="NEAR" value={p.principal} />
				</dd>
			</div>
			<div>
				<dt>If {sideLabel} wins, you also get</dt>
				<dd className="win">
					+<Amount value={p.winnings} />
				</dd>
			</div>
			<p className="muted small">
				Estimate at {Number(ASSUMED_APY_BPS) / 100}% staking APY, if nobody else bets. Later bets on
				your side shrink your share.
			</p>
		</dl>
	);
}
