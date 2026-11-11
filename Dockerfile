# Stage 1: Build the app
FROM node:22-alpine AS builder

WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Override Lovable's default "cloudflare-module" preset so Nitro emits a real
# Node HTTP server, not a Worker handler that never listens on a port
ENV NITRO_PRESET=node-server

RUN npm run build

# Stage 2: Run the production server
FROM node:22-alpine AS runner

WORKDIR /src

# The node-server output bundles its dependencies, so no npm install is needed here
COPY --from=builder /src/.output ./.output

EXPOSE 5173

# Nitro's Node server reads these to decide where to listen
ENV PORT=5173
ENV HOST=0.0.0.0
ENV NODE_ENV=production

CMD ["node", ".output/server/index.mjs"]
