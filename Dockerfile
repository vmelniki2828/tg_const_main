# Используем официальный образ Node.js
FROM node:18-alpine

# Устанавливаем wget и jq для health check и мониторинга
# А также системные зависимости для Puppeteer и ffmpeg
RUN apk add --no-cache \
    wget \
    jq \
    ffmpeg \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json из backend
COPY backend/package*.json ./backend/

# Переходим в папку backend и устанавливаем зависимости
WORKDIR /app/backend
RUN npm install

# Возвращаемся в корень и копируем исходный код
WORKDIR /app
COPY . .

# Создаем необходимые директории
RUN mkdir -p backend/uploads backend/promocodes backend/backups backend/temp_frames

# Устанавливаем права на директории
RUN chmod 755 backend/uploads backend/promocodes backend/backups

# Открываем порт
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"] 