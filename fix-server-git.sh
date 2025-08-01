#!/bin/bash

echo "🔧 Решение проблемы с Git на сервере..."

# Команды для выполнения на сервере
ssh root@95.164.119.96 "
cd /opt/tg_const_main

echo '📋 Текущий статус Git...'
git status

echo '🔧 Настройка Git для слияния...'
git config pull.rebase false

echo '📥 Принудительное получение изменений...'
git fetch origin

echo '🔄 Сброс к состоянию origin/main...'
git reset --hard origin/main

echo '🧹 Очистка...'
git clean -fd

echo '📦 Пересборка контейнеров...'
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up --build -d

echo '⏳ Ожидание запуска...'
sleep 15

echo '📊 Статус контейнеров...'
docker-compose -f docker-compose.yml ps

echo '✅ Проблема с Git решена!'
"

echo "🎉 Сервер обновлен!"
echo "🌐 Проверьте: http://95.164.119.96:3000" 