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

The app, against a local chain with sample markets:

```sh
cd apps/web && pnpm dev:local                  # http://localhost:3000
```

To read the story in code, start with `test/integration/MarketLifecycle.t.sol`. It runs a 30-day market:
- the loser keeps 150 NEAR of value;
- the early and late winners split the pot 2:1 by time weight.

## Deployments

App: **https://pearn.103.150.190.91.sslip.io** (Aurora testnet; deployed from `main` by Coolify, see [deploy/](deploy/README.md)).

Aurora testnet (1313161555), all verified on Blockscout:

| Contract | Address |
|---|---|
| PearnMarkets | [`0x4659f0d99587D4fA396840d982a4215FcFe8a557`](https://explorer.testnet.aurora.dev/address/0x4659f0d99587D4fA396840d982a4215FcFe8a557) |
| StNearRateOracle (reads `meta-v2.pool.testnet`) | [`0xA8adEFE2C8f0F71a585a73c1259997f593F9e463`](https://explorer.testnet.aurora.dev/address/0xA8adEFE2C8f0F71a585a73c1259997f593F9e463) |
| stNEAR (bridged, Meta Pool) | [`0x2137df2e54abd6bF1c1a8c1739f2EA6A8C15F144`](https://explorer.testnet.aurora.dev/address/0x2137df2e54abd6bF1c1a8c1739f2EA6A8C15F144) |

Check the XCC oracle yourself: `cast call 0xA8adEFE2C8f0F71a585a73c1259997f593F9e463 "rate()(uint256)" -r https://testnet.aurora.dev` → Meta Pool testnet's `get_st_near_price`, read from NEAR by Solidity. Three demo markets are open with bets from the deployer.

**Deploying without Aurora ETH.** Forge simulates, then `scripts/aurora-submit.mjs` signs each transaction at gas price 0 and hands it to the Aurora engine's `submit` method on NEAR, so a NEAR account pays NEAR gas. That is how these contracts went live:

```sh
pnpm rpc:testnet &
cd contracts && forge script script/Deploy.s.sol --rpc-url aurora_testnet --legacy     # simulate only
WALLET_PK=… NEAR_SIGNER=you.testnet node ../scripts/aurora-submit.mjs broadcast/Deploy.s.sol/1313161555/dry-run/run-latest.json
```

The oracle's first `sync()` pulls 2 wNEAR from the caller for its XCC account (approve first); later syncs are free. The keeper (`.github/workflows/keeper.yml`) syncs every 12 h the same way, with a NEAR function-call key that can only call `aurora.submit`.

## Testnet stNEAR

Everything goes through NEAR testnet with [near-cli-rs](https://github.com/near/near-cli-rs); bridging into Aurora needs no Aurora gas. `YOUR_ADDRESS` is your Aurora address, lowercase and without `0x`.

```sh
near account create-account sponsor-by-faucet-service you.testnet autogenerate-new-keypair save-to-legacy-keychain network-config testnet create   # 10 NEAR
near contract call-function as-transaction meta-v2.pool.testnet deposit_and_stake json-args '{}' prepaid-gas '200 Tgas' attached-deposit '5 NEAR' sign-as you.testnet network-config testnet sign-with-legacy-keychain send
near contract call-function as-transaction meta-v2.pool.testnet ft_transfer_call json-args '{"receiver_id":"aurora","amount":"<stNEAR yocto>","msg":"YOUR_ADDRESS"}' prepaid-gas '200 Tgas' attached-deposit '1 yoctoNEAR' sign-as you.testnet network-config testnet sign-with-legacy-keychain send
```

The stNEAR shows up at `0x2137…f144` on Aurora testnet. wNEAR (for the oracle's first sync) works the same way: `wrap.testnet` `storage_deposit` + `near_deposit`, then `ft_transfer_call` to `aurora`. Aurora gas (ETH) comes from the [Aurora faucet](https://aurora.dev/faucet).

## Repository

| Path | What |
|---|---|
| `contracts/src` | `PearnMarkets`, `StNearRateOracle`, `libraries/` (PayoutMath, NearJson), `interfaces/`, `types/` |
| `contracts/test` | `unit/`, `integration/`, `property/`, `fork/`, shared `utils/` and `mocks/` |
| `contracts/script` | Deploy, SyncOracle, SeedMarkets (testnet demo markets), DevChain (local sample markets), per-network addresses |
| `apps/web` | Next.js static app (viem, injected wallet): markets, bet, sponsor, resolve, claim, create, portfolio |
| `packages/brand` | Logo and icons |
| `deploy/` | Caddy static server, CSP build step, host nginx; CD via Coolify |
| `.github/workflows/keeper.yml` | Keeper: `oracle.sync()` every 12 h through NEAR, from a dedicated wallet |
| `scripts/abi.mjs` | Writes the web ABI from the contracts; CI fails on drift |
| `scripts/aurora-submit.mjs` | Replays a Forge run on Aurora through NEAR (`aurora.submit`, gas price 0): no Aurora ETH needed |
| `scripts/aurora-rpc.mjs` | Local RPC proxy: Foundry sends a bare block hash that Aurora rejects; this rewrites it to EIP-1898 |
| `REGRESSION.md` | One named test per fixed bug, checked in CI |

Workflow, layout and funds rules: [CONTRIBUTING.md](CONTRIBUTING.md).

## Hackathon notes

- Built for NEAR HACKATHON 2026, starting 2026-10-30. All code in this repository was written in the hackathon window.
- Reused from the team's earlier project [zPredict](https://github.com/zpredict/zpredict) (Zcash): only repo tooling patterns, namely the Biome config, the CONTRIBUTING structure and `scripts/regressions.mjs`. No product code.
- Libraries: OpenZeppelin Contracts 5.1, Aurora contracts SDK v0.1.0, forge-std. Written with AI assistance.

MIT © Pearn contributors
