// Every claim here must stay true of `main` and the live testnet deployment (see apps/docs).

export const steps = [
	{
		title: "Bet stNEAR",
		text: "Pick YES or NO. The NEAR value of your stNEAR is locked in as your principal.",
	},
	{
		title: "Yield accrues",
		text: "stNEAR earns NEAR staking rewards every epoch. Earlier bets weigh more: weight is principal × time left.",
	},
	{
		title: "Claim",
		text: "Everyone gets their principal back. The winning side splits the whole market's yield, plus anything sponsors added.",
	},
];

/** Left: a classic prediction market. Right: Pearn. */
export const compare = [
	["You lose your stake if you are wrong", "You keep your principal either way"],
	["Price feeds from an off-chain oracle", "Rate read from Meta Pool on NEAR, on-chain"],
	["Late whales can swing the payout", "Time weight: late bets earn almost nothing"],
	["An admin can pause or upgrade", "No owner, no upgrades"],
];

export const stack = [
	{
		title: "Aurora",
		text: "Contracts are Solidity on Aurora, NEAR's EVM, verified on Blockscout.",
	},
	{
		title: "stNEAR by Meta Pool",
		text: "The yield is NEAR staking itself: stNEAR's NEAR value rises every epoch.",
	},
	{
		title: "Cross-contract calls",
		text: "The oracle calls get_st_near_price on Meta Pool through Aurora's XCC precompile and gets the answer in a Solidity callback.",
	},
	{
		title: "No Aurora ETH",
		text: "Transactions are signed at gas price 0 and submitted to the Aurora engine from a NEAR account, which pays NEAR gas.",
	},
];

export const safety = [
	{
		title: "Monotonic rate",
		text: "The oracle never accepts a lower rate, so principal stays whole.",
	},
	{ title: "Named resolver", text: "Each market names who reports the outcome, ideally a DAO." },
	{
		title: "24 h challenge",
		text: "A guardian can only turn an outcome into Invalid, and only for 24 hours.",
	},
	{ title: "7-day void", text: "If nobody resolves, anyone can void the market after 7 days." },
	{
		title: "Solvent by construction",
		text: "Rounding never pays out more than the contract holds; fuzz and invariant tests check it.",
	},
];

export const faq = [
	{
		q: "Do I get NEAR or stNEAR back?",
		a: "stNEAR worth your principal's NEAR value at settlement. Convert at Meta Pool, instantly with a fee or through a delayed unstake.",
	},
	{
		q: "Can I exit before close?",
		a: "Not yet. Bets are locked until close; that is what keeps the time weight fair.",
	},
	{
		q: "What if the outcome is disputed?",
		a: "During the 24-hour challenge window the guardian can mark it Invalid. Then everyone keeps their principal and shares the yield.",
	},
	{
		q: "Why are the testnet pots small?",
		a: "Meta Pool's testnet rate barely moves, so testnet markets earn almost no yield and their pots are mostly sponsorship. On mainnet the rate rises every epoch.",
	},
	{
		q: "Is it audited?",
		a: "No. It is a hackathon build on testnet, with unit, integration, fuzz and fork tests against real stNEAR.",
	},
];

/** Hero highlighter strips. */
export const heroLines = [
	"Bet the yield.",
	"Keep the NEAR.",
	"Principal back, win or lose.",
	"Winners split the staking yield.",
	"Rate read from NEAR itself.",
];

/** What Pearn is built from, for the hero marquee. */
export const marquee = [
	"Aurora EVM",
	"stNEAR",
	"Meta Pool",
	"XCC precompile",
	"No price feed",
	"Gas price 0",
	"No owner",
	"Ponder indexer",
	"Foundry",
];
