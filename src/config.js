// Конфигурация API
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Для отладки - выводим в консоль
console.log('API_BASE_URL:', API_BASE_URL);
console.log('REACT_APP_API_URL env:', process.env.REACT_APP_API_URL);

export const config = {
  API_BASE_URL,
  // Другие настройки конфигурации можно добавить здесь
};

export default config; 