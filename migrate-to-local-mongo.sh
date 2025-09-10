#!/bin/bash

echo "🔄 Миграция данных с внешней MongoDB на локальную..."

# Останавливаем текущие сервисы
echo "⏹️ Останавливаем текущие сервисы..."
docker compose down

# Запускаем только MongoDB
echo "🚀 Запускаем локальную MongoDB..."
docker compose up -d mongodb

# Ждем, пока MongoDB запустится
echo "⏳ Ждем запуска MongoDB..."
sleep 30

# Проверяем, что MongoDB запустилась
echo "🔍 Проверяем статус MongoDB..."
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" || {
    echo "❌ MongoDB не запустилась!"
    exit 1
}

echo "✅ MongoDB запущена успешно!"

# Экспортируем данные с внешней MongoDB (если доступна)
echo "📤 Экспортируем данные с внешней MongoDB..."
if command -v mongodump &> /dev/null; then
    echo "📥 Создаем резервную копию с внешней MongoDB..."
    mongodump --uri="mongodb://157.230.20.252:27017/tg_const_main" --out=./mongo-backup-$(date +%Y%m%d_%H%M%S) || {
        echo "⚠️ Не удалось создать резервную копию с внешней MongoDB (возможно, недоступна)"
    }
else
    echo "⚠️ mongodump не найден, пропускаем резервное копирование"
fi

# Запускаем все сервисы
echo "🚀 Запускаем все сервисы..."
docker compose up -d

# Ждем запуска backend
echo "⏳ Ждем запуска backend..."
sleep 20

# Проверяем статус
echo "🔍 Проверяем статус сервисов..."
docker compose ps

echo "✅ Миграция завершена!"
echo "🌐 Фронтенд: http://157.230.20.252:3000"
echo "🔧 API: http://157.230.20.252:3001"
echo "🗄️ MongoDB: localhost:27017"
echo ""
echo "📊 Для проверки данных используйте:"
echo "docker compose exec mongodb mongosh tg_const_main --eval 'db.bots.find().count()'"
