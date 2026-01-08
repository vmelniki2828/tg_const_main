#!/bin/bash

# Скрипт для проверки использования диска
# Показывает, что занимает больше всего места

echo "📊 Анализ использования диска..."
echo ""

# Общая информация
echo "=== Общее использование диска ==="
df -h /
echo ""

# Размер основных директорий
echo "=== Размер основных директорий ==="
if [ -d "/home/tg_const_main" ]; then
    cd /home/tg_const_main
    echo "Проект tg_const_main:"
    du -sh . 2>/dev/null || echo "  Недоступно"
    echo ""
    echo "Поддиректории:"
    du -sh */ 2>/dev/null | sort -hr | head -20
    echo ""
    echo "backend/uploads:"
    du -sh backend/uploads 2>/dev/null || echo "  Недоступно"
    echo ""
    echo "backend/promocodes:"
    du -sh backend/promocodes 2>/dev/null || echo "  Недоступно"
fi

echo ""
echo "=== Docker использование ==="
docker system df 2>/dev/null || echo "Docker недоступен"
echo ""

echo "=== Самые большие файлы (топ 20) ==="
if [ -d "/home/tg_const_main" ]; then
    find /home/tg_const_main -type f -size +100M -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}' | sort -hr | head -20
fi

echo ""
echo "=== Старые файлы в uploads (старше 7 дней) ==="
if [ -d "/home/tg_const_main/backend/uploads" ]; then
    find /home/tg_const_main/backend/uploads -type f -mtime +7 -ls 2>/dev/null | wc -l | xargs echo "Количество файлов:"
    find /home/tg_const_main/backend/uploads -type f -mtime +7 -exec du -ch {} + 2>/dev/null | tail -1
fi

echo ""
echo "=== Видео файлы рулетки ==="
if [ -d "/home/tg_const_main/backend/uploads" ]; then
    find /home/tg_const_main/backend/uploads -name "roulette_*.mp4" -type f -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}'
    find /home/tg_const_main/backend/uploads -name "*_temp.mp4" -type f -exec ls -lh {} \; 2>/dev/null | awk '{print $5, $9}'
fi

echo ""
echo "=== Временные кадры видео ==="
if [ -d "/home/tg_const_main/backend/uploads/roulette_frames" ]; then
    du -sh /home/tg_const_main/backend/uploads/roulette_frames 2>/dev/null
    find /home/tg_const_main/backend/uploads/roulette_frames -type f 2>/dev/null | wc -l | xargs echo "Количество файлов:"
fi

echo ""
echo "=== Git размер ==="
if [ -d "/home/tg_const_main/.git" ]; then
    du -sh /home/tg_const_main/.git 2>/dev/null
fi
