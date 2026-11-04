/** Origins come from build env so a local stack can point the landing at its own app and indexer. */
export const site = {
	title: "Pearn | No-loss prediction markets on NEAR",
	description:
		"Bet on real questions with stNEAR. Win or lose, your stake comes back; the winning side splits the staking yield.",
	appUrl: import.meta.env.PUBLIC_APP_URL ?? "https://app.pearn.site",
	docsUrl: import.meta.env.PUBLIC_DOCS_URL ?? "https://docs.pearn.site",
	indexerUrl: import.meta.env.PUBLIC_INDEXER_URL ?? "https://indexer.pearn.site",
	repoUrl: "https://github.com/pearn-protocol/pearn",
	explorerUrl:
		"https://explorer.testnet.aurora.dev/address/0x4659f0d99587D4fA396840d982a4215FcFe8a557",
} as const;

export const nav = [
	{ label: "How it works", href: "/#how" },
	{ label: "Live markets", href: "/#markets" },
	{ label: "Why no-loss", href: "/#compare" },
	{ label: "On NEAR", href: "/#near" },
	{ label: "Safety", href: "/#safety" },
	{ label: "FAQ", href: "/#faq" },
	{ label: "Demo video", href: "/pitch/" },
];
