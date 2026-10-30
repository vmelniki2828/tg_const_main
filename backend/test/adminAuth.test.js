const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { AdminAccount } = require('../adminModels');
const { createAdminAuth, createInitialSuperadmin } = require('../adminAuth');
const { hashPassword, verifyPassword } = require('../adminPasswords');
const origin = 'http://localhost:3000';
const secret = 'test-only-session-secret-not-used-outside-tests';
const password = 'local-test-password-123';
let mongo, server, base, store, superadmin, savedHash;

function testApp(options = {}) {
  const app = express();
  createAdminAuth({ AdminAccount, store: options.store || store, secret,
    allowedOrigins: [origin], secureCookies: false, loginLimit: 1000, ...options }).install(app);
  app.use(express.json());
  app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
  app.get('/api/bots', (req, res) => res.json({ bots: [{ id: 'test-only', token: 'dummy-token' }] }));
  app.post('/api/work', (req, res) => res.json({ success: true }));
  app.get('/uploads/example.txt', (req, res) => res.send('private-media'));
  return app;
}
async function listen(app) {
  const http = app.listen(0, '127.0.0.1');
  await new Promise(resolve => http.once('listening', resolve));
  return http;
}
before(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri()); await AdminAccount.init();
  savedHash = await hashPassword(password);
  store = MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'test_admin_sessions' });
  server = await listen(testApp()); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect(); await mongo.stop();
});
beforeEach(async () => {
  await AdminAccount.deleteMany({}); await mongoose.connection.collection('test_admin_sessions').deleteMany({});
  superadmin = await AdminAccount.create({ login: 'root-admin', name: 'Root', role: 'superadmin', passwordHash: savedHash });
});
async function request(path, { cookie, csrf, method = 'GET', body, headers = {}, endpoint = base } = {}) {
  const response = await fetch(endpoint + path, { method, headers: { Origin: origin, 'X-Requested-With': 'admin-ui',
    ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function login(loginName = 'root-admin', pass = password, endpoint) {
  const r = await request('/api/auth/login', { method: 'POST', body: { login: loginName, password: pass }, endpoint });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  return { cookie: r.cookie, csrf: r.data.csrfToken, user: r.data.user };
}
async function account(values = {}) {
  return AdminAccount.create({ login: 'operator', name: 'Operator', role: 'admin', passwordHash: savedHash, ...values });
}

test('anonymous users cannot read bot tokens, media or mutate legacy API; health stays public', async () => {
  assert.equal((await request('/api/bots')).status, 401);
  assert.equal((await request('/api/work', { method: 'POST', body: {} })).status, 401);
  assert.equal((await request('/uploads/example.txt')).status, 401);
  assert.equal((await request('/api/health')).status, 200);
});

test('login uses a persistent HttpOnly SameSite session and never returns password hashes or session versions', async () => {
  const auth = await login();
  const r = await request('/api/auth/me', auth);
  assert.equal(r.data.user.login, 'root-admin');
  assert.equal(r.data.user.role, 'superadmin');
  assert.equal(r.data.csrfToken.length, 64);
  assert(!JSON.stringify(r.data).includes('passwordHash')); assert(!JSON.stringify(r.data).includes('sessionVersion'));
  const entry = await mongoose.connection.collection('test_admin_sessions').findOne({});
  assert(entry && entry.expires instanceof Date);
  const response = await request('/api/auth/login', { method: 'POST', body: { login: 'root-admin', password } });
  assert.match(response.headers.get('set-cookie'), /HttpOnly/); assert.match(response.headers.get('set-cookie'), /SameSite=Lax/);
  assert.equal((await request('/api/bots', auth)).status, 200);
  assert.equal((await request('/uploads/example.txt', auth)).status, 200);
});

test('invalid, inactive, unknown and injection-shaped logins fail without disclosing account existence', async () => {
  await account({ isActive: false });
  const results = [];
  for (const body of [{ login: 'root-admin', password: 'wrong' }, { login: 'missing-user', password },
    { login: 'operator', password }, { login: { $ne: null }, password }, { login: 'root-admin', password: { $ne: null } }]) {
    const r = await request('/api/auth/login', { method: 'POST', body });
    assert.equal(r.status, 401); results.push(r.data.error);
  }
  assert.equal(new Set(results).size, 1);
});

test('email logins are normalized, unique and accepted by bootstrap and account creation', async () => {
  const root = await login();
  const created = await request('/api/admin-users', { ...root, method: 'POST',
    body: { login: ' Admin@Admin.com ', name: 'Email administrator', role: 'superadmin', password } });
  assert.equal(created.status, 201); assert.equal(created.data.user.login, 'admin@admin.com');
  assert.equal((await login('ADMIN@ADMIN.COM')).user.login, 'admin@admin.com');
  const duplicate = await request('/api/admin-users', { ...root, method: 'POST',
    body: { login: 'admin@admin.com', name: 'Duplicate', password } });
  assert.equal(duplicate.status, 409);
  await AdminAccount.deleteMany({});
  const first = await createInitialSuperadmin(AdminAccount, { login: 'admin@admin.com', name: 'Root', password });
  assert.equal(first.role, 'superadmin'); assert.equal(first.mustChangePassword, false);
});

test('CSRF and origin guards cover JSON, form/multipart-style mutations and logout', async () => {
  const auth = await login();
  assert.equal((await request('/api/work', { cookie: auth.cookie, method: 'POST', body: {} })).status, 403);
  assert.equal((await request('/api/work', { ...auth, method: 'POST', headers: { Origin: 'http://evil.example' } })).status, 403);
  assert.equal((await request('/api/auth/logout', { cookie: auth.cookie, method: 'POST' })).status, 403);
  assert.equal((await request('/api/work', { ...auth, method: 'POST', headers: { 'X-CSRF-Token': 'é'.repeat(64) } })).status, 403);
  assert.equal((await request('/api/work', { ...auth, method: 'POST', body: {} })).status, 200);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { login: 'root-admin', password }, headers: { Origin: 'null' } })).status, 403);
});

test('admins retain legacy actions but cannot list, create, promote or revoke panel accounts', async () => {
  await account(); const auth = await login('operator');
  assert.equal((await request('/api/work', { ...auth, method: 'POST', body: {} })).status, 200);
  for (const [path, method] of [['/api/admin-users', 'GET'], ['/api/admin-users', 'POST'],
    [`/api/admin-users/${superadmin._id}`, 'PATCH'], [`/api/admin-users/${superadmin._id}/reset-password`, 'POST']]) {
    assert.equal((await request(path, { ...auth, method, body: method === 'GET' ? undefined : { role: 'superadmin' } })).status, 403);
  }
});

test('superadmin creates users with hashed temporary passwords; first login cannot bypass password change', async () => {
  const root = await login();
  const r = await request('/api/admin-users', { ...root, method: 'POST', body: { login: ' Operator ', name: 'Operator', password, role: 'admin' } });
  assert.equal(r.status, 201); assert.equal(r.data.user.login, 'operator');
  const stored = await AdminAccount.findById(r.data.user.id).select('+passwordHash');
  assert.notEqual(stored.passwordHash, password); assert(await verifyPassword(password, stored.passwordHash));
  let auth = await login('operator');
  assert.equal(auth.user.mustChangePassword, true);
  const blocked = await request('/api/bots', auth); assert.equal(blocked.status, 403); assert.equal(blocked.data.code, 'PASSWORD_CHANGE_REQUIRED');
  const updated = await request('/api/auth/password', { ...auth, method: 'POST', body: { currentPassword: password, newPassword: 'my-new-password-456' } });
  assert.equal(updated.status, 200); assert.equal(updated.data.user.mustChangePassword, false);
  assert.equal((await request('/api/bots', auth)).status, 401);
  auth = { cookie: updated.cookie, csrf: updated.data.csrfToken };
  assert.equal((await request('/api/bots', auth)).status, 200);
});

test('revocation invalidates every session; restoration never revives the old cookies', async () => {
  const target = await account(); const root = await login();
  const a = await login('operator'), b = await login('operator');
  const path = `/api/admin-users/${target._id}`;
  assert.equal((await request(path, { ...root, method: 'PATCH', body: { isActive: false } })).status, 200);
  assert.equal((await request('/api/bots', a)).status, 401); assert.equal((await request('/api/bots', b)).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { login: 'operator', password } })).status, 401);
  assert.equal((await request(path, { ...root, method: 'PATCH', body: { isActive: true } })).status, 200);
  assert.equal((await request('/api/bots', a)).status, 401);
  assert.equal((await request('/api/bots', await login('operator'))).status, 200);
});

test('password change/reset invalidate other sessions and reject weak passwords', async () => {
  const target = await account(); const root = await login(); const a = await login('operator'), b = await login('operator');
  const path = `/api/admin-users/${target._id}/reset-password`;
  assert.equal((await request(path, { ...root, method: 'POST', body: { password: 'short' } })).status, 400);
  assert.equal((await request(path, { ...root, method: 'POST', body: { password: 'new-temporary-password' } })).status, 200);
  assert.equal((await request('/api/bots', a)).status, 401); assert.equal((await request('/api/bots', b)).status, 401);
  assert.equal((await login('operator', 'new-temporary-password')).user.mustChangePassword, true);
});

test('role changes invalidate sessions and take effect server-side', async () => {
  const target = await account({ role: 'superadmin' }); const root = await login(); const old = await login('operator');
  assert.equal((await request(`/api/admin-users/${target._id}`, { ...root, method: 'PATCH', body: { role: 'admin' } })).status, 200);
  assert.equal((await request('/api/admin-users', old)).status, 401);
  assert.equal((await request('/api/admin-users', await login('operator'))).status, 403);
});

test('self-revocation/demotion are forbidden; concurrent reciprocal revocations retain an active superadmin', async () => {
  const root = await login();
  const self = `/api/admin-users/${superadmin._id}`;
  for (const body of [{ isActive: false }, { role: 'admin' }]) {
    assert.equal((await request(self, { ...root, method: 'PATCH', body })).status, 409);
  }
  const second = await account({ role: 'superadmin' }); const other = await login('operator');
  const results = await Promise.all([
    request(`/api/admin-users/${second._id}`, { ...root, method: 'PATCH', body: { isActive: false } }),
    request(self, { ...other, method: 'PATCH', body: { isActive: false } })
  ]);
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(await AdminAccount.countDocuments({ role: 'superadmin', isActive: true }), 1);
});

test('duplicates, unexpected types, bad IDs and oversized auth bodies are rejected', async () => {
  const root = await login();
  for (const [body, status] of [[{ login: 'ROOT-ADMIN', name: 'Duplicate', password }, 409],
    [{ login: { $ne: '' }, name: 'Invalid', password }, 400], [{ login: 'valid', name: 'Valid', password, role: 'owner' }, 400]]) {
    assert.equal((await request('/api/admin-users', { ...root, method: 'POST', body })).status, status);
  }
  assert.equal((await request('/api/admin-users/not-an-id', { ...root, method: 'PATCH', body: { isActive: false } })).status, 400);
  assert.equal((await request(`/api/admin-users/${superadmin._id}`, { ...root, method: 'PATCH', body: { isActive: 'false' } })).status, 400);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { login: 'a'.repeat(5000), password } })).status, 413);
});

test('logout destroys persisted sessions and a tampered cookie cannot authenticate', async () => {
  const auth = await login();
  assert.equal((await request('/api/auth/logout', { ...auth, method: 'POST' })).status, 200);
  assert.equal((await request('/api/bots', auth)).status, 401);
  assert.equal((await request('/api/bots', { cookie: auth.cookie + 'tampered' })).status, 401);
});

test('login rate limit rejects further attempts and requires a strong session secret', async () => {
  assert.throws(() => createAdminAuth({ AdminAccount, secret: 'short', allowedOrigins: [origin] }));
  const limited = await listen(testApp({ loginLimit: 2 }));
  try {
    const endpoint = `http://127.0.0.1:${limited.address().port}`;
    for (let i = 0; i < 2; i++) assert.equal((await request('/api/auth/login', { endpoint, method: 'POST', body: { login: 'missing', password } })).status, 401);
    assert.equal((await request('/api/auth/login', { endpoint, method: 'POST', body: { login: 'missing', password } })).status, 429);
  } finally { await new Promise(resolve => limited.close(resolve)); }
});

test('bootstrap creates exactly one superadmin and has no public HTTP registration endpoint', async () => {
  await AdminAccount.deleteMany({});
  const results = await Promise.allSettled(Array.from({ length: 2 }, () => createInitialSuperadmin(AdminAccount, { login: 'first-root', name: 'Root', password })));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(await AdminAccount.countDocuments(), 1);
  assert.equal((await request('/api/auth/register', { method: 'POST', body: { login: 'attacker', password } })).status, 401);
});

test('expired sessions and session-store failures fail closed', async () => {
  const auth = await login();
  await mongoose.connection.collection('test_admin_sessions').updateMany({}, { $set: { expires: new Date(0) } });
  assert.equal((await request('/api/bots', auth)).status, 401);
  const fresh = await login();
  class BrokenStore extends session.Store { get(id, done) { done(new Error('test database unavailable')); } }
  const broken = await listen(testApp({ store: new BrokenStore() }));
  try {
    const r = await request('/api/bots', { ...fresh, endpoint: `http://127.0.0.1:${broken.address().port}` });
    assert.equal(r.status, 503); assert(!JSON.stringify(r.data).includes('dummy-token'));
  } finally { await new Promise(resolve => broken.close(resolve)); }
});

test('server enforces the absolute session lifetime even if the cookie or store TTL is extended', async () => {
  const auth = await login();
  const collection = mongoose.connection.collection('test_admin_sessions');
  const stored = await collection.findOne({});
  const data = JSON.parse(stored.session); data.expiresAt = Date.now() - 1;
  await collection.updateOne({ _id: stored._id }, { $set: { session: JSON.stringify(data), expires: new Date(Date.now() + 86400000) } });
  assert.equal((await request('/api/bots', auth)).status, 401);
});

test('HTTPS configuration sets Secure cookies and protected media cannot be publicly cached', async () => {
  const secureStore = MongoStore.create({ client: mongoose.connection.getClient(), collectionName: 'test_admin_sessions' });
  const app = testApp({ secureCookies: true, store: secureStore }); app.set('trust proxy', 'loopback');
  const secure = await listen(app);
  try {
    const r = await request('/api/auth/login', { endpoint: `http://127.0.0.1:${secure.address().port}`,
      method: 'POST', headers: { 'X-Forwarded-Proto': 'https' }, body: { login: 'root-admin', password } });
    assert.equal(r.status, 200); assert.match(r.headers.get('set-cookie'), /; Secure;/);
  } finally { await new Promise(resolve => secure.close(resolve)); }
  const media = await request('/uploads/example.txt', await login());
  assert.equal(media.status, 200, JSON.stringify(media.data));
  assert.equal(media.headers.get('cache-control'), 'private, no-store');
});
