# 🤖 Telegram Quiz Bot - Руководство по развертыванию

Интерактивный Telegram бот для создания и управления квизами с системой промокодов и статистики.

## 📋 Содержание

- [Требования](#-требования)
- [Быстрый старт](#-быстрый-старт)
- [Развертывание на сервере](#-развертывание-на-сервере)
- [Настройка Telegram Bot](#-настройка-telegram-bot)
- [Конфигурация](#-конфигурация)
- [Мониторинг](#-мониторинг)
- [Обновление](#-обновление)
- [Устранение неполадок](#-устранение-неполадок)

## 🛠 Требования

### Минимальные требования:
- **ОС**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: 2 GB
- **CPU**: 1 ядро
- **Диск**: 10 GB свободного места
- **Сеть**: Статический IP или домен

### Программное обеспечение:
- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Nginx** (опционально): 1.18+
- **Git**: 2.25+

## 🚀 Быстрый старт

### 1. Клонирование репозитория
```bash
git clone https://github.com/vmelniki2828/tg_const_main.git
cd tg_const_main
```

### 2. Настройка прав доступа
```bash
chmod +x deploy.sh
```

### 3. Запуск приложения
```bash
./deploy.sh
```

### 4. Проверка работы
```bash
curl http://localhost:3001/api/bots
```

## 🌐 Развертывание на сервере

### Вариант 1: Docker (Рекомендуется)

#### 1. Подготовка сервера
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER
```

#### 2. Развертывание приложения
```bash
# Клонирование проекта
git clone https://github.com/vmelniki2828/tg_const_main.git
cd tg_const_main

# Запуск
./deploy.sh
```

### Вариант 2: Ручная установка

#### 1. Установка Node.js
```bash
# Установка Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Проверка версии
node --version
npm --version
```

#### 2. Установка зависимостей
```bash
npm install
```

#### 3. Запуск приложения
```bash
npm start
```

### Вариант 3: С PM2 (Production)

#### 1. Установка PM2
```bash
npm install -g pm2
```

#### 2. Создание конфигурации PM2
```bash
# Создаем ecosystem.config.js
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'telegram-quiz-bot',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    }
  }]
}
EOF
```

#### 3. Запуск с PM2
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🤖 Настройка Telegram Bot

### 1. Создание бота в Telegram

1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям:
   - Введите имя бота
   - Введите username (должен заканчиваться на `bot`)
4. Сохраните полученный токен

### 2. Настройка вебхука (опционально)

```bash
# Установка вебхука (замените на ваш токен и домен)
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/webhook"}'
```

### 3. Добавление бота в приложение

1. Откройте веб-интерфейс: `http://your-server:3001`
2. Нажмите "Создать бота"
3. Введите имя и токен бота
4. Нажмите "Запустить бота"

## ⚙️ Конфигурация

### Переменные окружения

Создайте файл `.env` в корне проекта:

```env
# Основные настройки
NODE_ENV=production
PORT=3001

# Настройки безопасности
CORS_ORIGIN=https://your-domain.com

# Настройки файлов
MAX_FILE_SIZE=52428800
UPLOAD_PATH=./backend/uploads
PROMOCODES_PATH=./backend/promocodes

# Настройки логирования
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Настройка Nginx

1. Установите Nginx:
```bash
sudo apt install nginx
```

2. Скопируйте конфигурацию:
```bash
sudo cp nginx.conf /etc/nginx/sites-available/telegram-bot
sudo ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/
```

3. Отредактируйте конфигурацию:
```bash
sudo nano /etc/nginx/sites-available/telegram-bot
# Замените your-domain.com на ваш домен
```

4. Перезапустите Nginx:
```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Настройка SSL (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление
sudo crontab -e
# Добавьте строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Мониторинг

### Логи приложения

```bash
# Docker
docker-compose logs -f

# PM2
pm2 logs telegram-quiz-bot

# Ручная установка
tail -f logs/app.log
```

### Мониторинг ресурсов

```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats

# Статус PM2
pm2 status
pm2 monit
```

### Проверка здоровья приложения

```bash
# Проверка API
curl http://localhost:3001/api/bots

# Проверка с помощью health check
curl http://localhost:3001/health
```

## 🔄 Обновление

### Обновление с Docker

```bash
# Остановка приложения
docker-compose down

# Получение обновлений
git pull origin main

# Пересборка и запуск
./deploy.sh
```

### Обновление с PM2

```bash
# Остановка приложения
pm2 stop telegram-quiz-bot

# Получение обновлений
git pull origin main

# Установка зависимостей
npm install

# Запуск приложения
pm2 start ecosystem.config.js
pm2 save
```

## 🔧 Устранение неполадок

### Частые проблемы

#### 1. Порт 3001 занят
```bash
# Поиск процесса
sudo lsof -i :3001

# Остановка процесса
sudo kill -9 <PID>
```

#### 2. Проблемы с правами доступа
```bash
# Установка прав на директории
sudo chown -R $USER:$USER backend/uploads backend/promocodes
chmod 755 backend/uploads backend/promocodes
```

#### 3. Проблемы с Docker
```bash
# Очистка Docker
docker system prune -a

# Перезапуск Docker
sudo systemctl restart docker
```

#### 4. Проблемы с Telegram Bot
```bash
# Проверка токена
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"

# Удаление вебхука
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook"
```

### Логи ошибок

#### Docker логи
```bash
docker-compose logs --tail=100
```

#### Nginx логи
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

#### Системные логи
```bash
sudo journalctl -u docker.service -f
sudo journalctl -u nginx.service -f
```

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте логи приложения
2. Убедитесь, что все зависимости установлены
3. Проверьте настройки сети и файрвола
4. Создайте issue в репозитории проекта

## 📄 Лицензия

MIT License - см. файл [LICENSE](LICENSE) для подробностей.

---

**Удачного развертывания! 🚀**
