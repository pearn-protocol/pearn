import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@pearn/brand/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/ui.css";
import "@/styles/markets.css";
import "@/styles/market.css";
import "@/styles/chart.css";
import type { Metadata, Viewport } from "next";
import Announce from "@/components/layout/Announce";
import Footer from "@/components/layout/Footer";
import Providers from "@/components/layout/Providers";
import Topbar from "@/components/layout/Topbar";

export const metadata: Metadata = {
	title: { default: "Pearn | No-loss prediction markets on NEAR", template: "%s | Pearn" },
	description: "No-loss prediction markets on NEAR: win or lose, your stake comes back.",
	icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
	manifest: "/site.webmanifest",
};

export const viewport: Viewport = { themeColor: "#050505" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<Providers>
					<Announce />
					<Topbar />
					{children}
					<Footer />
				</Providers>
			</body>
		</html>
	);
}
