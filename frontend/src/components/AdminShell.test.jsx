import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import AdminShell from './AdminShell';
import { authRequest, setCsrfToken } from '../api';

jest.mock('../api', () => ({ authRequest: jest.fn(), setCsrfToken: jest.fn(),
  jsonBody: (method, body) => ({ method, body }) }));
jest.mock('./AdminUsers', () => ({ currentUser }) => <div data-testid="access-panel">Access for {currentUser.login}</div>);
global.IS_REACT_ACT_ENVIRONMENT = true;
const admin = { id: '1', login: 'operator', name: 'Оператор', role: 'admin', mustChangePassword: false };
let root, container, user;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks(); user = null;
  authRequest.mockImplementation(async path => {
    if (path === 'auth/me') {
      if (!user) throw Object.assign(new Error('Увійдіть'), { status: 401 });
      return { user, csrfToken: 'test-csrf' };
    }
    if (path === 'auth/login') return { user: user || admin, csrfToken: 'test-csrf' };
    if (path === 'auth/logout') return { success: true };
    if (path === 'auth/password') return { user: { ...user, mustChangePassword: false }, csrfToken: 'new-csrf' };
    throw new Error('Unexpected path');
  });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });
async function render() { await act(async () => root.render(<AdminShell><div data-testid="private-app">Private bots</div></AdminShell>)); }
function button(text) { return Array.from(container.querySelectorAll('button')).find(b => b.textContent === text); }

test('anonymous visitors see only login; legacy app is never mounted before authentication', async () => {
  await render();
  expect(container.textContent).toContain('Вхід в адмінпанель');
  expect(container.querySelector('[data-testid="private-app"]')).toBeNull();
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('[data-testid="private-app"]')).not.toBeNull();
  expect(setCsrfToken).toHaveBeenCalledWith('test-csrf');
});

test('admin retains bot UI and has no account-management control; logout removes private data', async () => {
  user = admin; await render();
  expect(container.textContent).toContain('Private bots');
  expect(button('Користувачі та доступ')).toBeUndefined();
  await act(async () => button('Вийти').click());
  expect(container.querySelector('[data-testid="private-app"]')).toBeNull();
  expect(setCsrfToken).toHaveBeenCalledWith(null);
});

test('superadmin can open account management', async () => {
  user = { ...admin, role: 'superadmin' }; await render();
  act(() => button('Користувачі та доступ').click());
  expect(container.querySelector('[data-testid="access-panel"]')).not.toBeNull();
});

test('temporary password blocks all private UI and management until successfully changed', async () => {
  user = { ...admin, role: 'superadmin', mustChangePassword: true }; await render();
  expect(container.textContent).toContain('Змініть тимчасовий пароль');
  expect(button('Користувачі та доступ')).toBeUndefined();
  expect(container.querySelector('[data-testid="private-app"]')).toBeNull();
  const inputs = container.querySelectorAll('input');
  await act(async () => {
    Simulate.change(inputs[0], { target: { value: 'temporary-password' } });
    Simulate.change(inputs[1], { target: { value: 'my-personal-password' } });
    Simulate.change(inputs[2], { target: { value: 'my-personal-password' } });
  });
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.querySelector('[data-testid="private-app"]')).not.toBeNull();
});

test('revocation event immediately unmounts private UI and user-management data', async () => {
  user = { ...admin, role: 'superadmin' }; await render();
  act(() => button('Користувачі та доступ').click());
  act(() => window.dispatchEvent(new Event('admin-session-expired')));
  expect(container.querySelector('[data-testid="private-app"]')).toBeNull();
  expect(container.querySelector('[data-testid="access-panel"]')).toBeNull();
  expect(container.textContent).toContain('доступ відкликано');
});

test('idle panel rechecks the session and mismatched new passwords never reach API', async () => {
  user = admin; await render();
  const calls = authRequest.mock.calls.length;
  await act(async () => jest.advanceTimersByTime(30000));
  expect(authRequest.mock.calls.length).toBe(calls + 1);
  act(() => button('Змінити пароль').click());
  const inputs = container.querySelectorAll('input');
  act(() => {
    Simulate.change(inputs[1], { target: { value: 'long-new-password' } });
    Simulate.change(inputs[2], { target: { value: 'different-password' } });
  });
  await act(async () => Simulate.submit(container.querySelector('form')));
  expect(container.textContent).toContain('Нові паролі не збігаються');
  expect(authRequest.mock.calls.some(([path]) => path === 'auth/password')).toBe(false);
});
