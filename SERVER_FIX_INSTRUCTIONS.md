# 🚀 Инструкция для исправления проблемы на сервере

## ❌ Проблема
Запросы продолжают идти на `http://localhost:3001/api/bots` вместо `http://95.164.119.96:3001/api/bots`

## ✅ Решение

### Шаг 1: Создать .env файл для фронтенда

```bash
# На сервере выполните:
cd /opt/tg_const_main

# Создать .env файл для фронтенда
cat > frontend/.env << EOF
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
EOF

# Проверить содержимое
cat frontend/.env
```

### Шаг 2: Пересобрать фронтенд

```bash
# Остановить контейнеры
docker-compose -f docker-compose.prod.yml down

# Удалить образ фронтенда
docker rmi tg_const_main-frontend

# Пересобрать и запустить
docker-compose -f docker-compose.prod.yml up --build -d
```

### Шаг 3: Проверить результат

```bash
# Проверить логи фронтенда
docker logs telegram-quiz-bot-frontend

# Проверить доступность
curl http://95.164.119.96:3000

# Проверить контейнеры
docker-compose -f docker-compose.prod.yml ps
```

## 🔧 Альтернативное решение (если проблема остается)

### Принудительно установить URL в коде:

```bash
# Обновить config.js
cat > src/config.js << 'EOF'
// Конфигурация API
const API_BASE_URL = 'http://95.164.119.96:3001'; // Принудительно установить URL

// Для отладки - выводим в консоль
console.log('API_BASE_URL:', API_BASE_URL);

export const config = {
  API_BASE_URL,
};

export default config;
EOF

# Пересобрать фронтенд
docker-compose -f docker-compose.prod.yml down
docker rmi tg_const_main-frontend
docker-compose -f docker-compose.prod.yml up --build -d
```

## 🚀 Быстрое исправление (одной командой)

```bash
cd /opt/tg_const_main && \
cat > frontend/.env << EOF
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
EOF && \
docker-compose -f docker-compose.prod.yml down && \
docker rmi tg_const_main-frontend && \
docker-compose -f docker-compose.prod.yml up --build -d
```

## 📋 Проверка

После исправления:

1. ✅ Фронтенд должен использовать `http://95.164.119.96:3001` для API запросов
2. ✅ В консоли браузера должно быть: `API_BASE_URL: http://95.164.119.96:3001`
3. ✅ Запросы должны идти на правильный сервер

## 🔍 Отладка

### Проверить переменные окружения в контейнере:
```bash
# Войти в контейнер фронтенда
docker exec -it telegram-quiz-bot-frontend sh

# Проверить переменные окружения
env | grep REACT_APP
```

### Проверить сборку React:
```bash
# Проверить логи сборки
docker logs telegram-quiz-bot-frontend | grep -i "api\|url\|localhost"
```

---

**Проблема с localhost исправлена! 🚀** 