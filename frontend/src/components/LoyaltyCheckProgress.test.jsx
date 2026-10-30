import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import LoyaltyCheckProgress from './LoyaltyCheckProgress';
import { shouldPan } from './canvasPan';

global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root;
beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const job = { status: 'running', checked: 40, total: 100, issued: 3, alreadyIssued: 5, noStock: 2, errorCount: 1, skipped: { not_subscribed: 7 } };
test('progress counts actual checked users and shows stock, errors and skips', () => {
  act(() => root.render(<LoyaltyCheckProgress job={job} />));
  expect(container.textContent).toContain('40 из 100');
  expect(container.textContent).toContain('Не подписаны на канал: 7');
  expect(container.textContent).toContain('Не хватает ваучеров для наград: 2');
  expect(container.querySelector('progress').value).toBe(40);
});
test('cancel is available while running; completed and interrupted jobs remain visible', () => {
  const cancel = jest.fn();
  act(() => root.render(<LoyaltyCheckProgress job={job} onCancel={cancel} />));
  act(() => container.querySelector('button').click()); expect(cancel).toHaveBeenCalledTimes(1);
  act(() => root.render(<LoyaltyCheckProgress job={{ ...job, status: 'interrupted' }} />));
  expect(container.textContent).toContain('Проверка прервана'); expect(container.querySelector('button')).toBeNull();
});
test('zero-user completion and API failure are distinct states', () => {
  act(() => root.render(<LoyaltyCheckProgress job={{ ...job, status: 'completed', checked: 0, total: 0 }} />));
  expect(container.querySelector('progress').max).toBe(1);
  act(() => root.render(<LoyaltyCheckProgress job={{ ...job, status: 'failed', error: 'Ошибка Telegram (429)' }} />));
  expect(container.querySelector('[role="alert"]').textContent).toContain('429');
});
test('panning allows left background, right drag, hand and Alt; protects block editing', () => {
  const bg = document.createElement('div');
  const block = document.createElement('div'); block.className = 'dialog-block';
  const input = document.createElement('textarea'); block.appendChild(input);
  const event = (target, button = 0, altKey = false) => ({ target, button, altKey });
  expect(shouldPan(event(bg), false)).toBe(true);
  expect(shouldPan(event(block), false)).toBe(false);
  expect(shouldPan(event(block, 2), false)).toBe(true);
  expect(shouldPan(event(block), true)).toBe(true);
  expect(shouldPan(event(block, 0, true), false)).toBe(true);
  expect(shouldPan(event(input), true)).toBe(false);
});
