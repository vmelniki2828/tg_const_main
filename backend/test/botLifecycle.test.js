const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const source = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

test('polling confirmation keeps log/exit listeners and startup timeout kills an unready bot', async () => {
  let timer, child;
  const activeProcesses = new Map();
  const context = { activeProcesses, shuttingDown: false, Bot: { findOne: async () => ({}) }, path,
    __dirname: '.', console: { log() {}, error() {} }, Date,
    setTimeout(fn) { timer = fn; return 1; }, clearTimeout() {}, spawn() {
      child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
      child.kill = () => { child.killed = true; }; return child;
    } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function startBot(bot) {'), source.indexOf('// Функция для остановки бота')), context);
  const started = context.startBot({ id: 'a' }); await new Promise(setImmediate);
  child.emit('message', { type: 'polling-ok' }); await started;
  assert.equal(child.pollingReady, true);
  assert.equal(child.stdout.listenerCount('data'), 1); assert.equal(child.stderr.listenerCount('data'), 1);
  assert.equal(child.listenerCount('exit'), 1);
  child.emit('exit', 1); assert.equal(activeProcesses.size, 0);
  const failed = context.startBot({ id: 'b' }); await new Promise(setImmediate); timer();
  await assert.rejects(failed, /did not confirm/); assert.equal(child.killed, true);
});
test('deployment shutdown preserves desired active state, explicit stop deactivates the bot', async () => {
  let deactivations = 0;
  const activeProcesses = new Map();
  const context = { activeProcesses, console: { log() {}, error() {} }, setTimeout, clearTimeout,
    Bot: { updateOne: async () => { deactivations++; } } };
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('async function stopBot('), source.indexOf('// Функция для ожидания')), context);
  function child() { const process = new EventEmitter(); process.kill = () => setImmediate(() => process.emit('exit', 0)); return process; }
  activeProcesses.set('a', child()); await context.stopBot('a', { deactivate: false }); assert.equal(deactivations, 0);
  activeProcesses.set('b', child()); await context.stopBot('b'); assert.equal(deactivations, 1);
});
