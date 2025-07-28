#!/bin/bash

echo "🔧 Исправление расположения кнопок..."

# Остановить контейнеры
echo "🛑 Останавливаем контейнеры..."
docker-compose -f docker-compose.yml down

# Удалить образ фронтенда
echo "🗑️ Удаляем образ фронтенда..."
docker rmi tg_const_main-frontend 2>/dev/null || true

# Пересобрать и запустить
echo "🔨 Пересобираем фронтенд..."
docker-compose -f docker-compose.yml up --build -d

# Ждем немного
echo "⏳ Ждем запуска..."
sleep 15

# Проверить результат
echo "📊 Проверяем результат..."
docker-compose -f docker-compose.yml ps

echo "✅ Исправление завершено!"
echo "🌐 Проверьте: http://95.164.119.96:3000"
echo "🔧 Кнопки теперь должны быть справа от инпутов!" 