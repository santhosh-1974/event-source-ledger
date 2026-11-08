# syntax=docker/dockerfile:1
#
# Banking Backend — the event-sourced monolith (HTTP API + ledger).
#
# Multi-stage build:
#   deps    → installs the full lockfile-verified dependency tree
#   build   → compiles TypeScript (src/ → dist/)
#   runtime → production-only dependencies, compiled JS, migrations and the
#             entrypoint that applies migrations before the server starts
#
# The build stage finishes with `npm prune --omit=dev`, so the runtime image
# carries production dependencies only. `node-pg-migrate` is a *runtime*
# dependency (see package.json) because the container applies migrations on
# boot, so the production tree is self-sufficient — no build tooling required.

# ---------------------------------------------------------------------------
# Stage 1: dependencies
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps

WORKDIR /app

# Copy only the manifests first so the dependency layer is cached until the
# lockfile actually changes.
COPY package.json package-lock.json ./

# `npm ci` installs exactly what the lockfile pins (reproducible builds).
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2: build
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

ENV NODE_ENV=development

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# dumb-init gives us a real PID 1: correct signal forwarding to Node and no
# zombie processes when the server is stopped.
RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000

# Application code + production dependencies, owned by the unprivileged user.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json package-lock.json ./

# Migrations are TypeScript. node-pg-migrate loads them with Node's built-in
# type stripping (stable and enabled by default from Node 22.18), so no
# ts-node/tsx loader is needed — but the runtime MUST be Node >= 22.18.
# The entrypoint refuses to start on an older runtime instead of half-applying
# migrations.
COPY --chown=node:node migrations ./migrations
COPY --chown=node:node docker/backend-entrypoint.sh /usr/local/bin/backend-entrypoint.sh

RUN chmod +x /usr/local/bin/backend-entrypoint.sh \
    && mkdir -p /app/logs \
    && chown -R node:node /app

USER node

EXPOSE 5000

# No curl/wget in the slim image — use Node's built-in fetch.
HEALTHCHECK --interval=10s --timeout=5s --start-period=40s --retries=10 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--", "/usr/local/bin/backend-entrypoint.sh"]
CMD ["node", "dist/server.js"]
