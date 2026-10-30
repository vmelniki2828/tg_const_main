// Keep localhost and 127.0.0.1 consistent so browsers send same-site cookies.
// Production uses the HTTPS ingress; development keeps its separate API port.
const defaultApi = new URL(window.location.origin);
if (process.env.NODE_ENV !== 'production') defaultApi.port = '3001';
const API_BASE_URL = (process.env.REACT_APP_API_URL || defaultApi.origin).replace(/\/$/, '');

export const config = {
  API_BASE_URL,
};

export default config;
