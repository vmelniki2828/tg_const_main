#!/bin/bash

echo "🔧 ФИНАЛЬНОЕ исправление quizStats.json..."

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
echo "📄 Тип файла на хосте:"
file backend/quizStats.json

# 7. Удалить старые контейнеры и образы
echo "🧹 Очищаем старые контейнеры и образы..."
docker-compose down --volumes --remove-orphans
docker system prune -f

# 8. Пересобрать и запустить контейнеры
echo "🔨 Пересобираем и запускаем контейнеры..."
docker-compose up -d --build

# 9. Ждем полного запуска
echo "⏳ Ждем полного запуска контейнеров..."
sleep 20

# 10. Проверить файл внутри контейнера
echo "🔍 Проверяем файл внутри контейнера..."
docker-compose exec backend ls -la /app/backend/quizStats.json
docker-compose exec backend file /app/backend/quizStats.json

# 11. Если внутри контейнера все еще директория, исправим это
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

# 12. Проверить содержимое файла внутри контейнера
echo "📄 Проверяем содержимое файла внутри контейнера..."
docker-compose exec backend cat /app/backend/quizStats.json

# 13. Перезапустить backend для применения изменений
echo "🔄 Перезапускаем backend..."
docker-compose restart backend

# 14. Ждем перезапуска
echo "⏳ Ждем перезапуска backend..."
sleep 15

# 15. Проверить статус
echo "📊 Статус контейнеров:"
docker-compose ps

# 16. Проверить логи
echo "📋 Логи backend:"
docker-compose logs --tail=20 backend

# 17. Тест API
echo "🧪 Тестируем API статистики..."
curl -s http://localhost:3001/api/quiz-stats

# 18. Финальная проверка
echo "🎯 Финальная проверка..."
docker-compose exec backend bash -c '
echo "📁 Проверяем файл внутри контейнера:"
ls -la /app/backend/quizStats.json
echo "📄 Тип файла:"
file /app/backend/quizStats.json
echo "📊 Содержимое:"
head -10 /app/backend/quizStats.json
'

echo "🎉 ФИНАЛЬНОЕ исправление завершено!" 