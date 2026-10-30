const express = require('express');
const session = require('express-session');
const { rateLimit } = require('express-rate-limit');
const { randomBytes, timingSafeEqual } = require('crypto');
const { hashPassword, verifyPassword, validatePassword } = require('./adminPasswords');

const COOKIE_NAME = 'admin.sid';
const roles = ['admin', 'superadmin'];
const error = (status, message) => Object.assign(new Error(message), { status });

function loginValue(value) {
  const login = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const username = /^[a-z0-9][a-z0-9._-]{2,63}$/.test(login);
  const email = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(login);
  if (login.length > 254 || (!username && !email)) {
    throw error(400, 'Вкажіть email або логін із 3–64 латинських літер, цифр, крапок, дефісів чи підкреслень.');
  }
  return login;
}

function nameValue(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 100) {
    throw error(400, 'Вкажіть ім’я до 100 символів.');
  }
  return value.trim();
}

function publicAccount(account) {
  return { id: String(account._id), login: account.login, name: account.name, role: account.role,
    isActive: account.isActive, mustChangePassword: account.mustChangePassword,
    createdAt: account.createdAt, lastLoginAt: account.lastLoginAt };
}

async function createInitialSuperadmin(AdminAccount, input) {
  const login = loginValue(input.login);
  const name = nameValue(input.name);
  const passwordHash = await hashPassword(input.password);
  if (await AdminAccount.exists({})) throw error(409, 'Перший обліковий запис уже створено. Скористайтеся входом.');
  // Fixed bootstrap ID also prevents two concurrent bootstrap commands.
  return AdminAccount.create({ _id: '000000000000000000000001', login, name,
    passwordHash, role: 'superadmin', isActive: true });
}

function createAdminAuth({ AdminAccount, store, secret, allowedOrigins,
  secureCookies = process.env.NODE_ENV === 'production', loginLimit = 15 }) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new Error('AUTH_SESSION_SECRET має містити щонайменше 32 символи.');
  }
  const origins = new Set(allowedOrigins);
  if (!origins.size || origins.has('*')) throw new Error('Вкажіть конкретні дозволені origin адмінпанелі.');
  const cookie = { httpOnly: true, sameSite: 'lax', secure: secureCookies, path: '/' };
  const router = express.Router();
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const sessionMiddleware = session({ name: COOKIE_NAME, secret, store, resave: false,
    saveUninitialized: false, rolling: false, cookie: { ...cookie, maxAge: 8 * 60 * 60 * 1000 } });
  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  // Account administration is serialized in this application's single backend
  // process. Reload the actor inside the queue to prevent reciprocal revocation.
  let mutationQueue = Promise.resolve();
  function serial(fn) {
    const work = mutationQueue.then(fn);
    mutationQueue = work.catch(() => {});
    return work;
  }
  const destroy = req => new Promise((resolve, reject) => req.session.destroy(err => err ? reject(err) : resolve()));

  async function accountForSession(req) {
    if (!/^[a-f0-9]{24}$/i.test(req.session?.accountId || '')) return null;
    if (!Number.isFinite(req.session.expiresAt) || req.session.expiresAt <= Date.now()) return null;
    const account = await AdminAccount.findById(req.session.accountId).select('+sessionVersion');
    return account?.isActive && account.sessionVersion === req.session.authVersion ? account : null;
  }

  const requireAuth = wrap(async (req, res, next) => {
    const account = await accountForSession(req);
    if (!account) {
      if (req.session?.accountId) await destroy(req);
      res.clearCookie(COOKIE_NAME, cookie);
      return res.status(401).json({ error: 'Увійдіть в адмінпанель.', code: 'AUTH_REQUIRED' });
    }
    req.adminAccount = account;
    next();
  });

  function requireChangedPassword(req, res, next) {
    if (req.adminAccount.mustChangePassword) {
      return res.status(403).json({ error: 'Спочатку змініть тимчасовий пароль.', code: 'PASSWORD_CHANGE_REQUIRED' });
    }
    next();
  }

  function mutationOrigin(req, res, next) {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      (!origins.has(req.get('Origin')) || req.get('X-Requested-With') !== 'admin-ui')) {
      return res.status(403).json({ error: 'Недозволене джерело запиту.', code: 'ORIGIN_REJECTED' });
    }
    next();
  }

  function csrf(req, res, next) {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const supplied = req.get('X-CSRF-Token');
    const expected = req.session.csrfToken;
    if (typeof supplied !== 'string' || typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(supplied) ||
      supplied.length !== expected.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
      return res.status(403).json({ error: 'Оновіть сторінку та повторіть дію.', code: 'CSRF_REJECTED' });
    }
    next();
  }

  async function signIn(req, account) {
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.accountId = String(account._id);
    req.session.authVersion = account.sessionVersion;
    req.session.expiresAt = Date.now() + 8 * 60 * 60 * 1000;
    req.session.csrfToken = randomBytes(32).toString('hex');
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return { user: publicAccount(account), csrfToken: req.session.csrfToken };
  }

  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(mutationOrigin);
  router.use(express.json({ limit: '4kb' }));
  router.post('/login', express.json({ limit: '4kb' }), rateLimit({ windowMs: 15 * 60 * 1000,
    limit: loginLimit, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Забагато спроб входу. Повторіть через 15 хвилин.' } }), wrap(async (req, res) => {
    let login;
    try { login = loginValue(req.body?.login); } catch { login = null; }
    const account = login ? await AdminAccount.findOne({ login }).select('+passwordHash +sessionVersion') : null;
    const valid = await verifyPassword(req.body?.password, account?.passwordHash || await dummyHash);
    if (!valid || !account?.isActive) return res.status(401).json({ error: 'Невірний логін або пароль.' });
    // A concurrent reset/revocation must not create an authenticated session.
    const current = await AdminAccount.findOneAndUpdate({ _id: account._id, isActive: true,
      sessionVersion: account.sessionVersion }, { $set: { lastLoginAt: new Date() } }, { new: true }).select('+sessionVersion');
    if (!current) return res.status(401).json({ error: 'Невірний логін або пароль.' });
    res.json(await signIn(req, current));
  }));
  router.use(requireAuth);
  router.use(csrf);
  router.get('/me', (req, res) => res.json({ user: publicAccount(req.adminAccount), csrfToken: req.session.csrfToken }));
  router.post('/logout', wrap(async (req, res) => {
    await destroy(req); res.clearCookie(COOKIE_NAME, cookie); res.json({ success: true });
  }));
  router.post('/password', wrap(async (req, res) => {
    validatePassword(req.body?.newPassword);
    if (req.body.newPassword === req.body.currentPassword) throw error(400, 'Новий пароль має відрізнятися від поточного.');
    const account = await AdminAccount.findById(req.adminAccount._id).select('+passwordHash');
    if (!await verifyPassword(req.body.currentPassword, account.passwordHash)) throw error(400, 'Поточний пароль невірний.');
    const passwordHash = await hashPassword(req.body.newPassword);
    const updated = await AdminAccount.findOneAndUpdate({ _id: account._id, isActive: true,
      sessionVersion: req.adminAccount.sessionVersion }, { $set: { passwordHash, mustChangePassword: false },
      $inc: { sessionVersion: 1 } }, { new: true }).select('+sessionVersion');
    if (!updated) throw error(401, 'Сесію відкликано. Увійдіть знову.');
    res.json(await signIn(req, updated));
  }));

  const users = express.Router();
  users.use(express.json({ limit: '4kb' }));
  users.use((req, res, next) => req.adminAccount.role === 'superadmin' ? next() :
    res.status(403).json({ error: 'Керування доступом доступне лише суперадміністратору.' }));
  async function currentSuper(req) {
    const actor = await accountForSession(req);
    if (actor?.role !== 'superadmin' || actor.mustChangePassword) throw error(403, 'Право керувати доступом відкликано.');
    return actor;
  }
  users.param('id', (req, res, next, id) => /^[a-f0-9]{24}$/i.test(id) ? next() : res.status(400).json({ error: 'Невірний ID користувача.' }));
  users.get('/', wrap(async (req, res) => res.json({ users: (await AdminAccount.find().sort({ createdAt: 1 })).map(publicAccount) })));
  users.post('/', wrap(async (req, res) => {
    const login = loginValue(req.body?.login), name = nameValue(req.body?.name);
    const role = req.body.role || 'admin';
    if (!roles.includes(role)) throw error(400, 'Невідома роль.');
    const passwordHash = await hashPassword(req.body.password);
    const account = await serial(async () => {
      const actor = await currentSuper(req);
      return AdminAccount.create({ login, name, role, passwordHash, mustChangePassword: true,
        isActive: true, createdBy: actor._id, updatedBy: actor._id });
    });
    res.status(201).json({ user: publicAccount(account) });
  }));
  users.patch('/:id', wrap(async (req, res) => {
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) throw error(400, 'Потрібен JSON-об’єкт зі змінами доступу.');
    const changes = {};
    if (Object.hasOwn(req.body, 'role')) {
      if (!roles.includes(req.body.role)) throw error(400, 'Невідома роль.');
      changes.role = req.body.role;
    }
    if (Object.hasOwn(req.body, 'isActive')) {
      if (typeof req.body.isActive !== 'boolean') throw error(400, 'Невірний стан доступу.');
      changes.isActive = req.body.isActive;
    }
    if (!Object.keys(changes).length) throw error(400, 'Немає змін доступу.');
    const account = await serial(async () => {
      const actor = await currentSuper(req);
      const target = await AdminAccount.findById(req.params.id);
      if (!target) throw error(404, 'Користувача не знайдено.');
      if (String(actor._id) === String(target._id) && (changes.isActive === false || changes.role === 'admin')) {
        throw error(409, 'Не можна відкликати власний доступ або понизити власну роль.');
      }
      if (target.isActive && target.role === 'superadmin' && (changes.isActive === false || changes.role === 'admin') &&
        await AdminAccount.countDocuments({ role: 'superadmin', isActive: true }) <= 1) {
        throw error(409, 'Потрібен хоча б один активний суперадміністратор.');
      }
      return AdminAccount.findByIdAndUpdate(target._id, { $set: { ...changes, updatedBy: actor._id },
        $inc: { sessionVersion: 1 } }, { new: true });
    });
    res.json({ user: publicAccount(account) });
  }));
  users.post('/:id/reset-password', wrap(async (req, res) => {
    const passwordHash = await hashPassword(req.body?.password);
    const account = await serial(async () => {
      const actor = await currentSuper(req);
      if (String(actor._id) === req.params.id) throw error(409, 'Власний пароль змініть через меню профілю.');
      return AdminAccount.findByIdAndUpdate(req.params.id, { $set: { passwordHash, mustChangePassword: true,
        updatedBy: actor._id }, $inc: { sessionVersion: 1 } }, { new: true });
    });
    if (!account) throw error(404, 'Користувача не знайдено.');
    res.json({ user: publicAccount(account) });
  }));
  function authErrors(err, req, res, next) {
    if (err.code === 11000) return res.status(409).json({ error: 'Цей логін уже використовується.' });
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.status === 413 ? 'Запит завеликий.' : err.message });
    console.error('Admin auth failure:', err.name); // Never log bodies, passwords or session IDs.
    res.status(503).json({ error: 'Сервіс авторизації тимчасово недоступний.' });
  }
  router.use(authErrors);
  users.use(authErrors);

  function install(app) {
    app.disable('x-powered-by');
    app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    // Keep health probes independent of the session store. All other API routes
    // (including ones added later) pass through the same authorization boundary.
    app.use(['/api', '/uploads'], (req, res, next) => req.path === '/health' && ['GET', 'HEAD'].includes(req.method) ? next() : sessionMiddleware(req, res, next));
    app.use('/api/auth', router);
    app.use('/api', (req, res, next) => req.path === '/health' && ['GET', 'HEAD'].includes(req.method) ? next() : requireAuth(req, res, next));
    app.use('/api', (req, res, next) => req.path === '/health' && ['GET', 'HEAD'].includes(req.method) ? next() : requireChangedPassword(req, res, next));
    app.use('/api', mutationOrigin, csrf);
    app.use('/api/admin-users', users);
    app.use('/uploads', requireAuth, requireChangedPassword, (req, res, next) => {
      res.set('Cache-Control', 'private, no-store'); next();
    });
    // This handler catches session-store and guard failures before legacy routes.
    app.use(authErrors);
  }
  return { install, router };
}

module.exports = { createAdminAuth, createInitialSuperadmin, publicAccount, COOKIE_NAME };
