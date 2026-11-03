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

Browser → host nginx on the VPS (TLS) → Caddy in each container on its loopback port. Coolify builds the image on the VPS from `github.com/pearn-protocol/pearn`, branch `main`; nothing goes to a registry.

**CD:** every push to `main` runs CI (`.github/workflows/deploy.yml` calls `ci.yml`), then asks Coolify to rebuild `landing`, `web`, `indexer` and/or `docs` when the push touched that image's inputs. The GitHub environment `production` holds `COOLIFY_TOKEN` (a deploy-only token: it cannot read or change resources), `COOLIFY_URL`, `COOLIFY_WEB_UUID`, `COOLIFY_INDEXER_UUID`, `COOLIFY_DOCS_UUID` and `COOLIFY_LANDING_UUID`.

**Contract addresses** are build args: `NEXT_PUBLIC_MARKETS` and `NEXT_PUBLIC_ORACLE` are build variables on the Coolify resource, set from `contracts/deployments/1313161555.json`. A new deployment means updating both and redeploying.

**Host nginx:** the four `nginx*.conf` files, one per name. Each also answers its old `*.pearn.103.150.190.91.sslip.io` name with a 301 to the new one. To install or change them, copy `deploy/` to the VPS and run `sudo bash install-nginx.sh`: it gets missing Let's Encrypt certs (user-level certbot webroot; the existing cron renews them), installs the configs, and rolls back if `nginx -t` fails. DNS for `pearn.site` is on Cloudflare: A records to the VPS, not proxied.

**Rollback:** Coolify → `pearn` → `web` → Deployments → pick an earlier build → Redeploy.

**Privacy:** Caddy has no `log` directive, host nginx has `access_log off` and drops client-IP headers. The CSP allows only the app's own files, its inline scripts by hash, and `connect-src` to the Aurora RPC.
