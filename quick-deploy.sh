#!/bin/bash

# Быстрый деплой на сервер
# Использование: ./quick-deploy.sh

set -e

echo "🚀 Быстрый деплой на сервер..."

# Цвета
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}[INFO]${NC} Подготовка к деплою..."

# Git операции
echo -e "${BLUE}[INFO]${NC} Добавление изменений в Git..."
git add .

echo -e "${BLUE}[INFO]${NC} Создание коммита..."
git commit -m "Обновление проекта $(date '+%Y-%m-%d %H:%M:%S')"

echo -e "${BLUE}[INFO]${NC} Отправка на сервер..."
git push origin main

# Деплой на сервер
echo -e "${BLUE}[INFO]${NC} Обновление на сервере..."
ssh root@95.164.119.96 "
cd /opt/tg_const_main
git pull origin main
docker-compose -f docker-compose.yml down
docker-compose -f docker-compose.yml up --build -d
sleep 10
docker-compose -f docker-compose.yml ps
"

echo -e "${GREEN}[SUCCESS]${NC} Деплой завершен!"
echo ""
echo "🌐 Доступные сервисы:"
echo "   📱 Фронтенд: http://95.164.119.96:3000"
echo "   🔧 API: http://95.164.119.96:3001" 