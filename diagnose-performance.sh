#!/bin/bash

echo "🔍 Диагностика производительности бота"

# Проверяем статус контейнеров
echo "📊 Статус контейнеров:"
docker-compose ps

echo ""
echo "💾 Использование ресурсов:"
docker stats --no-stream

echo ""
echo "📝 Последние логи бэкенда:"
docker-compose logs backend --tail=20

echo ""
echo "🔧 Проверяем размер файлов данных:"
ls -lh backend/*.json backend/uploads/ backend/promocodes/ 2>/dev/null || echo "Файлы не найдены"

echo ""
echo "🌐 Проверяем доступность API:"
curl -s -w "Время ответа: %{time_total}s\n" http://95.164.119.96:3001/api/bots

echo ""
echo "📈 Проверяем процессы Node.js:"
docker-compose exec backend ps aux | grep node || echo "Не удалось проверить процессы"

echo ""
echo "🔍 Проверяем использование памяти в контейнере:"
docker-compose exec backend cat /proc/meminfo | head -5 || echo "Не удалось проверить память"

echo "✅ Диагностика завершена" 