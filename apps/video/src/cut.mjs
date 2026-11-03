// The whole cut: every shot in order, its caption, and where it was recorded. Footage shots are
// recorded by scripts/capture.mjs under the same name; cards are drawn by scripts/render.mjs.
// Every caption must stay true of `main` and the live deployment.

/** `where` is shown on each caption band, so a viewer always knows what they are looking at. */
export const LIVE = "Live · Aurora testnet";
export const LOCAL = "Local chain · the same app";

export const cut = [
	{
		name: "open",
		card: {
			lines: ["Lose a prediction market bet,", "lose your money."],
			sub: "On Pearn you only bet the staking yield.",
		},
		seconds: 4.5,
	},
	{
		name: "landing",
		where: LIVE,
		caption: "Pearn: a no-loss prediction market on NEAR. pearn.site",
	},
	{
		name: "bet-form",
		where: LOCAL,
		caption: "Bet stNEAR on YES or NO. Your principal is fixed in NEAR and comes back in full.",
	},
	{
		name: "bet-send",
		where: LOCAL,
		caption: "Approve and bet. Earlier bets weigh more, so late whales can't take the yield.",
	},
	{
		name: "resolve",
		where: LOCAL,
		caption: "After close the resolver reports. For 24 h a guardian can only turn it into Invalid.",
	},
	{
		name: "claim",
		where: LOCAL,
		caption: "Claim: your principal, plus the yield and sponsorship the winning side splits.",
	},
	{
		name: "proof-claim",
		where: LIVE,
		caption:
			"The same lifecycle ran on Aurora testnet. This claim was sent through NEAR, gas price 0.",
	},
	{
		name: "proof-oracle",
		where: LIVE,
		caption: "The rate comes from Meta Pool on NEAR, read by Solidity over cross-contract calls.",
	},
	{
		name: "end",
		card: {
			lines: ["Bet the yield.", "Keep the NEAR."],
			sub: "pearn.site · app.pearn.site · docs.pearn.site · github.com/pearn-protocol/pearn",
		},
		seconds: 5,
	},
];
