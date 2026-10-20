FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server.mjs ./server.mjs
RUN chown -R node:node /app

USER node
EXPOSE 4173

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4173/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.mjs"]
