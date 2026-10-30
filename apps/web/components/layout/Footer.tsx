import { chain, contracts, explorerAddress } from "@/lib/config";

export default function Footer() {
	const links = [
		contracts.markets && { href: explorerAddress(contracts.markets), label: "Markets contract" },
		contracts.oracle && { href: explorerAddress(contracts.oracle), label: "Rate oracle" },
		{ href: explorerAddress(contracts.stNear), label: "stNEAR" },
		{ href: "https://github.com/pearn-protocol/pearn", label: "GitHub" },
	].filter((l) => l !== null);
	return (
		<footer className="footer">
			<span>Pearn on {chain.name}. Principal safe, yield at stake.</span>
			<nav>
				{links.map((l) => (
					<a href={l.href} key={l.label} rel="noreferrer" target="_blank">
						{l.label}
					</a>
				))}
			</nav>
		</footer>
	);
}
