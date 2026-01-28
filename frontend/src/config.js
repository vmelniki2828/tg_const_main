// Конфигурация API с автоматическим определением окружения
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// В production: если задана переменная сборки — используем её; иначе если открыто с порта 80 — относительный URL (/api проксируется nginx); иначе тот же хост, порт 3001
const getApiBaseUrl = () => {
  if (typeof process !== 'undefined' && process.env?.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL.replace(/\/$/, '');
  }
  if (isDevelopment) {
    return 'http://localhost:3001';
  }
  const port = window.location.port || '';
  if (port === '80' || port === '443' || port === '') {
    return ''; // относительные запросы к /api/ — nginx проксирует на бэкенд
  }
  return `${window.location.protocol}//${window.location.hostname}:3001`;
};

const API_BASE_URL = getApiBaseUrl();

// Отладочная информация
console.log('🔧 API_BASE_URL:', API_BASE_URL || '(относительный /api)');
console.log('🔧 Текущий URL:', window.location.href);
console.log('🔧 Окружение:', isDevelopment ? 'development' : 'production');

export const config = {
  API_BASE_URL,
};

export default config; 