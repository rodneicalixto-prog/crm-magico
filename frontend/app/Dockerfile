FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ARG VITE_AUTH_URL=https://auth.sosbot.online
ARG VITE_WA_URL=https://whatsapp.sosbot.online
ENV VITE_AUTH_URL=$VITE_AUTH_URL
ENV VITE_WA_URL=$VITE_WA_URL

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
