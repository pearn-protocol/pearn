import { ponder } from "ponder:registry";
import { activity, market, participant } from "ponder:schema";

type Event = { id: string; block: { timestamp: bigint }; transaction: { hash: `0x${string}` } };

const at = (event: Event) => ({
	id: event.id,
	timestamp: event.block.timestamp,
	txHash: event.transaction.hash,
});

const emptyStake = { yesStaked: 0n, noStaked: 0n, sponsored: 0n };

ponder.on("PearnMarkets:MarketCreated", async ({ event, context }) => {
	const { id, creator, resolver, closeTime, question } = event.args;
	await context.db.insert(market).values({
		id,
		creator,
		resolver,
		question,
		closeTime,
		createdAt: event.block.timestamp,
		outcome: 0,
		...emptyStake,
		bets: 0,
	});
	await context.db
		.insert(activity)
		.values({ ...at(event), marketId: id, kind: "create", account: creator });
});

ponder.on("PearnMarkets:BetPlaced", async ({ event, context }) => {
	const { id, bettor, side, staked } = event.args;
	const yes = side === 0;
	await context.db.update(market, { id }).set((m) => ({
		yesStaked: m.yesStaked + (yes ? staked : 0n),
		noStaked: m.noStaked + (yes ? 0n : staked),
		bets: m.bets + 1,
	}));
	await context.db
		.insert(participant)
		.values({
			marketId: id,
			account: bettor,
			...emptyStake,
			[yes ? "yesStaked" : "noStaked"]: staked,
		})
		.onConflictDoUpdate((p) =>
			yes ? { yesStaked: p.yesStaked + staked } : { noStaked: p.noStaked + staked },
		);
	await context.db
		.insert(activity)
		.values({ ...at(event), marketId: id, kind: "bet", account: bettor, side, amount: staked });
});

ponder.on("PearnMarkets:Sponsored", async ({ event, context }) => {
	const { id, sponsor, amount } = event.args;
	await context.db.update(market, { id }).set((m) => ({ sponsored: m.sponsored + amount }));
	await context.db
		.insert(participant)
		.values({ marketId: id, account: sponsor, ...emptyStake, sponsored: amount })
		.onConflictDoUpdate((p) => ({ sponsored: p.sponsored + amount }));
	await context.db
		.insert(activity)
		.values({ ...at(event), marketId: id, kind: "sponsor", account: sponsor, amount });
});

ponder.on("PearnMarkets:MarketResolved", async ({ event, context }) => {
	const { id, outcome, settlementRate, pot } = event.args;
	await context.db
		.update(market, { id })
		.set({ outcome, settlementRate, pot, resolvedAt: event.block.timestamp });
	await context.db.insert(activity).values({
		...at(event),
		marketId: id,
		kind: "resolve",
		account: event.transaction.from,
		side: outcome,
		amount: pot,
	});
});

ponder.on("PearnMarkets:OutcomeOverridden", async ({ event, context }) => {
	const { id } = event.args;
	await context.db.update(market, { id }).set({ outcome: 3 });
	await context.db.insert(activity).values({
		...at(event),
		marketId: id,
		kind: "override",
		account: event.transaction.from,
		side: 3,
	});
});

ponder.on("PearnMarkets:Claimed", async ({ event, context }) => {
	const { id, bettor, amount } = event.args;
	await context.db
		.insert(participant)
		.values({ marketId: id, account: bettor, ...emptyStake, claimed: amount })
		.onConflictDoUpdate({ claimed: amount });
	await context.db
		.insert(activity)
		.values({ ...at(event), marketId: id, kind: "claim", account: bettor, amount });
});
