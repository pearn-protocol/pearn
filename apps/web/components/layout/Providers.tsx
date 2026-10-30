"use client";
import type { ReactNode } from "react";
import { ChainDataProvider } from "@/hooks/useChainData";
import { WalletProvider } from "@/hooks/useWallet";

export default function Providers({ children }: { children: ReactNode }) {
	return (
		<WalletProvider>
			<ChainDataProvider>{children}</ChainDataProvider>
		</WalletProvider>
	);
}
