"use client";
import { useEffect, useRef } from "react";

/** Runs `fn` now and then every `ms` after it settles; errors wait for the next tick. */
export function usePoll(fn: () => unknown, ms: number, key: unknown = null) {
	const ref = useRef(fn);
	ref.current = fn;
	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` restarts the loop on purpose
	useEffect(() => {
		let live = true;
		let t: ReturnType<typeof setTimeout>;
		const tick = async () => {
			try {
				// A hidden tab skips the read but keeps the loop, so it catches up when shown.
				if (!document.hidden) await ref.current();
			} catch {
				// a failed poll just waits for the next tick
			}
			if (live) t = setTimeout(tick, ms);
		};
		tick();
		return () => {
			live = false;
			clearTimeout(t);
		};
	}, [ms, key]);
}
