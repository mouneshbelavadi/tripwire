# ==============================================================================
# Tripwire Teams - Production Multi-Stage Dockerfile
# Optimized for Node.js 20 on Alpine Linux (Minimal attack surface, ~150MB)
# ==============================================================================

# --- Stage 1: Build & Dependencies ---
FROM node:20-alpine AS builder

# Install required build tools and libraries for native modules and Prisma engines
RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

# Copy package manifests first for optimal Docker layer caching
COPY package*.json ./
COPY tsconfig*.json ./

# Copy Prisma schema for client code generation
COPY prisma ./prisma/

# Clean dependency installation (including devDependencies needed for build)
RUN npm ci

# Generate Prisma Client specifically targeted for Linux Musl / Alpine
RUN npx prisma generate

# Copy application source code
COPY src ./src

# Compile TypeScript to production JavaScript in dist/
RUN npm run build

# Remove development dependencies to keep final runtime image slim
RUN npm prune --production

# --- Stage 2: Production Runtime ---
FROM node:20-alpine AS runner

# Install openssl for Prisma runtime and dumb-init for proper PID 1 signal forwarding
RUN apk add --no-cache openssl dumb-init

# Security: Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Create unprivileged system group and user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

# Copy pruned production node_modules and generated Prisma client from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

# Copy compiled JavaScript distribution
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy static landing page public directory into both src and dist paths for runtime asset serving
COPY --from=builder --chown=nodejs:nodejs /app/src/landing/public ./src/landing/public
COPY --from=builder --chown=nodejs:nodejs /app/src/landing/public ./dist/landing/public

# Switch to unprivileged non-root user
USER nodejs

# Expose HTTP port
EXPOSE 3000

# Container healthcheck targeting the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

# dumb-init forwards SIGTERM/SIGINT cleanly to Node process
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Default start command launches the Slack app / server
CMD ["node", "dist/slackApp.js"]
