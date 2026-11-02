import { aurora } from "viem/chains";
import { chain, DOCS_URL } from "@/lib/config";

/** The top strip on test networks: what this deployment is, and where to get its token. */
export default function Announce() {
	if (chain.id === aurora.id) return null;
	return (
		<p className="announce">
			NEAR HACKATHON demo on {chain.name}: testnet stNEAR, no real value.{" "}
			<a href={`${DOCS_URL}testnet-stnear/`}>Get testnet stNEAR →</a>
		</p>
	);
}
