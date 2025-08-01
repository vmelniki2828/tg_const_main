#!/bin/bash

echo "🔧 Исправление кнопок с ссылками..."

# Добавляем изменения
git add backend/botProcess.js

# Создаем коммит
git commit -m "Исправлена обработка кнопок с ссылками - добавлено логирование и улучшена логика"

# Отправляем на сервер
git push origin main

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