import type { Metadata } from "next";
import PortfolioList from "@/components/portfolio/PortfolioList";

export const metadata: Metadata = { title: "Portfolio" };

export default function PortfolioPage() {
	return (
		<main className="page">
			<h1>Portfolio</h1>
			<PortfolioList />
		</main>
	);
}
