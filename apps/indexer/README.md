# @pearn/indexer

[Ponder](https://ponder.sh) over the PearnMarkets events on Aurora. Tables: `market` (kept in step with every event), `participant` (stake, sponsorship and claim per account and market), `activity` (every event, for feeds). Served at `/graphql` and `/sql`; health at `/health`, `/ready`.

Hosted: https://indexer.pearn.103.150.190.91.sslip.io/graphql (Aurora testnet).

```sh
pnpm start --schema pearn            # index Aurora testnet into PGlite (.ponder/), serve on :42069
pnpm test                            # anvil + DevChain + ponder, GraphQL checks after seed, resolve and claim
```

```graphql
{ activitys(where: { marketId: "2" }, orderBy: "timestamp", orderDirection: "desc") { items { kind account amount txHash } } }
```

| Env | Default | |
|---|---|---|
| `PONDER_CHAIN_ID` | `1313161555` | Reads `contracts/deployments/<id>.json` for the address |
| `PONDER_RPC_URL` | `https://testnet.aurora.dev` | |
| `PONDER_START_BLOCK` | the testnet deploy block | |
| `PONDER_PGLITE_DIR` | `.ponder/pglite` | |

The web app uses it for market activity and to find an account's markets; balances and payouts always come from the chain, and the app works without it.
