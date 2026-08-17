# syntax=docker/dockerfile:1.7
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
COPY shared/package.json shared/package.json

RUN npm install --include=dev

COPY shared ./shared
COPY web ./web
COPY server ./server
COPY preview ./preview
COPY brain ./brain

RUN npm run build && npm test
RUN npm prune --omit=dev

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8787

RUN apk add --no-cache unzip ca-certificates && addgroup -S trader && adduser -S trader -G trader

COPY --from=build --chown=trader:trader /app/package.json ./package.json
COPY --from=build --chown=trader:trader /app/node_modules ./node_modules
COPY --from=build --chown=trader:trader /app/server/package.json ./server/package.json
COPY --from=build --chown=trader:trader /app/server/dist ./server/dist
COPY --from=build --chown=trader:trader /app/shared/package.json ./shared/package.json
COPY --from=build --chown=trader:trader /app/shared/dist ./shared/dist
COPY --from=build --chown=trader:trader /app/web/dist ./web/dist
COPY --from=build --chown=trader:trader /app/preview ./preview
COPY --from=build --chown=trader:trader /app/brain ./brain
RUN mkdir -p /app/data && chown trader:trader /app/data

USER trader
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD wget -qO- http://127.0.0.1:8787/health >/dev/null || exit 1
CMD ["node", "server/dist/index.js"]
