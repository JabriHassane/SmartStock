# --- Build Angular ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# --- nginx : sert le build et proxifie /api/* vers les microservices ---
FROM nginx:alpine

# Self-signed cert baked in at build time — no public hostname is reachable
# here for a real ACME cert, cloudflared skips validation with
# "No TLS Verify" instead (see DEPLOY.md). IP SAN covers direct Tailscale
# access; CN/DNS SAN covers cloudflared's "localhost:8446" service URL.
# Same pattern as MyPortfolio/azwebsite/video-dl-sass on this server.
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs \
    && openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/nginx/certs/selfsigned.key \
        -out /etc/nginx/certs/selfsigned.crt \
        -subj "/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:100.103.213.104" \
    && apk del openssl

COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy_headers.inc /etc/nginx/conf.d/proxy_headers.inc
EXPOSE 443
