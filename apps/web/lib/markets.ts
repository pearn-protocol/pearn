import type { ContractFunctionReturnType } from "viem";
import type { pearnMarketsAbi } from "./abi.ts";
import { percent } from "./format.ts";

export type Market = ContractFunctionReturnType<typeof pearnMarketsAbi, "view", "getMarket">;

/** `Side` and `Outcome` as in contracts/src/types/Market.sol. */
export const Side = { Yes: 0, No: 1 } as const;
export const Outcome = { Unresolved: 0, Yes: 1, No: 2, Invalid: 3 } as const;
export const OUTCOME_LABEL = ["Unresolved", "Yes", "No", "Invalid"] as const;

/** Mirrors the constants in PearnMarkets.sol. */
export const CHALLENGE_WINDOW = 86_400;
export const RESOLVE_TIMEOUT = 7 * 86_400;
export const MIN_DURATION = 3_600;
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
