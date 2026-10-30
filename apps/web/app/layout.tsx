import "@/styles/tokens.css";
import "@/styles/base.css";
import "@/styles/layout.css";
import "@/styles/ui.css";
import "@/styles/markets.css";
import type { Metadata, Viewport } from "next";
import Footer from "@/components/layout/Footer";
import Providers from "@/components/layout/Providers";
import Topbar from "@/components/layout/Topbar";

export const metadata: Metadata = {
	title: { default: "Pearn | No-loss prediction markets on NEAR", template: "%s | Pearn" },
	description: "Bet the staking yield of your NEAR, never the NEAR itself.",
	icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
	manifest: "/site.webmanifest",
};

export const viewport: Viewport = { themeColor: "#fe835a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<body>
				<Providers>
					<Topbar />
					{children}
					<Footer />
				</Providers>
			</body>
		</html>
	);
}
