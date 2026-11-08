# syntax=docker/dockerfile:1
#
# Identity Service — registration/login, password hashing, JWT issuance.
#
# Multi-stage:
#   deps    → full dependency tree (needs a toolchain for bcrypt 5.x fallback)
#   build   → TypeScript compile + production-only node_modules
#   runtime → compiled JS, production dependencies, non-root user
#
# Why a toolchain: bcrypt 5.1.1 does not ship prebuilt binaries. Its
# node-pre-gyp install script tries to download one from GitHub and otherwise
# compiles from source, which needs python3/make/g++. Build tools live only in
# the deps/build stages, never in the runtime image.

# ---------------------------------------------------------------------------
# Stage 1: dependencies
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps

WORKDIR /app

ENV NODE_ENV=development

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 2: build
# ---------------------------------------------------------------------------
FROM deps AS build

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev --no-audit --no-fund

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends dumb-init \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5001

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json package-lock.json ./

USER node

EXPOSE 5001

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=6 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
