# ---------------dependencies----------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json .
RUN npm ci

#--------------Builder-------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY  --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm build
RUN npm prune --omit=dev

#--------------Testing-----------------------------
FROM node:22-alpine AS tester
ENV NODE_ENV=test
CMD ["npm","test"]

#---------------Runner-----------------------------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=builder --chown=appuser:appgroup /app/dist /app/dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./nodemodules
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./

USER appuser
EXPOSE 5000
CMD ["node","dist/server.js"] 

