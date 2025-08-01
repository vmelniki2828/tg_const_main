#!/bin/bash

echo "🔧 Исправление отображения кнопок (по 2 в ряд)..."

# Добавляем изменения
git add backend/botProcess.js

# Создаем коммит
git commit -m "Исправлено отображение кнопок - теперь по 2 в ряд во всех блоках и квизах"

# Отправляем на сервер
git push origin main

echo "✅ Изменения отправлены в Git!"
echo "🔄 Теперь обновляем сервер..."

# Обновляем на сервере
ssh root@95.164.119.96 "
cd /opt/tg_const_main
git pull origin main
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up --build -d
sleep 10
docker-compose -f docker-compose.yml ps
"

echo "✅ Исправления отправлены на сервер!"
echo "🌐 Проверьте бота: http://95.164.119.96:3000"
echo "📱 Теперь кнопки отображаются по 2 в ряд!" 