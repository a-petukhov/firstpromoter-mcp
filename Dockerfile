# =============================================================================
# FirstPromoter MCP Server - Dockerfile
# =============================================================================
# This file tells Docker how to build a container image for our server.
# Think of it as a recipe for creating a portable "box" that contains
# everything our server needs to run.

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
# We use a "multi-stage build" which is like cooking in two kitchens:
# Kitchen 1 (build): Has all the tools to prepare the ingredients
# Kitchen 2 (production): Only has what's needed to serve the food

# Start with Node.js 20 on Alpine Linux (small and fast)
FROM node:20-alpine AS builder

# Set working directory inside the container
# Like saying "we'll do all our work in this folder"
WORKDIR /app

# Copy package files first (for better caching)
# Docker caches each step - if package.json hasn't changed,
# it won't reinstall dependencies (saves time!)
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build the TypeScript code into JavaScript
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production Stage
# -----------------------------------------------------------------------------
# Fresh, clean image with only what we need to run

FROM node:20-alpine AS production

# Add labels for documentation
LABEL org.opencontainers.image.title="FirstPromoter MCP Server"
LABEL org.opencontainers.image.description="MCP server for FirstPromoter affiliate management"
LABEL org.opencontainers.image.source="https://github.com/a-petukhov/firstpromoter-mcp"

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ONLY production dependencies (no dev tools needed)
RUN npm ci --only=production && npm cache clean --force

# Copy built JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

# For Phase 2: HTTP transport will use this port
# (Not used in Phase 1 stdio mode)
EXPOSE 3000

# Default command: run in stdio mode (for MCP clients like Claude Desktop)
# The "-i" flag in "docker run -i" connects stdin/stdout
CMD ["node", "dist/index.js", "--stdio"]
