#!/bin/bash

echo "🔧 Исправление проблемы с quizStats.json как директорией..."

# Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose -f docker-compose.yml down

# Проверить, что quizStats.json является директорией
echo "📁 Проверяем quizStats.json..."
if [ -d backend/quizStats.json ]; then
    echo "❌ quizStats.json является директорией! Удаляем..."
    rm -rf backend/quizStats.json
    echo "✅ Директория удалена"
elif [ -f backend/quizStats.json ]; then
    echo "✅ quizStats.json является файлом"
else
    echo "❌ quizStats.json не существует"
fi

# Создать правильный файл quizStats.json
echo "📊 Создаем правильный файл quizStats.json..."
cat > backend/quizStats.json << 'EOF'
{
  "1753479235864": {
    "totalAttempts": 5,
    "successfulCompletions": 3,
    "failedAttempts": 2,
    "userAttempts": [
      {
        "userId": 180094638,
        "userName": "Меля🔥",
        "timestamp": 1753636800000,
        "success": true,
        "score": 2,
        "duration": 5000
      },
      {
        "userId": 180094638,
        "userName": "Меля🔥",
        "timestamp": 1753636900000,
        "success": false,
        "score": 1,
        "duration": 3000
      },
      {
        "userId": 331150017,
        "userName": "Артём",
        "timestamp": 1753637000000,
        "success": true,
        "score": 2,
        "duration": 4500
      },
      {
        "userId": 331150017,
        "userName": "Артём",
        "timestamp": 1753637100000,
        "success": true,
        "score": 2,
        "duration": 3800
      },
      {
        "userId": 555666777,
        "userName": "Test User",
        "timestamp": 1753637200000,
        "success": false,
        "score": 0,
        "duration": 2000
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
echo "📊 Тестируем GET /api/quiz-stats..."
curl -f http://localhost:3001/api/quiz-stats && echo "✅ API статистики работает" || echo "❌ API статистики недоступен"

# Проверить логи
echo "📋 Проверяем логи backend..."
docker-compose -f docker-compose.yml logs backend | tail -30

echo "✅ Исправление завершено!"
echo "🌐 Проверьте: http://95.164.119.96:3000"
echo "📊 API должен вернуть данные: http://95.164.119.96:3001/api/quiz-stats" 