#!/bin/bash

# Скрипт для очистки дискового пространства на сервере
# Использование: ./cleanup-disk-space.sh

set -e

echo "🧹 Начинаем очистку дискового пространства..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для вывода с цветом
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверка использования диска
print_status "Проверка использования диска..."
df -h

echo ""
print_status "Начинаем очистку..."

# 1. Остановка контейнеров (если нужно)
print_status "Остановка Docker контейнеров..."
docker-compose down 2>/dev/null || true

# 2. Очистка Docker
print_status "Очистка Docker образов, контейнеров и кэша..."
docker system prune -af --volumes 2>/dev/null || true
docker volume prune -f 2>/dev/null || true

# 3. Очистка старых Docker образов (старше 7 дней)
print_status "Удаление старых Docker образов..."
docker image prune -af --filter "until=168h" 2>/dev/null || true

# 4. Очистка временных файлов в uploads
print_status "Очистка старых файлов в uploads (старше 7 дней)..."
if [ -d "backend/uploads" ]; then
    find backend/uploads -type f -mtime +7 -delete 2>/dev/null || true
    print_success "Очищены старые файлы из uploads"
fi

# 5. Очистка временных кадров видео рулетки
print_status "Очистка временных кадров видео рулетки..."
if [ -d "backend/uploads/roulette_frames" ]; then
    rm -rf backend/uploads/roulette_frames/* 2>/dev/null || true
    print_success "Очищены временные кадры видео"
fi

# 6. Очистка старых видео рулетки (старше 1 дня)
print_status "Очистка старых видео рулетки (старше 1 дня)..."
if [ -d "backend/uploads" ]; then
    find backend/uploads -name "roulette_*.mp4" -type f -mtime +1 -delete 2>/dev/null || true
    find backend/uploads -name "*_temp.mp4" -type f -delete 2>/dev/null || true
    print_success "Очищены старые видео"
fi

# 7. Очистка логов
print_status "Очистка логов..."
find . -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
docker-compose logs --tail=0 2>/dev/null || true

# 8. Очистка node_modules (если не в Docker)
print_status "Проверка node_modules..."
if [ -d "node_modules" ] && [ ! -f ".dockerignore" ]; then
    print_warning "Найдены node_modules вне Docker. Удаление..."
    rm -rf node_modules frontend/node_modules backend/node_modules 2>/dev/null || true
fi

# 9. Очистка Git объектов (если нужно)
print_status "Очистка Git мусора..."
if [ -d ".git" ]; then
    git gc --prune=now --aggressive 2>/dev/null || true
    print_success "Git очищен"
fi

# 10. Очистка кэша npm (если есть)
print_status "Очистка npm кэша..."
npm cache clean --force 2>/dev/null || true

# 11. Очистка временных файлов системы
print_status "Очистка системных временных файлов..."
rm -rf /tmp/* 2>/dev/null || true
rm -rf /var/tmp/* 2>/dev/null || true

# 12. Очистка старых промокодов (опционально, будьте осторожны!)
print_status "Проверка старых промокодов..."
if [ -d "backend/promocodes" ]; then
    # Удаляем только очень старые файлы (старше 30 дней)
    find backend/promocodes -type f -mtime +30 -delete 2>/dev/null || true
    print_success "Очищены очень старые файлы промокодов"
fi

# Финальная проверка
echo ""
print_status "Финальная проверка использования диска..."
df -h

echo ""
print_success "Очистка завершена!"

# Показываем размер основных директорий
echo ""
print_status "Размер основных директорий:"
du -sh backend/uploads 2>/dev/null || echo "  uploads: недоступно"
du -sh backend/promocodes 2>/dev/null || echo "  promocodes: недоступно"
du -sh .git 2>/dev/null || echo "  .git: недоступно"

echo ""
print_warning "Если места все еще недостаточно, проверьте:"
echo "  - docker system df (использование Docker)"
echo "  - du -sh * (размер директорий)"
echo "  - journalctl --vacuum-time=7d (логи системы, если доступно)"
