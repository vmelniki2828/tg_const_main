#!/bin/bash

echo "🔧 Исправление синтаксической ошибки в QuizStats.jsx..."

# Добавляем изменения
git add frontend/src/components/QuizStats.jsx

# Создаем коммит
git commit -m "Исправлена синтаксическая ошибка в QuizStats.jsx - исправлен отступ"

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

echo '📊 Проверяем логи фронтенда...'
docker logs \$(docker ps -q --filter 'name=frontend') --tail 20
"

echo "✅ Исправления отправлены на сервер!"
echo "🌐 Проверьте фронтенд: http://95.164.119.96:3000" 