FROM node:18-alpine AS builder

RUN apk add --no-cache \
    postgresql-client \
    python3 \
    make \
    g++

WORKDIR /app

COPY package*.json ./
COPY npm-shrinkwrap.json* ./

RUN npm ci --include=dev

COPY . .

RUN npm run build

FROM node:18-alpine AS production

RUN apk add --no-cache postgresql-client

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S skychart -u 1001

COPY package*.json ./

RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app ./

COPY --chown=skychart:nodejs server.js ./
COPY --chown=skychart:nodejs config/ ./config/
COPY --chown=skychart:nodejs middleware/ ./middleware/
COPY --chown=skychart:nodejs routes/ ./routes/
COPY --chown=skychart:nodejs public/ ./public/
RUN mkdir -p uploads && chown -R skychart:nodejs uploads

USER skychart
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node scripts/health-check.js

CMD ["npm", "start"]