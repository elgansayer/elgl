# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Development
FROM node:22-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
EXPOSE 4200
CMD ["npm", "run", "start"]

# Stage 3: Production Nginx serve
FROM nginx:alpine AS production
# Keep security-sensitive Alpine runtime libraries above Trivy-blocked fixed-version floors.
RUN apk add --no-cache \
    'libcrypto3>=3.5.8-r0' \
    'libssl3>=3.5.8-r0' \
    'libexpat>=2.8.4-r0' \
    'libuuid>=2.42.3-r0'
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
# outputMode "server" names the client shell index.csr.html. This static image
# serves the CSR shell, so install it as index.html (replacing nginx's default
# welcome page) and fail the build if the shell is missing.
RUN test -f /usr/share/nginx/html/index.csr.html \
    && mv -f /usr/share/nginx/html/index.csr.html /usr/share/nginx/html/index.html \
    && grep -q '<app-root' /usr/share/nginx/html/index.html
# Fallback SPA routing for Angular
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; index index.html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
