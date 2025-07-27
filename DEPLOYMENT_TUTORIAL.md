# 🚀 Туториал: Развертывание Telegram Quiz Bot на сервере

## 📋 Содержание

1. [Подготовка сервера](#-подготовка-сервера)
2. [Установка необходимого ПО](#-установка-необходимого-по)
3. [Клонирование проекта](#-клонирование-проекта)
4. [Настройка переменных окружения](#-настройка-переменных-окружения)
5. [Развертывание с Docker](#-развертывание-с-docker)
6. [Настройка домена и SSL](#-настройка-домена-и-ssl)
7. [Настройка Telegram Bot](#-настройка-telegram-bot)
8. [Мониторинг и обслуживание](#-мониторинг-и-обслуживание)
9. [Устранение неполадок](#-устранение-неполадок)

---

## 🖥️ Подготовка сервера

### **Требования к серверу:**
- **ОС**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM**: Минимум 2 GB (рекомендуется 4 GB)
- **CPU**: 1 ядро (рекомендуется 2 ядра)
- **Диск**: 10 GB свободного места
- **Сеть**: Статический IP или домен

### **Рекомендуемые провайдеры:**
- **DigitalOcean** - Droplet $5/месяц
- **Vultr** - Cloud Compute $2.50/месяц
- **Linode** - Nanode $5/месяц
- **AWS EC2** - t3.micro (бесплатный уровень)
- **Google Cloud** - e2-micro (бесплатный уровень)

---

## ⚙️ Установка необходимого ПО

### **1. Подключение к серверу**
```bash
# Подключение по SSH
ssh root@your-server-ip

# Обновление системы
sudo apt update && sudo apt upgrade -y
```

### **2. Установка Docker**
```bash
# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавление пользователя в группу docker
sudo usermod -aG docker $USER

# Перезагрузка сессии
exit
# Подключитесь снова
ssh root@your-server-ip
```

### **3. Установка Docker Compose**
```bash
# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Проверка установки
docker --version
docker-compose --version
```

### **4. Установка Git**
```bash
# Установка Git
sudo apt install git -y

# Настройка Git
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 📥 Клонирование проекта

### **1. Клонирование репозитория**
```bash
# Создание рабочей директории
mkdir -p /opt/telegram-bot
cd /opt/telegram-bot

# Клонирование проекта
git clone https://github.com/your-username/telegram-quiz-bot.git .
```

### **2. Настройка прав доступа**
```bash
# Установка прав на скрипт деплоя
chmod +x deploy.sh

# Создание необходимых директорий
mkdir -p backend/uploads backend/promocodes logs

# Установка прав на директории
chmod 755 backend/uploads backend/promocodes
```

### **3. Создание файлов состояния**
```bash
# Создание файла состояния ботов
echo '{"bots":[],"activeBot":null}' > backend/state.json

# Создание файла статистики квизов
echo '{}' > backend/quizStats.json
```

---

## 🔧 Настройка переменных окружения

### **1. Создание файла .env**
```bash
# Создание файла .env
cat > .env << 'EOF'
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
EOF
```

### **2. Редактирование .env**
```bash
# Редактирование файла .env
nano .env

# Замените your-domain.com на ваш домен
# Если домена нет, используйте IP сервера
```

---

## 🐳 Развертывание с Docker

### **Вариант 1: Автоматический деплой**
```bash
# Запуск автоматического деплоя
./deploy.sh

# Проверка статуса
docker-compose ps
```

### **Вариант 2: Ручной деплой**
```bash
# Сборка образа
docker-compose build --no-cache

# Запуск контейнеров
docker-compose up -d

# Проверка логов
docker-compose logs -f
```

### **3. Проверка работы**
```bash
# Проверка API
curl http://localhost:3001/api/bots

# Проверка статуса контейнеров
docker-compose ps

# Проверка использования ресурсов
docker stats
```

---

## 🌐 Настройка домена и SSL

### **1. Установка Nginx**
```bash
# Установка Nginx
sudo apt install nginx -y

# Запуск Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### **2. Настройка конфигурации Nginx**
```bash
# Копирование конфигурации
sudo cp nginx.conf /etc/nginx/sites-available/telegram-bot

# Редактирование конфигурации
sudo nano /etc/nginx/sites-available/telegram-bot

# Замените your-domain.com на ваш домен
```

### **3. Активация сайта**
```bash
# Создание символической ссылки
sudo ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/

# Удаление дефолтного сайта
sudo rm /etc/nginx/sites-enabled/default

# Проверка конфигурации
sudo nginx -t

# Перезапуск Nginx
sudo systemctl restart nginx
```

### **4. Настройка SSL (Let's Encrypt)**
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx -y

# Получение SSL сертификата
sudo certbot --nginx -d your-domain.com

# Автоматическое обновление сертификата
sudo crontab -e
# Добавьте строку:
# 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## 🤖 Настройка Telegram Bot

### **1. Создание бота в Telegram**
1. Найдите [@BotFather](https://t.me/botfather) в Telegram
2. Отправьте команду `/newbot`
3. Следуйте инструкциям:
   - Введите имя бота (например: "My Quiz Bot")
   - Введите username (например: `my_quiz_bot_bot`)
4. Сохраните полученный токен

### **2. Настройка вебхука (опционально)**
```bash
# Установка вебхука (замените на ваш токен и домен)
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-domain.com/api/webhook"}'
```

### **3. Добавление бота в приложение**
1. Откройте веб-интерфейс: `https://your-domain.com`
2. Нажмите "Создать бота"
3. Введите имя и токен бота
4. Нажмите "Запустить бота"

---

## 📊 Мониторинг и обслуживание

### **1. Просмотр логов**
```bash
# Логи приложения
docker-compose logs -f

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Системные логи
sudo journalctl -u docker.service -f
sudo journalctl -u nginx.service -f
```

### **2. Мониторинг ресурсов**
```bash
# Статус контейнеров
docker-compose ps

# Использование ресурсов
docker stats

# Использование диска
df -h

# Использование памяти
free -h
```

### **3. Обновление приложения**
```bash
# Остановка приложения
docker-compose down

# Получение обновлений
git pull origin main

# Пересборка и запуск
./deploy.sh
```

### **4. Резервное копирование**
```bash
# Создание бэкапа
mkdir -p /opt/backups
tar -czf /opt/backups/telegram-bot-$(date +%Y%m%d).tar.gz \
  backend/state.json \
  backend/quizStats.json \
  backend/uploads/ \
  backend/promocodes/

# Автоматические бэкапы (добавить в crontab)
sudo crontab -e
# Добавьте строку:
# 0 2 * * * tar -czf /opt/backups/telegram-bot-$(date +\%Y\%m\%d).tar.gz /opt/telegram-bot/backend/
```

---

## 🔧 Устранение неполадок

### **1. Проблемы с Docker**
```bash
# Перезапуск Docker
sudo systemctl restart docker

# Очистка Docker
docker system prune -a

# Проверка статуса
sudo systemctl status docker
```

### **2. Проблемы с портами**
```bash
# Проверка занятых портов
sudo lsof -i :3001
sudo lsof -i :80
sudo lsof -i :443

# Остановка процессов
sudo kill -9 <PID>
```

### **3. Проблемы с правами доступа**
```bash
# Установка прав на директории
sudo chown -R $USER:$USER /opt/telegram-bot
chmod 755 backend/uploads backend/promocodes

# Проверка прав
ls -la backend/
```

### **4. Проблемы с Telegram Bot**
```bash
# Проверка токена
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"

# Удаление вебхука
curl -X POST "https://api.telegram.org/bot<YOUR_TOKEN>/deleteWebhook"

# Проверка логов бота
docker-compose logs -f
```

### **5. Проблемы с SSL**
```bash
# Проверка сертификата
sudo certbot certificates

# Обновление сертификата
sudo certbot renew

# Проверка конфигурации Nginx
sudo nginx -t
```

---

## 🚀 Продвинутые настройки

### **1. Настройка файрвола**
```bash
# Установка UFW
sudo apt install ufw -y

# Настройка правил
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable

# Проверка статуса
sudo ufw status
```

### **2. Настройка мониторинга**
```bash
# Установка htop для мониторинга
sudo apt install htop -y

# Запуск мониторинга
htop
```

### **3. Настройка автозапуска**
```bash
# Создание systemd сервиса
sudo nano /etc/systemd/system/telegram-bot.service

# Содержимое файла:
[Unit]
Description=Telegram Quiz Bot
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/telegram-bot
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target

# Активация сервиса
sudo systemctl enable telegram-bot.service
sudo systemctl start telegram-bot.service
```

---

## 📞 Поддержка

### **Полезные команды:**
```bash
# Перезапуск всех сервисов
sudo systemctl restart docker nginx

# Проверка здоровья приложения
curl http://localhost:3001/api/bots

# Просмотр всех контейнеров
docker ps -a

# Очистка неиспользуемых ресурсов
docker system prune -a
```

### **Логи для диагностики:**
- **Приложение**: `docker-compose logs -f`
- **Nginx**: `sudo tail -f /var/log/nginx/error.log`
- **Система**: `sudo journalctl -f`

### **Контакты для поддержки:**
- Создайте issue в репозитории проекта
- Проверьте логи перед обращением
- Укажите версию Docker и ОС

---

## 🎉 Поздравляем!

Ваш Telegram Quiz Bot успешно развернут на сервере! 

### **Что у вас есть:**
- ✅ Работающий Telegram бот
- ✅ Веб-интерфейс для управления
- ✅ SSL сертификат
- ✅ Автоматические бэкапы
- ✅ Мониторинг и логирование

### **Следующие шаги:**
1. Создайте бота в Telegram
2. Добавьте его в веб-интерфейс
3. Создайте блоки и квизы
4. Протестируйте функциональность
5. Настройте мониторинг

**Удачного использования! 🚀** 