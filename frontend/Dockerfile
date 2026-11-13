# syntax=docker/dockerfile:1
#
# React Frontend — Vite production build served by nginx.
#
# The browser uses the same-origin /api/v1 path and nginx proxies it to the
# Gateway. VITE_API_BASE_URL is baked into the bundle at build time and can be
# overridden with --build-arg for a separately hosted API.
#
# Route handling: the app uses createBrowserRouter, so nginx must serve
# index.html for unknown paths (SPA fallback) or a refresh on /customers would
# 404.

# ---------------------------------------------------------------------------
# Stage 1: build the static bundle
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

# Browser-side API base URL. This is a host URL, NOT a service name.
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: static runtime (nginx, non-root)
# ---------------------------------------------------------------------------
FROM nginx:1.30-alpine AS runtime

# Full server config replaces the default: it listens on 5173 (an unprivileged
# port) and keeps all writable state under /tmp, so the master process can run
# as `nginx` instead of root.
COPY nginx.conf /etc/nginx/nginx.conf

# Only the compiled assets — no sources, no node_modules, no .env.
COPY --from=build /app/dist /usr/share/nginx/html

# The stock image's entrypoint scripts run as root to set up /etc/nginx and then
# start nginx; skip them entirely and exec nginx ourselves so the container
# never needs root at run time.
RUN chown -R nginx:nginx /usr/share/nginx/html /etc/nginx

USER nginx

EXPOSE 5173

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=6 \
    CMD wget -q -O /dev/null http://127.0.0.1:5173/healthz || exit 1

ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
