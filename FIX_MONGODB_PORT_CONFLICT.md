# 🔧 Исправление конфликта портов MongoDB

## 🚨 Проблема
Порт 27017 уже занят внешней MongoDB, поэтому локальная MongoDB не может запуститься.

## ✅ Решение

### 1. Остановите внешнюю MongoDB
```bash
# На сервере выполните:
sudo systemctl stop mongod
# или
sudo service mongod stop
# или найдите процесс и остановите его
sudo pkill -f mongod
```

### 2. Запустите миграцию
```bash
cd /home/tg_const_main
./migrate-to-local-mongo-fixed.sh
```

### 3. Альтернативное решение (если не можете остановить внешнюю MongoDB)

#### Вариант A: Используйте другой порт
```bash
# Измените порт в docker-compose.yml на 27018
# (уже сделано в обновленном файле)

# Запустите миграцию
./migrate-to-local-mongo-fixed.sh
```

#### Вариант B: Остановите внешнюю MongoDB временно
```bash
# Найдите процесс MongoDB
ps aux | grep mongod

# Остановите его
sudo kill -9 <PID>

# Запустите миграцию
./migrate-to-local-mongo-fixed.sh
```

## 🔍 Проверка результата

### 1. Проверьте статус сервисов
```bash
docker compose ps
```

### 2. Проверьте MongoDB
```bash
# Локальная MongoDB (порт 27018)
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Проверьте количество ботов
docker compose exec mongodb mongosh tg_const_main --eval "db.bots.countDocuments()"
```

### 3. Проверьте API
```bash
curl -s http://157.230.20.252:3001/api/health
curl -s http://157.230.20.252:3001/api/bots
```

## 📊 Что изменилось

### Новые порты:
- **Локальная MongoDB:** 27018 (внешний) → 27017 (внутренний)
- **Внешняя MongoDB:** 27017 (остается без изменений)

### Преимущества:
- ✅ **Нет конфликта портов** - каждая MongoDB на своем порту
- ✅ **Плавная миграция** - внешняя MongoDB остается доступной
- ✅ **Возможность отката** - можно вернуться на внешнюю MongoDB

## 🔄 Откат на внешнюю MongoDB

Если нужно вернуться на внешнюю MongoDB:

1. **Остановите локальную MongoDB:**
```bash
docker compose down
```

2. **Запустите внешнюю MongoDB:**
```bash
sudo systemctl start mongod
```

3. **Измените MONGO_URI в docker-compose.yml:**
```yaml
- MONGO_URI=mongodb://157.230.20.252:27017/tg_const_main
```

4. **Запустите сервисы:**
```bash
docker compose up -d
```

## 🎯 Результат

После успешной миграции:
- ✅ **Локальная MongoDB** работает на порту 27018
- ✅ **Внешняя MongoDB** остается на порту 27017
- ✅ **Нет конфликтов** портов
- ✅ **Боты не исчезают** - данные в изолированном контейнере
