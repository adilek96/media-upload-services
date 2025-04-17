# Этап сборки
FROM node:22 AS build

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Копируем исходный код
COPY . .

# Генерируем клиента Prisma с поддержкой разных версий OpenSSL
RUN npx prisma generate

# Сборка проекта
RUN npm run build

# Этап продакшн
FROM node:22-slim AS production

# Установка необходимых зависимостей для работы Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Копируем package.json
COPY --from=build /app/package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production --legacy-peer-deps

# Убедимся, что axios установлен
RUN npm install axios@1.6.2

# Копируем необходимые файлы из этапа сборки
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/.env ./.env

# Копируем Prisma Client со всеми скомпилированными движками
COPY --from=build /app/node_modules/.prisma/client ./node_modules/.prisma/client
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

# Явно указываем, что используем только порт 4001
ENV PORT=4003
EXPOSE 4003

# Запускаем приложение из dist/main.js
CMD ["node", "dist/main.js"]
