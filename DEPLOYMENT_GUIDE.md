# 🚀 Руководство по деплою проекта

## 📋 Варианты деплоя

### 1. Полная очистка и деплой (Рекомендуется для первого раза)

```bash
./clean-and-deploy.sh
```

**Что делает этот скрипт:**
- ✅ Очищает все Docker контейнеры и образы
- ✅ Удаляет node_modules и кэш
- ✅ Очищает временные файлы
- ✅ Сохраняет важные файлы (editorState.json, quizStats.json, .env)
- ✅ Отправляет изменения в Git
- ✅ Полностью пересобирает проект на сервере
- ✅ Восстанавливает важные файлы
- ✅ Устанавливает зависимости локально

### 2. Быстрый деплой (Для обычных обновлений)

```bash
./quick-deploy.sh
```

**Что делает этот скрипт:**
- ✅ Добавляет изменения в Git
- ✅ Отправляет на сервер
- ✅ Перезапускает контейнеры на сервере

## 🔧 Ручной деплой

### Локальные команды:

```bash
# 1. Добавить изменения в Git
git add .

# 2. Создать коммит
git commit -m "Описание изменений"

# 3. Отправить на сервер
git push origin main
```

### Команды на сервере:

```bash
# 1. Подключиться к серверу
ssh root@95.164.119.96

# 2. Перейти в директорию проекта
cd /opt/tg_const_main

# 3. Получить последние изменения
git pull origin main

# 4. Остановить контейнеры
docker-compose -f docker-compose.yml down

# 5. Пересобрать и запустить
docker-compose -f docker-compose.yml up --build -d

# 6. Проверить статус
docker-compose -f docker-compose.yml ps
```

## 🧹 Полная очистка на сервере

Если нужно полностью очистить сервер:

```bash
ssh root@95.164.119.96

cd /opt/tg_const_main

# Остановка всех контейнеров
docker-compose -f docker-compose.yml down --remove-orphans

# Удаление всех контейнеров проекта
docker rm -f $(docker ps -aq --filter "name=telegram-quiz-bot")

# Удаление всех образов проекта
docker rmi -f $(docker images -q --filter "reference=tg_const_main*")

# Очистка системы Docker
docker system prune -f

# Получение свежей версии
git pull origin main

# Пересборка
docker-compose -f docker-compose.yml up --build -d
```

## 📊 Проверка статуса

### Проверить статус контейнеров:
```bash
ssh root@95.164.119.96 'cd /opt/tg_const_main && docker-compose -f docker-compose.yml ps'
```

### Посмотреть логи:
```bash
ssh root@95.164.119.96 'cd /opt/tg_const_main && docker-compose -f docker-compose.yml logs -f'
```

### Проверить доступность сервисов:
```bash
# API
curl http://95.164.119.96:3001/api/bots

# Фронтенд
curl http://95.164.119.96:3000
```

## 🌐 Доступные сервисы

После успешного деплоя:

- **📱 Фронтенд**: http://95.164.119.96:3000
- **🔧 API**: http://95.164.119.96:3001

## ⚠️ Важные замечания

1. **Сохранение данных**: Скрипт автоматически сохраняет важные файлы:
   - `backend/editorState.json` - состояние редактора
   - `backend/quizStats.json` - статистика квизов
   - `.env` - переменные окружения

2. **Telegram Bot Token**: Убедитесь, что в `.env` файле указан правильный токен бота

3. **Порты**: Убедитесь, что порты 3000 и 3001 открыты на сервере

4. **Права доступа**: Скрипты должны быть исполняемыми:
   ```bash
   chmod +x clean-and-deploy.sh
   chmod +x quick-deploy.sh
   ```

## 🚨 Устранение проблем

### Если деплой не работает:

1. **Проверьте подключение к серверу:**
   ```bash
   ssh root@95.164.119.96
   ```

2. **Проверьте статус Docker:**
   ```bash
   docker --version
   docker-compose --version
   ```

3. **Проверьте логи:**
   ```bash
   ssh root@95.164.119.96 'cd /opt/tg_const_main && docker-compose -f docker-compose.yml logs'
   ```

4. **Принудительная пересборка:**
   ```bash
   ssh root@95.164.119.96 'cd /opt/tg_const_main && docker-compose -f docker-compose.yml down && docker system prune -f && docker-compose -f docker-compose.yml up --build -d'
   ```

## 📝 Примеры использования

### Первый деплой:
```bash
./clean-and-deploy.sh
```

### Обычное обновление:
```bash
./quick-deploy.sh
```

### Только отправка изменений:
```bash
git add . && git commit -m "Обновление" && git push origin main
```

---

**Готово к деплою! 🚀** 