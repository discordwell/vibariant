FROM node:22-slim AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json* ./
# Install deps, ignoring the file: SDK reference (it'll be copied manually)
RUN npm install --ignore-scripts 2>/dev/null || true

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
# Copy the local SDK package into node_modules (must be in builder, not deps)
COPY packages/sdk ./node_modules/@vibariant/sdk
COPY dashboard/ .

ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_ vars must be set at build time for Next.js
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN mkdir -p public && npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
