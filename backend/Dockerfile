# Stage 1: Build
FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

# Stage 2: Development
FROM node:26-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start:dev"]

# Stage 3: Production
FROM node:26-alpine AS production
WORKDIR /app
# Apply every Alpine security fix available at build time, so new base-image
# advisories do not block releases until someone adds another version floor.
RUN apk upgrade --no-cache
COPY package*.json ./
RUN npm ci --legacy-peer-deps --omit=dev \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /root/.npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main"]
