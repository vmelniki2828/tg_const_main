#!/bin/bash

echo "🔍 Детальная диагностика падения бота..."

echo ""
echo "📊 Системные ресурсы:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "RAM: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"
echo "Swap: $(free -m | awk 'NR==3{printf "%.1f%%", $3*100/$2}')"

echo ""
echo "🐳 Статус контейнеров:"
docker-compose ps

echo ""
echo "📝 Последние 50 строк логов backend:"
docker-compose logs --tail=50 backend

echo ""
echo "🔍 Проверка процессов в контейнере:"
docker-compose exec backend ps aux

echo ""
echo "💾 Использование памяти в контейнере:"
docker-compose exec backend free -m

echo ""
echo "📁 Размер файлов:"
docker-compose exec backend du -sh /app/backend/*

echo ""
echo "🔍 Проверка health check:"
curl -v http://localhost:3001/api/health

echo ""
echo "📊 Статистика Docker:"
docker stats --no-stream

echo ""
echo "✅ Диагностика завершена" 