# Этап сборки
FROM node:22 AS build

WORKDIR /app

# Копируем package.json и устанавливаем зависимости
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Копируем исходный код
COPY . .


# Сборка проекта
RUN npm run build

# Этап продакшн
FROM node:22-slim AS production



WORKDIR /app

# Копируем package.json
COPY --from=build /app/package*.json ./

# Устанавливаем только production зависимости
RUN npm ci --only=production --legacy-peer-deps



# Копируем необходимые файлы из этапа сборки
COPY --from=build /app/dist ./dist
COPY --from=build /app/.env ./.env



# Явно указываем, что используем только порт 4001
ENV PORT=4003
EXPOSE 4003

# Запускаем приложение из dist/main.js
CMD ["node", "dist/main.js"]
