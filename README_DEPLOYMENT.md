# 🚀 Развертывание Telegram Quiz Bot на сервере

## ✅ Проблема решена!

Ошибка `failed to read dockerfile: open Dockerfile: no such file or directory` была исправлена.

## 🎯 Цель развертывания

- **Фронтенд**: http://95.164.119.96:3000
- **API**: http://95.164.119.96:3001
- **Nginx**: http://95.164.119.96

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
chmod +x deploy-prod.sh
```

### 3. Развертывание
```bash
# Запуск развертывания
./deploy-prod.sh
```

## ✅ Проверка развертывания

```bash
# Проверка контейнеров
docker-compose -f docker-compose.prod.yml ps

# Проверка API
curl http://95.164.119.96:3001/api/bots

# Проверка фронтенда
curl http://95.164.119.96:3000

# Проверка логов
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔧 Управление

```bash
# Остановка
docker-compose -f docker-compose.prod.yml down

# Перезапуск
docker-compose -f docker-compose.prod.yml restart

# Обновление
git pull
./deploy-prod.sh
```

## ⚠️ Важные замечания

1. **ОБЯЗАТЕЛЬНО** замените `your_bot_token_here` на ваш реальный Telegram Bot токен
2. Убедитесь, что порты 80, 3000, 3001 открыты в файрволе
3. Проверьте, что Docker и Docker Compose установлены на сервере

## 🆘 Устранение проблем

### Если контейнеры не запускаются:
```bash
# Проверка логов
docker-compose -f docker-compose.prod.yml logs

# Очистка и пересборка
docker-compose -f docker-compose.prod.yml down
docker system prune -a -f
./deploy-prod.sh
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
│   └── public/
├── Dockerfile         # Для бэкенда
├── Dockerfile.frontend # Для фронтенда
├── docker-compose.prod.yml
├── nginx.conf
└── deploy-prod.sh
```

## 🎉 Результат

После успешного развертывания:

- **Фронтенд**: http://95.164.119.96:3000
- **API**: http://95.164.119.96:3001
- **Nginx**: http://95.164.119.96

## 📖 Дополнительная документация

- `DEPLOYMENT_GUIDE.md` - Полное руководство
- `DEPLOYMENT_CHECKLIST.md` - Чек-лист
- `DEPLOYMENT_FIXED.md` - Исправления
- `QUICK_START.md` - Быстрый старт

---

**Проект полностью готов к развертыванию! 🚀** 