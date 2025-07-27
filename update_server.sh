#!/bin/bash

echo "🔄 Обновление сервера..."

# Подключение к серверу и обновление
ssh root@95.164.119.96 << 'EOF'

echo "📁 Переход в директорию проекта..."
cd /opt/telegram-bot

echo "🛑 Остановка контейнеров..."
docker-compose down

echo "📥 Обновление кода..."
git pull origin main

echo "🔧 Установка зависимостей..."
npm install

echo "🏗️ Сборка React приложения..."
npm run build

echo "🚀 Запуск контейнеров..."
docker-compose up -d

echo "✅ Обновление завершено!"
echo "🌐 Проверьте: http://95.164.119.96:3001"

EOF

echo "🎉 Сервер обновлен!" 