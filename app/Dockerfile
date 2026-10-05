FROM node:22-alpine
WORKDIR /app
COPY . .
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
