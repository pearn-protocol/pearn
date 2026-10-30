<p align="center">
  <img alt="Pearn" width="96" src="packages/brand/android-chrome-192x192.png">
</p>

# Pearn

[![CI](https://github.com/pearn-protocol/pearn/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/pearn-protocol/pearn/actions/workflows/ci.yml)

No-loss prediction market on NEAR. **Bet the staking yield, keep the principal.**

You bet stNEAR (staked NEAR) on YES or NO. When the market resolves, everyone gets their principal's NEAR value back, and the winning side splits all the staking yield the market earned, plus any sponsored pot.

## Problem

In a normal prediction market the loser loses everything, which keeps most people out. Staked NEAR earns ~4.5% a year anyway. Pearn uses that yield as the stake.

## How it works

1. **Bet:** stNEAR in. Your principal is fixed in NEAR at the current rate, and your weight = principal × time left until close.
2. **Yield:** stNEAR's NEAR value rises every epoch. `StNearRateOracle` reads the rate from Meta Pool on NEAR through Aurora's cross-contract-call (XCC) precompile. There is no off-chain feed, and the rate never decreases.
3. **Resolve:** the market's resolver (ideally a DAO) reports the outcome after close. During a 24 h window a guardian can only turn it into `Invalid`. If no one resolves within 7 days, anyone can void the market.
4. **Claim:** losers get their principal back. Winners get their principal back plus `pot × weight / winning weight`. Payouts are rounded so the contract can never pay out more than it holds.

There is no owner, no upgrade path, and no admin access to funds. Design and math: [DESIGN.md](DESIGN.md).

## NEAR integration

| What | Where |
|---|---|
| Contracts on **Aurora** (NEAR's EVM), Solidity + Foundry | `contracts/src/` |
| **stNEAR** (Meta Pool liquid staking) as the yield source | `PearnMarkets.sol` |
| **XCC** view of `get_st_near_price` on `meta-pool.near`, callback into Solidity | `StNearRateOracle.sol` |
| DAO-resolved markets (resolver is any account, e.g. a SputnikDAO) | `resolve()` |

## Try it

Requirements: [Foundry](https://getfoundry.sh) 1.8+, Node 24, pnpm 10.

```sh
git clone --recursive https://github.com/pearn-protocol/pearn && cd pearn
pnpm install
cd contracts && forge test
```
→ 46 tests pass:
- unit: math, markets, oracle, JSON parsing;
- integration: the full market lifecycle with the real oracle;
- property: a fuzz test checking that nobody loses principal and the contract stays solvent.

```sh
pnpm rpc:testnet & pnpm rpc:mainnet &          # Aurora RPC proxy (see below)
cd contracts && FOUNDRY_PROFILE=fork forge test
```
→ the same market round-trips the **real bridged stNEAR** on Aurora testnet and mainnet forks.

To read the story in code, start with `test/integration/MarketLifecycle.t.sol`. It runs a 30-day market:
- the loser keeps 150 NEAR of value;
- the early and late winners split the pot 2:1 by time weight.

## Deployments

| Network | PearnMarkets | StNearRateOracle |
|---|---|---|
| Aurora testnet (1313161555) | pending | pending |

Deploy: `pnpm rpc:testnet`, then `cd contracts && forge script script/Deploy.s.sol --rpc-url aurora_testnet --legacy --broadcast` (env `WALLET_PK`). The first `script/SyncOracle.s.sol` run pays the oracle's one-time 2 wNEAR XCC storage.

## Repository

| Path | What |
|---|---|
| `contracts/src` | `PearnMarkets`, `StNearRateOracle`, `libraries/` (PayoutMath, NearJson), `interfaces/`, `types/` |
| `contracts/test` | `unit/`, `integration/`, `property/`, `fork/`, shared `utils/` and `mocks/` |
| `contracts/script` | Deploy, SyncOracle, per-network addresses |
| `scripts/aurora-rpc.mjs` | Local RPC proxy: Foundry sends a bare block hash that Aurora rejects; this rewrites it to EIP-1898 |
| `REGRESSION.md` | One named test per fixed bug, checked in CI |

Workflow, layout and funds rules: [CONTRIBUTING.md](CONTRIBUTING.md).

## Hackathon notes

- Built for NEAR HACKATHON 2026, starting 2026-10-30. All code in this repository was written in the hackathon window.
- Reused from the team's earlier project [zPredict](https://github.com/zpredict/zpredict) (Zcash): only repo tooling patterns, namely the Biome config, the CONTRIBUTING structure and `scripts/regressions.mjs`. No product code.
- Libraries: OpenZeppelin Contracts 5.1, Aurora contracts SDK v0.1.0, forge-std. Written with AI assistance.

MIT © Pearn contributors
