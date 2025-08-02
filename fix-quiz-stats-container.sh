#!/bin/bash

echo "🔧 Качественное исправление quizStats.json..."

# 1. Получить последние изменения
echo "📥 Получаем последние изменения..."
git pull origin main

# 2. Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose down

# 3. Удалить проблемную директорию/файл на хосте
echo "🗑️ Удаляем проблемный quizStats.json на хосте..."
rm -rf backend/quizStats.json

# 4. Создать правильный файл на хосте
echo "📝 Создаем правильный файл quizStats.json на хосте..."
cat > backend/quizStats.json << 'EOF'
{
  "test-quiz": {
    "totalAttempts": 1,
    "successfulCompletions": 1,
    "failedAttempts": 0,
    "userAttempts": [
      {
        "userId": 123456789,
        "userName": "Test User",
        "userLastName": "Test",
        "username": "testuser",
        "timestamp": 1754089733162,
        "success": true,
        "score": 5,
        "totalQuestions": 5,
        "successRate": 100,
        "duration": 30000,
        "answers": [
          {
            "questionIndex": 0,
            "selectedAnswer": "Правильный ответ",
            "isCorrect": true
          }
        ]
      }
    ]
  }
}
EOF

# 5. Установить правильные права доступа
echo "🔐 Устанавливаем права доступа..."
chmod 644 backend/quizStats.json

# 6. Проверить файл на хосте
echo "✅ Проверяем файл на хосте..."
ls -la backend/quizStats.json
echo "📄 Содержимое файла на хосте:"
head -5 backend/quizStats.json

# 7. Запустить контейнеры
echo "🚀 Запускаем контейнеры..."
docker-compose up -d

# 8. Ждем запуска
echo "⏳ Ждем запуска контейнеров..."
sleep 15

# 9. Проверить файл внутри контейнера
echo "🔍 Проверяем файл внутри контейнера..."
docker-compose exec backend ls -la /app/backend/quizStats.json
docker-compose exec backend file /app/backend/quizStats.json

# 10. Если внутри контейнера все еще директория, исправим это
echo "🔧 Исправляем файл внутри контейнера..."
docker-compose exec backend bash -c '
if [ -d "/app/backend/quizStats.json" ]; then
    echo "❌ quizStats.json это директория внутри контейнера"
    rm -rf /app/backend/quizStats.json
    echo "📝 Создаем правильный файл внутри контейнера..."
    cat > /app/backend/quizStats.json << "EOF"
{
  "test-quiz": {
    "totalAttempts": 1,
    "successfulCompletions": 1,
    "failedAttempts": 0,
    "userAttempts": [
      {
        "userId": 123456789,
        "userName": "Test User",
        "userLastName": "Test",
        "username": "testuser",
        "timestamp": 1754089733162,
        "success": true,
        "score": 5,
        "totalQuestions": 5,
        "successRate": 100,
        "duration": 30000,
        "answers": [
          {
            "questionIndex": 0,
            "selectedAnswer": "Правильный ответ",
            "isCorrect": true
          }
        ]
      }
    ]
  }
}
EOF
    chmod 644 /app/backend/quizStats.json
    echo "✅ Файл создан внутри контейнера"
else
    echo "✅ quizStats.json уже правильный файл внутри контейнера"
fi
'

# 11. Проверить содержимое файла внутри контейнера
echo "📄 Проверяем содержимое файла внутри контейнера..."
docker-compose exec backend cat /app/backend/quizStats.json

# 12. Перезапустить backend для применения изменений
echo "🔄 Перезапускаем backend..."
docker-compose restart backend

# 13. Ждем перезапуска
echo "⏳ Ждем перезапуска backend..."
sleep 10

# 14. Проверить статус
echo "📊 Статус контейнеров:"
docker-compose ps

# 15. Проверить логи
echo "📋 Логи backend:"
docker-compose logs --tail=30 backend

# 16. Тест API
echo "🧪 Тестируем API..."
curl -s http://localhost:3001/api/quiz-stats | head -10

echo "🎉 Качественное исправление завершено!" 