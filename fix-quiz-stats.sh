#!/bin/bash

echo "🔧 Диагностика и исправление статистики квизов..."

# Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose -f docker-compose.yml down

# Проверить файлы данных
echo "📊 Проверяем файлы данных..."

# Проверить quizStats.json
if [ -f backend/quizStats.json ]; then
    echo "✅ Файл quizStats.json существует"
    echo "📄 Размер файла: $(ls -lh backend/quizStats.json | awk '{print $5}')"
    echo "📄 Содержимое файла:"
    cat backend/quizStats.json
else
    echo "❌ Файл quizStats.json не найден, создаем..."
    echo '{}' > backend/quizStats.json
fi

# Проверить editorState.json
if [ -f backend/editorState.json ]; then
    echo "✅ Файл editorState.json существует"
    echo "📄 Размер файла: $(ls -lh backend/editorState.json | awk '{print $5}')"
else
    echo "❌ Файл editorState.json не найден, создаем..."
    echo '{"bots": [], "activeBot": null}' > backend/editorState.json
fi

# Проверить права доступа
echo "🔐 Проверяем права доступа..."
ls -la backend/quizStats.json backend/editorState.json

# Исправить права доступа
echo "🔧 Исправляем права доступа..."
chmod 666 backend/quizStats.json backend/editorState.json

# Проверить, что файлы валидные JSON
echo "✅ Проверяем валидность JSON..."
if python3 -m json.tool backend/quizStats.json > /dev/null 2>&1; then
    echo "✅ quizStats.json валиден"
else
    echo "❌ quizStats.json невалиден, исправляем..."
    echo '{}' > backend/quizStats.json
fi

if python3 -m json.tool backend/editorState.json > /dev/null 2>&1; then
    echo "✅ editorState.json валиден"
else
    echo "❌ editorState.json невалиден, исправляем..."
    echo '{"bots": [], "activeBot": null}' > backend/editorState.json
fi

# Пересобрать и запустить
echo "🔨 Пересобираем и запускаем..."
docker-compose -f docker-compose.yml up --build -d

# Ждем немного
echo "⏳ Ждем запуска..."
sleep 20

# Проверить логи
echo "📋 Проверяем логи backend..."
docker-compose -f docker-compose.yml logs backend | tail -30

# Проверить API
echo "🔍 Проверяем API статистики..."
echo "📊 Тестируем /api/quiz-stats..."
curl -f http://localhost:3001/api/quiz-stats && echo "✅ API статистики работает" || echo "❌ API статистики недоступен"

echo "🔍 Проверяем API ботов..."
echo "📊 Тестируем /api/bots..."
curl -f http://localhost:3001/api/bots && echo "✅ API ботов работает" || echo "❌ API ботов недоступен"

echo "✅ Диагностика завершена!"
echo "🌐 Проверьте: http://95.164.119.96:3000"
echo "📊 Статистика должна работать теперь!" 