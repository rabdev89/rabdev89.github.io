FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY prisma ./prisma/
RUN npx prisma generate

COPY . .
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/build ./build
COPY --from=build /app/prisma ./prisma

EXPOSE 3000

CMD ["npm", "run", "docker-start"]
