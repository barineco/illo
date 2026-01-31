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
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies directly in builder stage
# This keeps pnpm symlinks intact
RUN pnpm install --frozen-lockfile

# Copy Prisma schema first (needed for generation)
COPY apps/backend/prisma ./apps/backend/prisma

# Copy source code
COPY apps/backend ./apps/backend
COPY packages/shared ./packages/shared

# Generate Prisma Client before building
WORKDIR /app/apps/backend
RUN npx prisma generate

# Build shared package first
WORKDIR /app/packages/shared
RUN npm run build

# Build backend
WORKDIR /app/apps/backend
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
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies (including devDependencies for prisma CLI)
RUN pnpm install --frozen-lockfile

# Copy Prisma schema and migrations
COPY apps/backend/prisma ./apps/backend/prisma

# Copy entrypoint script
COPY apps/backend/docker-entrypoint.sh /app/apps/backend/
RUN chmod +x /app/apps/backend/docker-entrypoint.sh

# Generate Prisma Client
WORKDIR /app/apps/backend
RUN pnpm prisma generate
WORKDIR /app

# Copy built artifacts
WORKDIR /app
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Copy static assets (placeholder images, etc.)
COPY apps/backend/src/assets ./apps/backend/src/assets

# Expose port
EXPOSE 11104

# Set production environment
ENV NODE_ENV=production
ENV PORT=11104

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:11104/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint script to run migrations before starting
ENTRYPOINT ["/app/apps/backend/docker-entrypoint.sh"]
