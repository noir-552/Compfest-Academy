FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html tsconfig*.json vite.config.ts ./
COPY public ./public
COPY src ./src

ENV VITE_API_PROXY_TARGET=http://backend:3001

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
