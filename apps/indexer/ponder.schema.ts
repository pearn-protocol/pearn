import { index, onchainEnum, onchainTable, primaryKey } from "ponder";

export const activityKind = onchainEnum("activity_kind", [
	"create",
	"bet",
	"sponsor",
	"resolve",
	"override",
	"claim",
]);

/** One row per market, kept in step with its events. Amounts are raw (1e24 per stNEAR). */
export const market = onchainTable("market", (t) => ({
	id: t.bigint().primaryKey(),
	creator: t.hex().notNull(),
	resolver: t.hex().notNull(),
	question: t.text().notNull(),
	closeTime: t.bigint().notNull(),
	createdAt: t.bigint().notNull(),
	/** Outcome enum of the contract: 0 Unresolved, 1 Yes, 2 No, 3 Invalid. */
	outcome: t.integer().notNull(),
	resolvedAt: t.bigint(),
	settlementRate: t.bigint(),
	pot: t.bigint(),
	yesStaked: t.bigint().notNull(),
	noStaked: t.bigint().notNull(),
	sponsored: t.bigint().notNull(),
	bets: t.integer().notNull(),
}));

/** What one account put into and took out of one market. */
export const participant = onchainTable(
	"participant",
	(t) => ({
		marketId: t.bigint().notNull(),
		account: t.hex().notNull(),
		yesStaked: t.bigint().notNull(),
		noStaked: t.bigint().notNull(),
		sponsored: t.bigint().notNull(),
		claimed: t.bigint(),
	}),
	(table) => ({
		pk: primaryKey({ columns: [table.marketId, table.account] }),
		accountIdx: index().on(table.account),
	}),
);

/** Every event, newest first by timestamp, for activity feeds. */
export const activity = onchainTable(
	"activity",
	(t) => ({
		id: t.text().primaryKey(),
		marketId: t.bigint().notNull(),
		kind: activityKind("kind").notNull(),
		account: t.hex(),
		/** Side for bets (0 Yes, 1 No); outcome for resolve and override. */
		side: t.integer(),
		amount: t.bigint(),
		timestamp: t.bigint().notNull(),
		txHash: t.hex().notNull(),
	}),
	(table) => ({
		marketIdx: index().on(table.marketId),
		accountIdx: index().on(table.account),
	}),
);
