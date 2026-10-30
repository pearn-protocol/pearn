# Contributing

## Workflow

1. **Issue first.** Labels: one `type:`, the `area:`s it touches, one `priority:`, plus `funds` if it changes how principal or yield moves.
2. **Branch** off `main`: `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…`.
3. **Small commits**, [Conventional Commits](https://www.conventionalcommits.org/): `feat(contract): …`.
4. **PR** with `Closes #n`, the issue's labels, what changed, and test evidence. Add a comment saying where review should focus.
5. Merge commits only; branches auto-delete. Comment on the issue when its PR merges.

## Checks

CI (`.github/workflows/ci.yml`) runs on every PR and on `main`, and `main` requires it to pass. Deploys to Coolify follow once there is an app to deploy (#2).

The Husky pre-commit hook runs Biome on staged files and `cargo fmt --check`. Before you open a PR:

```sh
pnpm check
cargo fmt --all && cargo clippy --all-targets -- -D warnings && cargo test   # once the contract exists
```

## Layout

`contracts/` holds NEAR contracts, `apps/` anything that runs or deploys, `scripts/` the keeper and repo scripts.

**Rust (`contracts/pearn`)**
- `lib.rs` is the contract struct, constants and `mod` only.
- One concept per module (`market.rs`, `vault.rs`, `payout.rs`, …); the error type goes in `error.rs`.
- Unit tests sit next to the code; sandbox tests (near-workspaces) go in `tests/`.

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
- State changes only after a cross-contract callback confirms success.
- Every write that adds state takes a storage deposit.
- Never commit keys or seed phrases; they live in environment variables.
