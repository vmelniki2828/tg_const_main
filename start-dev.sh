#!/bin/bash

echo "🚀 Запуск среды разработки..."

# Проверяем, что мы в корневой директории проекта
if [ ! -f "package.json" ]; then
    echo "❌ Ошибка: Запустите скрипт из корневой директории проекта"
    exit 1
fi

# Функция для остановки всех процессов при выходе
cleanup() {
    echo "🛑 Остановка всех процессов..."
    pkill -f "nodemon.*server.js" 2>/dev/null
    pkill -f "react-scripts start" 2>/dev/null
    exit 0
}

# Устанавливаем обработчик сигналов
trap cleanup SIGINT SIGTERM

echo "📦 Установка зависимостей backend..."
cd backend
npm install

echo "🔧 Запуск backend сервера..."
npm start &
BACKEND_PID=$!

echo "⏳ Ожидание запуска backend..."
sleep 5

# Проверяем, что backend запустился
if ! curl -s http://localhost:3001/api/bots > /dev/null; then
    echo "❌ Ошибка: Backend не запустился"
    exit 1
fi

echo "✅ Backend запущен на http://localhost:3001"

echo "📦 Установка зависимостей frontend..."
cd ../frontend
npm install

echo "🌐 Запуск frontend сервера..."
npm start &
FRONTEND_PID=$!

echo "✅ Frontend запущен на http://localhost:3000"
echo ""
echo "🎉 Среда разработки готова!"
echo "📱 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo ""
echo "Для остановки нажмите Ctrl+C"

# Ждем завершения процессов
wait $BACKEND_PID $FRONTEND_PID 