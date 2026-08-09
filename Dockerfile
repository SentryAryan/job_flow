# syntax=docker/dockerfile:1

# Job Flow — production image for Render (long-running Node, not serverless).
# NEXT_PUBLIC_* must be available at *build* time (Render: set as build env vars).

ARG NODE_VERSION=22

# ---- dependencies ----
FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
RUN npm ci

# ---- build ----
FROM node:${NODE_VERSION}-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public client env (inlined into the browser bundle at build)
ARG NEXT_PUBLIC_INSFORGE_URL
ARG NEXT_PUBLIC_INSFORGE_ANON_KEY
ARG NEXT_PUBLIC_INSFORGE_TIMEOUT_MS=90000
ARG NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ARG NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP=no_clamp
ARG NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS=750000
ARG NEXT_PUBLIC_PROFILE_FETCH_TIMEOUT_MS

ENV NEXT_PUBLIC_INSFORGE_URL=$NEXT_PUBLIC_INSFORGE_URL \
    NEXT_PUBLIC_INSFORGE_ANON_KEY=$NEXT_PUBLIC_INSFORGE_ANON_KEY \
    NEXT_PUBLIC_INSFORGE_TIMEOUT_MS=$NEXT_PUBLIC_INSFORGE_TIMEOUT_MS \
    NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=$NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN \
    NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST \
    NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP=$NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP \
    NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS=$NEXT_PUBLIC_RESEARCH_CLIENT_TIMEOUT_MS \
    NEXT_PUBLIC_PROFILE_FETCH_TIMEOUT_MS=$NEXT_PUBLIC_PROFILE_FETCH_TIMEOUT_MS \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production

RUN npm run build

# ---- runner ----
FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

# ca-certificates for HTTPS; Cairo stack for @napi-rs/canvas (resume extract PDF).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libcairo2 \
    libpango-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    APP_ENV=production \
    RESEARCH_TIMEOUT_CLAMP=no_clamp \
    NEXT_PUBLIC_RESEARCH_TIMEOUT_CLAMP=no_clamp

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Render sets PORT; Next standalone respects it.
CMD ["node", "server.js"]
