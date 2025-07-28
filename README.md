# 🤖 Telegram Quiz Bot

Интерактивный конструктор Telegram ботов для создания квизов с промокодами.

## 🚀 Быстрое развертывание

### На сервере 95.164.119.96:

```bash
# 1. Клонирование
git clone <your-repo-url>
cd tg_const_main

# 2. Запуск
./deploy.sh

# 3. Проверка
./health-check.sh
```

## 🌐 Доступ к приложению

- **Фронтенд:** http://95.164.119.96:3000
- **API:** http://95.164.119.96:3001

## 📋 Требования

- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM
- 10GB места

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

## 🔧 Устранение проблем

Если что-то не работает:

1. Проверьте логи: `docker-compose logs`
2. Перезапустите: `docker-compose down && ./deploy.sh`
3. Очистите Docker: `docker system prune -a`

## 📖 Документация

- `QUICK_START.md` - быстрый старт
- `DEPLOYMENT_GUIDE.md` - подробное руководство
- `DEPLOYMENT_SUMMARY.md` - сводка исправлений

## 🎯 Возможности

- ✅ Создание Telegram ботов
- ✅ Конструктор диалогов
- ✅ Система квизов
- ✅ Управление промокодами
- ✅ Статистика и аналитика
- ✅ Загрузка медиафайлов
- ✅ Экспорт данных

## 🔐 Безопасность

- Настроены CORS заголовки
- Добавлены заголовки безопасности
- Правильная обработка preflight запросов

## 📞 Поддержка

При возникновении проблем:

1. Запустите `./health-check.sh` для диагностики
2. Проверьте логи: `docker-compose logs`
3. Перезапустите: `docker-compose down && ./deploy.sh`
4. Очистите Docker: `docker system prune -a`

---

**Готово к развертыванию на сервере 95.164.119.96! 🚀**
