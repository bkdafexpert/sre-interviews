# ---- deps ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

# ---- builder ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next.config.js rewrites() and NEXT_PUBLIC_* are resolved at build time, so these must be present now.
# Leave NEXT_PUBLIC_SHORT_DOMAIN empty to derive the short host from window.location at runtime
# (localhost:3000 in dev, the real FQDN in prod). Set it to brand short links, e.g. sgcut.co.
ARG BACKEND_URL=http://backend:4000
ARG NEXT_PUBLIC_SHORT_DOMAIN=
# Auth: 'demo' (default, offline) or 'cognito'. NEXT_PUBLIC_COGNITO_* only needed for cognito.
ARG NEXT_PUBLIC_AUTH_PROVIDER=demo
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_COGNITO_USER_POOL_ID=
ARG NEXT_PUBLIC_COGNITO_CLIENT_ID=
ARG NEXT_PUBLIC_COGNITO_DOMAIN=
ENV BACKEND_URL=$BACKEND_URL
ENV NEXT_PUBLIC_SHORT_DOMAIN=$NEXT_PUBLIC_SHORT_DOMAIN
ENV NEXT_PUBLIC_AUTH_PROVIDER=$NEXT_PUBLIC_AUTH_PROVIDER
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_COGNITO_USER_POOL_ID=$NEXT_PUBLIC_COGNITO_USER_POOL_ID
ENV NEXT_PUBLIC_COGNITO_CLIENT_ID=$NEXT_PUBLIC_COGNITO_CLIENT_ID
ENV NEXT_PUBLIC_COGNITO_DOMAIN=$NEXT_PUBLIC_COGNITO_DOMAIN
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runner ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
