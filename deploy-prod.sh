#!/bin/bash

# Скрипт для развертывания Telegram Quiz Bot на продакшен сервере
# Использование: ./deploy-prod.sh

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

# Создаем .env файл для фронтенда
if [ ! -f frontend/.env ]; then
    echo "📝 Создаем .env файл для фронтенда..."
    cat > frontend/.env << EOF
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
EOF
    echo "✅ .env файл для фронтенда создан!"
fi

# Копируем nginx.conf в frontend если его там нет
if [ ! -f frontend/nginx.conf ]; then
    echo "📝 Копируем nginx.conf в frontend..."
    cp nginx.conf frontend/
    echo "✅ nginx.conf скопирован в frontend!"
fi

# Останавливаем существующие контейнеры
echo "🛑 Останавливаем существующие контейнеры..."
docker-compose -f docker-compose.prod.yml down || true

# Удаляем старые образы
echo "🧹 Удаляем старые образы..."
docker system prune -f

# Собираем и запускаем контейнеры
echo "🔨 Собираем и запускаем контейнеры..."
docker-compose -f docker-compose.prod.yml up --build -d

# Ждем немного для запуска сервисов
echo "⏳ Ждем запуска сервисов..."
sleep 10

# Проверяем статус контейнеров
echo "📊 Проверяем статус контейнеров..."
docker-compose -f docker-compose.prod.yml ps

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
echo "   📊 Статус контейнеров: docker-compose -f docker-compose.prod.yml ps"
echo "   📝 Логи: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "⚠️  Не забудьте:"
echo "   1. Добавить ваш Telegram Bot токен в .env файл"
echo "   2. Настроить файрвол для портов 80, 3000, 3001"
echo "   3. Настроить SSL сертификат для HTTPS"
echo ""
echo "🔧 Полезные команды:"
echo "   Остановить: docker-compose -f docker-compose.prod.yml down"
echo "   Перезапустить: docker-compose -f docker-compose.prod.yml restart"
echo "   Обновить: ./deploy-prod.sh" 