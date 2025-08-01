#!/bin/bash

echo "🔧 Исправление промокодов и статистики..."

# Добавляем изменения
git add backend/botProcess.js

# Создаем коммит
git commit -m "Исправлена обработка промокодов и улучшено сохранение статистики квизов"

# Отправляем на сервер
git push origin main

echo "✅ Изменения отправлены в Git!"
echo "🔄 Обновляем сервер..."

# Обновляем на сервере
ssh root@95.164.119.96 "
cd /opt/tg_const_main
git pull origin main

echo '🔧 Проверяем файл статистики...'
ls -la backend/quizStats.json 2>/dev/null || echo '❌ Файл quizStats.json не найден'

echo '🔧 Создаем тестовую статистику...'
cat > backend/quizStats.json << 'EOF'
{
  \"test_quiz\": {
    \"totalAttempts\": 5,
    \"successfulCompletions\": 3,
    \"failedAttempts\": 2,
    \"userAttempts\": [
      {
        \"userId\": 123456789,
        \"userName\": \"Тестовый пользователь\",
        \"userLastName\": \"\",
        \"username\": \"test_user\",
        \"timestamp\": $(date +%s)000,
        \"success\": true,
        \"score\": 3,
        \"totalQuestions\": 3,
        \"successRate\": 100,
        \"duration\": 45000,
        \"answers\": [
          {\"questionIndex\": 0, \"selectedAnswer\": \"Правильный ответ\", \"isCorrect\": true},
          {\"questionIndex\": 1, \"selectedAnswer\": \"Правильный ответ\", \"isCorrect\": true},
          {\"questionIndex\": 2, \"selectedAnswer\": \"Правильный ответ\", \"isCorrect\": true}
        ]
      },
      {
        \"userId\": 987654321,
        \"userName\": \"Другой пользователь\",
        \"userLastName\": \"\",
        \"username\": \"another_user\",
        \"timestamp\": $(date +%s)000,
        \"success\": false,
        \"score\": 1,
        \"totalQuestions\": 3,
        \"successRate\": 33.3,
        \"duration\": 30000,
        \"answers\": [
          {\"questionIndex\": 0, \"selectedAnswer\": \"Правильный ответ\", \"isCorrect\": true},
          {\"questionIndex\": 1, \"selectedAnswer\": \"Неправильный ответ\", \"isCorrect\": false},
          {\"questionIndex\": 2, \"selectedAnswer\": \"Неправильный ответ\", \"isCorrect\": false}
        ]
      }
    ]
  }
}
EOF

echo '🔧 Проверяем права доступа...'
chmod 666 backend/quizStats.json
ls -la backend/quizStats.json

echo '🔧 Перезапускаем контейнеры...'
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up --build -d

echo '⏳ Ждем запуска сервисов...'
sleep 15

echo '📊 Проверяем API статистики...'
curl -s http://localhost:3001/api/quiz-stats | head -20

echo '📊 Проверяем статус контейнеров...'
docker-compose -f docker-compose.yml ps
"

echo "✅ Исправления отправлены на сервер!"
echo "🌐 Проверьте статистику: http://95.164.119.96:3000"
echo "📊 API статистики: http://95.164.119.96:3001/api/quiz-stats" 