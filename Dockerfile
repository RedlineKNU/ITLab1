FROM node:20-alpine AS build
WORKDIR /app

# better-sqlite3 needs a toolchain for its native addon.
RUN apk add --no-cache python3 make g++ libc6-compat

# Skip the ~250 MB Electron binary — the server image doesn't need it.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 \
    ELECTRON_SKIP_BINARY_DOWNLOAD_SKIP_AUTOCHECK=1 \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
COPY packages/desktop/package.json packages/desktop/

RUN npm install --no-audit --no-fund

COPY packages/shared ./packages/shared
COPY packages/server ./packages/server
COPY packages/web ./packages/web

RUN npm run build --workspace=@mini-drive/web

FROM node:20-alpine AS runtime
WORKDIR /app

RUN apk add --no-cache libc6-compat tini wget

ENV NODE_ENV=production \
    DATA_DIR=/data \
    WEB_DIST_DIR=/app/packages/web/dist \
    PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/packages/server ./packages/server
COPY --from=build /app/packages/web/dist ./packages/web/dist

RUN mkdir -p /data

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "packages/server/src/index.js"]
