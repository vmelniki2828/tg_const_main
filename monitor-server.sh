#!/bin/bash

echo "🔍 Мониторинг состояния сервера..."

# Проверка использования CPU и RAM
echo "📊 Использование ресурсов:"
echo "CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "RAM: $(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')"

# Проверка Docker контейнеров
echo ""
echo "🐳 Статус Docker контейнеров:"
docker-compose ps

# Проверка логов backend
echo ""
echo "📝 Последние логи backend:"
docker-compose logs --tail=20 backend

# Проверка health check
echo ""
echo "🏥 Health check:"
curl -s http://localhost:3001/api/health | jq '.'

# Проверка активных пользователей
echo ""
echo "👥 Активные пользователи:"
curl -s http://localhost:3001/api/health | jq '.activeUsers'

echo ""
echo "✅ Мониторинг завершен" 