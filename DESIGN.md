# Pearn — design

No-loss prediction market on NEAR. You bet the **staking yield** of your NEAR, never the NEAR itself. Everyone gets their principal back; the winning side splits the yield of the whole market.

Status: design, 2026-10-30. Nothing built yet.

## 1. Problem and pitch

- In a normal prediction market the loser loses everything. That keeps most people out, and it is gambling in most jurisdictions' eyes.
- Idle NEAR earns ~4.5% a year from staking anyway. Pearn turns that yield into the stake: "Bet the interest, keep the money."
- Prior art exists on EVM (Aave-based hackathon projects: Unice, NoLoss Predict, ExtraLife). Pearn differs in three ways:
  1. **Native NEAR staking as the yield source.** No lending protocol, no liquidation risk, and NEAR has no slashing today.
  2. **Sponsored pots.** Projects, DAOs and validators top up the pot. Yield alone is too small to be fun (see §6); sponsors are the business model, not an afterthought.
  3. **DAO resolvers.** Each market names a SputnikDAO/Trezu account as its oracle, so a community resolves its own markets.

## 2. Actors

| Actor | Does |
|---|---|
| Bettor | Deposits NEAR on YES or NO, claims principal + winnings |
| Sponsor | Adds NEAR to a market's pot; gets nothing back except attention |
| Creator | Creates a market: question, close time, resolver |
| Resolver | An account (ideally a DAO) that reports the outcome after close |
| Keeper | Anyone. Calls permissionless maintenance methods (sync, stake, unstake, withdraw) |

## 3. System

```
Browser (Next.js + wallet-selector)
   │  bet / sponsor / claim / create          view calls
   ▼                                              │
pearn.near  (one Rust contract)  ◄────────────────┘
   │  deposit_and_stake / unstake / withdraw_all / get_account_total_balance
   ▼
staking pool (one validator, e.g. *.poolv1.near)

keeper script (cron, Node) ──► pearn.sync / stake / unstake / withdraw
resolver DAO (SputnikDAO)   ──► pearn.resolve(market, outcome)
```

One contract holds every market. All deposits go into one shared **vault** staked with one pool. Markets don't stake separately; they own **vault shares**, ERC-4626 style. This keeps the cross-contract surface to one pool and four methods.

## 4. Accounting (the core)

### Vault
- `assets = pool_total_balance (staked + unstaking) + liquid − owed`
- `price = assets / total_shares`. It only rises (rewards are paid per epoch; no slashing).
- `price` is refreshed by `sync()`, a cross-contract view of `get_account_total_balance` with a callback. Rewards land once per epoch (~12 h), so syncing once per epoch is exact, not an approximation.

### Bet
User attaches `a` NEAR on side `s` at time `t` (before `close`):
- `shares = floor(a / price)` — rounding favours the vault, so principal is never over-promised.
- `weight = a × (close − t)` — time-weighted stake. Known at bet time because bets are locked until close, so no running accumulators are needed.
- The market adds `a`, `shares` and `weight` to side `s`.

**Why time weight:** without it a whale bets on the obvious side one minute before close and takes the yield that early bettors produced. With it, a late bet earns almost nothing.

### Resolve
After `close`, the resolver calls `resolve(id, Yes | No | Invalid)`. The contract then:
1. Values the market at the current price: `V = market_shares × price`.
2. `yield = max(0, V − total_principal)`. `pot = yield + sponsored`.
3. Burns the market's shares and records `V + sponsored` as `owed` (a fixed NEAR liability). The market stops earning.
4. Opens a 24 h **challenge window** in which the contract `guardian` (a DAO) may override the outcome to `Invalid`. After that the outcome is final.

### Claim
| Case | Bettor receives |
|---|---|
| Lost | `a` |
| Won | `a + pot × weight / W_winning_side` |
| Invalid, or nobody on the winning side | `a + pot × weight / W_all` (everyone shares the pot) |

Rounding dust stays in the treasury. Sum of payouts ≤ `V + sponsored` by construction, so the market can never pay out more than it holds.

**Protocol fee:** optional `fee_bps` on the pot only (never on principal). Defaults to 0 for the hackathon.

## 5. Liquidity and the 4-epoch unstake delay

The reference staking pool releases unstaked NEAR after 4 epochs (~2 days). Pearn handles this with a liquid buffer and netting, not a lockup UX:

1. New bets stay **liquid** first. `claim` pays from liquid immediately when it can — new deposits fund old claims.
2. `stake()` (keeper): stakes `liquid − owed` when positive.
3. `unstake()` (keeper): when `owed > liquid + unstaking`, unstakes the gap. One unstake per epoch, because the pool resets the 4-epoch timer on every unstake call.
4. `withdraw()` (keeper): `withdraw_all` once the pool says the balance is available.
5. If liquid is short, `claim` returns `pending` with an ETA. The user claims again later. Nothing is lost; it just waits.

Every keeper method is permissionless and idempotent, so anyone can run the keeper and a missed run only delays, never breaks.

## 6. Honest numbers

APY ≈ 4.5% (after the 2025 inflation halving; pool fees vary).

| TVL in market | Duration | Market yield | Winners at 50/50 earn on principal |
|---|---|---|---|
| 10,000 NEAR | 30 days | ≈ 37 NEAR | ≈ 0.74% in a month (2× normal staking) |
| 10,000 NEAR | 1 year | ≈ 450 NEAR | ≈ 9% |

Pure yield is a savings account with a twist. That is why the design leans on:
- **Sponsored pots.** A project funding a 500 NEAR pot on "Will X ship mainnet by Q1?" gets engaged forecasters for a fraction of an ad budget.
- **Validator sponsorship.** The vault stakes with the pool that sponsors; validators are already paying for delegation.
- **Long markets.** Elections and year-end prices, where yield builds up.

The UI always shows "your principal: safe · projected winnings: X NEAR" with the real number, never a hyped APY.

## 7. Contract interface (draft)

```
// write
create_market(question, close_ts, resolver) -> id            // creator; storage deposit attached
bet(id, side)                    #[payable]                   // min 1 NEAR, covers storage
sponsor(id)                      #[payable]
resolve(id, outcome)                                          // resolver, after close
override_invalid(id)                                          // guardian, inside challenge window
claim(id) -> Paid | Pending{eta}
// keeper, permissionless
sync()  stake()  unstake()  withdraw()
// view
get_market(id)  list_markets(from, limit)  get_position(id, account)  get_vault()
```

Verify the staking pool's method names (`deposit_and_stake`, `unstake`, `withdraw_all`, `get_account_total_balance`, `is_account_unstaked_balance_available`) against `near/core-contracts/staking-pool` before writing the code.

## 8. Risks and how we handle them

| Risk | Mitigation |
|---|---|
| Cross-contract call fails mid-flow | State changes after the callback confirms success; a `busy` flag blocks overlapping pool calls; failed callbacks roll back |
| Resolver lies | Resolver is a DAO; 24 h challenge window with a guardian DAO that can only force `Invalid` (everyone keeps principal + own share) |
| Pool goes offline / fee rises | Owner (DAO) can switch pool via unstake → withdraw → restake; principal still intact |
| Slashing introduced in the future | README states the assumption; then `price` could drop and principal would no longer be guaranteed — revisit |
| Storage abuse | Every write that adds state requires attached storage deposit |
| Contract bug | Small surface, unit tests on the math, sandbox tests on the pool flow, testnet only for the hackathon |

## 9. User flows

**Bettor:** connect wallet → open market → see odds, pot, "projected winnings" calculator → bet 5 NEAR on YES → after resolution: claim → 5 NEAR + winnings (or 5 NEAR back).

**Sponsor:** open market → "Add to pot" → 100 NEAR → pot grows, sponsor named on the market page.

**Creator:** create market → question, close date, resolver account (DAO).

**Resolver DAO:** a proposal "resolve market 7 = YES" → vote → the DAO calls `pearn.resolve`. Optional: a keeper script that mirrors Polymarket outcomes into DAO proposals (adapted from zPredict's `polymarket-catalog.mjs`, disclosed as baseline).

## 10. Repository

```
contracts/pearn/    Rust, near-sdk; unit tests for §4 math, near-workspaces sandbox tests for §5
apps/web/           Next.js + @near-wallet-selector
scripts/keeper.mjs  cron: sync, stake, unstake, withdraw
README.md           what / why / "do X → see Y" steps for judges (Claude Code screens it)
DESIGN.md  LICENSE (MIT)
```

## 11. Timeline (hackathon ends 2026-11-14 23:59 UTC)

| Dates | Work |
|---|---|
| Oct 30 – Nov 2 | Contract: markets, bets, resolve, claim math + unit tests |
| Nov 3 – 6 | Vault ↔ staking pool, keeper methods, sandbox tests with fast-forwarded epochs |
| Nov 7 – 10 | Web app: market list, detail, portfolio, create |
| Nov 11 – 12 | Testnet deploy, keeper on cron, seed markets with a sponsored pot, end-to-end run |
| Nov 13 | README, demo video, X post draft (human posts) |
| Nov 14 | Repo public, submission — payload confirmed by the human first |

## 12. Tracks

`defi` (yield-backed market), `social` (DAO-resolved, community-sponsored markets), `open`.

## 13. Later (not in the hackathon scope)

- Any-chain deposits via NEAR Intents 1Click (mainnet only; no Intents testnet).
- Early exit before close: get principal back, leave your yield in the pot.
- Liquid staking token as the yield source for instant withdrawals.
- Social login / meta transactions so bettors never see a wallet.
