import { Suspense } from "react";
import MarketDetail from "@/components/market/MarketDetail";

export default function MarketPage() {
	return (
		<main className="page">
			<Suspense fallback={<p className="muted">Loading market…</p>}>
				<MarketDetail />
			</Suspense>
		</main>
	);
}
