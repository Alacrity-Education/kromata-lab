# Builds with both the legacy builder and BuildKit: no syntax directive and no cache mounts, so
# `docker build .` works as-is without DOCKER_BUILDKIT or the buildx plugin. Layer caching still
# works the usual way, because the manifests are copied before the install.

# Debian rather than Alpine: sharp ships prebuilt glibc binaries, so this needs no build toolchain
# and no apt packages at all.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app


FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile


FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build


FROM base AS runtime
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Everything the Lab persists lives here, mounted as a volume.
ENV KROMATA_DATA_DIR=/data

# The standalone server is self-contained except for two things Next does not put inside it.
COPY --from=build /app/.next/standalone ./
# Static assets are emitted outside the standalone tree and must be placed next to it, or every
# stylesheet and client chunk 404s while the server itself still appears to work.
COPY --from=build /app/.next/static ./.next/static

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/stats').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
