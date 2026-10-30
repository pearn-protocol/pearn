"use client";
import { useWallet } from "@/hooks/useWallet";
import { short } from "@/lib/format";

export default function ConnectButton() {
	const { address, available, connect, error } = useWallet();
	if (address) return <span className="pill mono">{short(address)}</span>;
	if (!available) {
		return (
			<a
				className="button ghost"
				href="https://metamask.io/download/"
				rel="noreferrer"
				target="_blank"
			>
				Install a wallet
			</a>
		);
	}
	return (
		<button className="button" onClick={connect} title={error ?? undefined} type="button">
			Connect wallet
		</button>
	);
}
