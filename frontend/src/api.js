import config from './config';

let csrfToken = null;
let authGeneration = 0;
export function setCsrfToken(value) {
  const next = value || null;
  if (next !== csrfToken) authGeneration++;
  csrfToken = next;
}

export async function apiFetch(input, options = {}) {
  const { suppressAuthEvent = false, ...requestOptions } = options;
  const generation = authGeneration;
  const url = new URL(input, window.location.href);
  const apiOrigin = new URL(config.API_BASE_URL).origin;
  if (url.origin !== apiOrigin || !url.pathname.startsWith('/api/')) {
    throw new Error('Неприпустима адреса API.');
  }
  const headers = new Headers(options.headers);
  headers.set('X-Requested-With', 'admin-ui');
  const method = (options.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(url.toString(), { ...requestOptions, headers, credentials: 'include', cache: 'no-store' });
  if (response.status === 401 && generation === authGeneration && !suppressAuthEvent && !url.pathname.endsWith('/auth/login')) {
    setCsrfToken(null);
    window.dispatchEvent(new Event('admin-session-expired'));
  }
  if (response.status === 403) {
    const data = await response.clone().json().catch(() => ({}));
    if (data.code === 'PASSWORD_CHANGE_REQUIRED') window.dispatchEvent(new Event('admin-password-required'));
  }
  return response;
}

export async function authRequest(path, options) {
  const response = await apiFetch(`${config.API_BASE_URL}/api/${path}`, options);
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error || 'Не вдалося виконати запит.'), { status: response.status });
  return data;
}

export const jsonBody = (method, body) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
