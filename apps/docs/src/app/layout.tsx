import "./global.css";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: { default: "Pearn docs", template: "%s | Pearn docs" },
	description: "How Pearn's no-loss prediction markets on NEAR work, and how to build on them.",
	icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
	manifest: "/site.webmanifest",
};

export const viewport: Viewport = { themeColor: "#fe835a" };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className="flex min-h-screen flex-col">
				{/* Static export: search loads the prebuilt index from /api/search. */}
				<RootProvider search={{ options: { type: "static" } }}>{children}</RootProvider>
			</body>
		</html>
	);
}
