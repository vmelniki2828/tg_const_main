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
  },
  // Поля для отслеживания источника трафика
  firstSource: { type: String, default: 'direct' }, // Первый источник (direct, google_ads, facebook и т.д.)
  firstSourceDate: Date, // Дата первого перехода
  sourceDetails: { // Детали первого источника
    type: { type: String, enum: ['deep_link', 'utm', 'referral', 'direct'], default: 'direct' },
    campaign: String, // Название кампании (если есть)
    medium: String, // Канал (если есть)
    content: String // Контент (если есть)
  },
  // Поля для отслеживания активного времени
  sourceActiveTime: { type: Number, default: 0 }, // Общее активное время в миллисекундах (только для firstSource)
  lastActivityTime: Date, // Время последнего действия
  lastActivityAction: { type: String, enum: ['message', 'callback', 'command'], default: null }, // Тип последнего действия
  sessionStartTime: Date, // Время начала текущей сессии
  totalSessions: { type: Number, default: 0 } // Количество сессий
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

// Схема для ежедневной статистики активности
const DailyActivityStatsSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  date: { type: Date, required: true }, // Дата (начало дня в UTC)
  activeUsers: { type: Number, default: 0 }, // Количество активных пользователей за день
  startCommandUsers: { type: Number, default: 0 }, // Количество пользователей нажавших /start
  buttonClickUsers: { type: Number, default: 0 }, // Количество пользователей нажавших хоть 1 кнопку
  totalButtonClicks: { type: Number, default: 0 }, // Общее количество нажатий кнопок
  totalCommands: { type: Number, default: 0 }, // Общее количество команд
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Схема для отслеживания уникальных пользователей за день (для подсчета уникальных)
const DailyUserActivitySchema = new mongoose.Schema({
  botId: { type: String, required: true },
  date: { type: Date, required: true },
  userId: { type: Number, required: true },
  hasStarted: { type: Boolean, default: false }, // Нажал /start
  hasClickedButton: { type: Boolean, default: false }, // Нажал кнопку
  lastActivityAt: { type: Date, default: Date.now }
});

// Уникальный индекс для botId + date + userId
DailyUserActivitySchema.index({ botId: 1, date: 1, userId: 1 }, { unique: true });
DailyUserActivitySchema.index({ botId: 1, date: -1 });

// Уникальный индекс для botId + date
DailyActivityStatsSchema.index({ botId: 1, date: 1 }, { unique: true });
DailyActivityStatsSchema.index({ botId: 1, date: -1 }); // Для сортировки

// Схема для статистики по блокам
const BlockStatsSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  blockId: { type: String, required: true },
  blockName: String, // Название блока (для удобства)
  enterCount: { type: Number, default: 0 }, // Количество входов в блок
  uniqueUsers: { type: Number, default: 0 }, // Количество уникальных пользователей (обновляется периодически)
  lastEnteredAt: Date, // Последний вход
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Уникальный индекс для botId + blockId
BlockStatsSchema.index({ botId: 1, blockId: 1 }, { unique: true });
BlockStatsSchema.index({ botId: 1, enterCount: -1 }); // Для сортировки по популярности

// Схема для статистики по кнопкам
const ButtonStatsSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  blockId: { type: String, required: true },
  buttonId: { type: String, required: true },
  buttonText: String, // Текст кнопки (для удобства)
  clickCount: { type: Number, default: 0 }, // Количество нажатий
  uniqueUsers: { type: Number, default: 0 }, // Количество уникальных пользователей (обновляется периодически)
  lastClickedAt: Date, // Последнее нажатие
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Уникальный индекс для botId + blockId + buttonId
ButtonStatsSchema.index({ botId: 1, blockId: 1, buttonId: 1 }, { unique: true });
ButtonStatsSchema.index({ botId: 1, clickCount: -1 }); // Для сортировки по популярности

// Схема для хранения индивидуальных маршрутов пользователей
const UserNavigationPathSchema = new mongoose.Schema({
  botId: { type: String, required: true },
  userId: { type: Number, required: true },
  blockId: { type: String, required: true }, // ID блока
  blockName: String, // Название блока (для удобства)
  action: { type: String, enum: ['enter', 'exit'], default: 'enter' }, // Вход или выход
  buttonId: String, // ID кнопки, по которой был переход (если есть)
  buttonText: String, // Текст кнопки (для удобства)
  previousBlockId: String, // Предыдущий блок (откуда пришел)
  timestamp: { type: Date, default: Date.now }, // Время события
  sessionId: String // ID сессии для группировки событий в рамках одной сессии
});

// Индексы для быстрого поиска
UserNavigationPathSchema.index({ botId: 1, userId: 1, timestamp: -1 }); // Для получения маршрута пользователя
UserNavigationPathSchema.index({ botId: 1, userId: 1, sessionId: 1 }); // Для группировки по сессиям

module.exports = {
  Bot: mongoose.model('Bot', BotSchema),
  User: mongoose.model('User', UserSchema),
  QuizStats: mongoose.model('QuizStats', QuizStatsSchema),
  PromoCode: mongoose.model('PromoCode', PromoCodeSchema),
  Loyalty: mongoose.model('Loyalty', LoyaltySchema),
  LoyaltyConfig: mongoose.model('LoyaltyConfig', LoyaltyConfigSchema),
  LoyaltyPromoCode: mongoose.model('LoyaltyPromoCode', LoyaltyPromoCodeSchema),
  DailyActivityStats: mongoose.model('DailyActivityStats', DailyActivityStatsSchema),
  DailyUserActivity: mongoose.model('DailyUserActivity', DailyUserActivitySchema),
  BlockStats: mongoose.model('BlockStats', BlockStatsSchema),
  ButtonStats: mongoose.model('ButtonStats', ButtonStatsSchema),
  UserNavigationPath: mongoose.model('UserNavigationPath', UserNavigationPathSchema)
};