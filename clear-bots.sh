#!/bin/bash

echo "🧹 Очистка данных ботов..."

# Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose -f docker-compose.yml down

# Очистить файлы данных
echo "🗑️ Очищаем файлы данных..."
echo '{"bots": [], "activeBot": null}' > backend/editorState.json
echo '{}' > backend/quizStats.json

# Очистить загруженные файлы
echo "🗑️ Очищаем загруженные файлы..."
rm -rf backend/uploads/*

# Пересобрать и запустить
echo "🔨 Пересобираем и запускаем..."
docker-compose -f docker-compose.yml up --build -d

# Ждем немного
echo "⏳ Ждем запуска..."
sleep 15

# Проверить результат
echo "📊 Проверяем результат..."
docker-compose -f docker-compose.yml ps

echo "✅ Очистка завершена!"
echo "🌐 Проверьте: http://95.164.119.96:3000"
echo "🔧 Все данные ботов очищены!" 