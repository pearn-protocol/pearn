# @pearn/landing

The marketing site at https://pearn.103.150.190.91.sslip.io (Astro, static): hero, how it works, the newest markets, built on NEAR, safety, FAQ. The app lives at `app.`, the docs at `docs.`.

```sh
pnpm --filter @pearn/landing dev        # http://localhost:3003
pnpm --filter @pearn/landing build      # build + smoke test of dist/
pnpm --filter @pearn/landing test       # market card logic
```

- Copy lives in `src/data/` (`content.ts`, `site.ts`), so it is reviewable in one place and must stay true of `main` and the live deployment.
- The "Newest markets" cards are fetched in the browser from the indexer (`src/scripts/markets.ts`); without it the section links to the app. That fetch is the page's only cross-origin request, and the CSP allows only the indexer origin.
- `PUBLIC_APP_URL`, `PUBLIC_DOCS_URL`, `PUBLIC_INDEXER_URL` override the production origins (build args in `Dockerfile`).
- `scripts/smoke.mjs` fails the build on a missing route, a broken local link or anchor, or any third-party script, stylesheet or image.
