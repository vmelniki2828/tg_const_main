# 🚀 Решение проблемы с конфликтом имен контейнеров

## ❌ Проблема
```
Error response from daemon: Conflict. The container name "/telegram-quiz-bot-backend" is already in use by container "0117895b92b4db73eb4e5274084afbccdf5aa8319837ba4b6cb40441891258fb". You have to remove (or rename) that container to be able to reuse that name.
```

## ✅ Решение

### Вариант 1: Использование нового скрипта (Рекомендуется)

```bash
# Используйте новый скрипт без фиксированных имен контейнеров
chmod +x deploy-prod-clean.sh
./deploy-prod-clean.sh
```

### Вариант 2: Ручная очистка

```bash
# Остановить все контейнеры
docker-compose -f docker-compose.prod.yml down

# Удалить конфликтующие контейнеры
docker rm -f telegram-quiz-bot-backend telegram-quiz-bot-frontend telegram-quiz-bot-nginx

# Удалить образы
docker rmi -f $(docker images -q --filter "reference=tg_const_main*")

# Очистить Docker
docker system prune -f

# Запустить заново
./deploy-prod.sh
```

### Вариант 3: Использование альтернативной конфигурации

```bash
# Использовать конфигурацию без фиксированных имен
docker-compose -f docker-compose.prod-clean.yml up --build -d
```

## 🔧 Команды для управления

### С новым скриптом:
```bash
# Остановка
docker-compose -f docker-compose.prod-clean.yml down

# Перезапуск
docker-compose -f docker-compose.prod-clean.yml restart

# Логи
docker-compose -f docker-compose.prod-clean.yml logs -f
```

### С оригинальным скриптом:
```bash
# Остановка
docker-compose -f docker-compose.prod.yml down

# Перезапуск
docker-compose -f docker-compose.prod.yml restart

# Логи
docker-compose -f docker-compose.prod.yml logs -f
```

## 📋 Различия между конфигурациями

### docker-compose.prod.yml (с фиксированными именами)
```yaml
services:
  backend:
    container_name: telegram-quiz-bot-backend
  frontend:
    container_name: telegram-quiz-bot-frontend
  nginx:
    container_name: telegram-quiz-bot-nginx
```

### docker-compose.prod-clean.yml (без фиксированных имен)
```yaml
services:
  backend: # Автоматическое имя
  frontend: # Автоматическое имя
  nginx: # Автоматическое имя
```

## 🎯 Рекомендация

Используйте `deploy-prod-clean.sh` для избежания конфликтов имен контейнеров. Этот скрипт:

1. ✅ Полностью очищает все существующие контейнеры
2. ✅ Удаляет конфликтующие образы
3. ✅ Использует конфигурацию без фиксированных имен
4. ✅ Автоматически копирует nginx.conf
5. ✅ Создает все необходимые .env файлы

## 🚀 Быстрый старт

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

# 3. Запустить развертывание
chmod +x deploy-prod-clean.sh
./deploy-prod-clean.sh
```

## 🎉 Результат

После успешного развертывания:

- **Фронтенд**: http://95.164.119.96:3000
- **API**: http://95.164.119.96:3001
- **Nginx**: http://95.164.119.96

---

**Проблема с конфликтом имен решена! 🚀** 