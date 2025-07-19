const { Telegraf } = require('telegraf');
const { HttpsProxyAgent } = require('https-proxy-agent');

const token = '8059264224:AAFbmpBiKt2cvYK_L6xgcdAoOziU92LrVTw';

// Настройка прокси
const proxyUrl = 'http://proxy.example.com:3128'; // Замените на ваш прокси
const agent = new HttpsProxyAgent(proxyUrl);

const bot = new Telegraf(token, {
  telegram: {
    agent
  }
});

async function testBot() {
  try {
    console.log('Testing bot with proxy...');
    
    // Проверяем токен
    const me = await bot.telegram.getMe();
    console.log('Bot info:', me);

    // Удаляем вебхук
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('Webhook deleted');

    // Простой обработчик
    bot.command('start', ctx => ctx.reply('Test bot is working!'));
    
    // Запускаем бота
    await bot.launch();
    console.log('Bot is running!');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testBot(); 