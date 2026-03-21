FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY src ./src
RUN mkdir -p /app/storage/audio /app/storage/cover
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/index.js"]

