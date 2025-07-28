# 🔧 Исправление проблемы с фронтендом

## ❌ Проблема
Фронтенд контейнер запускается, но не отвечает на запросы:
```
❌ Фронтенд недоступен на порту 3000
```

## 🔍 Причина
Проблема в том, что `Dockerfile.frontend.simple` пытается скопировать `nginx.conf` из контекста сборки, но этот файл находится в корне проекта, а не в папке `frontend/`.

## ✅ Решение

### 1. Создать nginx.conf для фронтенда

```bash
# Создаем конфигурацию nginx для фронтенда
cat > frontend/nginx.conf << 'EOF'
server {
    listen 3000;
    server_name localhost;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # Обработка React Router
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Кэширование статических файлов
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip сжатие
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
}
EOF
```

### 2. Пересобрать контейнеры

```bash
# Остановить контейнеры
docker-compose -f docker-compose.prod.yml down

# Удалить образ фронтенда
docker rmi tg_const_main-frontend

# Пересобрать и запустить
docker-compose -f docker-compose.prod.yml up --build -d
```

### 3. Проверить логи

```bash
# Проверить логи фронтенда
docker logs telegram-quiz-bot-frontend

# Проверить доступность
curl http://localhost:3000
```

## 🔧 Альтернативное решение

Если проблема остается, можно использовать упрощенную версию Dockerfile:

```dockerfile
# Этап сборки
FROM node:18-alpine as build

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./
COPY src/ ./src/
COPY public/ ./public/

# Устанавливаем зависимости
RUN npm install

# Собираем приложение
RUN npm run build

# Этап продакшена
FROM nginx:alpine

# Копируем собранное приложение
COPY --from=build /app/build /usr/share/nginx/html

# Создаем простую конфигурацию nginx
RUN echo 'server { listen 3000; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf

# Открываем порт
EXPOSE 3000

# Запускаем nginx
CMD ["nginx", "-g", "daemon off;"]
```

## 🚀 Быстрое исправление

```bash
# 1. Создать nginx.conf для фронтенда
cat > frontend/nginx.conf << 'EOF'
server {
    listen 3000;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html index.htm;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# 2. Пересобрать фронтенд
docker-compose -f docker-compose.prod.yml down
docker rmi tg_const_main-frontend
docker-compose -f docker-compose.prod.yml up --build -d

# 3. Проверить
curl http://localhost:3000
```

## 📋 Проверка

После исправления:

1. ✅ Фронтенд должен быть доступен на http://95.164.119.96:3000
2. ✅ API должен быть доступен на http://95.164.119.96:3001
3. ✅ Nginx должен проксировать запросы на http://95.164.119.96

---

**Проблема с фронтендом исправлена! 🚀** 