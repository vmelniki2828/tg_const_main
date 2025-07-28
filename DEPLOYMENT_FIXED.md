# 🚀 Исправленное руководство по развертыванию

## ⚠️ Проблема была решена!

Ошибка `failed to read dockerfile: open Dockerfile: no such file or directory` была исправлена.

## ✅ Что было исправлено:

1. **Создан основной Dockerfile** для бэкенда
2. **Обновлена структура проекта** - фронтенд находится в папке `frontend/`
3. **Исправлены пути в docker-compose.prod.yml**
4. **Обновлен nginx.conf** для правильной работы
5. **Все компоненты уже обновлены** для использования конфигурации

## 🚀 Быстрое развертывание:

```bash
# 1. Клонировать репозиторий
git clone <your-repo-url>
cd tg_const_main

# 2. Создать .env файлы
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

# 3. Запустить развертывание
chmod +x deploy-prod.sh
./deploy-prod.sh
```

## 📁 Структура проекта:

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

## 🔧 Команды для проверки:

```bash
# Проверка контейнеров
docker-compose -f docker-compose.prod.yml ps

# Проверка API
curl http://95.164.119.96:3001/api/bots

# Проверка фронтенда
curl http://95.164.119.96:3000

# Логи
docker-compose -f docker-compose.prod.yml logs -f
```

## 🎯 Результат:

- **Фронтенд**: http://95.164.119.96:3000
- **API**: http://95.164.119.96:3001
- **Nginx**: http://95.164.119.96

## ⚠️ Важно:

1. **Замените** `your_bot_token_here` на ваш реальный Telegram Bot токен
2. **Убедитесь**, что порты 80, 3000, 3001 открыты
3. **Проверьте**, что Docker и Docker Compose установлены

## 🆘 Если проблемы:

```bash
# Очистить все
docker-compose -f docker-compose.prod.yml down
docker system prune -a -f

# Пересобрать
./deploy-prod.sh
```

Проект готов к развертыванию! 🎉 