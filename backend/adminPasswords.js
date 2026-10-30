const { randomBytes, scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw Object.assign(new Error('Пароль має містити від 12 до 128 символів.'), { status: 400 });
  }
}

async function hashPassword(password) {
  validatePassword(password);
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return `scrypt-v1$${salt}$${hash.toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  if (typeof password !== 'string' || password.length > 128 || typeof encoded !== 'string') return false;
  const [version, salt, hex] = encoded.split('$');
  if (version !== 'scrypt-v1' || !/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
  const hash = await derive(password, salt, 64, options);
  return timingSafeEqual(hash, Buffer.from(hex, 'hex'));
}

module.exports = { hashPassword, verifyPassword, validatePassword };
