# Используем официальный образ Node.js (Debian-based для поддержки canvas)
FROM node:18-slim

# Устанавливаем системные зависимости для canvas, ffmpeg и утилиты
# Используем --no-install-recommends для уменьшения размера
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    ffmpeg \
    wget \
    jq \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/* \
    && rm -rf /tmp/* \
    && rm -rf /var/tmp/*

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
RUN mkdir -p backend/uploads backend/promocodes backend/backups backend/videos backend/temp_frames

# Устанавливаем права на директории
RUN chmod 755 backend/uploads backend/promocodes backend/backups backend/videos backend/temp_frames

# Открываем порт
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"] 