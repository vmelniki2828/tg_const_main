#!/bin/bash

echo "🔍 Отладка сохранения статистики квизов..."

# Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose -f docker-compose.yml down

# Создать пустой файл статистики с правильными правами
echo "📊 Создаем пустой файл статистики..."
echo '{}' > backend/quizStats.json
chmod 666 backend/quizStats.json

# Пересобрать и запустить
echo "🔨 Пересобираем и запускаем..."
docker-compose -f docker-compose.yml up --build -d

# Ждем немного
echo "⏳ Ждем запуска..."
sleep 20

# Проверить API
echo "🔍 Проверяем API статистики..."
echo "📊 Тестируем GET /api/quiz-stats..."
curl -f http://localhost:3001/api/quiz-stats && echo "✅ API статистики работает" || echo "❌ API статистики недоступен"

# Проверить логи
echo "📋 Проверяем логи backend..."
docker-compose -f docker-compose.yml logs backend | tail -50

echo "✅ Отладка завершена!"
echo "🌐 Теперь пройдите квиз и посмотрите логи ниже:"
echo "📋 Логи в реальном времени:"
docker-compose -f docker-compose.yml logs -f backend 