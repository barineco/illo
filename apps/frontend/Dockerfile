# ===================================
# Stage 1: Base
# ===================================
FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# ===================================
# Stage 2: Builder
# ===================================
FROM base AS builder

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy all package.json files
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies directly in builder stage
# This keeps pnpm symlinks intact
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/frontend ./apps/frontend
COPY packages/shared ./packages/shared

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build frontend
WORKDIR /app/apps/frontend

# Set build-time environment variables
ARG NUXT_PUBLIC_API_BASE=http://localhost:11104
ENV NUXT_PUBLIC_API_BASE=$NUXT_PUBLIC_API_BASE

RUN npm run build

# ===================================
# Stage 3: Production
# ===================================
FROM node:20-alpine AS production

# Install pnpm
RUN npm install -g pnpm@9

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/shared/package.json ./packages/shared/

# Copy built artifacts only (no need to install dependencies)
# Nuxt .output directory contains everything needed to run
COPY --from=builder /app/apps/frontend/.output ./apps/frontend/.output

# Copy debug script
COPY apps/frontend/start-with-debug.mjs ./apps/frontend/start-with-debug.mjs

WORKDIR /app/apps/frontend

# Expose port
EXPOSE 11103

# Set production environment
ENV NODE_ENV=production
ENV PORT=11103
ENV HOST=0.0.0.0

# Increase Node.js memory limit to prevent OOM errors
# Set to 4GB to handle Nuxt SSR memory requirements
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Health check (disabled temporarily due to memory issues)
# HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
#   CMD node -e "require('http').get('http://localhost:11103/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start Nuxt in production mode
CMD ["node", ".output/server/index.mjs"]
