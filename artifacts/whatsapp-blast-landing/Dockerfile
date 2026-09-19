# Ora Repot landing — Next.js (artifacts/whatsapp-blast-landing)
FROM node:22-alpine AS deps
WORKDIR /app
# Do NOT copy package-lock.json — a corrupt/incomplete lock crashes npm arborist
# with: Cannot read properties of undefined (reading 'extraneous')
COPY package.json ./
ENV NODE_ENV= \
    NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=300000 \
    NPM_CONFIG_REGISTRY=https://registry.npmjs.org/
RUN for i in 1 2 3 4 5; do \
      npm install --no-audit --no-fund && break; \
      echo "npm install failed (attempt $i), retrying..."; \
      sleep $((i * 5)); \
    done; \
    test -d node_modules/next

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY . .
# Ensure install is not re-run against a bad lock from the build context.
RUN rm -f package-lock.json
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# NEXT_PUBLIC_* must be present at `next build` (inlined into client bundle).
# Runtime --env-file alone is not enough for browser Snap.
ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
ARG NEXT_PUBLIC_MIDTRANS_MERCHANT_ID
ARG NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=true
ARG NEXT_PUBLIC_APP_URL=https://orarepot.com
ARG NEXT_PUBLIC_API_BASE_URL=https://api.orarepot.com
ENV NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=$NEXT_PUBLIC_MIDTRANS_CLIENT_KEY \
    NEXT_PUBLIC_MIDTRANS_MERCHANT_ID=$NEXT_PUBLIC_MIDTRANS_MERCHANT_ID \
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=$NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=5173
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 5173

CMD ["node", "server.js"]
