/** Origins come from build env so a local stack can point the landing at its own app and indexer. */
export const site = {
	title: "Pearn | No-loss prediction markets on NEAR",
	description:
		"Bet the staking yield of your NEAR, never the NEAR itself. Everyone gets their principal back; the winning side splits the yield.",
	appUrl: import.meta.env.PUBLIC_APP_URL ?? "https://app.pearn.103.150.190.91.sslip.io",
	docsUrl: import.meta.env.PUBLIC_DOCS_URL ?? "https://docs.pearn.103.150.190.91.sslip.io",
	indexerUrl: import.meta.env.PUBLIC_INDEXER_URL ?? "https://indexer.pearn.103.150.190.91.sslip.io",
	repoUrl: "https://github.com/pearn-protocol/pearn",
	explorerUrl:
		"https://explorer.testnet.aurora.dev/address/0x4659f0d99587D4fA396840d982a4215FcFe8a557",
} as const;

export const nav = [
	{ label: "How it works", href: "/#how" },
	{ label: "Markets", href: "/#markets" },
	{ label: "On NEAR", href: "/#near" },
	{ label: "Safety", href: "/#safety" },
	{ label: "FAQ", href: "/#faq" },
];
