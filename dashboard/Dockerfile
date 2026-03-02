FROM node:22-alpine AS builder

WORKDIR /app

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ .
RUN npm run build

FROM caddy:2-alpine

COPY --from=builder /app/dist /var/www/html
COPY Caddyfile /etc/caddy/Caddyfile

EXPOSE 8601

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
