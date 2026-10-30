# Contributing

## Workflow

1. **Issue first.** Labels: one `type:`, the `area:`s it touches, one `priority:`, plus `funds` if it changes how principal or yield moves.
2. **Branch** off `main`: `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`.
3. **Small commits**, [Conventional Commits](https://www.conventionalcommits.org/): `feat(contract): …`.
4. **PR** with `Closes #n`, the issue's labels, what changed, and test evidence. Add a comment saying where review should focus.
5. Merge commits only; branches auto-delete. Comment on the issue when its PR merges.

## Checks

CI (`.github/workflows/ci.yml`) runs on every PR and on `main`, and `main` requires it to pass. Deploys to Coolify follow once there is an app to deploy (#2).

The Husky pre-commit hook runs Biome on staged files and `forge fmt --check`. Before you open a PR:

```sh
pnpm check
cd contracts && forge fmt --check && forge build --sizes && forge test
```

## Layout

`contracts/` holds the Solidity contracts (Aurora), `apps/` anything that runs or deploys, `scripts/` the keeper and repo scripts.

**Solidity (`contracts/`, Foundry)**
- `src/` one contract per file; `interfaces/` hold events, errors and the external API; `libraries/` pure logic; `types/` structs and enums.
- Custom errors, an event for every state change, NatSpec on external functions, immutables for addresses.
- Checks-effects-interactions, `SafeERC20`, `Math.mulDiv` for products.
- `test/` mirrors `src/` (`PearnMarkets.t.sol`, …); mocks in `test/mocks/`; fuzz and invariant tests for anything in DESIGN.md §5.

**Next.js (`apps/web`)**
- `app/` routes only compose.
- `components/ui/` for primitives, `components/<feature>/` for features.
- `hooks/` for data hooks; `lib/` for non-React logic and config.

**Everywhere**
- One component or concept per file; keep files under ~250 lines.
- No speculative abstractions.

## Funds rules

Principal is the promise, so every PR keeps to these:
- Payouts never exceed what the market holds (DESIGN.md §4); rounding favours the vault.
- Oracle state changes only in a callback from the oracle's own XCC account, and the rate never decreases.
- No owner and no upgrade path over funds.
- Never commit keys or seed phrases; they live in environment variables.
