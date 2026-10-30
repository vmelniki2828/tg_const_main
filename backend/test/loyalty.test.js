const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const models = require('../models');
const { createLoyaltyService, effectiveTime, normalizeChannel } = require('../loyaltyService');
const { createLoyaltyJobs, registerLoyaltyJobRoutes } = require('../loyaltyJobs');
const { createLoyaltySweep } = require('../loyaltySweep');
const { User, Bot, Loyalty, LoyaltyConfig, LoyaltyPromoCode, LoyaltyCheckJob } = models;
const now = Date.UTC(2026, 9, 30);
const config = { isEnabled: true, messages: { '1m': { enabled: true } }, channelSettings: { isRequired: false } };
let mongo;
let service;
let membership;
let calls;
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri());
  await Promise.all(Object.values(models).map(model => model.init()));
});
after(async () => { await mongoose.disconnect(); await mongo?.stop(); });
beforeEach(async () => {
  await Promise.all(Object.values(models).map(model => model.deleteMany({})));
  calls = 0;
  membership = { status: 'member' };
  service = createLoyaltyService({ ...models, now: () => now, telegramForBot: async () => ({ getChatMember: async () => {
    calls++;
    if (membership instanceof Error) throw membership;
    return membership;
  } }) });
});
async function user(id = 1, values = {}) {
  return (await User.create({ botId: 'b', userId: id, isSubscribed: true,
    loyaltyStartedAt: new Date(now - 60000), ...values })).toObject();
}
async function stock(count = 1, period = '1m') {
  return LoyaltyPromoCode.insertMany(Array.from({ length: count }, (_, i) => ({ botId: 'b', period, code: `${period}-${i}` })));
}
const check = (u, c = config, p) => service.checkUser('b', u, c, p);

test('eligible boundary assigns exactly one voucher and persists both flag collections', async () => {
  const u = await user(); await stock();
  assert.equal((await check(u)).issued, 1);
  assert.equal((await User.findOne({ userId: 1 })).loyaltyRewards['1m'], true);
  assert.equal((await Loyalty.findOne({ userId: 1 })).rewards['1m'], true);
  assert.equal((await check(u)).alreadyIssued, 1);
});
test('empty stock does not mark a reward; later refill recovers stale true flags', async () => {
  const u = await user(1, { loyaltyRewards: { '1m': true } });
  await Loyalty.create({ botId: 'b', userId: 1, rewards: { '1m': true } });
  assert.equal((await check(u)).noStock, 1);
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
  await stock();
  assert.equal((await check(u)).issued, 1);
});
test('new user with empty stock keeps false flags', async () => {
  const u = await user(); assert.equal((await check(u)).noStock, 1);
  assert.equal((await User.findOne({ userId: 1 })).loyaltyRewards['1m'], false);
  assert.equal(await Loyalty.countDocuments(), 0);
});
test('historical voucher repairs stale flags without issuing another code', async () => {
  const u = await user(); const [code] = await stock(2);
  await LoyaltyPromoCode.updateOne({ _id: code._id }, { activated: true, activatedBy: 1 });
  assert.equal((await check(u)).alreadyIssued, 1);
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 1);
  assert.equal(await Loyalty.countDocuments({ botId: 'b', userId: 1 }), 1);
});
test('20 concurrent requests for the same user cannot allocate duplicates', async () => {
  const u = await user(); await stock(20);
  const results = await Promise.all(Array.from({ length: 20 }, () => check(u)));
  assert.equal(results.reduce((n, r) => n + r.issued, 0), 1);
  assert.equal(results.reduce((n, r) => n + r.errors, 0), 0);
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 1);
});
test('two users cannot claim the same last code', async () => {
  const [a, b] = await Promise.all([user(1), user(2)]); await stock();
  const results = await Promise.all([check(a), check(b)]);
  assert.equal(results.reduce((n, r) => n + r.issued, 0), 1);
  assert.equal(results.reduce((n, r) => n + r.noStock, 0), 1);
});
test('retry after failure to write flags retains original voucher', async () => {
  const u = await user(); await stock(2);
  const broken = createLoyaltyService({ ...models, User: { updateMany: async () => { throw new Error('database down'); } }, now: () => now });
  assert.equal((await broken.checkUser('b', u, config)).errors, 1);
  assert.equal((await check(u)).alreadyIssued, 1);
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 1);
});
test('disabled program/period, no start, not due, future timestamp allocate nothing', async () => {
  await stock();
  assert.equal((await check(await user(), { ...config, isEnabled: false })).status, 'disabled');
  assert.equal((await check(await user(2), { ...config, messages: {} })).status, 'not_due');
  assert.equal((await check(await user(3, { loyaltyStartedAt: null }))).status, 'not_started');
  assert.equal((await check(await user(4, { loyaltyStartedAt: new Date(now + 1) }))).status, 'not_due');
  assert.equal((await check(await user(5, { loyaltyStartedAt: new Date(now - 59999) }))).status, 'not_due');
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
});
test('paused time and unsubscribe stop the subscription clock', () => {
  assert.equal(effectiveTime({ loyaltyStartedAt: new Date(now - 100000), isSubscribed: true, pausedTime: 50000 }, now), 50000);
  assert.equal(effectiveTime({ loyaltyStartedAt: new Date(now - 100000), isSubscribed: false, lastUnsubscribedAt: new Date(now - 20000), pausedTime: 30000 }, now), 50000);
  assert.equal(effectiveTime({ loyaltyStartedAt: 'bad date' }, now), 0);
});
test('membership accepts member/admin/creator and restricted current member only', async () => {
  const c = { ...config, channelSettings: { isRequired: true, channelId: '100123456' } };
  await stock(8);
  for (const [i, status] of ['member', 'administrator', 'creator', 'restricted', 'left', 'kicked'].entries()) {
    membership = { status, is_member: status === 'restricted' };
    const r = await check(await user(i + 1), c);
    assert.equal(r.issued, i < 4 ? 1 : 0);
  }
  membership = { status: 'restricted', is_member: false };
  assert.equal((await check(await user(7), c)).status, 'not_subscribed');
});
test('DNS, timeout, API errors propagate as errors, never as not subscribed', async () => {
  await stock(); const u = await user();
  for (const code of ['EAI_AGAIN', 'ETIMEDOUT', 429, 401, 400]) {
    membership = Object.assign(new Error('token must stay secret'), { code });
    await assert.rejects(check(u, { ...config, channelSettings: { isRequired: true, channelId: '@channel' } }));
  }
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
});
test('bad channel and unsupported period never award', async () => {
  const u = await user(); await stock();
  await assert.rejects(check(u, config, 'bad'));
  await assert.rejects(check(u, { ...config, channelSettings: { isRequired: true, channelId: '' } }));
  assert.equal(normalizeChannel(' 100123 '), '-100123');
  assert.equal(normalizeChannel('@valid'), '@valid');
});
test('period disabled cannot be forced; unsubscribed without a required channel is skipped', async () => {
  const u = await user(1, { isSubscribed: false }); await stock();
  assert.equal((await check(u)).status, 'not_subscribed');
  assert.equal((await check(await user(2), { ...config, messages: {} }, '1m')).issued, 0);
});

async function jobFixture(serviceOverride = service) {
  await Bot.create({ id: 'b', token: 'test-only' });
  await LoyaltyConfig.create({ botId: 'b', ...config });
  const callbacks = [];
  const jobs = createLoyaltyJobs({ ...models, service: serviceOverride, schedule: fn => callbacks.push(fn) });
  return { jobs, callbacks };
}
test('background job returns before processing; concurrent starts share one job', async () => {
  await user(); await stock(); const { jobs, callbacks } = await jobFixture();
  const starts = await Promise.all(Array.from({ length: 5 }, () => jobs.start('b')));
  assert.equal(new Set(starts.map(j => String(j._id))).size, 1);
  assert.equal(callbacks.length, 1);
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
  await callbacks[0]();
  const job = await jobs.latest('b'); assert.equal(job.status, 'completed');
  assert.equal(job.checked, 1); assert.equal(job.issued, 1);
});
test('job reports real skips/no stock/errors, not an all-zero success', async () => {
  await user(); await user(2, { loyaltyStartedAt: null }); await user(3, { isSubscribed: false });
  const { jobs, callbacks } = await jobFixture(); await jobs.start('b'); await callbacks[0]();
  const job = await jobs.latest('b');
  assert.equal(job.checked, 3); assert.equal(job.noStock, 1);
  assert.equal(job.skipped.not_started, 1); assert.equal(job.skipped.not_subscribed, 1);
});
test('zero users completes explicitly and without issuance', async () => {
  const { jobs, callbacks } = await jobFixture(); await jobs.start('b'); await callbacks[0]();
  const job = await jobs.latest('b'); assert.equal(job.total, 0); assert.equal(job.status, 'completed');
});
test('cancellation before execution awards nothing', async () => {
  await user(); await stock(); const { jobs, callbacks } = await jobFixture();
  await jobs.start('b'); await jobs.cancel('b'); await callbacks[0]();
  assert.equal((await jobs.latest('b')).status, 'cancelled');
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
});
test('keyset paging checks the snapshot only, once per user', async () => {
  for (let i = 0; i < 12; i++) await user(i + 1);
  const { jobs, callbacks } = await jobFixture(); await jobs.start('b'); await user(99);
  await callbacks[0](); const job = await jobs.latest('b');
  assert.equal(job.total, 12); assert.equal(job.checked, 12);
});
test('three consecutive Telegram failures fail the job with preserved progress', async () => {
  for (let i = 0; i < 6; i++) await user(i + 1);
  const { jobs, callbacks } = await jobFixture({ checkUser: async () => { throw Object.assign(new Error('secret token'), { code: 'EAI_AGAIN' }); } });
  await jobs.start('b'); await callbacks[0](); const job = await jobs.latest('b');
  assert.equal(job.status, 'failed'); assert.equal(job.checked, 3); assert.equal(job.errorCount, 3);
  assert(!JSON.stringify(job).includes('secret token'));
});
test('server recovery interrupts a job and never resumes issuance', async () => {
  await user(); await stock(); const { jobs } = await jobFixture(); await jobs.start('b');
  await jobs.recover(); assert.equal((await jobs.latest('b')).status, 'interrupted');
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
});
test('cancel during processing stops before the next user, without losing the cancellation flag', async () => {
  for (let i = 0; i < 8; i++) await user(i + 1);
  let fixture;
  let checked = 0;
  fixture = await jobFixture({ checkUser: async () => {
    checked++; await fixture.jobs.cancel('b');
    return { status: 'processed', issued: 0, alreadyIssued: 0, noStock: 0, errors: 0 };
  } });
  await fixture.jobs.start('b'); await fixture.callbacks[0]();
  const job = await fixture.jobs.latest('b'); assert.equal(job.status, 'cancelled'); assert.equal(checked, 1);
});
test('disabling the program during a job stops further allocations', async () => {
  await user(); await stock(); const { jobs, callbacks } = await jobFixture();
  await jobs.start('b'); await LoyaltyConfig.updateOne({ botId: 'b' }, { isEnabled: false }); await callbacks[0]();
  assert.equal((await jobs.latest('b')).status, 'cancelled');
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
});
test('interrupted pending worker cannot allocate after recovery', async () => {
  await user(); await stock(); const { jobs, callbacks } = await jobFixture();
  await jobs.start('b'); await jobs.recover(); await callbacks[0]();
  assert.equal((await jobs.latest('b')).status, 'interrupted');
  assert.equal(await LoyaltyPromoCode.countDocuments({ activated: true }), 0);
});
test('HTTP API returns 202 and readonly progress while the worker is pending', async t => {
  const express = require('express'); await user(); const { jobs, callbacks } = await jobFixture();
  const app = express(); registerLoyaltyJobRoutes(app, jobs);
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const started = await fetch(`${base}/api/force-give-loyalty-rewards-all/b`, { method: 'POST' });
  assert.equal(started.status, 202); assert.equal((await started.json()).job.status, 'running');
  assert.equal((await (await fetch(`${base}/api/loyalty-check/b`)).json()).job.checked, 0);
  assert.equal((await fetch(`${base}/api/force-give-loyalty-rewards-period/b/bad`, { method: 'POST' })).status, 400);
  await callbacks[0]();
});
test('automatic cycle exposes progress, excludes newly joined users until the next cycle, and avoids overlapping batches', async () => {
  for (let i = 1; i <= 5; i++) await user(i);
  await LoyaltyConfig.create({ botId: 'b', ...config });
  const seen = [], progress = [];
  const sweep = createLoyaltySweep({ User, LoyaltyConfig, botId: 'b', batchSize: 2, publish: p => progress.push(p),
    service: { checkUser: async (botId, u) => { seen.push(u.userId); await new Promise(setImmediate); return { errors: 0 }; } } });
  await Promise.all([sweep.runBatch(), sweep.runBatch()]);
  assert.deepEqual(seen, [1, 2]);
  await user(6); await sweep.runBatch(); await sweep.runBatch();
  assert.deepEqual(seen, [1, 2, 3, 4, 5]);
  assert.equal(progress.at(-1).checked, 5); assert.equal(progress.at(-1).total, 5);
  assert.equal(progress.at(-1).status, 'completed');
  await sweep.runBatch(); assert.equal(progress.at(-1).total, 6);
});
test('automatic checker publishes errors and disabled state without allocating', async () => {
  await user(); await LoyaltyConfig.create({ botId: 'b', ...config });
  const progress = [];
  const sweep = createLoyaltySweep({ User, LoyaltyConfig, botId: 'b', publish: p => progress.push(p),
    service: { checkUser: async () => { throw Object.assign(new Error('secret'), { code: 'EAI_AGAIN' }); } } });
  await sweep.runBatch(); assert.equal(progress.at(-1).errors, 1);
  assert(!JSON.stringify(progress).includes('secret'));
  await LoyaltyConfig.updateOne({ botId: 'b' }, { isEnabled: false });
  await sweep.runBatch(); assert.equal(progress.at(-1).status, 'disabled');
});
