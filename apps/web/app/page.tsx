import Hero from "@/components/markets/Hero";
import MarketList from "@/components/markets/MarketList";
import RateInfo from "@/components/ui/RateInfo";

export default function Home() {
	return (
		<main className="page">
			<Hero />
			<RateInfo />
			<h2>Markets</h2>
			<MarketList />
		</main>
	);
}
