FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
# Install build tools for sqlite3 on alpine
RUN apk add --no-cache python3 make g++ && npm install
COPY . .
EXPOSE 4000
CMD ["node", "vault.js"]
