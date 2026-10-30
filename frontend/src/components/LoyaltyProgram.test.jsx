import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import LoyaltyProgram from './LoyaltyProgram';
global.IS_REACT_ACT_ENVIRONMENT = true;
let container, root, job;
const running = { _id: 'job1', status: 'running', checked: 5, total: 100, issued: 0, alreadyIssued: 0, noStock: 0, errorCount: 0 };
beforeEach(() => {
  jest.useFakeTimers(); job = null;
  window.confirm = jest.fn(() => true);
  global.fetch = jest.fn(async (url, options) => {
    if (url.includes('force-give')) { job = { ...running }; return { ok: true, json: async () => ({ job }) }; }
    if (url.includes('/loyalty-check/')) return { ok: true, json: async () => ({ job }) };
    if (url.includes('auto-progress')) return { ok: true, json: async () => ({ progress: null }) };
    return { ok: true, json: async () => ({ isEnabled: true }) };
  });
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); jest.useRealTimers(); });
async function render() { await act(async () => { root.render(<LoyaltyProgram botId="test" onClose={() => {}} />); }); }
async function tick() { await act(async () => { jest.advanceTimersByTime(2000); }); }
test('start returns immediately, polling updates progress, and completion re-enables the button', async () => {
  await render();
  const button = () => container.querySelector('.force-check-btn');
  await act(async () => { button().click(); });
  expect(button().disabled).toBe(true);
  expect(container.textContent).toContain('5 из 100');
  job = { ...running, checked: 40 }; await tick();
  expect(container.textContent).toContain('40 из 100');
  job = { ...running, status: 'completed', checked: 100 }; await tick();
  expect(button().disabled).toBe(false);
  expect(container.textContent).toContain('Проверка завершена');
});
test('reopening discovers a running job using GET and never starts another operation', async () => {
  job = { ...running, checked: 70 }; await render();
  expect(container.textContent).toContain('70 из 100');
  expect(container.querySelector('.force-check-btn').disabled).toBe(true);
  expect(fetch.mock.calls.every(([, options]) => options?.method !== 'POST')).toBe(true);
});
test('unmounting stops polling and never cancels a server job', async () => {
  await render(); act(() => root.unmount()); root = createRoot(container);
  const count = fetch.mock.calls.length; await tick();
  expect(fetch.mock.calls.length).toBe(count);
});
