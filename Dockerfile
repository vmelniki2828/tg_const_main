# Используем официальный образ Node.js (Debian-based для поддержки canvas)
FROM node:18-slim

# Устанавливаем системные зависимости для canvas и ffmpeg
RUN apt-get update && apt-get install -y \
    wget \
    jq \
    python3 \
    make \
    g++ \
    pkg-config \
    libcairo2-dev \
    libjpeg-dev \
    libpango1.0-dev \
    libgif-dev \
    librsvg2-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

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
RUN mkdir -p backend/uploads backend/promocodes backend/backups

# Устанавливаем права на директории
RUN chmod 755 backend/uploads backend/promocodes backend/backups

# Открываем порт
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"] 