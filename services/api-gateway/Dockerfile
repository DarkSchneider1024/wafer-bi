# ---- Build Stage ----
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

# ---- Production Stage ----
FROM node:20-slim
WORKDIR /app

# Security: run as non-root user
RUN groupadd --gid 1001 appgroup && \
    useradd --uid 1001 --gid appgroup --shell /bin/sh appuser

COPY --from=builder /app/node_modules ./node_modules
COPY src/ ./src/
COPY package.json ./

USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/healthz', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "-r", "./src/tracing.js", "src/index.js"]
