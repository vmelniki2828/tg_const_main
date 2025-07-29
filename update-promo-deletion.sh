#!/bin/bash

echo "🔄 Обновление сервера с функциональностью удаления промокодов"

# Останавливаем контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose down

# Удаляем старые образы
echo "🗑️ Удаляем старые образы..."
docker system prune -f

# Пересобираем и запускаем контейнеры
echo "🔨 Пересобираем контейнеры..."
docker-compose up --build -d

# Ждем запуска сервисов
echo "⏳ Ждем запуска сервисов..."
sleep 10

# Проверяем статус
echo "📊 Проверяем статус контейнеров..."
docker-compose ps

# Проверяем доступность API
echo "🔍 Проверяем доступность API..."
if curl -s http://95.164.119.96:3001/api/bots > /dev/null; then
    echo "✅ API доступен"
else
    echo "❌ API недоступен"
    exit 1
fi

# Тестируем новый эндпоинт
echo "🧪 Тестируем эндпоинт удаления промокодов..."
DELETE_RESPONSE=$(curl -s -X DELETE http://95.164.119.96:3001/api/quiz-promocodes/999999)
echo "📄 Ответ: $DELETE_RESPONSE"

if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Функциональность удаления промокодов работает"
else
    echo "❌ Ошибка в функциональности удаления промокодов"
fi

echo "🎉 Обновление завершено!"