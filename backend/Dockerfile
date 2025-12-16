# ============================================================================
# SpannerWork Backend - Production Dockerfile
# Multi-stage build for optimized production image
# ============================================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Install build dependencies for native modules (bcrypt, etc.)
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# ============================================================================
# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ============================================================================
# Stage 3: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    # For healthcheck
    curl \
    # For ClamAV virus scanning (optional)
    clamav clamav-daemon \
    # Timezone data
    tzdata \
    # Security: run as non-root user
    && addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 spannerwork

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy built application
COPY --from=builder --chown=spannerwork:nodejs /app/dist ./dist
COPY --from=builder --chown=spannerwork:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=spannerwork:nodejs /app/package*.json ./
COPY --from=builder --chown=spannerwork:nodejs /app/prisma ./prisma

# Create directories for uploads and logs
RUN mkdir -p uploads logs \
    && chown -R spannerwork:nodejs uploads logs

# Configure ClamAV (optional - for virus scanning)
RUN mkdir -p /var/run/clamav \
    && chown clamav:clamav /var/run/clamav \
    && freshclam --quiet || true

# Security: Set file permissions
RUN chmod -R 755 /app

# Switch to non-root user
USER spannerwork

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
