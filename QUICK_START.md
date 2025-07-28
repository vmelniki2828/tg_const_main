# 🚀 Полный туториал развертывания Telegram Quiz Bot

## 📋 Требования к серверу

- **ОС:** Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **RAM:** Минимум 2GB
- **CPU:** 1 ядро
- **Диск:** 10GB свободного места
- **Сеть:** Статический IP (95.164.119.96)

## 🔧 Подготовка сервера

### 1. Подключение к серверу
```bash
ssh root@95.164.119.96
```

### 2. Обновление системы
```bash
# Обновляем пакеты
sudo apt update && sudo apt upgrade -y

# Устанавливаем необходимые пакеты
sudo apt install -y curl git wget
```

### 3. Установка Docker
```bash
# Скачиваем скрипт установки Docker
curl -fsSL https://get.docker.com -o get-docker.sh

# Запускаем установку
sudo sh get-docker.sh

# Добавляем пользователя в группу docker
sudo usermod -aG docker $USER

# Проверяем установку
docker --version
```

### 4. Установка Docker Compose
```bash
# Скачиваем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Делаем исполняемым
sudo chmod +x /usr/local/bin/docker-compose

# Проверяем установку
docker-compose --version
```

### 5. Перезагрузка системы
```bash
sudo reboot
```

## 🚀 Развертывание приложения

### 1. Подключение после перезагрузки
```bash
ssh root@95.164.119.96
```

### 2. Создание рабочей директории
```bash
# Создаем директорию для проекта
mkdir -p /opt/telegram-bot
cd /opt/telegram-bot
```

### 3. Клонирование репозитория
```bash
# Клонируем репозиторий (замените на ваш URL)
git clone <your-repo-url> .

# Проверяем содержимое
ls -la
```

### 4. Настройка прав доступа
```bash
# Делаем скрипты исполняемыми
chmod +x deploy.sh health-check.sh

# Проверяем права
ls -la *.sh
```

### 5. Создание необходимых директорий и файлов
```bash
# Создаем директории
mkdir -p backend/uploads backend/promocodes

# Создаем файлы состояния
echo '{"bots":[],"activeBot":null}' > backend/state.json
echo '{}' > backend/quizStats.json
echo '{"blocks":[],"connections":[],"pan":{"x":0,"y":0},"scale":1}' > backend/editorState.json

# Устанавливаем права на директории
chmod 755 backend/uploads backend/promocodes

# Проверяем созданные файлы
ls -la backend/
```

### 6. Запуск развертывания
```bash
# Запускаем автоматическое развертывание
./deploy.sh
```

## ✅ Проверка развертывания

### 1. Проверка статуса контейнеров
```bash
# Проверяем, что контейнеры запущены
docker-compose ps

# Должны увидеть что-то вроде:
# NAME                         IMAGE                   STATUS              PORTS
# telegram-quiz-bot-backend    telegram-bot-backend    Up 2 minutes        0.0.0.0:3001->3001/tcp
# telegram-quiz-bot-frontend   telegram-bot-frontend   Up 2 minutes        0.0.0.0:3000->3000/tcp
```

### 2. Проверка здоровья системы
```bash
# Запускаем комплексную проверку
./health-check.sh
```

### 3. Ручная проверка доступности
```bash
# Проверка API
curl http://95.164.119.96:3001/api/bots

# Должен вернуть JSON с пустым массивом ботов:
# {"bots":[],"activeBot":null}

# Проверка фронтенда
curl http://95.164.119.96:3000

# Должен вернуть HTML страницу
```

### 4. Проверка логов
```bash
# Просмотр всех логов
docker-compose logs

# Логи в реальном времени
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs backend
docker-compose logs frontend
```

## 🌐 Доступ к приложению

После успешного развертывания:

- **Фронтенд:** http://95.164.119.96:3000
- **API:** http://95.164.119.96:3001

### Откройте браузер и перейдите на:
1. http://95.164.119.96:3000 - веб-интерфейс
2. http://95.164.119.96:3001/api/bots - API для проверки

## 🛠️ Управление приложением

### Основные команды:
```bash
# Остановка приложения
docker-compose down

# Перезапуск приложения
docker-compose restart

# Просмотр логов в реальном времени
docker-compose logs -f

# Обновление приложения
git pull && ./deploy.sh

# Очистка Docker
docker system prune -a
```

### Мониторинг ресурсов:
```bash
# Использование ресурсов контейнерами
docker stats

# Проверка дискового пространства
docker system df

# Проверка здоровья системы
./health-check.sh
```

## 🔧 Устранение проблем

### Проблема: "Permission denied" при запуске deploy.sh
```bash
# Решение:
chmod +x deploy.sh health-check.sh
bash deploy.sh
```

### Проблема: Контейнеры не запускаются
```bash
# Проверяем логи
docker-compose logs

# Пересобираем образы
docker-compose build --no-cache

# Очищаем Docker
docker system prune -a

# Перезапускаем
./deploy.sh
```

### Проблема: Порт занят
```bash
# Проверяем что использует порты
sudo lsof -i :3000
sudo lsof -i :3001

# Останавливаем процессы если нужно
sudo kill -9 <PID>
```

### Проблема: API недоступен
```bash
# Проверяем контейнер backend
docker-compose logs backend

# Перезапускаем backend
docker-compose restart backend

# Проверяем порты
netstat -tulpn | grep 3001
```

### Проблема: Фронтенд недоступен
```bash
# Проверяем контейнер frontend
docker-compose logs frontend

# Перезапускаем frontend
docker-compose restart frontend

# Проверяем порты
netstat -tulpn | grep 3000
```

## 🔐 Дополнительная настройка

### Настройка файрвола:
```bash
# Установка UFW
sudo apt install ufw

# Настройка правил
sudo ufw allow ssh
sudo ufw allow 3000
sudo ufw allow 3001
sudo ufw enable

# Проверка статуса
sudo ufw status
```

### Настройка HTTPS (опционально):
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d 95.164.119.96
```

### Настройка автоматического обновления:
```bash
# Создаем cron задачу
crontab -e

# Добавляем строку для ежедневного обновления
0 2 * * * cd /opt/telegram-bot && git pull && ./deploy.sh
```

## 📊 Проверка работоспособности

### 1. Создание тестового бота:
1. Откройте http://95.164.119.96:3000
2. Нажмите "Создать бота"
3. Введите имя бота
4. Введите токен от @BotFather
5. Нажмите "Запустить бота"

### 2. Проверка API:
```bash
# Проверка списка ботов
curl http://95.164.119.96:3001/api/bots

# Должен вернуть JSON с вашими ботами
```

### 3. Проверка статистики:
```bash
# Проверка файлов состояния
ls -la backend/
cat backend/state.json
```

## 📞 Поддержка

### Если что-то не работает:

1. **Запустите диагностику:**
   ```bash
   ./health-check.sh
   ```

2. **Проверьте логи:**
   ```bash
   docker-compose logs
   ```

3. **Перезапустите приложение:**
   ```bash
   docker-compose down && ./deploy.sh
   ```

4. **Очистите Docker:**
   ```bash
   docker system prune -a
   ```

### Полезные команды для диагностики:
```bash
# Статус системы
systemctl status docker

# Проверка портов
netstat -tulpn | grep -E ':(3000|3001)'

# Проверка дискового пространства
df -h

# Проверка памяти
free -h

# Проверка процессов Docker
docker ps -a
```

## 🎯 Результат

После выполнения всех шагов у вас будет:

✅ **Работающее приложение на сервере 95.164.119.96**
✅ **Фронтенд доступен на порту 3000**
✅ **API доступен на порту 3001**
✅ **Автоматические проверки здоровья системы**
✅ **Готовность к продакшену**
✅ **Возможность создавать и управлять Telegram ботами**

**Проект полностью готов к использованию! 🚀**

---

## 📖 Дополнительная документация

- `DEPLOYMENT_GUIDE.md` - подробное руководство
- `DEPLOYMENT_SUMMARY.md` - сводка исправлений
- `health-check.sh` - скрипт диагностики 