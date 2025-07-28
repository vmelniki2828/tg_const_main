#!/bin/bash

# Скрипт для развертывания Telegram Quiz Bot на продакшен сервере
# Использование: ./deploy-prod-clean.sh

set -e

echo "🚀 Начинаем развертывание Telegram Quiz Bot на продакшен сервере..."

# Проверяем наличие Docker и Docker Compose
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова."
    exit 1
fi

# Создаем .env файл для продакшена если его нет
if [ ! -f .env ]; then
    echo "📝 Создаем .env файл для продакшена..."
    cat > .env << EOF
# Настройки окружения для продакшена
NODE_ENV=production

# Настройки сервера
PORT=3001
HOST=0.0.0.0

# Настройки фронтенда
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000

# Настройки Telegram Bot (замените на ваш токен)
TELEGRAM_BOT_TOKEN=your_bot_token_here

# Настройки безопасности
CORS_ORIGIN=http://95.164.119.96:3000
EOF
    echo "✅ .env файл создан. Не забудьте добавить ваш Telegram Bot токен!"
fi



# Создаем nginx.conf для фронтенда
echo "📝 Создаем nginx.conf для фронтенда..."
cat > frontend/nginx.conf << 'EOF'
server {
    listen 3000;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # Обработка React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF
echo "✅ nginx.conf для фронтенда создан!"

# Полная очистка всех контейнеров и образов
echo "🧹 Полная очистка Docker..."
docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=telegram-quiz-bot") 2>/dev/null || true
docker rmi -f $(docker images -q --filter "reference=tg_const_main*") 2>/dev/null || true
docker system prune -f

# Собираем и запускаем контейнеры
echo "🔨 Собираем и запускаем контейнеры..."
docker-compose -f docker-compose.yml up --build -d

# Ждем немного для запуска сервисов
echo "⏳ Ждем запуска сервисов..."
sleep 15

# Проверяем статус контейнеров
echo "📊 Проверяем статус контейнеров..."
docker-compose -f docker-compose.yml ps

# Проверяем доступность API
echo "🔍 Проверяем доступность API..."
if curl -f http://localhost:3001/api/bots > /dev/null 2>&1; then
    echo "✅ API доступен на порту 3001"
else
    echo "❌ API недоступен на порту 3001"
fi

# Проверяем доступность фронтенда
echo "🔍 Проверяем доступность фронтенда..."
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Фронтенд доступен на порту 3000"
else
    echo "❌ Фронтенд недоступен на порту 3000"
fi

echo ""
echo "🎉 Развертывание завершено!"
echo ""
echo "📋 Информация о развертывании:"
echo "   🌐 Фронтенд: http://95.164.119.96:3000"
echo "   🔧 API: http://95.164.119.96:3001"
echo "   📊 Статус контейнеров: docker-compose -f docker-compose.yml ps"
echo "   📝 Логи: docker-compose -f docker-compose.yml logs -f"
echo ""
echo "⚠️  Не забудьте добавить ваш Telegram Bot токен в .env файл" 