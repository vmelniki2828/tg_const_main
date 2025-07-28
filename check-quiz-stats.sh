#!/bin/bash

echo "🔍 Проверка файла статистики квизов в реальном времени..."

# Проверить текущий файл статистики
echo "📊 Текущий файл статистики:"
if [ -f backend/quizStats.json ]; then
    echo "✅ Файл существует"
    echo "📄 Размер: $(ls -lh backend/quizStats.json | awk '{print $5}')"
    echo "📄 Содержимое:"
    cat backend/quizStats.json
else
    echo "❌ Файл не существует"
fi

echo ""
echo "🔄 Мониторинг изменений файла (Ctrl+C для остановки):"
echo "📊 Каждые 5 секунд проверяем файл..."

# Мониторинг файла
while true; do
    echo ""
    echo "⏰ $(date '+%H:%M:%S') - Проверка файла..."
    
    if [ -f backend/quizStats.json ]; then
        echo "📄 Размер: $(ls -lh backend/quizStats.json | awk '{print $5}')"
        echo "📄 Содержимое:"
        cat backend/quizStats.json
    else
        echo "❌ Файл не существует"
    fi
    
    echo "----------------------------------------"
    sleep 5
done 