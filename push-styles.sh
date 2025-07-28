#!/bin/bash

echo "🚀 Пуш стилизации кнопок на сервер..."

# Проверяем статус git
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Обнаружены изменения, коммитим..."
    
    # Добавляем все изменения
    git add .
    
    # Создаем коммит
    git commit -m "Исправлена стилизация блока кнопок - убран горизонтальный скролл - $(date)"
    
    # Пушим в репозиторий
    echo "📤 Отправляем изменения в репозиторий..."
    git push origin main
    
    echo "✅ Изменения отправлены в репозиторий!"
else
    echo "ℹ️ Нет изменений для коммита"
fi

# Обновляем на сервере
echo "🔄 Обновляем на сервере..."
ssh root@95.164.119.96 << 'EOF'
    cd /opt/tg_const_main
    echo "📥 Получаем последние изменения..."
    git pull origin main
    
    echo "🛑 Останавливаем контейнеры..."
    docker-compose -f docker-compose.yml down
    
    echo "🗑️ Удаляем старый образ фронтенда..."
    docker rmi tg_const_main-frontend 2>/dev/null || true
    
    echo "🔨 Пересобираем фронтенд..."
    docker-compose -f docker-compose.yml up --build -d
    
    echo "⏳ Ждем запуска..."
    sleep 15
    
    echo "📊 Проверяем статус..."
    docker-compose -f docker-compose.yml ps
    
    echo "✅ Обновление завершено!"
    echo "🌐 Проверьте: http://95.164.119.96:3000"
EOF

echo "🎉 Пуш стилей завершен!"
echo "🔗 Откройте: http://95.164.119.96:3000" 