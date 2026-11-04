"use client";
import NotDeployed from "@/components/ui/NotDeployed";
import RateInfo from "@/components/ui/RateInfo";
import { useChainData } from "@/hooks/useChainData";
import { useNow } from "@/hooks/useNow";
import { contracts } from "@/lib/config";
import { byInterest, listed } from "@/lib/home";
import AllMarkets from "./AllMarkets";
import ClosingSoon from "./ClosingSoon";
import Featured from "./Featured";

/** Markets home: featured carousel with "closing soon" beside it, then all markets by topic. */
export default function Home({ mark }: { mark: string }) {
	const { markets, oracle, error, references } = useChainData();
	const now = useNow(10_000);
	if (!contracts.markets) return <NotDeployed />;

	const items = (markets ?? [])
		.map((m) => listed(m, references))
		.sort((a, b) => byInterest(a, b, now));
	const loading = !markets;
	return (
		<>
			<h1 className="sr-only">Pearn markets</h1>
			<div className="home__top">
				<Featured items={items} loading={loading} mark={mark} />
				<aside aria-label="Closing soon" className="home__side">
					<ClosingSoon items={items} now={now} />
				</aside>
			</div>
			{error && <p className="muted">{error}</p>}
			<AllMarkets items={items} loading={loading} now={now} rate={oracle?.rate ?? 0n} />
			<RateInfo />
		</>
	);
}
