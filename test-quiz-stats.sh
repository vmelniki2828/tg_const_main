#!/bin/bash

echo "🧪 Тестирование записи статистики квизов..."

# Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose -f docker-compose.yml down

# Создать тестовый файл статистики
echo "📊 Создаем тестовый файл статистики..."
cat > backend/quizStats.json << 'EOF'
{
  "test-quiz-123": {
    "totalAttempts": 1,
    "successfulCompletions": 1,
    "failedAttempts": 0,
    "userAttempts": [
      {
        "userId": 123456789,
        "userName": "Test User",
        "timestamp": 1753636800000,
        "success": true,
        "score": 1,
        "duration": 5000
      }
    ]
  }
}
EOF

# Установить права доступа
echo "🔐 Устанавливаем права доступа..."
chmod 666 backend/quizStats.json

# Проверить файл
echo "✅ Проверяем созданный файл..."
ls -la backend/quizStats.json
echo "📄 Содержимое файла:"
cat backend/quizStats.json

# Пересобрать и запустить
echo "🔨 Пересобираем и запускаем..."
docker-compose -f docker-compose.yml up --build -d

# Ждем немного
echo "⏳ Ждем запуска..."
sleep 20

# Проверить API
echo "🔍 Проверяем API статистики..."
echo "📊 Тестируем /api/quiz-stats..."
curl -f http://localhost:3001/api/quiz-stats && echo "✅ API статистики работает" || echo "❌ API статистики недоступен"

# Проверить логи
echo "📋 Проверяем логи backend..."
docker-compose -f docker-compose.yml logs backend | tail -30

echo "✅ Тестирование завершено!"
echo "🌐 Проверьте: http://95.164.119.96:3000"
echo "📊 Теперь попробуйте пройти квиз снова и посмотрите логи!" 