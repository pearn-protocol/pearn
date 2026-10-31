# Deploy

| File | What |
|---|---|
| `static/Caddyfile` | Static server in the web image: security headers, no logs |
| `static/prepare.mjs` | Image build step: hashed self-only CSP, precompressed assets |
| `nginx.conf`, `nginx-indexer.conf`, `nginx-docs.conf` | Host nginx on the VPS: TLS and the proxy to each container |

## Hosted app

| URL | Coolify resource (project `pearn`) | Loopback port |
|---|---|---|
| https://pearn.103.150.190.91.sslip.io | app `web` (`apps/web/Dockerfile`) | 3177 |
| https://docs.pearn.103.150.190.91.sslip.io | app `docs` (`apps/docs/Dockerfile`) | 3179 |
| https://indexer.pearn.103.150.190.91.sslip.io | app `indexer` (`apps/indexer/Dockerfile`, Ponder, 1 GiB cap) | 3178 |

Browser → host nginx on the VPS (TLS) → Caddy in the container on `127.0.0.1:3177`. Coolify builds the image on the VPS from `github.com/pearn-protocol/pearn`, branch `main`; nothing goes to a registry.

**CD:** every push to `main` runs CI (`.github/workflows/deploy.yml` calls `ci.yml`), then asks Coolify to rebuild `web`, `indexer` and/or `docs` when the push touched that image's inputs. The GitHub environment `production` holds `COOLIFY_TOKEN` (a deploy-only token: it cannot read or change resources), `COOLIFY_URL`, `COOLIFY_WEB_UUID`, `COOLIFY_INDEXER_UUID` and `COOLIFY_DOCS_UUID`.

**Contract addresses** are build args: `NEXT_PUBLIC_MARKETS` and `NEXT_PUBLIC_ORACLE` are build variables on the Coolify resource, set from `contracts/deployments/1313161555.json`. A new deployment means updating both and redeploying.

**Host nginx:** edit `nginx.conf`, then on the VPS `sudo tee /etc/nginx/sites-available/pearn.103.150.190.91.sslip.io < nginx.conf && sudo nginx -t && sudo systemctl reload nginx`. TLS: `certbot certonly --webroot -w ~/acme --config-dir ~/le/config … --cert-name pearn.103.150.190.91.sslip.io` (user-level certbot; the existing cron renews it).

**Rollback:** Coolify → `pearn` → `web` → Deployments → pick an earlier build → Redeploy.

**Privacy:** Caddy has no `log` directive, host nginx has `access_log off` and drops client-IP headers. The CSP allows only the app's own files, its inline scripts by hash, and `connect-src` to the Aurora RPC.
