# 📚 Сводка документов для развертывания

## 🎯 Обновленные документы для репозитория `https://github.com/vmelniki2828/tg_const_main`

### **📖 Основные руководства:**

1. **`DEPLOYMENT_TUTORIAL.md`** - Подробный пошаговый туториал
   - ✅ Полное руководство по развертыванию
   - ✅ Настройка сервера, Docker, Nginx
   - ✅ Создание Telegram бота
   - ✅ Мониторинг и обслуживание
   - ✅ Устранение неполадок

2. **`QUICK_DEPLOY.md`** - Быстрая шпаргалка (5 минут)
   - ✅ Экспресс-деплой
   - ✅ Основные команды
   - ✅ Чек-лист развертывания

3. **`DEPLOY_INSTRUCTIONS.md`** - Краткая инструкция
   - ✅ Минимальные шаги
   - ✅ Быстрая помощь
   - ✅ Устранение неполадок

4. **`README.md`** - Основная документация
   - ✅ Обновлен с правильными ссылками
   - ✅ Полное руководство пользователя

### **🎥 Для создания видео:**

5. **`VIDEO_TUTORIAL_SCRIPT.md`** - Скрипт для видео-туториала
   - ✅ Структура видео (15-20 минут)
   - ✅ Сцены и диалоги
   - ✅ Команды для копирования
   - ✅ Метрики успеха

### **🧹 Дополнительные документы:**

6. **`MEDIA_CLEANUP_GUIDE.md`** - Руководство по управлению файлами
   - ✅ Автоматическое удаление медиафайлов
   - ✅ Ручная очистка
   - ✅ Технические детали

## 🚀 Быстрый старт (5 минут)

### **1. Подготовка сервера:**
```bash
ssh root@your-server-ip
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
sudo apt install git -y
```

### **2. Клонирование и запуск:**
```bash
mkdir -p /opt/telegram-bot
cd /opt/telegram-bot
git clone https://github.com/vmelniki2828/tg_const_main.git .
chmod +x deploy.sh
mkdir -p backend/uploads backend/promocodes logs
chmod 755 backend/uploads backend/promocodes
echo '{"bots":[],"activeBot":null}' > backend/state.json
echo '{}' > backend/quizStats.json
./deploy.sh
```

### **3. Проверка:**
```bash
curl http://localhost:3001/api/bots
docker-compose ps
# Открыть http://your-server-ip:3001
```

## 🤖 Создание Telegram Bot

### **В Telegram:**
1. Найдите [@BotFather](https://t.me/botfather)
2. Отправьте `/newbot`
3. Введите имя и username
4. Сохраните токен

### **В веб-интерфейсе:**
1. Откройте `http://your-server-ip:3001`
2. Нажмите "Создать бота"
3. Введите имя и токен
4. Нажмите "Запустить бота"

## 📊 Управление

### **Основные команды:**
```bash
# Статус
docker-compose ps

# Логи
docker-compose logs -f

# Остановка
docker-compose down

# Перезапуск
docker-compose restart

# Обновление
git pull origin main
./deploy.sh
```

## 🔧 Устранение неполадок

### **Проблемы с портами:**
```bash
sudo lsof -i :3001
sudo kill -9 <PID>
```

### **Проблемы с Docker:**
```bash
sudo systemctl restart docker
docker system prune -a
```

### **Проблемы с правами:**
```bash
sudo chown -R $USER:$USER /opt/telegram-bot
chmod 755 backend/uploads backend/promocodes
```

## 🎯 Чек-лист развертывания

- [ ] Сервер подготовлен (Ubuntu 20.04+)
- [ ] Docker установлен и работает
- [ ] Проект клонирован (`git clone https://github.com/vmelniki2828/tg_const_main.git`)
- [ ] Файлы состояния созданы
- [ ] Приложение запущено (`./deploy.sh`)
- [ ] API отвечает (`curl http://localhost:3001/api/bots`)
- [ ] Веб-интерфейс доступен
- [ ] Telegram бот создан
- [ ] Бот добавлен в приложение

## 📞 Поддержка

### **Полезные команды:**
```bash
# Проверка здоровья
curl http://localhost:3001/api/bots

# Перезапуск всего
docker-compose down
sudo systemctl restart docker
./deploy.sh

# Логи для диагностики
docker-compose logs -f
```

### **Контакты:**
- **Репозиторий:** https://github.com/vmelniki2828/tg_const_main
- **Документация:** Все файлы в корне проекта
- **Поддержка:** Создайте issue в репозитории

---

## 🎉 Готово к развертыванию!

**Все документы обновлены для репозитория `https://github.com/vmelniki2828/tg_const_main`**

### **Что у вас есть:**
- ✅ **Подробный туториал** - пошаговое руководство
- ✅ **Быстрая шпаргалка** - экспресс-деплой за 5 минут
- ✅ **Видео-скрипт** - для создания туториала
- ✅ **Устранение неполадок** - решение частых проблем
- ✅ **Мониторинг** - команды для управления

### **Следующие шаги:**
1. Выберите подходящий документ для ваших целей
2. Следуйте инструкциям по развертыванию
3. Создайте Telegram бота
4. Протестируйте функциональность
5. Настройте мониторинг

**Удачного развертывания! 🚀** 