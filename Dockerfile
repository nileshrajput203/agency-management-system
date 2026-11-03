# --- Production Dockerfile for AgencyOS ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package manifests and workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY artifacts ./artifacts
COPY lib ./lib

# Install all dependencies and build monorepo packages
RUN pnpm install --frozen-lockfile
RUN pnpm run build

# --- Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV SERVE_STATIC=true
ENV PORT=3000

# Copy runtime assets and production dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts/agency-os/public/templates ./dist/public/templates

EXPOSE 3000

CMD ["node", "dist/index.mjs"]
