import { formatUnits, parseUnits } from "viem";

/** stNEAR and NEAR both use 24 decimals; contracts never read `decimals()` (DESIGN.md §2). */
export const DECIMALS = 24;

/** Raw units to a short number: "1,234.5678", "0.0001", "< 0.0001" for dust. */
export function amount(raw: bigint, digits = 4): string {
	if (raw === 0n) return "0";
	const value = Number(formatUnits(raw, DECIMALS));
	if (value > 0 && value < 10 ** -digits) return `< ${(10 ** -digits).toFixed(digits)}`;
	return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** A typed amount to raw units, or null if it is not a positive number. */
export function parseAmount(input: string): bigint | null {
	const s = input.trim();
	if (!/^\d*\.?\d+$|^\d+\.$/.test(s)) return null;
	const raw = parseUnits(s, DECIMALS);
	return raw > 0n ? raw : null;
}

/** "3d 4h", "2h 15m", "45s". */
export function duration(seconds: number): string {
	const s = Math.max(0, Math.floor(seconds));
	const d = Math.floor(s / 86400);
	const h = Math.floor((s % 86400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	if (d) return `${d}d ${h}h`;
	if (h) return `${h}h ${m}m`;
	if (m) return `${m}m`;
	return `${s}s`;
}

/** "0x3B4f…85F5". */
export const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/** Unix seconds to a local date and time. */
export const dateTime = (unix: bigint | number) =>
	new Date(Number(unix) * 1000).toLocaleString("en-US", {
		dateStyle: "medium",
		timeStyle: "short",
	});

/** `part / whole` as a whole percentage, 50 when both are zero. */
export const percent = (part: bigint, whole: bigint) =>
	whole === 0n ? 50 : Number((part * 100n) / whole);
