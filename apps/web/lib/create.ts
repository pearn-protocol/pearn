import { type Address, getAddress, isAddress } from "viem";
import { MAX_QUESTION_LENGTH, MIN_DURATION } from "./markets.ts";

export type Draft = { question: string; close: string; resolver: string };
export type Checked = { question: string; closeTime: bigint; resolver: Address };

/**
 * The same checks `createMarket` makes, so the form says what is wrong before the wallet
 * opens. `close` is a datetime-local value, read in the browser's time zone.
 */
export function checkDraft(d: Draft, now: number): Checked | string {
	const question = d.question.trim();
	const bytes = new TextEncoder().encode(question).length;
	if (bytes === 0) return "Write the question.";
	if (bytes > MAX_QUESTION_LENGTH) return `Keep the question under ${MAX_QUESTION_LENGTH} bytes.`;

	const closeMs = Date.parse(d.close);
	if (Number.isNaN(closeMs)) return "Pick a close time.";
	const closeTime = Math.floor(closeMs / 1000);
	if (closeTime < now + MIN_DURATION) return "Close at least an hour from now.";

	const resolver = d.resolver.trim();
	if (!isAddress(resolver, { strict: false })) return "The resolver must be an Aurora address.";
	return { question, closeTime: BigInt(closeTime), resolver: getAddress(resolver) };
}
