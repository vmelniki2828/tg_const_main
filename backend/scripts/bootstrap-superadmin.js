const mongoose = require('mongoose');
const readline = require('readline/promises');
const { Writable } = require('stream');
const { AdminAccount } = require('../adminModels');
const { createInitialSuperadmin } = require('../adminAuth');

async function hiddenQuestion(label) {
  process.stdout.write(label);
  const output = new Writable({ write(chunk, encoding, done) { done(); } });
  const prompt = readline.createInterface({ input: process.stdin, output, terminal: true });
  try { return await prompt.question(''); }
  finally { prompt.close(); process.stdout.write('\n'); }
}
async function main() {
  if (!process.stdin.isTTY) throw new Error('Запустіть команду в інтерактивному терміналі. Паролі не передаються через аргументи командного рядка.');
  // Explicitly isolated default; never fall back to an IP from deployment files.
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27019/tg_const_admin_local';
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  await AdminAccount.init();
  if (await AdminAccount.exists({})) throw new Error('Перший користувач уже існує. Додайте інших через адмінпанель.');
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  const login = await prompt.question('Логін суперадміністратора: ');
  const name = await prompt.question('Ім’я: ');
  prompt.close();
  const password = await hiddenQuestion('Пароль (12–128 символів, введення приховане): ');
  const confirmation = await hiddenQuestion('Повторіть пароль: ');
  if (password !== confirmation) throw new Error('Паролі не збігаються.');
  await createInitialSuperadmin(AdminAccount, { login, name, password });
  console.log('Суперадміністратора створено. Можна увійти в адмінпанель.');
}
main().catch(err => { console.error(err.code === 11000 ? 'Обліковий запис уже існує.' : err.message); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
