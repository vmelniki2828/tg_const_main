#!/bin/bash

echo "🚀 Деплой исправлений статистики квизов на сервер..."

# Добавляем все изменения
git add .

# Создаем коммит
git commit -m "Исправлено сохранение статистики квизов - прямое сохранение в файл с подробным логированием"

# Отправляем на сервер
git push origin main

echo "✅ Изменения отправлены в Git!"
echo "🔄 Обновляем сервер..."

# Обновляем на сервере
ssh root@95.164.119.96 "
cd /opt/tg_const_main

echo '📥 Получаем изменения с Git...'
git pull origin main

echo '🔧 Останавливаем контейнеры...'
docker-compose -f docker-compose.yml down

echo '🔧 Перезапускаем контейнеры...'
docker-compose -f docker-compose.yml up --build -d

echo '⏳ Ждем запуска сервисов...'
sleep 30

echo '📊 Проверяем статус контейнеров...'
docker-compose -f docker-compose.yml ps

echo '📊 Проверяем логи бэкенда...'
docker logs \$(docker ps -q --filter 'name=backend') --tail 30

echo '📁 Проверяем файл статистики...'
docker exec \$(docker ps -q --filter 'name=backend') ls -la /opt/tg_const_main/backend/quizStats.json 2>/dev/null || echo 'Файл статистики не найден'

echo '📊 Проверяем содержимое файла статистики...'
docker exec \$(docker ps -q --filter 'name=backend') cat /opt/tg_const_main/backend/quizStats.json 2>/dev/null || echo 'Файл статистики пуст или не существует'
"

echo "✅ Деплой завершен!"
echo "🌐 Проверьте фронтенд: http://95.164.119.96:3000"
echo "📊 Теперь статистика должна сохраняться правильно!" 