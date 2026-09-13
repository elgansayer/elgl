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
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Stage 3: Production
FROM node:22-alpine AS production
WORKDIR /app
RUN apk upgrade --no-cache libcrypto3 libssl3
COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /root/.npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
