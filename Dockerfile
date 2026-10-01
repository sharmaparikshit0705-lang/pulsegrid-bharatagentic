# PulseGrid API — deploys the Express/PostGIS backend plus the shared agent core.
# The agent core lives in client/src/agents and is imported by the server, so
# both trees ship in the image.
FROM node:20-alpine

WORKDIR /app

# install server deps first (layer cache)
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

COPY server/ ./server/
COPY client/src/agents/ ./client/src/agents/

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=4s --start-period=10s \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1

CMD ["node", "server/src/index.js"]
