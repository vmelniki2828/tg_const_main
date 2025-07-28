# 🚀 Туториал развертывания на сервере (Frontend: 3000, Backend: 3001)

## 📋 Обзор архитектуры

- **Frontend (React)**: Порт 3000 - веб-интерфейс
- **Backend (Node.js)**: Порт 3001 - API сервер
- **Docker Compose**: Управление контейнерами

## 🔧 Подготовка сервера

### 1. Подключение к серверу
```bash
ssh root@95.164.119.96
```

### 2. Обновление системы
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Установка Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 4. Установка Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### 5. Установка Git
```bash
sudo apt install git -y
```

## 🚀 Развертывание приложения

### 1. Клонирование проекта
```bash
mkdir -p /opt/telegram-bot
cd /opt/telegram-bot
git clone https://github.com/vmelniki2828/tg_const_main.git .
```

### 2. Настройка прав
```bash
chmod +x deploy.sh
mkdir -p backend/uploads backend/promocodes logs
chmod 755 backend/uploads backend/promocodes
```

### 3. Создание файлов состояния
```bash
echo '{"bots":[],"activeBot":null}' > backend/state.json
echo '{}' > backend/quizStats.json
```

### 4. Запуск приложения
```bash
./deploy.sh
```

## 🔍 Проверка работы

### 1. Проверка контейнеров
```bash
docker-compose ps
```

Должны быть запущены:
- `telegram-quiz-bot-backend` (порт 3001)
- `telegram-quiz-bot-frontend` (порт 3000)

### 2. Проверка API
```bash
curl http://localhost:3001/api/bots
```

### 3. Проверка фронтенда
```bash
curl http://localhost:3000
```

### 4. Открытие в браузере
- **Фронтенд**: `http://95.164.119.96:3000`
- **API**: `http://95.164.119.96:3001/api/bots`

## 🔧 Управление приложением

### Основные команды:
```bash
# Статус контейнеров
docker-compose ps

# Логи всех сервисов
docker-compose logs -f

# Логи только бэкенда
docker-compose logs -f backend

# Логи только фронтенда
docker-compose logs -f frontend

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Обновление
git pull origin main
./deploy.sh
```

## 🛠️ Устранение неполадок

### Проблема: Порт 3000/3001 занят
```bash
# Проверка занятых портов
sudo lsof -i :3000
sudo lsof -i :3001

# Остановка процессов
sudo kill -9 <PID>
```

### Проблема: Контейнеры не запускаются
```bash
# Проверка логов
docker-compose logs

# Перезапуск Docker
sudo systemctl restart docker

# Очистка
docker system prune -a
```

### Проблема: Фронтенд не подключается к API
```bash
# Проверка CORS настроек
curl -H "Origin: http://localhost:3000" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS http://localhost:3001/api/bots
```

## 📊 Мониторинг

### Проверка здоровья:
```bash
# API работает?
curl http://localhost:3001/api/bots

# Фронтенд работает?
curl http://localhost:3000

# Контейнеры запущены?
docker-compose ps

# Логи без ошибок?
docker-compose logs --tail=20
```

### Полный перезапуск:
```bash
docker-compose down
sudo systemctl restart docker
./deploy.sh
```

## 🔐 Настройка файрвола

### Открытие портов:
```bash
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw enable
```

### Проверка статуса:
```bash
sudo ufw status
```

## 📝 Чек-лист развертывания

- [ ] Сервер подготовлен (Ubuntu 20.04+)
- [ ] Docker установлен и работает
- [ ] Docker Compose установлен
- [ ] Проект клонирован
- [ ] Файлы состояния созданы
- [ ] Приложение запущено (`./deploy.sh`)
- [ ] API отвечает (`curl http://localhost:3001/api/bots`)
- [ ] Фронтенд доступен (`curl http://localhost:3000`)
- [ ] Порт 3000 открыт в файрволе
- [ ] Порт 3001 открыт в файрволе
- [ ] Веб-интерфейс открывается в браузере

## 🎯 Быстрые команды

```bash
# Полный перезапуск
cd /opt/telegram-bot && ./deploy.sh

# Проверка статуса
docker-compose ps && curl http://localhost:3001/api/bots

# Просмотр логов
docker-compose logs -f

# Обновление кода
git pull origin main && ./deploy.sh
```

---

**🎉 Готово! Ваш бот работает на портах 3000 (фронт) и 3001 (бэк)!**

**Репозиторий:** https://github.com/vmelniki2828/tg_const_main 