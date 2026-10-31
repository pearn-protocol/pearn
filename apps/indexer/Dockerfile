# The Pearn indexer: Ponder over PearnMarkets events, GraphQL at /graphql, SQL at /sql.
# Build context: repo root.  docker build -f apps/indexer/Dockerfile .
FROM node:24.19.0-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
ENV HUSKY=0 NODE_ENV=production
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @pearn/indexer... \
	&& mkdir -p apps/indexer/.ponder && chown -R node:node apps/indexer/.ponder
USER node
WORKDIR /repo/apps/indexer
EXPOSE 8080
# ponder: PGlite inside the container, rebuilt from the chain on every deploy (about a minute
# for testnet). Point DATABASE_URL at Postgres if the history ever grows large.
HEALTHCHECK --interval=30s --timeout=3s --start-period=120s CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["pnpm", "exec", "ponder", "start", "--schema", "pearn", "--port", "8080", "--log-level", "warn"]
