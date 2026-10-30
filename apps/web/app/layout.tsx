import "@/styles/tokens.css";
import "@/styles/base.css";
import type { Metadata, Viewport } from "next";

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
			<body>{children}</body>
		</html>
	);
}
