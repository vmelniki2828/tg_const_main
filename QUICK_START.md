# 🚀 Быстрый старт Telegram Quiz Bot

## ⚡ Развертывание за 3 шага

### 1. Подготовка
```bash
# Убедитесь, что Docker установлен
docker --version
docker-compose --version
```

### 2. Клонирование
```bash
git clone <your-repo-url>
cd tg_const_main
```

### 3. Запуск
```bash
./deploy.sh
```

## ✅ Проверка работы

После запуска проверьте:

```bash
# Проверка здоровья системы
./health-check.sh

# Или вручную:
curl http://95.164.119.96:3001/api/bots
curl http://95.164.119.96:3000
```

## 🌐 Доступ к приложению

- **Фронтенд:** http://95.164.119.96:3000
- **API:** http://95.164.119.96:3001

## 🛠️ Управление

```bash
# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Логи
docker-compose logs -f

# Обновление
git pull && ./deploy.sh
```

## 📋 Требования

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM
- 10GB места

## 🔧 Устранение проблем

Если что-то не работает:

1. Проверьте логи: `docker-compose logs`
2. Перезапустите: `docker-compose down && ./deploy.sh`
3. Очистите Docker: `docker system prune -a`

## 📖 Подробная документация

См. `DEPLOYMENT_GUIDE.md` для полного руководства. 