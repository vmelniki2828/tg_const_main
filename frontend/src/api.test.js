import { apiFetch, setCsrfToken } from './api';
beforeEach(() => { global.fetch = jest.fn(async () => ({ status: 200 })); setCsrfToken(null); });
test('existing API calls send cookies and CSRF, including multipart requests without overwriting content type', async () => {
  setCsrfToken('csrf-test'); const body = new FormData(); body.append('file', new Blob(['test']));
  await apiFetch('http://localhost:3001/api/upload-media', { method: 'POST', body });
  const [, options] = fetch.mock.calls[0];
  expect(options.credentials).toBe('include'); expect(options.cache).toBe('no-store');
  expect(options.headers.get('X-CSRF-Token')).toBe('csrf-test');
  expect(options.headers.get('Content-Type')).toBeNull();
});
test('credentials cannot be sent to another API origin', async () => {
  await expect(apiFetch('https://evil.example/api/bots')).rejects.toThrow('адреса API');
  expect(fetch).not.toHaveBeenCalled();
});
test('401 triggers reauthentication while a stale response cannot terminate a newer login', async () => {
  const expired = jest.fn(); window.addEventListener('admin-session-expired', expired);
  try {
    fetch.mockResolvedValueOnce({ status: 401 });
    await apiFetch('http://localhost:3001/api/bots'); expect(expired).toHaveBeenCalledTimes(1);
    let finish;
    fetch.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = apiFetch('http://localhost:3001/api/bots');
    setCsrfToken('new-login'); finish({ status: 401 }); await pending;
    expect(expired).toHaveBeenCalledTimes(1);
  } finally { window.removeEventListener('admin-session-expired', expired); }
});
