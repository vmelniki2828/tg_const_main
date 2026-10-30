const { Telegraf } = require('telegraf');
const models = require('./models');
const { createLoyaltyService } = require('./loyaltyService');
const agent = require('./telegramAgent');

function telegramClient(token) {
  const telegram = new Telegraf(token, { telegram: { agent } }).telegram;
  return {
    getChatMember: (channel, userId) => telegram.callApi('getChatMember', {
      chat_id: channel, user_id: userId
    }, { signal: AbortSignal.timeout(10000) })
  };
}

const service = createLoyaltyService({ ...models, telegramForBot: async (botId) => {
  const bot = await models.Bot.findOne({ id: botId }).select('token').lean();
  if (!bot?.token) throw new Error('Токен бота не настроен');
  return telegramClient(bot.token);
} });

module.exports = { service, telegramClient };
