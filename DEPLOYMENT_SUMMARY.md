# 📋 Сводка изменений для развертывания на продакшене

## 🎯 Цель
Подготовить проект для развертывания на сервере `95.164.119.96` с:
- Фронтендом на порту 3000
- Бэкендом на порту 3001
- Исправлением всех ссылок на localhost

## ✅ Выполненные изменения

### 1. Конфигурация окружения
- ✅ Создан `env.example` с настройками для разработки и продакшена
- ✅ Добавлена зависимость `dotenv` в `package.json`
- ✅ Обновлен `backend/server.js` для использования переменных окружения
- ✅ Создан `src/config.js` для централизованной конфигурации API

### 2. Исправление ссылок на localhost
- ✅ Обновлен `src/components/App.jsx` - все API вызовы используют конфигурацию
- ✅ Обновлен `src/components/BotsList.jsx` - исправлены все fetch запросы
- ✅ Обновлен `src/components/QuizStats.jsx` - исправлены API вызовы
- ✅ Обновлен `src/components/QuizBlock.jsx` - исправлены ссылки на медиафайлы
- ✅ Обновлен `src/components/PromoCodeUploader.jsx` - исправлены API вызовы
- ✅ Обновлен `src/components/FlowEditor.jsx` - исправлены все fetch запросы
- ✅ Обновлен `src/components/DialogChainEditor.jsx` - исправлены API вызовы
- ✅ Обновлен `src/components/TelegramForm.jsx` - исправлены API вызовы

### 3. Docker конфигурация
- ✅ Создан `docker-compose.prod.yml` для продакшена
- ✅ Создан `Dockerfile.frontend` для фронтенда
- ✅ Обновлен `nginx.conf` для продакшена
- ✅ Обновлен основной `Dockerfile` для бэкенда

### 4. Скрипты развертывания
- ✅ Создан `deploy-prod.sh` - автоматический скрипт развертывания
- ✅ Создан `DEPLOYMENT_GUIDE.md` - полное руководство
- ✅ Создан `DEPLOYMENT_CHECKLIST.md` - чек-лист
- ✅ Создан `QUICK_START.md` - быстрый старт

## 🔧 Конфигурация для продакшена

### Переменные окружения (.env)
```bash
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
TELEGRAM_BOT_TOKEN=your_bot_token_here
CORS_ORIGIN=http://95.164.119.96:3000
```

### Docker Compose (docker-compose.prod.yml)
- **Backend**: порт 3001
- **Frontend**: порт 3000  
- **Nginx**: порт 80
- Автоматический перезапуск при сбоях
- Тома для сохранения данных

## 🚀 Команды для развертывания

### Быстрое развертывание
```bash
# 1. Клонировать репозиторий
git clone <your-repo-url>
cd tg_const_main

# 2. Создать .env файл
cat > .env << EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
TELEGRAM_BOT_TOKEN=your_bot_token_here
CORS_ORIGIN=http://95.164.119.96:3000
EOF

# 3. Запустить развертывание
chmod +x deploy-prod.sh
./deploy-prod.sh
```

### Ручное развертывание
```bash
# Остановить существующие контейнеры
docker-compose -f docker-compose.prod.yml down

# Удалить старые образы
docker system prune -f

# Собрать и запустить
docker-compose -f docker-compose.prod.yml up --build -d

# Проверить статус
docker-compose -f docker-compose.prod.yml ps
```

## ✅ Проверка развертывания

### Проверка контейнеров
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Проверка доступности
```bash
# API
curl http://95.164.119.96:3001/api/bots

# Фронтенд
curl http://95.164.119.96:3000

# Nginx
curl http://95.164.119.96
```

### Проверка логов
```bash
# Все логи
docker-compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f backend
```

## 🎯 Результат

После развертывания приложение будет доступно по адресам:

- **Фронтенд**: http://95.164.119.96:3000
- **API**: http://95.164.119.96:3001  
- **Nginx**: http://95.164.119.96

## 🔧 Управление

### Остановка
```bash
docker-compose -f docker-compose.prod.yml down
```

### Перезапуск
```bash
docker-compose -f docker-compose.prod.yml restart
```

### Обновление
```bash
git pull
./deploy-prod.sh
```

## ⚠️ Важные замечания

1. **Обязательно** замените `your_bot_token_here` на ваш реальный Telegram Bot токен
2. **Убедитесь**, что порты 80, 3000, 3001 открыты в файрволе
3. **Проверьте**, что у вас есть права на сервер
4. **Рекомендуется** настроить SSL сертификат для HTTPS

## 📖 Документация

- `DEPLOYMENT_GUIDE.md` - Полное руководство по развертыванию
- `DEPLOYMENT_CHECKLIST.md` - Чек-лист для проверки
- `QUICK_START.md` - Быстрый старт
- `DEPLOYMENT_TUTORIAL.md` - Оригинальный туториал

## 🎉 Готово!

Проект полностью подготовлен для развертывания на продакшене. Все ссылки на localhost исправлены, добавлена поддержка переменных окружения, созданы Docker конфигурации и скрипты автоматизации. 