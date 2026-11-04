# Pearn landing: Astro static build served by Caddy. Build context: repo root.
#   docker build -f apps/landing/Dockerfile .
FROM node:24.19.0-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
# The landing links to the app and docs and reads its market cards from the indexer.
ARG PUBLIC_APP_URL=https://app.pearn.site
ARG PUBLIC_DOCS_URL=https://docs.pearn.site
ARG PUBLIC_INDEXER_URL=https://indexer.pearn.site
ENV HUSKY=0 ASTRO_TELEMETRY_DISABLED=1 PUBLIC_APP_URL=$PUBLIC_APP_URL \
	PUBLIC_DOCS_URL=$PUBLIC_DOCS_URL PUBLIC_INDEXER_URL=$PUBLIC_INDEXER_URL
# The VPS is shared and tight on memory: cap Node's heap so a build can't starve the host.
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN corepack enable
WORKDIR /repo
COPY . .
# The CSP connects only to the indexer, the price feed and Polymarket (mirrored markets).
RUN pnpm install --frozen-lockfile --filter @pearn/landing... \
	&& pnpm --filter @pearn/landing build \
	&& node deploy/static/prepare.mjs apps/landing/dist /csp.caddy \
		"$(node -p 'new URL(process.argv[1]).origin' "$PUBLIC_INDEXER_URL"),https://api.coingecko.com,https://gamma-api.polymarket.com"

FROM caddy:2.11.7-alpine@sha256:24ec7b05bc532c7bb57f727030c5056e257ff7138b4b50460306819ff79362bd
COPY deploy/static/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /csp.caddy /etc/caddy/csp.caddy
COPY --from=build /repo/apps/landing/dist /srv
# Caddy keeps nothing on disk here; point its state dirs somewhere nobody can write.
ENV XDG_CONFIG_HOME=/tmp XDG_DATA_HOME=/tmp
USER nobody
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
