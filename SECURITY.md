# Security policy

Pearn is a hackathon project deployed on **Aurora testnet**; it holds no real funds. Please still report anything that could let someone lose principal, take others' yield, block payouts or break the apps.

## Reporting

Use [GitHub private vulnerability reporting](https://github.com/pearn-protocol/pearn/security/advisories/new). Do not open a public issue for a vulnerability. Include the affected file or contract, the steps to reproduce, and the impact. We aim to answer within a few days; there is no bug bounty.

## Scope

| In scope | Where |
|---|---|
| Contracts: `PearnMarkets`, `StNearRateOracle`, payout math | `contracts/src/` |
| The keeper and its scripts (oracle sync, Polymarket resolution) | `scripts/`, `.github/workflows/keeper.yml` |
| The app, landing, docs and indexer | `apps/` |

Out of scope: third parties we depend on (Meta Pool, Aurora, Polymarket, CoinGecko), and testnet-only conditions such as an empty faucet.

## Known risks

Documented and accepted until a mainnet deployment: the oracle accepts any higher rate without a cap and stops updating after a fall in stNEAR's value, the creator of a market chooses its resolver, the guardian key cannot be rotated, and bets have no minimum. See [Risks](https://docs.pearn.site/docs/risks/).
