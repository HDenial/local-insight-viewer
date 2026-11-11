FROM node:22-alpine AS builder
WORKDIR /src

COPY package.json package-lock.json ./
RUN npm ci
COPY . .

# Emit a Node HTTP server instead of the default Cloudflare Worker.
ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /src
COPY --from=builder /src/.output ./.output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=5173
EXPOSE 5173
CMD ["node", ".output/server/index.mjs"]
