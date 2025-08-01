#!/bin/bash

# Скрипт для полной очистки проекта и загрузки на сервер
# Использование: ./clean-and-deploy.sh

set -e

echo "🧹 Начинаем полную очистку проекта и загрузку на сервер..."

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

# 1. Очистка локального проекта
print_status "Очистка локального проекта..."

# Остановка всех контейнеров Docker
print_status "Остановка Docker контейнеров..."
docker-compose down --remove-orphans 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=telegram-quiz-bot") 2>/dev/null || true
docker rmi -f $(docker images -q --filter "reference=tg_const_main*") 2>/dev/null || true
docker system prune -f

# Очистка node_modules
print_status "Удаление node_modules..."
rm -rf node_modules
rm -rf frontend/node_modules
rm -rf backend/node_modules

# Очистка кэша
print_status "Очистка кэша..."
rm -rf .cache
rm -rf frontend/.cache
rm -rf backend/.cache

# Очистка временных файлов
print_status "Очистка временных файлов..."
find . -name "*.log" -type f -delete
find . -name "*.tmp" -type f -delete
find . -name ".DS_Store" -type f -delete

# Очистка загрузок
print_status "Очистка загрузок..."
rm -rf backend/uploads/*
rm -rf backend/promocodes/*
rm -rf backend/backups/*

# Сохранение важных файлов
print_status "Сохранение важных файлов..."
mkdir -p temp_backup
cp backend/editorState.json temp_backup/ 2>/dev/null || true
cp backend/quizStats.json temp_backup/ 2>/dev/null || true
cp .env temp_backup/ 2>/dev/null || true

# 2. Git операции
print_status "Подготовка Git репозитория..."

# Проверка статуса Git
if [ -d ".git" ]; then
    print_status "Проверка статуса Git..."
    git status
    
    # Добавление всех изменений
    print_status "Добавление изменений в Git..."
    git add .
    
    # Создание коммита
    COMMIT_MESSAGE="Полная очистка и обновление проекта $(date '+%Y-%m-%d %H:%M:%S')"
    print_status "Создание коммита: $COMMIT_MESSAGE"
    git commit -m "$COMMIT_MESSAGE"
    
    # Отправка на сервер
    print_status "Отправка изменений на сервер..."
    git push origin main
    
    print_success "Git операции завершены!"
else
    print_error "Git репозиторий не найден!"
    exit 1
fi

# 3. Очистка на сервере
print_status "Подключение к серверу и очистка..."

# Команды для выполнения на сервере
SERVER_COMMANDS="
echo '🧹 Начинаем очистку на сервере...'
cd /opt/tg_const_main

echo '📥 Получение последних изменений...'
git pull origin main

echo '🛑 Остановка всех контейнеров...'
docker-compose -f docker-compose.yml down --remove-orphans 2>/dev/null || true

echo '🗑️ Удаление старых образов...'
docker rm -f \$(docker ps -aq --filter 'name=telegram-quiz-bot') 2>/dev/null || true
docker rmi -f \$(docker images -q --filter 'reference=tg_const_main*') 2>/dev/null || true
docker system prune -f

echo '🧹 Очистка временных файлов...'
find . -name '*.log' -type f -delete 2>/dev/null || true
find . -name '*.tmp' -type f -delete 2>/dev/null || true

echo '📦 Пересборка и запуск контейнеров...'
docker-compose -f docker-compose.yml up --build -d

echo '⏳ Ожидание запуска сервисов...'
sleep 20

echo '📊 Проверка статуса контейнеров...'
docker-compose -f docker-compose.yml ps

echo '🔍 Проверка доступности сервисов...'
if curl -f http://localhost:3001/api/bots > /dev/null 2>&1; then
    echo '✅ API доступен на порту 3001'
else
    echo '❌ API недоступен на порту 3001'
fi

if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo '✅ Фронтенд доступен на порту 3000'
else
    echo '❌ Фронтенд недоступен на порту 3000'
fi

echo '🎉 Очистка и развертывание завершены!'
"

# Выполнение команд на сервере
print_status "Выполнение команд на сервере..."
ssh root@95.164.119.96 "$SERVER_COMMANDS"

# 4. Восстановление важных файлов
print_status "Восстановление важных файлов..."
if [ -d "temp_backup" ]; then
    cp temp_backup/editorState.json backend/ 2>/dev/null || true
    cp temp_backup/quizStats.json backend/ 2>/dev/null || true
    cp temp_backup/.env . 2>/dev/null || true
    rm -rf temp_backup
fi

# 5. Установка зависимостей локально
print_status "Установка зависимостей локально..."
npm install
cd frontend && npm install && cd ..
cd backend && npm install && cd ..

print_success "Полная очистка и загрузка завершены!"
echo ""
echo "📋 Результат:"
echo "   ✅ Локальный проект очищен"
echo "   ✅ Изменения отправлены в Git"
echo "   ✅ Сервер обновлен и перезапущен"
echo "   ✅ Зависимости установлены"
echo ""
echo "🌐 Доступные сервисы:"
echo "   📱 Фронтенд: http://95.164.119.96:3000"
echo "   🔧 API: http://95.164.119.96:3001"
echo ""
echo "📊 Проверить статус:"
echo "   ssh root@95.164.119.96 'cd /opt/tg_const_main && docker-compose -f docker-compose.yml ps'"
echo ""
echo "📝 Посмотреть логи:"
echo "   ssh root@95.164.119.96 'cd /opt/tg_const_main && docker-compose -f docker-compose.yml logs -f'" 