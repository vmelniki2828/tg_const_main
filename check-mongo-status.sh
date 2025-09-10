#!/bin/bash

echo "🔍 Проверка статуса MongoDB..."

# Проверяем, запущена ли MongoDB
if docker compose ps mongodb | grep -q "Up"; then
    echo "✅ MongoDB контейнер запущен"
else
    echo "❌ MongoDB контейнер не запущен"
    exit 1
fi

# Проверяем подключение к MongoDB
echo "🔌 Проверяем подключение к MongoDB..."
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')" || {
    echo "❌ Не удается подключиться к MongoDB"
    exit 1
}

echo "✅ Подключение к MongoDB успешно!"

# Показываем статистику коллекций
echo "📊 Статистика коллекций:"
docker compose exec mongodb mongosh tg_const_main --eval "
print('📈 Статистика базы данных tg_const_main:');
print('=====================================');
print('Боты:', db.bots.countDocuments());
print('Пользователи:', db.users.countDocuments());
print('Статистика квизов:', db.quizstats.countDocuments());
print('Промокоды:', db.promocodes.countDocuments());
print('Лояльность:', db.loyalties.countDocuments());
print('Конфигурации лояльности:', db.loyaltyconfigs.countDocuments());
print('Промокоды лояльности:', db.loyaltypromocodes.countDocuments());
"

# Показываем последние боты
echo "🤖 Последние боты:"
docker compose exec mongodb mongosh tg_const_main --eval "
db.bots.find({}, {name: 1, id: 1, isActive: 1, createdAt: 1}).sort({createdAt: -1}).limit(5).forEach(function(bot) {
    print('  - ' + bot.name + ' (ID: ' + bot.id + ', Активен: ' + bot.isActive + ')');
});
"

echo "✅ Проверка завершена!"
