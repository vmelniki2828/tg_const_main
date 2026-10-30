// A persistent, isolated development database. This runner never reads .env
// database credentials and never connects to production or starts production bots.
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const { spawn } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

async function main() {
  const data = path.resolve(__dirname, '../.local-data');
  fs.mkdirSync(path.join(data, 'mongo'), { recursive: true });
  const secretPath = path.join(data, 'session-secret');
  if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, randomBytes(48).toString('hex'), { mode: 0o600, flag: 'wx' });
  const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14' },
    instance: { ip: '127.0.0.1', port: 27019, portGeneration: false, dbPath: path.join(data, 'mongo'),
      dbName: 'tg_const_admin_local', storageEngine: 'wiredTiger' } });
  console.log('Local database ready on 127.0.0.1:27019 (tg_const_admin_local).');
  const child = spawn(process.execPath, ['server.js'], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: '3001',
      MONGO_URI: mongo.getUri('tg_const_admin_local'), AUTH_SESSION_SECRET: fs.readFileSync(secretPath, 'utf8'),
      AUTH_COOKIE_SECURE: 'false', CORS_ORIGIN: 'http://localhost:3000,http://127.0.0.1:3000' } });
  let stopping = false;
  const stop = () => { if (!stopping) { stopping = true; child.kill('SIGTERM'); } };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  child.on('exit', async code => { await mongo.stop({ doCleanup: false }); process.exit(code || 0); });
  child.on('error', async () => { await mongo.stop({ doCleanup: false }); process.exit(1); });
}
main().catch(err => { console.error('Local development startup failed:', err.message); process.exit(1); });
