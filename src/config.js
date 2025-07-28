// Конфигурация API
const API_BASE_URL = 'http://95.164.119.96:3001'; // Принудительно установить URL для продакшена

// Для отладки - выводим в консоль
console.log('API_BASE_URL:', API_BASE_URL);

export const config = {
  API_BASE_URL,
  // Другие настройки конфигурации можно добавить здесь
};

export default config; 