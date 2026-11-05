# Pearn — design

No-loss prediction market on NEAR. You bet the **staking yield** of your NEAR, never the NEAR itself. Everyone gets their principal back; the winning side splits the yield of the whole market.

Contracts are Solidity (Foundry) on **Aurora**, the EVM on NEAR. The stake is **stNEAR**, Meta Pool's liquid-staked NEAR, bridged to Aurora as an ERC-20. Its NEAR value rises every epoch as staking rewards land; that rise is the yield.

## 1. Problem and pitch

- In a normal prediction market the loser loses everything. That keeps most people out.
- Staked NEAR earns ~4.5% a year anyway. Pearn turns that yield into the stake: "Bet the interest, keep the money."
- Prior art exists on EVM chains (Aave-based hackathon projects: Unice, NoLoss Predict, ExtraLife). Pearn differs:
  1. **NEAR staking as the yield source**, not a lending market: no borrowers, no liquidations, and NEAR has no slashing today.
  2. **Instant claims.** Bets and payouts are in stNEAR, so nothing waits for NEAR's 4-epoch unstake.
  3. **The rate comes from NEAR itself.** A Solidity oracle reads `get_st_near_price` from the Meta Pool contract on NEAR through Aurora's cross-contract-call (XCC) precompile. There is no off-chain price feed.
  4. **Sponsored pots and DAO resolvers.** Projects top up pots; each market names its own resolver, ideally a DAO.

## 2. Why stNEAR and not XCC → staking pool

The first design staked NEAR directly with a validator through XCC. Reading the XCC source rules it out:

- The XCC precompile funds every NEAR deposit a promise attaches by pulling the **caller's wNEAR** (`engine-precompiles/src/xcc.rs`, `required_near`). The router then attaches that NEAR (`etc/xcc-router/src/lib.rs`).
- After `unstake` → `withdraw_all`, the NEAR lands on the contract's XCC router account. Getting it back to Aurora means wrapping it with `near_deposit`, and that attaches NEAR, which the precompile charges to the contract **again**. The router's own NEAR can never leave; only a fixed 2 NEAR refund exists.

So native staking via XCC is one-way. stNEAR keeps the staking yield and avoids the problem: it is an ERC-20 on Aurora already, and XCC is only needed for a free view call.

Verified on chain (2026-10-30):

| | Aurora mainnet (1313161554) | Aurora testnet (1313161555) |
|---|---|---|
| stNEAR ERC-20 | `0x07f9f7f963c5cd2bbffd30ccfb964be114332e30` (24 decimals) | `0x2137df2e54abd6bf1c1a8c1739f2ea6a8c15f144` |
| Meta Pool on NEAR | `meta-pool.near` (rate 1.5128 NEAR) | `meta-v2.pool.testnet` |
| XCC precompile | `0x516cded1d16af10cad47d6d49128e2eb7d27b372` | same |

Testnet bridged tokens report empty metadata (`decimals() = 0`), so contracts never call `decimals()`. All amounts are raw units, 1e24 per token.

## 3. Actors

| Actor | Does |
|---|---|
| Bettor | Bets stNEAR on YES or NO, claims principal + winnings |
| Sponsor | Adds stNEAR to a market's pot; gets it back only if nobody bet |
| Creator | Anyone. Creates a market: question, close time, resolver |
| Resolver | Set per market (ideally a DAO). Reports the outcome after close |
| Guardian | One account, fixed at deploy, that can only turn an outcome into `Invalid` during the challenge window. Meant to be a DAO or multisig; on testnet it is the deployer's wallet |
| Keeper | Anyone. Calls `oracle.sync()` once per epoch |

There is no owner and no upgrade path: no one can move principal.

## 4. System

```
Browser (Next.js static export, viem, MetaMask on Aurora)
   │ approve + bet / sponsor / claim / create            reads
   ▼                                                        │
PearnMarkets.sol ─── rate() ──► StNearRateOracle.sol ◄──────┘
   │ holds stNEAR ERC-20            │ XCC: get_st_near_price on meta-pool.near
   ▼                                ▼ callback onRate(...)
stNEAR (bridged NEP-141)        NEAR: Meta Pool contract

keeper (cron) ──► oracle.sync()
resolver DAO  ──► markets.resolve(id, outcome)
```

## 5. Accounting

`rate` is yoctoNEAR per 1 stNEAR (1e24 scale). It only rises; the oracle ignores any lower reading, which keeps every payout within the contract's holdings. It does not protect principal from a real fall in stNEAR's value (see §8, slashing).

### Bet
User sends `s` stNEAR on side `side` at time `t < close`:
- `principal = s × rate / 1e24` — the bet's NEAR value, fixed now.
- `weight = principal × (close − t)` — time-weighted. Known at bet time because bets are locked until close.
- The market adds `s`, `principal` and `weight` to that side and to the user's position.

**Why time weight:** without it a whale bets on the obvious side just before close and takes the yield early bettors produced. With it, a late bet earns almost nothing.

A stale rate is safe for everyone else. An old, lower rate under-counts the bettor's own principal, by at most 2 days of yield (`MAX_RATE_AGE`), and the difference goes into the pot. It never comes out of anyone else.

### Resolve
After `close`, once the oracle has synced after close, the resolver calls `resolve(id, Yes | No | Invalid)`. The market stores `rateR`:
- `reserve = ceil(totalPrincipal × 1e24 / rateR)` — stNEAR needed to give everyone their NEAR back.
- `pot = totalStaked − reserve + sponsored` — all the yield, plus sponsors.

Then a 24 h **challenge window** opens, in which the guardian may override to `Invalid`. If the resolver does nothing for 7 days after close, anyone can void the market (`Invalid`).

### Claim (after the window)
| Case | Bettor receives (stNEAR) |
|---|---|
| Lost | `floor(principal × 1e24 / rateR)` |
| Won | refund + `pot × weight / W_winning` |
| Invalid, or nobody on the winning side | refund + `pot × weight / W_all` |

`Σ refund ≤ reserve` (floor vs ceil) and `Σ share ≤ pot` (floor). So the contract can never pay out more than it holds; dust stays in the contract. The principal is returned in stNEAR worth the bet's NEAR value at `rateR`. Users convert to NEAR at Meta Pool (instant with a fee, or delayed unstake).

## 6. Honest numbers

APY ≈ 4.5% (after the 2025 inflation halving; Meta Pool takes its fee).

| TVL in market | Duration | Market yield | Winners at 50/50 earn on principal |
|---|---|---|---|
| 10,000 NEAR | 30 days | ≈ 37 NEAR | ≈ 0.74% in a month (2× normal staking) |
| 10,000 NEAR | 1 year | ≈ 450 NEAR | ≈ 9% |

Pure yield is a savings account with a twist, so the design leans on **sponsored pots** and **long markets**. The UI always shows "principal: safe · projected winnings: X" with the real number.

## 7. Contracts

```
contracts/
  src/
    PearnMarkets.sol            market lifecycle: create, bet, sponsor, resolve, void, override, claim
    StNearRateOracle.sol        XCC view of get_st_near_price; monotonic rate
    interfaces/IPearnMarkets.sol  events, errors, external API
    interfaces/IRateOracle.sol
    libraries/PayoutMath.sol    pure §5 math
    libraries/NearJson.sol      parses the u128 string Meta Pool returns
    types/Market.sol            Market, Side, Outcome, Stake
  test/                         unit, integration, fuzz (property), invariant (several markets) and fork tests
  script/                       Deploy, SyncOracle, SeedMarkets, DevChain (local anvil), NetworkConfig
```

Best practice applied: Solidity 0.8.28, custom errors, events on every state change, checks-effects-interactions plus `ReentrancyGuard`, `SafeERC20`, `Math.mulDiv` for all products, immutables for every address, NatSpec on the external API.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Oracle callback spoofed | Only the oracle's own XCC account (`implicitAuroraAddress(addressSubAccount(oracle, "aurora"))`) may call `onRate`; the rate never decreases |
| Resolver lies | DAO resolver; 24 h window where the guardian can force `Invalid` (everyone keeps principal plus their share of the yield) |
| Resolver disappears | Anyone voids after 7 days |
| stNEAR depeg or bug | Principal is a NEAR value paid in stNEAR, so Meta Pool risk stays with the bettor (docs: Risks) |
| Slashing introduced on NEAR | The rate could fall. The oracle keeps its last (higher) rate and stops refreshing: after 2 days bets stop, and markets closing after the last good sync can no longer be resolved (that needs a sync after close), so after 7 days they can only be voided to `Invalid`. Refunds use the last, higher rate, so the stNEAR returned is worth less NEAR than was put in: **principal loses value in proportion to the fall** |
| Contract bug | Small surface, no admin, fuzz + invariant tests on "payouts ≤ holdings" across several markets |
| Betting both sides | Costs only capital, and the hedger's weight earns a share of any sponsored pot whatever the outcome. Inherent to no-loss: losers lose nothing, and per-account netting is defeated by a second account. Sponsors should expect their pot to be shared by capital as well as by calls |

## 9. User flows

- **Bettor:** connect MetaMask (Aurora) → open market → see odds, pot and the projected-winnings calculator → approve + bet 5 stNEAR on YES → after resolution and the window: claim → refund + winnings.
- **Sponsor:** "Add to pot" → 100 stNEAR → the pot grows and the sponsor is listed.
- **Resolver DAO:** a proposal "resolve market 7 = YES" → vote → the DAO calls `resolve`.
- **Getting stNEAR:** stake NEAR at Meta Pool and bridge it to Aurora. The README and the docs (Testnet stNEAR) give the testnet commands.

## 10. Repository

```
contracts/       Foundry project (§7)
apps/web/        Next.js static export + viem (the app)
apps/landing/    Astro static site (pearn.site)
apps/indexer/    Ponder indexer (activity, positions)
apps/docs/       Fumadocs static docs
packages/        abi (generated from contracts), brand (logo, tokens, ASCII mark)
scripts/         aurora-submit (deploy and sync through NEAR), aurora-rpc (fork proxy), abi
.github/         CI, deploy, keeper (oracle.sync every 12 h), health
```

## 11. Timeline (hackathon ends 2026-11-14 23:59 UTC)

| When | Status |
|---|---|
| Oct 30 – 31 | Done: contracts and tests, testnet deploy and verification through NEAR, keeper |
| Oct 31 – Nov 2 | Done: web app, indexer, docs, seed markets, a full demo lifecycle (bet → resolve → claim) |
| Nov 2 – 3 | Done: landing, pearn.site, audit fixes |
| By Nov 14 | Demo video and X post (the human posts), submission — the human confirms the payload first |

## 12. Tracks

`defi` (yield-backed market), `social` (DAO-resolved, community-sponsored markets), `open`.

## 13. Later

- Zap: bet with wNEAR, and the contract stakes it into stNEAR via XCC `deposit_and_stake` + bridge back.
- Any-chain deposits via NEAR Intents 1Click (mainnet only).
- Early exit before close: principal back, your yield stays in the pot.
