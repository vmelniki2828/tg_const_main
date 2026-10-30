const originalNodeEnv = process.env.NODE_ENV;
const originalApiUrl = process.env.REACT_APP_API_URL;

afterEach(() => {
  process.env.NODE_ENV = originalNodeEnv;
  if (originalApiUrl === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = originalApiUrl;
  jest.resetModules();
});

function apiUrl(environment, override) {
  jest.resetModules();
  process.env.NODE_ENV = environment;
  if (override === undefined) delete process.env.REACT_APP_API_URL;
  else process.env.REACT_APP_API_URL = override;
  return require('./config').default.API_BASE_URL;
}

test('production API and authenticated uploads use the page origin without port 3001', () => {
  expect(apiUrl('production')).toBe(window.location.origin);
});

test('development retains the API port on the same hostname', () => {
  const expected = new URL(window.location.origin);
  expected.port = '3001';
  expect(apiUrl('development')).toBe(expected.origin);
});

test('explicit API override takes precedence and trims the trailing slash', () => {
  expect(apiUrl('production', 'https://example.org/')).toBe('https://example.org');
});

test('empty API override falls back to the production page origin', () => {
  expect(apiUrl('production', '')).toBe(window.location.origin);
});
