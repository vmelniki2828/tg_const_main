# Используем официальный образ Node.js
FROM node:18-alpine

# Устанавливаем системные зависимости для canvas, ffmpeg и утилиты
RUN apk add --no-cache \
    wget \
    jq \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    librsvg-dev \
    ffmpeg \
    && ln -sf python3 /usr/bin/python

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
RUN mkdir -p backend/uploads backend/promocodes backend/backups backend/temp_frames backend/uploads/giveaways

# Устанавливаем права на директории
RUN chmod 755 backend/uploads backend/promocodes backend/backups

# Открываем порт
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"] 