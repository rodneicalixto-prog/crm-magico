FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
RUN apk --no-cache add ca-certificates tzdata
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --frozen-lockfile
COPY --from=builder /app/dist ./dist
EXPOSE 8002
CMD ["node", "dist/index.js"]
