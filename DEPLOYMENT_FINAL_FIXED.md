# 🚀 Финальное руководство по развертыванию (ИСПРАВЛЕНО)

## ✅ Все проблемы исправлены!

Исправлены ошибки:
- ✅ `failed to read dockerfile: open Dockerfile: no such file or directory`
- ✅ `failed to solve: failed to compute cache key: failed to calculate checksum of ref: "/nginx.conf": not found`
- ✅ `Error response from daemon: Conflict. The container name "/telegram-quiz-bot-backend" is already in use`
- ✅ **НОВОЕ**: Фронтенд не отвечает на запросы (проблема с nginx.conf)

## 🔧 Исправление проблемы с фронтендом

### Проблема
Фронтенд контейнер запускается, но не отвечает на запросы:
```
❌ Фронтенд недоступен на порту 3000
```

### Причина
`Dockerfile.frontend.simple` пытался скопировать `nginx.conf` из корня проекта, но этот файл предназначен для основного nginx, а не для фронтенда.

### Решение
Создан специальный `frontend/nginx.conf` для фронтенда с правильной конфигурацией.

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

cat > frontend/.env << EOF
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
EOF

# Делаем скрипт исполняемым
chmod +x deploy-prod-clean.sh
```

### 3. Развертывание
```bash
# Запуск развертывания (рекомендуется)
./deploy-prod-clean.sh

# ИЛИ использование оригинального скрипта
./deploy-prod.sh
```

## ✅ Проверка развертывания

```bash
# Проверка контейнеров
docker-compose -f docker-compose.prod-clean.yml ps

# Проверка API
curl http://95.164.119.96:3001/api/bots

# Проверка фронтенда
curl http://95.164.119.96:3000

# Проверка логов
docker-compose -f docker-compose.prod-clean.yml logs -f
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

## ⚠️ Важные замечания

1. **ОБЯЗАТЕЛЬНО** замените `your_bot_token_here` на ваш реальный Telegram Bot токен
2. Убедитесь, что порты 80, 3000, 3001 открыты в файрволе
3. Проверьте, что Docker и Docker Compose установлены на сервере
4. **ВАЖНО**: Теперь автоматически создается правильный `frontend/nginx.conf`

## 🆘 Устранение проблем

### Если фронтенд не отвечает:
```bash
# Проверить логи фронтенда
docker logs $(docker ps -q --filter "name=frontend")

# Пересобрать фронтенд
docker-compose -f docker-compose.prod-clean.yml down
docker rmi $(docker images -q --filter "reference=*frontend*")
./deploy-prod-clean.sh
```

### Если контейнеры не запускаются:
```bash
# Проверка логов
docker-compose -f docker-compose.prod-clean.yml logs

# Очистка и пересборка
docker-compose -f docker-compose.prod-clean.yml down
docker system prune -a -f
./deploy-prod-clean.sh
```

### Если порты заняты:
```bash
# Проверка процессов
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :80

# Остановка процессов если нужно
sudo kill -9 <PID>
```

## 📁 Структура проекта

```
tg_const_main/
├── backend/           # Бэкенд Node.js
├── frontend/          # Фронтенд React
│   ├── src/
│   │   ├── components/
│   │   └── config.js
│   ├── public/
│   └── nginx.conf     # Конфигурация nginx для фронтенда
├── Dockerfile         # Для бэкенда
├── Dockerfile.frontend.simple # Для фронтенда
├── docker-compose.prod.yml
├── docker-compose.prod-clean.yml
├── nginx.conf         # Конфигурация nginx для проксирования
├── deploy-prod.sh
└── deploy-prod-clean.sh
```

## 🎯 Результат

После успешного развертывания:

- **Фронтенд**: http://95.164.119.96:3000 ✅
- **API**: http://95.164.119.96:3001 ✅
- **Nginx**: http://95.164.119.96 ✅

## 🎉 Готово!

Проект полностью готов к развертыванию! Все проблемы исправлены, включая проблему с фронтендом.

---

**Проект готов к развертыванию! 🚀** 