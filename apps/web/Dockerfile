FROM node:24-bookworm-slim AS build
# The registry can be very slow from home: wait longer and retry instead of failing
RUN npm install --global pnpm@11.25.0 \
    --fetch-retries=8 \
    --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=180000 \
    --fetch-timeout=300000
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
# The packages are kept in a BuildKit cache between builds, so a failed install resumes from what it already
# downloaded. The same store as the other projects on the server, which share most packages.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter web --store-dir /pnpm/store
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["node", "apps/web/server.js"]
