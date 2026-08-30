FROM node:22-alpine
WORKDIR /app
COPY package.json .
# No npm install needed - uses only Node built-ins
COPY src/ ./src/
EXPOSE 3100
CMD ["node", "src/server.js"]
