#!/bin/bash

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔍 Проверка здоровья системы Telegram Quiz Bot на сервере 95.164.119.96${NC}"
echo "=================================================="

# Проверка Docker
echo -e "${YELLOW}🐳 Проверка Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker установлен${NC}"
    docker --version
else
    echo -e "${RED}❌ Docker не установлен${NC}"
    exit 1
fi

# Проверка Docker Compose
echo -e "${YELLOW}📦 Проверка Docker Compose...${NC}"
if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose установлен${NC}"
    docker-compose --version 2>/dev/null || docker compose version
else
    echo -e "${RED}❌ Docker Compose не установлен${NC}"
    exit 1
fi

# Проверка контейнеров
echo -e "${YELLOW}📊 Проверка контейнеров...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Контейнеры запущены${NC}"
    docker-compose ps
else
    echo -e "${RED}❌ Контейнеры не запущены${NC}"
    echo -e "${YELLOW}💡 Запустите: ./deploy.sh${NC}"
    exit 1
fi

# Проверка портов
echo -e "${YELLOW}🔌 Проверка портов...${NC}"
if netstat -tulpn 2>/dev/null | grep -q ":3000"; then
    echo -e "${GREEN}✅ Порт 3000 (фронтенд) открыт${NC}"
else
    echo -e "${RED}❌ Порт 3000 (фронтенд) не открыт${NC}"
fi

if netstat -tulpn 2>/dev/null | grep -q ":3001"; then
    echo -e "${GREEN}✅ Порт 3001 (backend) открыт${NC}"
else
    echo -e "${RED}❌ Порт 3001 (backend) не открыт${NC}"
fi

# Проверка API
echo -e "${YELLOW}🔧 Проверка API...${NC}"
if curl -s http://95.164.119.96:3001/api/bots > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API доступен${NC}"
    echo -e "${BLUE}📋 Ответ API:${NC}"
    curl -s http://95.164.119.96:3001/api/bots | python3 -m json.tool 2>/dev/null || curl -s http://95.164.119.96:3001/api/bots
else
    echo -e "${RED}❌ API недоступен${NC}"
fi

# Проверка фронтенда
echo -e "${YELLOW}🌐 Проверка фронтенда...${NC}"
if curl -s http://95.164.119.96:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Фронтенд доступен${NC}"
else
    echo -e "${RED}❌ Фронтенд недоступен${NC}"
fi

# Проверка дискового пространства
echo -e "${YELLOW}💾 Проверка дискового пространства...${NC}"
df -h . | tail -1 | awk '{print "Использовано: " $3 "/" $2 " (" $5 ")"}'

# Проверка использования памяти
echo -e "${YELLOW}🧠 Проверка использования памяти...${NC}"
free -h | grep Mem | awk '{print "Память: " $3 "/" $2}'

# Проверка логов на ошибки
echo -e "${YELLOW}📋 Проверка последних ошибок в логах...${NC}"
ERRORS=$(docker-compose logs --tail=50 2>/dev/null | grep -i "error\|exception\|failed" | wc -l)
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ Ошибок в логах не найдено${NC}"
else
    echo -e "${YELLOW}⚠️  Найдено $ERRORS потенциальных ошибок в логах${NC}"
    echo -e "${BLUE}📋 Последние ошибки:${NC}"
    docker-compose logs --tail=20 2>/dev/null | grep -i "error\|exception\|failed" | tail -5
fi

# Проверка файлов состояния
echo -e "${YELLOW}📁 Проверка файлов состояния...${NC}"
if [ -f "backend/state.json" ]; then
    echo -e "${GREEN}✅ state.json существует${NC}"
else
    echo -e "${RED}❌ state.json отсутствует${NC}"
fi

if [ -f "backend/quizStats.json" ]; then
    echo -e "${GREEN}✅ quizStats.json существует${NC}"
else
    echo -e "${RED}❌ quizStats.json отсутствует${NC}"
fi

if [ -f "backend/editorState.json" ]; then
    echo -e "${GREEN}✅ editorState.json существует${NC}"
else
    echo -e "${RED}❌ editorState.json отсутствует${NC}"
fi

# Проверка директорий
echo -e "${YELLOW}📂 Проверка директорий...${NC}"
if [ -d "backend/uploads" ]; then
    echo -e "${GREEN}✅ Директория uploads существует${NC}"
else
    echo -e "${RED}❌ Директория uploads отсутствует${NC}"
fi

if [ -d "backend/promocodes" ]; then
    echo -e "${GREEN}✅ Директория promocodes существует${NC}"
else
    echo -e "${RED}❌ Директория promocodes отсутствует${NC}"
fi

echo ""
echo -e "${BLUE}=================================================="
echo -e "${GREEN}✅ Проверка завершена!${NC}"
echo -e "${BLUE}🌐 Фронтенд: http://95.164.119.96:3000${NC}"
echo -e "${BLUE}🔧 API: http://95.164.119.96:3001${NC}"
echo -e "${BLUE}📝 Логи: docker-compose logs -f${NC}"
echo -e "${BLUE}==================================================" 