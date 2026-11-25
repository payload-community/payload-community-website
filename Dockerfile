# Payload Community image: Next.js standalone server plus cli.mjs (ADR-023).
# Starting point: templates/website/Dockerfile in payloadcms/payload v3.90.2,
# adjusted for Node 24, pnpm only, and user `node` (uid 1000).
# Build: docker build --build-arg APP_VERSION=<version> -t payload-community .
# Published releases push ghcr.io/payload-community/payload-community-website:<version>
# (docs/releases.md).

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat \
  && corepack enable \
  && corepack prepare pnpm@11.18.0 --activate

FROM base AS deps
WORKDIR /app
# pnpm-workspace.yaml holds allowBuilds. Without it, pnpm 11 refuses the install.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build && pnpm bundle:cli && cp cli.mjs .next/standalone/cli.mjs

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Docker sets HOSTNAME to the container name at runtime, which /etc/hosts maps to the
# container address. Next's server.js listens on HOSTNAME, or on 0.0.0.0 when it is unset.
ENV HOSTNAME=0.0.0.0

ARG APP_VERSION=
ENV APP_VERSION=$APP_VERSION

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
# Fails the build when the standalone trace is missing a module cli.mjs imports.
RUN node cli.mjs self-test

EXPOSE 3000
CMD ["node", "server.js"]
