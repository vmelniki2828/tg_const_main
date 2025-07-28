// Конфигурация API для продакшена
const API_BASE_URL = 'http://95.164.119.96:3001';

// Отладочная информация
console.log('🔧 API_BASE_URL:', API_BASE_URL);
console.log('🔧 Текущий URL:', window.location.href);

export const config = {
  API_BASE_URL,
};

export default config; 