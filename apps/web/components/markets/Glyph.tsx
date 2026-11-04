"use client";
import { useState } from "react";
import type { Mirror } from "@/lib/catalog";

/**
 * A market's square badge: a mirror's Polymarket image, downloaded once into packages/catalog
 * and served from our own origin. Else, or if it fails to load, the first letter of its topic.
 */
export default function Glyph({ mirror, topic }: { mirror?: Mirror; topic: string }) {
	const [broken, setBroken] = useState(false);
	if (mirror && !broken)
		return (
			// biome-ignore lint/performance/noImgElement: static export has no image optimizer
			<img
				alt=""
				className="glyph glyph--img"
				decoding="async"
				height={32}
				onError={() => setBroken(true)}
				src={`/markets/${mirror.image}`}
				width={32}
			/>
		);
	return (
		<span aria-hidden="true" className="glyph">
			{topic.charAt(0)}
		</span>
	);
}
