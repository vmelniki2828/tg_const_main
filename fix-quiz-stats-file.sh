#!/bin/bash

echo "🔧 Исправление quizStats.json на сервере..."

# 1. Получить последние изменения
echo "📥 Получаем последние изменения..."
git pull origin main

# 2. Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose down

# 3. Удалить проблемную директорию/файл
echo "🗑️ Удаляем проблемный quizStats.json..."
rm -rf backend/quizStats.json

# 4. Создать правильный файл quizStats.json
echo "📝 Создаем правильный файл quizStats.json..."
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

# 6. Проверить, что файл создан правильно
echo "✅ Проверяем созданный файл..."
ls -la backend/quizStats.json
echo "📄 Содержимое файла:"
cat backend/quizStats.json

# 7. Перезапустить контейнеры
echo "🚀 Запускаем контейнеры..."
docker-compose up -d

# 8. Ждем немного для запуска
echo "⏳ Ждем запуска контейнеров..."
sleep 10

# 9. Проверить статус
echo "📊 Статус контейнеров:"
docker-compose ps

# 10. Проверить логи
echo "📋 Логи backend:"
docker-compose logs --tail=20 backend

echo "🎉 Исправление завершено!" 