import type { pearnMarketsAbi } from "@pearn/abi";
import type { ContractFunctionReturnType } from "viem";
import { percent } from "./format.ts";
import { potOf, reserveOf } from "./payout.ts";

export type Market = ContractFunctionReturnType<typeof pearnMarketsAbi, "view", "getMarket">;

/** `Side` and `Outcome` as in contracts/src/types/Market.sol. */
export const Side = { Yes: 0, No: 1 } as const;
export const Outcome = { Unresolved: 0, Yes: 1, No: 2, Invalid: 3 } as const;
export const OUTCOME_LABEL = ["Unresolved", "Yes", "No", "Invalid"] as const;

/** Mirrors the constants in PearnMarkets.sol. */
export const CHALLENGE_WINDOW = 86_400;
export const RESOLVE_TIMEOUT = 7 * 86_400;
export const MIN_DURATION = 3_600;
/** Bets need an oracle reading younger than this. */
export const MAX_RATE_AGE = 2 * 86_400;
export const MAX_QUESTION_LENGTH = 280;

/**
 * Where a market is in its life (DESIGN.md §5):
 * open → closed (awaiting the resolver; voidable after the timeout) → challenge → final.
 */
export type Phase = "open" | "closed" | "voidable" | "challenge" | "final";

export function phaseOf(
	m: Pick<Market, "outcome" | "closeTime" | "resolvedAt">,
	now: number,
): Phase {
	if (m.outcome === Outcome.Unresolved) {
		if (now < Number(m.closeTime)) return "open";
		return now < Number(m.closeTime) + RESOLVE_TIMEOUT ? "closed" : "voidable";
	}
	return now < Number(m.resolvedAt) + CHALLENGE_WINDOW ? "challenge" : "final";
}

export const PHASE_LABEL: Record<Phase, string> = {
	open: "Open",
	closed: "Awaiting resolution",
	voidable: "Resolver timed out",
	challenge: "Challenge window",
	final: "Settled",
};

/** YES's share of the market's principal, in percent; 50 for an empty market. */
export function yesPercent(m: Pick<Market, "yes" | "no">): number {
	return percent(m.yes.principal, m.yes.principal + m.no.principal);
}

/**
 * The pot: fixed once settled, otherwise what it would be if the market settled at `rate`.
 * With no rate yet (0) only the sponsorships are known.
 */
export function potAt(
	m: Pick<Market, "outcome" | "pot" | "yes" | "no" | "sponsored">,
	rate: bigint,
) {
	if (m.outcome !== Outcome.Unresolved) return m.pot;
	if (rate === 0n) return m.sponsored;
	const principal = m.yes.principal + m.no.principal;
	const reserve = principal === 0n ? 0n : reserveOf(principal, rate);
	return potOf(m.yes.staked + m.no.staked, reserve, m.sponsored);
}
