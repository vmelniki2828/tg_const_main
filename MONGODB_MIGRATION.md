# 🗄️ Миграция MongoDB в Docker Compose

## 📋 Обзор

MongoDB теперь интегрирована в Docker Compose для обеспечения стабильности и изоляции данных. Это решает проблему исчезновения ботов из базы данных.

## 🚀 Быстрый старт

### 1. Миграция на локальную MongoDB
```bash
./migrate-to-local-mongo.sh
```

### 2. Проверка статуса
```bash
./check-mongo-status.sh
```

## 🔧 Конфигурация

### MongoDB настройки:
- **Порт:** 27017
- **База данных:** tg_const_main
- **Пользователь:** app_user
- **Пароль:** app_password
- **Volume:** mongodb_data (постоянное хранение)

### Переменные окружения:
```bash
MONGO_URI=mongodb://app_user:app_password@mongodb:27017/tg_const_main?authSource=tg_const_main
```

## 📊 Преимущества

### ✅ Решенные проблемы:
1. **Исчезновение ботов** - данные теперь в изолированном контейнере
2. **Сетевые проблемы** - MongoDB в той же сети Docker
3. **Зависимости сервисов** - backend ждет запуска MongoDB
4. **Резервное копирование** - данные сохраняются в Docker volume

### 🛡️ Защита данных:
- **Автоматические индексы** при инициализации
- **Health checks** для MongoDB
- **Restart policy** для автоматического восстановления
- **Resource limits** для стабильности

## 🔍 Мониторинг

### Проверка статуса MongoDB:
```bash
# Статус контейнера
docker compose ps mongodb

# Подключение к MongoDB
docker compose exec mongodb mongosh

# Статистика коллекций
docker compose exec mongodb mongosh tg_const_main --eval "db.bots.countDocuments()"
```

### Логи MongoDB:
```bash
docker compose logs mongodb
```

## 🚨 Важные изменения

### 1. Обновлен docker-compose.yml:
- Добавлен сервис `mongodb`
- Обновлен `MONGO_URI` в backend
- Добавлена зависимость `depends_on`
- Создан volume `mongodb_data`

### 2. Обновлен код:
- `backend/server.js` - использует `process.env.MONGO_URI`
- `backend/botProcess.js` - использует `process.env.MONGO_URI`

### 3. Созданы скрипты:
- `migrate-to-local-mongo.sh` - миграция данных
- `check-mongo-status.sh` - проверка статуса
- `mongo-init/init-db.js` - инициализация БД

## 🔄 Откат на внешнюю MongoDB

Если нужно вернуться на внешнюю MongoDB:

1. Измените `MONGO_URI` в docker-compose.yml:
```yaml
- MONGO_URI=mongodb://157.230.20.252:27017/tg_const_main
```

2. Удалите зависимость от MongoDB:
```yaml
# Удалите секцию depends_on
```

3. Перезапустите сервисы:
```bash
docker compose up -d
```

## 📈 Производительность

### Resource limits:
- **MongoDB:** 1 CPU, 1GB RAM
- **Backend:** 2 CPU, 2GB RAM
- **Frontend:** 0.5 CPU, 512MB RAM

### Health checks:
- MongoDB проверяется каждые 30 секунд
- Backend проверяется каждые 30 секунд

## 🎯 Результат

Теперь ваши боты будут:
- ✅ **Стабильно работать** без исчезновения
- ✅ **Быстро загружаться** благодаря локальной БД
- ✅ **Автоматически восстанавливаться** при сбоях
- ✅ **Безопасно хранить данные** в изолированном контейнере
