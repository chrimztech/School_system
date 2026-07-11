# syntax=docker/dockerfile:1

# ==================================================
# Stage 1: Install all dependencies required to build
# ==================================================
FROM node:22-slim AS dependencies

WORKDIR /app

# Copy dependency manifests first for better Docker caching
COPY package.json package-lock.json ./

# Required because npm postinstall executes scripts from this directory
COPY scripts ./scripts

RUN npm ci


# ==================================================
# Stage 2: Build the TanStack Start application
# ==================================================
FROM dependencies AS build

WORKDIR /app

COPY . .

# Vite exposes this value to the frontend during compilation
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Uses vite.config.render.ts and creates:
# - dist/client
# - dist/server/server.js
RUN npm run build:render


# ==================================================
# Stage 3: Install production dependencies only
# ==================================================
FROM node:22-slim AS production-dependencies

WORKDIR /app

COPY package.json package-lock.json ./

# Required by your package.json postinstall command
COPY scripts ./scripts

RUN npm ci --omit=dev \
    && npm cache clean --force


# ==================================================
# Stage 4: Production runtime
# ==================================================
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy production dependencies
COPY --from=production-dependencies --chown=node:node \
    /app/node_modules ./node_modules

# Copy package metadata
COPY --from=build --chown=node:node \
    /app/package.json ./package.json

# Copy the Render/Node entry point
COPY --from=build --chown=node:node \
    /app/server.node.mjs ./server.node.mjs

# Contains dist/client and dist/server/server.js
COPY --from=build --chown=node:node \
    /app/dist ./dist

# Run as the non-root Node user
USER node

EXPOSE 3000

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=20s \
    --retries=3 \
    CMD node -e "const http=require('http');const port=Number(process.env.PORT)||3000;const request=http.get({hostname:'127.0.0.1',port,path:'/'},response=>process.exit(response.statusCode<500?0:1));request.on('error',()=>process.exit(1));request.setTimeout(4000,()=>{request.destroy();process.exit(1)});"

CMD ["node", "server.node.mjs"]