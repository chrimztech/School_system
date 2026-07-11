# --- Dependencies (full, needed for the build) ---
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY scripts ./scripts
RUN npm ci

# --- Build ---
FROM deps AS build
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build:render
RUN npm prune --omit=dev

# --- Runtime ---
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.node.mjs ./server.node.mjs
COPY --from=build /app/dist ./dist
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=5s --retries=10 \
  CMD node -e "require('http').get('http://localhost:'+(process.env.PORT||3000), r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.node.mjs"]
