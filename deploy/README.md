# Deploy

| File | What |
|---|---|
| `static/Caddyfile` | Static server in the landing, web and docs images: security headers, no logs |
| `static/prepare.mjs` | Image build step: hashed self-only CSP, precompressed assets |
| `nginx.conf`, `nginx-app.conf`, `nginx-indexer.conf`, `nginx-docs.conf` | Host nginx on the VPS: TLS and the proxy to each container |
| `install-nginx.sh` | Installs those on the VPS, with certs and a rollback |

## Hosted app

| URL | Coolify resource (project `pearn`) | Loopback port |
|---|---|---|
| https://pearn.site | app `landing` (`apps/landing/Dockerfile`, Astro) | 3180 |
| https://app.pearn.site | app `web` (`apps/web/Dockerfile`) | 3177 |
| https://docs.pearn.site | app `docs` (`apps/docs/Dockerfile`) | 3179 |
| https://indexer.pearn.site | app `indexer` (`apps/indexer/Dockerfile`, Ponder, 1 GiB cap) | 3178 |

Browser → host nginx on the VPS (TLS) → Caddy in each container on its loopback port. Images are built on GitHub's runners and pushed to GHCR as `ghcr.io/pearn-protocol/pearn-<app>:<sha>` and `:main` (public packages). Each Coolify app uses build pack `dockerimage` with tag `main`, so the VPS only pulls; it never builds.

**CD:** every push to `main` runs CI (`.github/workflows/deploy.yml` calls `ci.yml`), builds and pushes the images of `landing`, `web`, `indexer` and/or `docs` whose inputs changed since the last successful deploy, then asks Coolify to pull and restart them. A manual run (`gh workflow run deploy.yml`) rebuilds all four. The GitHub environment `production` holds `COOLIFY_TOKEN` (a deploy-only token: it cannot read or change resources), `COOLIFY_URL`, `COOLIFY_WEB_UUID`, `COOLIFY_INDEXER_UUID`, `COOLIFY_DOCS_UUID` and `COOLIFY_LANDING_UUID`.

**Contract addresses** are build args: `NEXT_PUBLIC_MARKETS` and `NEXT_PUBLIC_ORACLE` are read from `contracts/deployments/1313161555.json` by the images job. A new deployment means committing that file; the push rebuilds `web` and `indexer`.

**Host nginx:** the four `nginx*.conf` files, one per name. Each also answers its old `*.pearn.103.150.190.91.sslip.io` name with a 301 to the new one. To install or change them, copy `deploy/` to the VPS and run `sudo bash install-nginx.sh`: it gets missing Let's Encrypt certs (user-level certbot webroot; the existing cron renews them), installs the configs, and rolls back if `nginx -t` fails. DNS for `pearn.site` is on Cloudflare: A records to the VPS, not proxied.

**Rollback:** set the Coolify app's image tag to an earlier commit sha (every build stays in GHCR), redeploy, then set it back to `main`.

**Privacy:** Caddy has no `log` directive, host nginx has `access_log off` and drops client-IP headers. The CSP allows only each site's own files and its inline scripts by hash; `connect-src` adds the Aurora RPC and the indexer for the app, and the indexer alone for the landing.
