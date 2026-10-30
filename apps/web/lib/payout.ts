/**
 * TypeScript port of contracts/src/libraries/PayoutMath.sol (DESIGN.md §5), in bigint, plus
 * the projection the market page shows. Rounding matches the contract exactly.
 */

/** Fixed-point scale of the stNEAR rate and of stNEAR itself. */
export const ONE = 10n ** 24n;
const YEAR = 365n * 24n * 3600n;
/** Staking APY the projection assumes, in basis points (DESIGN.md §6). */
export const ASSUMED_APY_BPS = 450n;

const ceilDiv = (a: bigint, b: bigint) => (a + b - 1n) / b;

export const principalOf = (staked: bigint, rate: bigint) => (staked * rate) / ONE;

export const weightOf = (principal: bigint, now: bigint, closeTime: bigint) =>
	principal * (closeTime - now);

export const reserveOf = (totalPrincipal: bigint, rate: bigint) =>
	ceilDiv(totalPrincipal * ONE, rate);

export const refundOf = (principal: bigint, rate: bigint) => (principal * ONE) / rate;

export const potOf = (totalStaked: bigint, reserve: bigint, sponsored: bigint) =>
	(totalStaked > reserve ? totalStaked - reserve : 0n) + sponsored;

export const shareOf = (pot: bigint, weight: bigint, totalWeight: bigint) =>
	totalWeight === 0n ? 0n : (pot * weight) / totalWeight;

/** `rate` grown by `apyBps` simple interest over `seconds`. An estimate, never on chain. */
export const projectedRate = (rate: bigint, seconds: bigint, apyBps = ASSUMED_APY_BPS) =>
	rate + (rate * apyBps * seconds) / (10_000n * YEAR);

export type Stake = { staked: bigint; principal: bigint; weight: bigint };

export type Projection = { principal: bigint; pot: bigint; winnings: bigint };

/**
 * What a bet of `amount` stNEAR on one side would return if that side wins, assuming the rate
 * grows at the assumed APY until close and nobody else bets. `pick` is the side bet on.
 */
export function projectBet(args: {
	amount: bigint;
	rate: bigint;
	now: bigint;
	closeTime: bigint;
	pick: Stake;
	other: Stake;
	sponsored: bigint;
}): Projection {
	const { amount, rate, now, closeTime, pick, other, sponsored } = args;
	const principal = principalOf(amount, rate);
	const weight = weightOf(principal, now, closeTime);
	const closeRate = projectedRate(rate, closeTime - now);
	const reserve = reserveOf(pick.principal + other.principal + principal, closeRate);
	const pot = potOf(pick.staked + other.staked + amount, reserve, sponsored);
	return { principal, pot, winnings: shareOf(pot, weight, pick.weight + weight) };
}
