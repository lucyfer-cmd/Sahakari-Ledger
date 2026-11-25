# Production image: builds the React app, then runs the API which also serves it.
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json server/
RUN cd server && npm ci --omit=dev
COPY server/ server/
COPY --from=client /app/client/dist client/dist
USER node
EXPOSE 5000
CMD ["node", "server/src/server.js"]
