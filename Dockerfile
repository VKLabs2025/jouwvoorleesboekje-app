# Jouw Voorleesboekje — productie image voor Fly.io
FROM node:20-bookworm-slim

# Native build tools voor better-sqlite3 + fonts voor PDF's
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    fontconfig fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Eerst deps (cache-vriendelijk)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

# App-code
COPY . .

# Persistente volume-mountpoint voor SQLite + PDF's
RUN mkdir -p /data/db /data/pdfs /data/tmp && chown -R node:node /data

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data

EXPOSE 8080

USER node

CMD ["node", "server/index.js"]
