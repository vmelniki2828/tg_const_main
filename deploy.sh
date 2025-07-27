#!/bin/bash

# Скрипт для развертывания Telegram Quiz Bot
# Использование: ./deploy.sh [production|development]

set -e

ENVIRONMENT=${1:-production}
PROJECT_NAME="telegram-quiz-bot"

echo "🚀 Начинаем развертывание Telegram Quiz Bot в режиме: $ENVIRONMENT"

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker и попробуйте снова."
    exit 1
fi

# Проверяем наличие Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова."
    exit 1
fi

echo "✅ Docker и Docker Compose найдены"

# Создаем необходимые директории
echo "📁 Создаем необходимые директории..."
mkdir -p backend/uploads backend/promocodes logs

# Создаем файлы состояния если их нет
if [ ! -f backend/state.json ]; then
    echo "📄 Создаем файл состояния..."
    echo '{"bots":[],"activeBot":null}' > backend/state.json
fi

if [ ! -f backend/quizStats.json ]; then
    echo "📊 Создаем файл статистики..."
    echo '{}' > backend/quizStats.json
fi

# Останавливаем существующие контейнеры
echo "🛑 Останавливаем существующие контейнеры..."
docker-compose down || true

# Удаляем старые образы
echo "🧹 Очищаем старые образы..."
docker system prune -f

# Собираем новый образ
echo "🔨 Собираем Docker образ..."
docker-compose build --no-cache

# Запускаем приложение
echo "🚀 Запускаем приложение..."
docker-compose up -d

# Ждем запуска
echo "⏳ Ждем запуска приложения..."
sleep 10

# Проверяем статус
echo "🔍 Проверяем статус приложения..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ Приложение успешно запущено!"
    echo "📊 Статус контейнеров:"
    docker-compose ps
    
    echo ""
    echo "🌐 Приложение доступно по адресу: http://localhost:3001"
    echo "📝 Логи можно посмотреть командой: docker-compose logs -f"
    echo "🛑 Остановить приложение: docker-compose down"
    
else
    echo "❌ Ошибка запуска приложения"
    echo "📋 Логи ошибок:"
    docker-compose logs
    exit 1
fi

echo ""
echo "🎉 Развертывание завершено успешно!" 