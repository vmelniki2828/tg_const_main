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
docker-compose logs --tail=10 backend

# Проверка health check
echo ""
echo "🏥 Health check:"
if command -v jq &> /dev/null; then
    curl -s http://localhost:3001/api/health | jq '.' 2>/dev/null || echo "Ошибка парсинга JSON"
else
    curl -s http://localhost:3001/api/health
fi

# Проверка активных пользователей
echo ""
echo "👥 Активные пользователи:"
if command -v jq &> /dev/null; then
    curl -s http://localhost:3001/api/health | jq '.activeUsers' 2>/dev/null || echo "Ошибка получения данных"
else
    echo "jq не установлен, используйте: apt-get install jq"
fi

echo ""
echo "✅ Мониторинг завершен" 