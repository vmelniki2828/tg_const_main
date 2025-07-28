# 🔧 Исправление проблемы с localhost на сервере

## ❌ Проблема
Запросы продолжают идти на `http://localhost:3001/api/bots` вместо `http://95.164.119.96:3001/api/bots`

## 🔍 Причина
Фронтенд не получает правильные переменные окружения из-за отсутствия файла `frontend/.env`

## ✅ Решение

### 1. Создать .env файл для фронтенда на сервере

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

### 2. Пересобрать фронтенд

```bash
# Остановить контейнеры
docker-compose -f docker-compose.prod.yml down

# Удалить образ фронтенда
docker rmi tg_const_main-frontend

# Пересобрать и запустить
docker-compose -f docker-compose.prod.yml up --build -d
```

### 3. Проверить переменные окружения

```bash
# Проверить логи фронтенда
docker logs telegram-quiz-bot-frontend

# Проверить доступность
curl http://95.164.119.96:3000
```

## 🔧 Альтернативное решение

Если проблема остается, можно принудительно установить URL в коде:

### Обновить config.js
```javascript
// Конфигурация API
const API_BASE_URL = 'http://95.164.119.96:3001'; // Принудительно установить URL

export const config = {
  API_BASE_URL,
};

export default config;
```

### Пересобрать фронтенд
```bash
docker-compose -f docker-compose.prod.yml down
docker rmi tg_const_main-frontend
docker-compose -f docker-compose.prod.yml up --build -d
```

## 🚀 Быстрое исправление

```bash
# 1. Создать .env файл
cat > frontend/.env << EOF
REACT_APP_API_URL=http://95.164.119.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000
EOF

# 2. Пересобрать фронтенд
docker-compose -f docker-compose.prod.yml down
docker rmi tg_const_main-frontend
docker-compose -f docker-compose.prod.yml up --build -d

# 3. Проверить
curl http://95.164.119.96:3000
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