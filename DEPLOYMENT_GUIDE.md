# 🚀 Руководство по развертыванию Telegram Quiz Bot

## 📋 Требования

- Docker (версия 20.10+)
- Docker Compose (версия 2.0+)
- Минимум 2GB RAM
- Минимум 10GB свободного места

## 🔧 Быстрое развертывание

### 1. Клонирование репозитория
```bash
git clone <your-repo-url>
cd tg_const_main
```

### 2. Запуск развертывания
```bash
chmod +x deploy.sh
./deploy.sh
```

## 📝 Пошаговое развертывание

### Шаг 1: Подготовка сервера
```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Добавляем пользователя в группу docker
sudo usermod -aG docker $USER

# Устанавливаем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезагружаем систему
sudo reboot
```

### Шаг 2: Клонирование и настройка
```bash
# Клонируем репозиторий
git clone <your-repo-url>
cd tg_const_main

# Создаем необходимые директории
mkdir -p backend/uploads backend/promocodes

# Создаем файлы состояния
echo '{"bots":[],"activeBot":null}' > backend/state.json
echo '{}' > backend/quizStats.json
echo '{"blocks":[],"connections":[],"pan":{"x":0,"y":0},"scale":1}' > backend/editorState.json
```

### Шаг 3: Развертывание
```bash
# Запускаем развертывание
./deploy.sh
```

## 🌐 Настройка домена (опционально)

### 1. Настройка Nginx
```bash
sudo apt install nginx
```

### 2. Создание конфигурации
```bash
sudo nano /etc/nginx/sites-available/telegram-bot
```

Добавьте следующую конфигурацию:
```nginx
server {
    listen 80;
    server_name 95.164.119.96;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Активация конфигурации
```bash
sudo ln -s /etc/nginx/sites-available/telegram-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 🔍 Проверка развертывания

### Проверка статуса контейнеров
```bash
docker-compose ps
```

### Просмотр логов
```bash
# Все логи
docker-compose logs

# Логи в реальном времени
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs backend
docker-compose logs frontend
```

### Проверка доступности
```bash
# Проверка API
curl http://95.164.119.96:3001/api/bots

# Проверка фронтенда
curl http://95.164.119.96:3000
```

## 🛠️ Управление приложением

### Остановка
```bash
docker-compose down
```

### Перезапуск
```bash
docker-compose restart
```

### Обновление
```bash
git pull
./deploy.sh
```

### Очистка
```bash
docker-compose down
docker system prune -a
```

## 📊 Мониторинг

### Просмотр использования ресурсов
```bash
docker stats
```

### Проверка дискового пространства
```bash
docker system df
```

## 🔧 Устранение неполадок

### Проблема: Контейнеры не запускаются
```bash
# Проверяем логи
docker-compose logs

# Пересобираем образы
docker-compose build --no-cache

# Очищаем Docker
docker system prune -a
```

### Проблема: API недоступен
```bash
# Проверяем порты
netstat -tulpn | grep 3001

# Проверяем контейнер backend
docker-compose logs backend
```

### Проблема: Фронтенд недоступен
```bash
# Проверяем порты
netstat -tulpn | grep 3000

# Проверяем контейнер frontend
docker-compose logs frontend
```

## 📁 Структура файлов

```
tg_const_main/
├── backend/
│   ├── server.js          # Основной сервер
│   ├── state.json         # Состояние ботов
│   ├── quizStats.json     # Статистика квизов
│   ├── editorState.json   # Состояние редактора
│   ├── uploads/           # Загруженные файлы
│   └── promocodes/        # Промокоды
├── frontend/
│   ├── src/               # Исходный код
│   └── public/            # Статические файлы
├── docker-compose.yml     # Конфигурация Docker
├── Dockerfile.backend     # Образ для backend
├── Dockerfile.frontend    # Образ для frontend
├── nginx.conf            # Конфигурация Nginx
└── deploy.sh             # Скрипт развертывания
```

## 🔐 Безопасность

### Рекомендации:
1. Используйте HTTPS в продакшене
2. Настройте файрвол
3. Регулярно обновляйте Docker образы
4. Мониторьте логи на предмет подозрительной активности

### Настройка HTTPS с Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d 95.164.119.96
```

## 📞 Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs`
2. Убедитесь, что порты 3000 и 3001 свободны
3. Проверьте права доступа к файлам
4. Убедитесь, что Docker и Docker Compose установлены корректно 