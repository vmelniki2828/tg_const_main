# 🚀 Инструкции по миграции MongoDB на сервере

## 📋 Что нужно сделать на сервере

### 1. Подключитесь к серверу
```bash
ssh root@157.230.20.252
cd /home/tg_const_main
```

### 2. Остановите текущие сервисы
```bash
docker compose down
```

### 3. Запустите только MongoDB
```bash
docker compose up -d mongodb
```

### 4. Дождитесь запуска MongoDB (30 секунд)
```bash
# Проверьте статус
docker compose ps mongodb

# Проверьте логи
docker compose logs mongodb
```

### 5. Создайте резервную копию данных с внешней MongoDB
```bash
# Если mongodump доступен
mongodump --uri="mongodb://157.230.20.252:27017/tg_const_main" --out=./mongo-backup-$(date +%Y%m%d_%H%M%S)

# Или экспортируйте через API
curl -s http://157.230.20.252:3001/api/bots > bots-backup.json
```

### 6. Запустите все сервисы
```bash
docker compose up -d
```

### 7. Проверьте статус
```bash
# Статус всех сервисов
docker compose ps

# Проверка MongoDB
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Количество ботов в новой БД
docker compose exec mongodb mongosh tg_const_main --eval "db.bots.countDocuments()"
```

### 8. Проверьте работу API
```bash
# Проверка API
curl -s http://157.230.20.252:3001/api/bots

# Проверка здоровья
curl -s http://157.230.20.252:3001/api/health
```

## 🔧 Альтернативный способ (если есть проблемы)

### Если нужно сохранить данные с внешней MongoDB:

1. **Экспортируйте данные через API:**
```bash
# Боты
curl -s http://157.230.20.252:3001/api/bots > bots-backup.json

# Пользователи
curl -s http://157.230.20.252:3001/api/users > users-backup.json

# Статистика квизов
curl -s http://157.230.20.252:3001/api/quiz-stats > quiz-stats-backup.json
```

2. **После миграции восстановите данные:**
```bash
# Восстановление ботов (если нужно)
# Данные будут автоматически созданы при первом запуске
```

## 🚨 Важные моменты

### ✅ Преимущества новой конфигурации:
- **MongoDB в Docker** - изолированная и стабильная
- **Автоматические индексы** - оптимизированная производительность
- **Health checks** - автоматическое восстановление
- **Постоянное хранение** - данные не исчезнут

### ⚠️ Что изменилось:
- **MONGO_URI** теперь указывает на локальную MongoDB
- **Добавлена зависимость** backend от MongoDB
- **Создан volume** для постоянного хранения данных

### 🔍 Проверка успешности миграции:
```bash
# 1. MongoDB запущена
docker compose ps mongodb

# 2. Backend подключился к MongoDB
docker compose logs backend | grep "MongoDB connected"

# 3. API работает
curl -s http://157.230.20.252:3001/api/health

# 4. Боты доступны
curl -s http://157.230.20.252:3001/api/bots
```

## 📊 Мониторинг после миграции

### Ежедневные проверки:
```bash
# Статус сервисов
docker compose ps

# Логи MongoDB
docker compose logs mongodb --tail=50

# Статистика данных
docker compose exec mongodb mongosh tg_const_main --eval "
print('Боты:', db.bots.countDocuments());
print('Пользователи:', db.users.countDocuments());
print('Статистика квизов:', db.quizstats.countDocuments());
"
```

## 🎯 Результат

После успешной миграции:
- ✅ **Боты не будут исчезать** из базы данных
- ✅ **Повысится стабильность** системы
- ✅ **Улучшится производительность** (локальная БД)
- ✅ **Автоматическое восстановление** при сбоях
