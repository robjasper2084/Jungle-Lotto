# Build context: lottominded-ultra.io/games/gothtechnology2. No image build or deployment is automatic.
FROM node:24-bookworm-slim AS build
WORKDIR /app/ride-core
COPY ride-core/package*.json ./
RUN npm ci
COPY ride-core/src ./src
COPY ride-core/tsconfig.json ride-core/LICENSE.txt ./
RUN npm run build && npm prune --omit=dev
WORKDIR /app/love-tag-server
COPY love-tag-server/package*.json ./
RUN npm ci
COPY love-tag-server/src ./src
COPY love-tag-server/tsconfig*.json ./
RUN npx tsc -p tsconfig.render.json && npm prune --omit=dev
COPY love-tag-server/fixtures/*.json.gz ./fixtures/
COPY love-tag-server/scripts/prepare-host-fixtures.mjs ./scripts/
RUN node scripts/prepare-host-fixtures.mjs && rm fixtures/*.json.gz
FROM node:24-bookworm-slim
COPY --from=build /app /app
WORKDIR /app/love-tag-server
ENV NODE_ENV=production PORT=8211
ENV NODE_OPTIONS=--max-old-space-size=192 TAG_MAX_ROOMS=1
USER node
EXPOSE 8211
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/render.js"]
