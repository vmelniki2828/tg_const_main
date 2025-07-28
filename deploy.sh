#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Начинаем развертывание Telegram Quiz Bot на сервере 95.164.119.96...${NC}"

# Проверяем наличие Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker не установлен. Установите Docker и попробуйте снова.${NC}"
    exit 1
fi

# Проверяем наличие Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose не установлен. Установите Docker Compose и попробуйте снова.${NC}"
    exit 1
fi

# Останавливаем существующие контейнеры
echo -e "${YELLOW}🛑 Останавливаем существующие контейнеры...${NC}"
docker-compose down 2>/dev/null || docker compose down 2>/dev/null

# Удаляем старые образы
echo -e "${YELLOW}🧹 Очищаем старые образы...${NC}"
docker system prune -f

# Создаем необходимые директории и файлы
echo -e "${YELLOW}📁 Создаем необходимые директории...${NC}"
mkdir -p backend/uploads backend/promocodes

# Создаем файлы состояния если их нет
if [ ! -f "backend/state.json" ]; then
    echo '{"bots":[],"activeBot":null}' > backend/state.json
fi

if [ ! -f "backend/quizStats.json" ]; then
    echo '{}' > backend/quizStats.json
fi

if [ ! -f "backend/editorState.json" ]; then
    echo '{"blocks":[],"connections":[],"pan":{"x":0,"y":0},"scale":1}' > backend/editorState.json
fi

# Собираем и запускаем контейнеры
echo -e "${YELLOW}🔨 Собираем Docker образы...${NC}"
if docker-compose build --no-cache; then
    echo -e "${GREEN}✅ Образы успешно собраны${NC}"
else
    echo -e "${RED}❌ Ошибка при сборке образов${NC}"
    exit 1
fi

echo -e "${YELLOW}🚀 Запускаем контейнеры...${NC}"
if docker-compose up -d; then
    echo -e "${GREEN}✅ Контейнеры запущены${NC}"
else
    echo -e "${RED}❌ Ошибка при запуске контейнеров${NC}"
    exit 1
fi

# Ждем запуска приложения
echo -e "${YELLOW}⏳ Ждем запуска приложения...${NC}"
sleep 15

# Проверяем статус контейнеров
echo -e "${YELLOW}🔍 Проверяем статус контейнеров...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Приложение успешно запущено!${NC}"
else
    echo -e "${RED}❌ Ошибка: контейнеры не запустились${NC}"
    echo -e "${YELLOW}📋 Логи контейнеров:${NC}"
    docker-compose logs
    exit 1
fi

# Проверяем доступность API
echo -e "${YELLOW}🔍 Проверяем доступность API...${NC}"
for i in {1..30}; do
    if curl -s http://95.164.119.96:3001/api/bots > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API доступен${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ API недоступен после 30 попыток${NC}"
        exit 1
    fi
    sleep 2
done

# Проверяем доступность фронтенда
echo -e "${YELLOW}🔍 Проверяем доступность фронтенда...${NC}"
for i in {1..30}; do
    if curl -s http://95.164.119.96:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Фронтенд доступен${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ Фронтенд недоступен после 30 попыток${NC}"
        exit 1
    fi
    sleep 2
done

# Выводим информацию о развертывании
echo -e "${GREEN}📊 Статус контейнеров:${NC}"
docker-compose ps

echo -e "${GREEN}🌐 Фронтенд доступен по адресу: http://95.164.119.96:3000${NC}"
echo -e "${GREEN}🔧 API доступен по адресу: http://95.164.119.96:3001${NC}"
echo -e "${GREEN}📝 Логи можно посмотреть командой: docker-compose logs -f${NC}"
echo -e "${GREEN}🛑 Остановить приложение: docker-compose down${NC}"

echo -e "${GREEN}🎉 Развертывание завершено успешно!${NC}" 