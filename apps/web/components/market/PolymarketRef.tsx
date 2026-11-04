"use client";
import { useChainData } from "@/hooks/useChainData";
import { mirrorOf, polymarketUrl } from "@/lib/catalog";
import { usdCompact } from "@/lib/reference";

/** For a mirrored market: Polymarket's live price and volume, how it resolves, and a link. */
export default function PolymarketRef({ id }: { id: bigint }) {
	const { references } = useChainData();
	const mirror = mirrorOf(id);
	if (!mirror) return null;
	const ref = references.get(mirror.slug);
	return (
		<section className="card polyref">
			<h2>Mirrored from Polymarket</h2>
			{ref && (
				<p className="polyref__price">
					<b>{ref.yes}%</b> Yes on Polymarket · {usdCompact(ref.volume)} traded there
				</p>
			)}
			<p className="muted">{mirror.rules}</p>
			<p className="muted">
				Resolves per Polymarket: once Polymarket (UMA) settles it, the keeper reports the same
				outcome here. A 50-50 settlement resolves Invalid: everyone gets their principal back. The
				guardian's 24-hour challenge window still applies.
			</p>
			<a
				className="button ghost small"
				href={polymarketUrl(mirror)}
				rel="noreferrer"
				target="_blank"
			>
				View on Polymarket ↗
			</a>
		</section>
	);
}
