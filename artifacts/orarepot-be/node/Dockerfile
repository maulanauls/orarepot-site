FROM node:22-bookworm-slim AS build
WORKDIR /src
COPY package.json ./
RUN npm install --omit=dev=false
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:22-bookworm-slim
WORKDIR /app
COPY --from=build /src/package.json ./
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
ENV NODE_ENV=production
EXPOSE 8201 8202 8203 8204 8205
CMD ["node", "dist/members/main.js"]
