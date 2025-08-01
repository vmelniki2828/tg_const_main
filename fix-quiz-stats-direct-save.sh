#!/bin/bash

echo "🔧 Исправление прямого сохранения статистики квизов..."

# Добавляем изменения
git add backend/botProcess.js

# Создаем коммит
git commit -m "Исправлено сохранение статистики квизов - возврат к прямому сохранению в файл с улучшенным логированием"

# Отправляем на сервер
git push origin main

echo "✅ Изменения отправлены в Git!"
echo "🔄 Обновляем сервер..."

# Обновляем на сервере
ssh root@95.164.119.96 "
cd /opt/tg_const_main
git pull origin main

echo '🔧 Перезапускаем контейнеры...'
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up --build -d

echo '⏳ Ждем запуска сервисов...'
sleep 20

echo '📊 Проверяем статус контейнеров...'
docker-compose -f docker-compose.yml ps

echo '📊 Проверяем логи бэкенда...'
docker logs \$(docker ps -q --filter 'name=backend') --tail 20

echo '📁 Проверяем файл статистики...'
docker exec \$(docker ps -q --filter 'name=backend') ls -la /opt/tg_const_main/backend/quizStats.json 2>/dev/null || echo 'Файл статистики не найден'
"

echo "✅ Исправления отправлены на сервер!"
echo "🌐 Проверьте фронтенд: http://95.164.119.96:3000"
echo "📊 Теперь статистика должна сохраняться правильно!" 