// Конфигурация API с автоматическим определением окружения
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = isDevelopment ? 'http://localhost:3001' : 'http://95.164.119.96:3001';

// Отладочная информация
console.log('🔧 API_BASE_URL:', API_BASE_URL);
console.log('🔧 Текущий URL:', window.location.href);
console.log('🔧 Окружение:', isDevelopment ? 'development' : 'production');

export const config = {
  API_BASE_URL,
};

export default config; 