// Shared by the Polymarket catalog scripts: reading a Pearn market with cast, and the rule that
// turns a settled Polymarket market into a Pearn outcome.
import { execFileSync } from "node:child_process";

export const GAMMA = "https://gamma-api.polymarket.com";
/** Outcome enum of contracts/src/types/Market.sol. */
export const OUTCOME = { Unresolved: 0, Yes: 1, No: 2, Invalid: 3 };
const MARKET =
	"(address,address,uint64,uint64,uint8,uint128,uint128,uint256,(uint128,uint128,uint256),(uint128,uint128,uint256),string)";

export const cast = (...args) => execFileSync("cast", args, { encoding: "utf8" }).trim();

/** The fields of PearnMarkets.getMarket(id) the scripts need. */
export function readMarket(markets, id, rpc) {
	const [m] = JSON.parse(
		cast("call", markets, `getMarket(uint256)(${MARKET})`, String(id), "--json", "--rpc-url", rpc),
	);
	return { resolver: m[1], closeTime: Number(m[2]), outcome: Number(m[4]), question: m[10] };
}

/**
 * The Pearn outcome for a Gamma market, or null while Polymarket has not settled it: settled
 * means `closed` and UMA's status "resolved" (a proposed or disputed answer waits). Yes or No
 * when one side settled at 1; anything else (a 50-50 settlement) is Invalid: principal back.
 */
export function outcomeOf(m) {
	if (!m.closed || m.umaResolutionStatus !== "resolved") return null;
	if (JSON.stringify(JSON.parse(m.outcomes ?? "[]")) !== '["Yes","No"]') return OUTCOME.Invalid;
	const [yes, no] = JSON.parse(m.outcomePrices ?? "[]").map(Number);
	if (yes === 1 && no === 0) return OUTCOME.Yes;
	if (yes === 0 && no === 1) return OUTCOME.No;
	return OUTCOME.Invalid;
}
