# ==================================================
# Stage 1: Install dependencies
# ==================================================
FROM node:22-slim AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY scripts ./scripts

# Make npm more tolerant of slow or unstable internet
RUN npm config set registry https://registry.npmjs.org/ \
    && npm config set fetch-retries 10 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 180000 \
    && npm config set fetch-timeout 600000 \
    && npm config set audit false \
    && npm config set fund false \
    && npm ci --no-audit --no-fund


# ==================================================
# Stage 2: Build the TanStack Start application
# ==================================================
FROM dependencies AS build

WORKDIR /app

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build:render


# ==================================================
# Stage 3: Production runtime
# ==================================================
FROM node:22-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy dependencies from the first stage.
# This temporarily includes development dependencies,
# but avoids a second npm download.
COPY --from=dependencies --chown=node:node \
    /app/node_modules ./node_modules

COPY --from=build --chown=node:node \
    /app/package.json ./package.json

COPY --from=build --chown=node:node \
    /app/server.node.mjs ./server.node.mjs

COPY --from=build --chown=node:node \
    /app/dist ./dist

USER node

EXPOSE 3000

HEALTHCHECK \
    --interval=30s \
    --timeout=5s \
    --start-period=20s \
    --retries=3 \
    CMD node -e "const http=require('http');const port=Number(process.env.PORT)||3000;const request=http.get({hostname:'127.0.0.1',port,path:'/'},response=>process.exit(response.statusCode<500?0:1));request.on('error',()=>process.exit(1));request.setTimeout(4000,()=>{request.destroy();process.exit(1)});"

CMD ["node", "server.node.mjs"]