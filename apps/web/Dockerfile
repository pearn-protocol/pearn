# The Pearn app: Next.js static export served by Caddy. Build context: repo root.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_MARKETS=0x… --build-arg NEXT_PUBLIC_ORACLE=0x… .
FROM node:24.19.0-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
ARG NEXT_PUBLIC_CHAIN_ID=1313161555
# From contracts/deployments/<chainId>.json; empty means "contracts not deployed yet".
ARG NEXT_PUBLIC_MARKETS=
ARG NEXT_PUBLIC_ORACLE=
# The only origin the CSP lets the app connect to besides itself.
ARG NEXT_PUBLIC_RPC_URL=https://testnet.aurora.dev
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID \
	NEXT_PUBLIC_MARKETS=$NEXT_PUBLIC_MARKETS NEXT_PUBLIC_ORACLE=$NEXT_PUBLIC_ORACLE \
	NEXT_PUBLIC_RPC_URL=$NEXT_PUBLIC_RPC_URL
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @pearn/web... \
	&& pnpm --filter @pearn/web build \
	&& node deploy/static/prepare.mjs apps/web/out /csp.caddy "$(node -p 'new URL(process.argv[1]).origin' "$NEXT_PUBLIC_RPC_URL")"

FROM caddy:2.11.7-alpine@sha256:24ec7b05bc532c7bb57f727030c5056e257ff7138b4b50460306819ff79362bd
COPY deploy/static/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /csp.caddy /etc/caddy/csp.caddy
COPY --from=build /repo/apps/web/out /srv
# Caddy keeps nothing on disk here; point its state dirs somewhere nobody can write.
ENV XDG_CONFIG_HOME=/tmp XDG_DATA_HOME=/tmp
USER nobody
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
