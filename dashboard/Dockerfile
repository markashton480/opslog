FROM node:22-alpine AS builder

WORKDIR /app

ARG VITE_OPSLOG_API_URL=/api/v1
ENV VITE_OPSLOG_API_URL=$VITE_OPSLOG_API_URL

COPY dashboard/package*.json ./
RUN npm ci

COPY dashboard/ .
RUN npm run build

FROM caddy:2-alpine

COPY --from=builder /app/dist /var/www/html
COPY dashboard/Caddyfile /etc/caddy/Caddyfile

EXPOSE 8601

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
