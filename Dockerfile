# ---------- Base image ----------
FROM node:20-alpine

WORKDIR /app

# Cai dependencies truoc de tan dung Docker layer cache
COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy toan bo source code
COPY . .

ENV NODE_ENV=production
ENV PORT=5000
EXPOSE 5000

# Healthcheck don gian goi vao /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5000) + '/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
