# 🚀 Быстрое развертывание Telegram Quiz Bot

## 📋 Краткая инструкция (5 минут)

### **1. Подготовка сервера**
```bash
# Подключение к серверу
ssh root@your-server-ip

# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Установка Git
sudo apt install git -y
```

### **2. Клонирование и запуск**
```bash
# Клонирование проекта
mkdir -p /opt/telegram-bot
cd /opt/telegram-bot
git clone https://github.com/vmelniki2828/tg_const_main.git .

# Настройка прав
chmod +x deploy.sh
mkdir -p backend/uploads backend/promocodes logs
chmod 755 backend/uploads backend/promocodes

# Создание файлов состояния
echo '{"bots":[],"activeBot":null}' > backend/state.json
echo '{}' > backend/quizStats.json

# Запуск
./deploy.sh
```

### **3. Проверка работы**
```bash
# Проверка API
curl http://localhost:3001/api/bots

# Проверка статуса
docker-compose ps

# Открыть в браузере
# http://your-server-ip:3001
```

## 🤖 Создание Telegram Bot

### **1. В Telegram:**
1. Найдите [@BotFather](https://t.me/botfather)
2. Отправьте `/newbot`
3. Введите имя и username
4. Сохраните токен

### **2. В веб-интерфейсе:**
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
# Проверка занятых портов
sudo lsof -i :3001

# Остановка процессов
sudo kill -9 <PID>
```

### **Проблемы с Docker:**
```bash
# Перезапуск Docker
sudo systemctl restart docker

# Очистка
docker system prune -a
```

### **Проблемы с правами:**
```bash
# Установка прав
sudo chown -R $USER:$USER /opt/telegram-bot
chmod 755 backend/uploads backend/promocodes
```

## 📞 Быстрая помощь

### **Проверка здоровья:**
```bash
# API работает?
curl http://localhost:3001/api/bots

# Контейнеры запущены?
docker-compose ps

# Логи без ошибок?
docker-compose logs --tail=20
```

### **Перезапуск всего:**
```bash
# Полный перезапуск
docker-compose down
sudo systemctl restart docker
./deploy.sh
```

## 🎯 Чек-лист развертывания

- [ ] Сервер подготовлен (Ubuntu 20.04+)
- [ ] Docker установлен и работает
- [ ] Проект клонирован
- [ ] Файлы состояния созданы
- [ ] Приложение запущено (`./deploy.sh`)
- [ ] API отвечает (`curl http://localhost:3001/api/bots`)
- [ ] Веб-интерфейс доступен
- [ ] Telegram бот создан
- [ ] Бот добавлен в приложение

---

**🎉 Готово! Ваш бот работает!**

**Репозиторий:** https://github.com/vmelniki2828/tg_const_main 