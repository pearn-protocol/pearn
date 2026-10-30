"use client";
import { useEffect, useState } from "react";

/** Unix seconds, ticking every `ms`. Zero on the server so static HTML stays stable. */
export function useNow(ms = 1000): number {
	const [now, setNow] = useState(0);
	useEffect(() => {
		const tick = () => setNow(Math.floor(Date.now() / 1000));
		tick();
		const t = setInterval(tick, ms);
		return () => clearInterval(t);
	}, [ms]);
	return now;
}
