#!/bin/bash

echo "📊 Мониторинг производительности бота"

# Проверяем статус контейнеров
echo "📈 Статус контейнеров:"
docker-compose ps

echo ""
echo "💾 Использование ресурсов:"
docker stats --no-stream

echo ""
echo "📝 Последние логи (последние 10 строк):"
docker-compose logs backend --tail=10

echo ""
echo "🔍 Проверяем размер файлов данных:"
ls -lh backend/*.json 2>/dev/null || echo "JSON файлы не найдены"

echo ""
echo "🌐 Тестируем время ответа API:"
curl -s -w "Время ответа: %{time_total}s\n" http://95.164.119.96:3001/api/bots

echo ""
echo "📊 Проверяем использование памяти в контейнере:"
docker-compose exec backend cat /proc/meminfo | head -3 2>/dev/null || echo "Не удалось проверить память"

echo ""
echo "🔍 Проверяем процессы в контейнере:"
docker-compose exec backend ps aux 2>/dev/null || echo "Не удалось проверить процессы"

echo "✅ Мониторинг завершен" 