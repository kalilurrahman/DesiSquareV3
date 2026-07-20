# Zero-dependency Node service — no build step, no npm install needed.
FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=8791
EXPOSE 8791
CMD ["node", "src/server.js"]
