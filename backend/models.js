const mongoose = require('mongoose');

const BotSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  token: String,
  isActive: Boolean,
  editorState: Object,
  createdAt: { type: Date, default: Date.now }
});

const UserSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  userId: { type: Number, required: true },
  username: String,
  firstName: String,
  lastName: String,
  firstSubscribedAt: Date,
  lastSubscribedAt: Date,
  isSubscribed: Boolean,
  subscriptionHistory: [
    {
      subscribedAt: Date,
      unsubscribedAt: Date
    }
  ],
  // Поля для отслеживания паузы времени подписки
  totalSubscribedTime: { type: Number, default: 0 }, // Общее время подписки в миллисекундах
  lastUnsubscribedAt: Date, // Время последней отписки
  pausedTime: { type: Number, default: 0 }, // Время на паузе в миллисекундах
  // Поля для программы лояльности
  loyaltyStartedAt: Date, // Время начала участия в программе лояльности
  loyaltyRewards: {
    '1m': { type: Boolean, default: false },
    '24h': { type: Boolean, default: false },
    '7d': { type: Boolean, default: false },
    '30d': { type: Boolean, default: false },
    '90d': { type: Boolean, default: false },
    '180d': { type: Boolean, default: false },
    '360d': { type: Boolean, default: false }
  }
});

const QuizStatsSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  userId: { type: Number, required: true },
  blockId: { type: String, required: true },
  correctAnswers: { type: Number, required: true },
  totalQuestions: { type: Number, required: true },
  percentage: { type: Number, required: true },
  completionTime: { type: Number, required: true },
  answers: [{
    questionIndex: Number,
    answer: String,
    isCorrect: Boolean
  }],
  completedAt: { type: Date, default: Date.now }
});

// Создаем индекс для быстрого поиска
QuizStatsSchema.index({ botId: 1, userId: 1, blockId: 1 }, { unique: true });

const PromoCodeSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  code: { type: String, required: true },
  quizId: String,
  activated: { type: Boolean, default: false },
  activatedBy: Number,
  activatedAt: Date
});

const LoyaltySchema = new mongoose.Schema({
  botId: { type: String, required: true },
  userId: { type: Number, required: true },
  rewards: {
    '1m': { type: Boolean, default: false },
    '24h': { type: Boolean, default: false },
    '7d': { type: Boolean, default: false },
    '30d': { type: Boolean, default: false },
    '90d': { type: Boolean, default: false },
    '180d': { type: Boolean, default: false },
    '360d': { type: Boolean, default: false }
  }
});

// Схема для конфигурации программы лояльности
const LoyaltyConfigSchema = new mongoose.Schema({
  botId: { type: String, required: true, unique: true },
  isEnabled: { type: Boolean, default: false },
  // Настройки канала для проверки подписки
  channelSettings: {
    isRequired: { type: Boolean, default: false }, // Требуется ли подписка на канал
    channelId: { type: String, default: '' }, // ID канала (например: @channel_username или -1001234567890)
    channelUsername: { type: String, default: '' }, // Username канала (например: @channel_username)
    channelTitle: { type: String, default: '' }, // Название канала
    notSubscribedMessage: { type: String, default: 'Для участия в программе лояльности необходимо подписаться на наш канал!' }
  },
  messages: {
    '1m': {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' }
    },
    '24h': {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' }
    },
    '7d': {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' }
    },
    '30d': {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' }
    },
    '90d': {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' }
    },
    '180d': {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' }
    },
    '360d': {
      enabled: { type: Boolean, default: false },
      message: { type: String, default: '' }
    }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Схема для промокодов программы лояльности
const LoyaltyPromoCodeSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  period: { type: String, required: true, enum: ['1m', '24h', '7d', '30d', '90d', '180d', '360d'] },
  code: { type: String, required: true },
  activated: { type: Boolean, default: false },
  activatedBy: Number,
  activatedAt: Date,
  createdAt: { type: Date, default: Date.now }
});

// Индекс для быстрого поиска доступных промокодов
LoyaltyPromoCodeSchema.index({ botId: 1, period: 1, activated: 1 });

// Индекс для уникальности промокода в рамках периода (разрешаем дублирование между периодами)
LoyaltyPromoCodeSchema.index({ botId: 1, period: 1, code: 1 }, { unique: true });

module.exports = {
  Bot: mongoose.model('Bot', BotSchema),
  User: mongoose.model('User', UserSchema),
  QuizStats: mongoose.model('QuizStats', QuizStatsSchema),
  PromoCode: mongoose.model('PromoCode', PromoCodeSchema),
  Loyalty: mongoose.model('Loyalty', LoyaltySchema),
  LoyaltyConfig: mongoose.model('LoyaltyConfig', LoyaltyConfigSchema),
  LoyaltyPromoCode: mongoose.model('LoyaltyPromoCode', LoyaltyPromoCodeSchema)
};