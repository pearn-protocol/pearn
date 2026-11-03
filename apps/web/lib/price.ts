import { formatUnits } from "viem";
import { DECIMALS } from "./format.ts";

/** Mainnet market prices in USD per whole token. Testnet tokens have no market of their own. */
export type Prices = { stNEAR: number; NEAR: number };

export const PRICE_URL =
	"https://api.coingecko.com/api/v3/simple/price?ids=near,staked-near&vs_currencies=usd";

export async function fetchPrices(): Promise<Prices> {
	const r = await fetch(PRICE_URL);
	if (!r.ok) throw new Error(`price feed answered ${r.status}`);
	const j = (await r.json()) as { near?: { usd?: number }; "staked-near"?: { usd?: number } };
	const NEAR = j.near?.usd;
	const stNEAR = j["staked-near"]?.usd;
	if (!NEAR || !stNEAR) throw new Error("price feed returned no price");
	return { NEAR, stNEAR };
}

/** Raw units at `price` USD per token: "$1,234.56", "< $0.01" for dust. */
export function usd(raw: bigint, price: number): string {
	const value = Number(formatUnits(raw, DECIMALS)) * price;
	if (value > 0 && value < 0.01) return "< $0.01";
	return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
