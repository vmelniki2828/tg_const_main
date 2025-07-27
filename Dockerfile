# Используем официальный образ Node.js
FROM node:18-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем исходный код
COPY . .

# Создаем необходимые директории
RUN mkdir -p backend/uploads backend/promocodes

# Устанавливаем права на директории
RUN chmod 755 backend/uploads backend/promocodes

# Открываем порт
EXPOSE 3001

# Команда для запуска приложения
CMD ["npm", "start"] 