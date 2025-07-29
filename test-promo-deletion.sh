#!/bin/bash

echo "🧪 Тестирование удаления промокодов квизов"

# Проверяем, что сервер запущен
echo "📡 Проверяем доступность сервера..."
if ! curl -s http://95.164.119.96:3001/api/bots > /dev/null; then
    echo "❌ Сервер недоступен"
    exit 1
fi

echo "✅ Сервер доступен"

# Тестируем удаление промокодов для несуществующего квиза
echo "🧪 Тестируем удаление промокодов для несуществующего квиза..."
DELETE_RESPONSE=$(curl -s -X DELETE http://95.164.119.96:3001/api/quiz-promocodes/999999)

echo "📄 Ответ сервера: $DELETE_RESPONSE"

# Проверяем, что ответ содержит success: true
if echo "$DELETE_RESPONSE" | grep -q '"success":true'; then
    echo "✅ Удаление промокодов работает корректно"
else
    echo "❌ Ошибка в удалении промокодов"
fi

echo "🎯 Тест завершен"