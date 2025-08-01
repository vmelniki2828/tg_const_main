#!/bin/bash

echo "🔧 Исправление сохранения статистики квизов..."

# Устанавливаем node-fetch в бэкенде
cd backend
npm install node-fetch@2

# Добавляем изменения
cd ..
git add backend/package.json backend/package-lock.json backend/botProcess.js

# Создаем коммит
git commit -m "Исправлено сохранение статистики квизов - добавлен API запрос для синхронизации"

# Отправляем на сервер
git push origin main

echo "✅ Изменения отправлены в Git!"
echo "🔄 Обновляем сервер..."

# Обновляем на сервере
ssh root@95.164.119.96 "
cd /opt/tg_const_main
git pull origin main

echo '📦 Устанавливаем новые зависимости...'
cd backend
npm install

echo '🔧 Перезапускаем контейнеры...'
cd ..
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up --build -d

echo '⏳ Ждем запуска сервисов...'
sleep 20

echo '📊 Проверяем статус контейнеров...'
docker-compose -f docker-compose.yml ps

echo '📊 Проверяем логи бэкенда...'
docker logs \$(docker ps -q --filter 'name=backend') --tail 20
"

echo "✅ Исправления отправлены на сервер!"
echo "🌐 Проверьте фронтенд: http://95.164.119.96:3000"
echo "📊 Теперь статистика квизов должна сохраняться и отображаться корректно!" 