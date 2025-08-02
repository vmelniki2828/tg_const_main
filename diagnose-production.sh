#!/bin/bash

echo "🔍 Диагностика продакшн сервера..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SERVER_IP="95.164.119.96"
FRONTEND_PORT="3000"
BACKEND_PORT="3001"

echo -e "${BLUE}📊 Проверка доступности сервера...${NC}"

# Проверка ping
echo -e "${YELLOW}🔌 Ping сервера...${NC}"
if ping -c 3 $SERVER_IP > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Сервер отвечает на ping${NC}"
else
    echo -e "${RED}❌ Сервер не отвечает на ping${NC}"
    exit 1
fi

# Проверка портов
echo -e "${YELLOW}🔌 Проверка портов...${NC}"

# Проверка порта 3000 (фронтенд)
if nc -z -w5 $SERVER_IP $FRONTEND_PORT 2>/dev/null; then
    echo -e "${GREEN}✅ Порт $FRONTEND_PORT (фронтенд) открыт${NC}"
else
    echo -e "${RED}❌ Порт $FRONTEND_PORT (фронтенд) закрыт${NC}"
fi

# Проверка порта 3001 (backend)
if nc -z -w5 $SERVER_IP $BACKEND_PORT 2>/dev/null; then
    echo -e "${GREEN}✅ Порт $BACKEND_PORT (backend) открыт${NC}"
else
    echo -e "${RED}❌ Порт $BACKEND_PORT (backend) закрыт${NC}"
fi

# Проверка HTTP ответов
echo -e "${YELLOW}🌐 Проверка HTTP ответов...${NC}"

# Проверка фронтенда
echo -e "${BLUE}📱 Проверка фронтенда (http://$SERVER_IP:$FRONTEND_PORT)...${NC}"
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:$FRONTEND_PORT 2>/dev/null || echo "000")
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Фронтенд отвечает (HTTP $FRONTEND_RESPONSE)${NC}"
elif [ "$FRONTEND_RESPONSE" = "000" ]; then
    echo -e "${RED}❌ Фронтенд недоступен${NC}"
else
    echo -e "${YELLOW}⚠️  Фронтенд отвечает с кодом $FRONTEND_RESPONSE${NC}"
fi

# Проверка backend API
echo -e "${BLUE}🔧 Проверка backend API (http://$SERVER_IP:$BACKEND_PORT/api/bots)...${NC}"
BACKEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:$BACKEND_PORT/api/bots 2>/dev/null || echo "000")
if [ "$BACKEND_RESPONSE" = "200" ]; then
    echo -e "${GREEN}✅ Backend API отвечает (HTTP $BACKEND_RESPONSE)${NC}"
elif [ "$BACKEND_RESPONSE" = "000" ]; then
    echo -e "${RED}❌ Backend API недоступен${NC}"
else
    echo -e "${YELLOW}⚠️  Backend API отвечает с кодом $BACKEND_RESPONSE${NC}"
fi

# Проверка детального ответа API
echo -e "${BLUE}📋 Детальная проверка API...${NC}"
API_DETAILS=$(curl -s http://$SERVER_IP:$BACKEND_PORT/api/bots 2>/dev/null || echo "ERROR")
if [ "$API_DETAILS" != "ERROR" ]; then
    echo -e "${GREEN}✅ API возвращает данные:${NC}"
    echo "$API_DETAILS" | head -c 200
    echo "..."
else
    echo -e "${RED}❌ API не возвращает данные${NC}"
fi

echo ""
echo -e "${BLUE}📋 Рекомендации:${NC}"

if [ "$BACKEND_RESPONSE" = "000" ]; then
    echo -e "${YELLOW}💡 Backend сервер не запущен. Необходимо:${NC}"
    echo "   1. Подключиться к серверу по SSH"
    echo "   2. Перейти в директорию /opt/tg_const_main"
    echo "   3. Запустить: docker-compose up -d"
    echo "   4. Проверить логи: docker-compose logs"
fi

if [ "$FRONTEND_RESPONSE" = "000" ]; then
    echo -e "${YELLOW}💡 Frontend сервер не запущен. Необходимо:${NC}"
    echo "   1. Проверить статус контейнеров: docker-compose ps"
    echo "   2. Перезапустить: docker-compose restart"
fi

echo ""
echo -e "${BLUE}🔧 Команды для исправления:${NC}"
echo "ssh root@$SERVER_IP"
echo "cd /opt/tg_const_main"
echo "docker-compose down"
echo "docker-compose up -d"
echo "docker-compose logs" 