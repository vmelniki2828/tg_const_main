# 🚀 Руководство по развертыванию Telegram Quiz Bot

## 📋 Обзор

Это руководство поможет вам развернуть Telegram Quiz Bot на сервере `95.164.119.96` с использованием Docker и Docker Compose.

## 🎯 Цель развертывания

- **Фронтенд**: доступен на порту 3000 (http://95.164.119.96:3000)
- **Бэкенд**: доступен на порту 3001 (http://95.164.119.96:3001)
- **Nginx**: проксирует запросы на порту 80

## 📦 Предварительные требования

### На сервере должны быть установлены:

1. **Docker** (версия 20.10+)
2. **Docker Compose** (версия 2.0+)
3. **Git** (для клонирования репозитория)

### Установка Docker на Ubuntu/Debian:

```bash
# Обновляем пакеты
sudo apt update

# Устанавливаем необходимые пакеты
sudo apt install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Добавляем GPG ключ Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Добавляем репозиторий Docker
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Обновляем пакеты и устанавливаем Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Добавляем пользователя в группу docker
sudo usermod -aG docker $USER

# Запускаем Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### Установка Docker Compose:

```bash
# Устанавливаем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## 🔧 Настройка проекта

### 1. Клонирование репозитория

```bash
# Клонируем проект
git clone <your-repository-url>
cd tg_const_main

# Делаем скрипт развертывания исполняемым
chmod +x deploy-prod.sh
```

### 2. Настройка переменных окружения

Создайте файл `.env` в корне проекта:

```bash
# Создаем .env файл
cat > .env << EOF
# Настройки окружения для продакшена
NODE_ENV=production

# Настройки сервера
PORT=3001
HOST=0.0.0.0

# Настройки фронтенда
REACT_APP_API_URL=http://95.164.96:3001
REACT_APP_FRONTEND_URL=http://95.164.119.96:3000

# Настройки Telegram Bot (ОБЯЗАТЕЛЬНО замените на ваш токен!)
TELEGRAM_BOT_TOKEN=your_actual_bot_token_here

# Настройки безопасности
CORS_ORIGIN=http://95.164.119.96:3000
EOF
```

### 3. Настройка файрвола

```bash
# Открываем необходимые порты
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 3001/tcp  # Backend

# Включаем файрвол
sudo ufw enable
```

## 🚀 Развертывание

### Автоматическое развертывание

```bash
# Запускаем скрипт развертывания
./deploy-prod.sh
```

### Ручное развертывание

```bash
# 1. Останавливаем существующие контейнеры
docker-compose -f docker-compose.prod.yml down

# 2. Удаляем старые образы
docker system prune -f

# 3. Собираем и запускаем контейнеры
docker-compose -f docker-compose.prod.yml up --build -d

# 4. Проверяем статус
docker-compose -f docker-compose.prod.yml ps
```

## ✅ Проверка развертывания

### 1. Проверка контейнеров

```bash
# Проверяем статус всех контейнеров
docker-compose -f docker-compose.prod.yml ps

# Должны быть запущены:
# - telegram-quiz-bot-backend
# - telegram-quiz-bot-frontend  
# - telegram-quiz-bot-nginx
```

### 2. Проверка доступности сервисов

```bash
# Проверяем API
curl http://95.164.119.96:3001/api/bots

# Проверяем фронтенд
curl http://95.164.119.96:3000

# Проверяем через nginx
curl http://95.164.119.96
```

### 3. Проверка логов

```bash
# Логи всех сервисов
docker-compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend
docker-compose -f docker-compose.prod.yml logs -f nginx
```

## 🔧 Управление приложением

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
# Останавливаем контейнеры
docker-compose -f docker-compose.prod.yml down

# Удаляем старые образы
docker system prune -f

# Пересобираем и запускаем
docker-compose -f docker-compose.prod.yml up --build -d
```

### Просмотр логов

```bash
# Все логи
docker-compose -f docker-compose.prod.yml logs -f

# Логи конкретного сервиса
docker-compose -f docker-compose.prod.yml logs -f backend
```

## 🛠️ Устранение неполадок

### Проблема: Контейнеры не запускаются

```bash
# Проверяем логи
docker-compose -f docker-compose.prod.yml logs

# Проверяем статус Docker
sudo systemctl status docker

# Перезапускаем Docker
sudo systemctl restart docker
```

### Проблема: Порт занят

```bash
# Проверяем какие процессы используют порты
sudo netstat -tulpn | grep :3000
sudo netstat -tulpn | grep :3001
sudo netstat -tulpn | grep :80

# Останавливаем процессы если нужно
sudo kill -9 <PID>
```

### Проблема: Файрвол блокирует доступ

```bash
# Проверяем статус файрвола
sudo ufw status

# Открываем порты если нужно
sudo ufw allow 3000/tcp
sudo ufw allow 3001/tcp
sudo ufw allow 80/tcp
```

### Проблема: Недостаточно места на диске

```bash
# Очищаем неиспользуемые Docker ресурсы
docker system prune -a -f

# Проверяем использование диска
df -h
```

## 🔒 Безопасность

### 1. Настройка SSL (HTTPS)

Для продакшена рекомендуется настроить SSL сертификат:

```bash
# Устанавливаем Certbot
sudo apt install certbot python3-certbot-nginx

# Получаем SSL сертификат
sudo certbot --nginx -d your-domain.com
```

### 2. Настройка файрвола

```bash
# Настраиваем файрвол
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 3. Регулярные обновления

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Обновляем Docker образы
docker-compose -f docker-compose.prod.yml pull
```

## 📊 Мониторинг

### Проверка ресурсов

```bash
# Использование CPU и памяти
docker stats

# Использование диска
df -h

# Логи системы
journalctl -f
```

### Автоматический перезапуск

Контейнеры настроены на автоматический перезапуск при сбоях:

```yaml
restart: unless-stopped
```

## 📝 Полезные команды

```bash
# Просмотр всех контейнеров
docker ps -a

# Просмотр всех образов
docker images

# Очистка неиспользуемых ресурсов
docker system prune -a -f

# Просмотр использования ресурсов
docker stats

# Вход в контейнер
docker exec -it telegram-quiz-bot-backend sh
```

## 🆘 Поддержка

Если у вас возникли проблемы:

1. Проверьте логи: `docker-compose -f docker-compose.prod.yml logs -f`
2. Убедитесь, что все порты открыты
3. Проверьте, что .env файл настроен правильно
4. Убедитесь, что Telegram Bot токен указан верно

## 🎉 Готово!

После успешного развертывания ваше приложение будет доступно по адресам:

- **Фронтенд**: http://95.164.119.96:3000
- **API**: http://95.164.119.96:3001
- **Через Nginx**: http://95.164.119.96

Не забудьте настроить ваш Telegram Bot и добавить токен в .env файл! 