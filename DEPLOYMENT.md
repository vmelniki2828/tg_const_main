# 🚀 Развертывание Telegram Quiz Bot

## 📋 Требования
- Ubuntu/Debian сервер
- Docker и Docker Compose
- Открытые порты: 80, 3000, 3001

## 🚀 Быстрое развертывание

### 1. Подготовка сервера
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Открытие портов
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw enable
```

### 2. Клонирование и настройка
```bash
# Клонирование проекта
git clone <your-repo-url>
cd tg_const_main

# Создание .env файлов
cat > .env << EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
TELEGRAM_BOT_TOKEN=your_bot_token_here
CORS_ORIGIN=http://95.164.119.96:3000
EOF

# Создание .env файла для фронтенда
cat > frontend/.env << EOF
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
EOF

# Делаем скрипт исполняемым
chmod +x deploy-prod-clean.sh
```

### 3. Развертывание
```bash
# Запуск развертывания
./deploy-prod-clean.sh

# Если фронтенд все еще использует localhost, пересоберите его:
docker-compose -f docker-compose.prod-clean.yml down
docker rmi tg_const_main-frontend
docker-compose -f docker-compose.prod-clean.yml up --build -d
```

## ✅ Проверка

```bash
# Проверка контейнеров
docker-compose -f docker-compose.prod-clean.yml ps

# Проверка API
curl http://95.164.119.96:3001/api/bots

# Проверка фронтенда
curl http://95.164.119.96:3000
```

## 🔧 Управление

```bash
# Остановка
docker-compose -f docker-compose.prod-clean.yml down

# Перезапуск
docker-compose -f docker-compose.prod-clean.yml restart

# Обновление
git pull
./deploy-prod-clean.sh
```

## ⚠️ Важно

1. **Замените** `your_bot_token_here` на ваш Telegram Bot токен
2. **Замените** `<your-repo-url>` на URL вашего репозитория
3. **Замените** `95.164.119.96` на IP вашего сервера

## 🔧 Исправление проблемы с localhost

Если фронтенд все еще отправляет запросы на localhost:

```bash
# Быстрое исправление
./fix-localhost.sh

# ИЛИ ручное исправление
docker-compose -f docker-compose.prod-clean.yml down
docker rmi tg_const_main-frontend
docker-compose -f docker-compose.prod-clean.yml up --build -d

# Проверить логи
docker logs $(docker ps -q --filter "name=frontend")
```

## 🎯 Результат

После успешного развертывания:
- **Фронтенд**: http://95.164.119.96:3000
- **API**: http://95.164.119.96:3001
- **Nginx**: http://95.164.119.96

---

**Проект готов к развертыванию! 🚀** 