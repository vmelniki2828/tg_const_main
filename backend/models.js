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
  loyaltyRewards: {
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
  quizId: { type: String, required: true },
  attempts: [
    {
      timestamp: Date,
      success: Boolean,
      score: Number,
      duration: Number,
      answers: Array,
      promoCode: String
    }
  ]
});

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
    '24h': { type: Boolean, default: false },
    '7d': { type: Boolean, default: false },
    '30d': { type: Boolean, default: false },
    '90d': { type: Boolean, default: false },
    '180d': { type: Boolean, default: false },
    '360d': { type: Boolean, default: false }
  }
});

module.exports = {
  Bot: mongoose.model('Bot', BotSchema),
  User: mongoose.model('User', UserSchema),
  QuizStats: mongoose.model('QuizStats', QuizStatsSchema),
  PromoCode: mongoose.model('PromoCode', PromoCodeSchema),
  Loyalty: mongoose.model('Loyalty', LoyaltySchema)
};