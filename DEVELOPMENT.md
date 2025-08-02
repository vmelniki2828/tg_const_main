# 🚀 Руководство по разработке

## 📋 Быстрый старт

### Автоматический запуск (Рекомендуется)
```bash
./start-dev.sh
```

Этот скрипт автоматически:
- ✅ Устанавливает зависимости для backend и frontend
- ✅ Запускает backend сервер на порту 3001
- ✅ Запускает frontend сервер на порту 3000
- ✅ Проверяет работоспособность серверов

### Ручной запуск

#### 1. Backend сервер
```bash
cd backend
npm install
npm start
```

#### 2. Frontend сервер
```bash
cd frontend
npm install
npm start
```

## 🌐 Доступные URL

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001

## 🔧 Конфигурация

### Автоматическое определение окружения
Фронтенд автоматически определяет окружение:
- **Development**: `localhost` или `127.0.0.1` → Backend: `http://localhost:3001`
- **Production**: Другие домены → Backend: `http://95.164.119.96:3001`

### Ручная настройка
Измените `frontend/src/config.js` для ручной настройки API URL.

## 📊 Тестирование API

### Проверка работоспособности backend:
```bash
# Список ботов
curl http://localhost:3001/api/bots

# Статистика квизов
curl http://localhost:3001/api/quiz-stats

# Промокоды квиза
curl http://localhost:3001/api/quiz-promocodes/test-quiz
```

## 🐛 Отладка

### Логи backend:
```bash
cd backend
npm start
```

### Логи frontend:
```bash
cd frontend
npm start
```

### Проверка процессов:
```bash
# Список процессов Node.js
ps aux | grep node

# Остановка всех процессов разработки
pkill -f "nodemon\|react-scripts"
```

## 📁 Структура проекта

```
tg_const_main/
├── backend/           # Backend сервер (Node.js + Express)
│   ├── server.js     # Основной сервер
│   ├── botProcess.js # Логика Telegram ботов
│   └── package.json  # Зависимости backend
├── frontend/         # Frontend приложение (React)
│   ├── src/          # Исходный код
│   └── package.json  # Зависимости frontend
└── start-dev.sh      # Скрипт автоматического запуска
```

## 🔄 Обновление зависимостей

### Backend:
```bash
cd backend
npm update
```

### Frontend:
```bash
cd frontend
npm update
```

## 🚀 Деплой

Для деплоя на продакшн используйте:
```bash
./deploy.sh
```

Подробности в [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) 