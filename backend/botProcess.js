const { Telegraf } = require('telegraf');
const { Bot, User, QuizStats, TriviaStats, PromoCode, Loyalty, LoyaltyConfig, LoyaltyPromoCode } = require('./models');
const {
  trackActiveUser,
  trackStartCommand,
  trackButtonClick,
  trackBlockEnter,
  trackBlockTransition,
  trackBlockEnterWithPath
} = require('./statisticsUtils');
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tg_const_main';
const mongoOptions = {
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
};

// Передаем в процесс только ID бота. Токен и сценарий читаются из MongoDB,
// чтобы большой editorState не превышал системный лимит размера argv (E2BIG).
const [botId] = process.argv.slice(2);

if (!botId) {
  console.error('Missing required argument: botId');
  process.exit(1);
}

let token;
let state;
let bot;

async function connectToMongo() {
  try {
    await mongoose.connect(MONGO_URI, mongoOptions);
    console.log('✅ MongoDB connected (botProcess.js)');
  } catch (firstError) {
    console.error('❌ MongoDB connection error (botProcess.js):', firstError);
    console.error('❌ Retrying MongoDB connection in 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    await mongoose.connect(MONGO_URI, mongoOptions);
    console.log('✅ MongoDB connected after retry (botProcess.js)');
  }
}

const mongoReady = connectToMongo();

// Кэш для промокодов
const promoCodeCache = new Map();

/** Экранирование текста для Telegram HTML */
function escapeTelegramHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeTelegramHref(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;');
}

/**
 * Ссылки: [видимый текст](url). URL можно без https:// — добавится автоматически.
 * Остальной текст экранируется как HTML.
 */
function formatMessageWithMarkdownLinksToHtml(text) {
  if (text == null || text === '') return '';
  const str = String(text);
  const linkRe = /\[([^\]]*)\]\(([^)]+)\)/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = linkRe.exec(str)) !== null) {
    out += escapeTelegramHtml(str.slice(last, m.index));
    const hrefRaw = m[2].trim();
    let href = hrefRaw;
    if (!/^https?:\/\//i.test(href)) {
      if (/^javascript:/i.test(href) || /^data:/i.test(href)) {
        out += escapeTelegramHtml(m[0]);
        last = m.index + m[0].length;
        continue;
      }
      href = 'https://' + href;
    }
    out += '<a href="' + escapeTelegramHref(href) + '">' + escapeTelegramHtml(m[1]) + '</a>';
    last = m.index + m[0].length;
  }
  out += escapeTelegramHtml(str.slice(last));
  return out;
}

// Функция для отправки медиафайлов (оптимизированная)
async function sendMediaMessage(ctx, message, mediaFiles, keyboard, inlineKeyboard = []) {
  const fs = require('fs');
  const path = require('path');
  const htmlMessage = formatMessageWithMarkdownLinksToHtml(message || '');
  const parseModeHtml = { parse_mode: 'HTML' };

  console.log(`🔍 DEBUG: sendMediaMessage called with:`);
  const msgPreview = String(message || '');
  console.log(`  - message: ${msgPreview.length > 50 ? msgPreview.substring(0, 50) + '...' : msgPreview}`);
  console.log(`  - mediaFiles: ${mediaFiles ? mediaFiles.length : 0} files`);
  console.log(`  - keyboard: ${keyboard.length} rows`);
  console.log(`  - inlineKeyboard: ${inlineKeyboard.length} rows`);
  
  try {
    // Проверяем, что mediaFiles существует и не пустой
    if (!mediaFiles || !Array.isArray(mediaFiles) || mediaFiles.length === 0) {
      console.log(`🔍 DEBUG: No media files, sending text only`);
      // Если нет медиафайлов, отправляем только текст
      const replyMarkup = {};
      if (keyboard.length > 0) {
        replyMarkup.keyboard = keyboard;
        replyMarkup.resize_keyboard = true;
      }
      if (inlineKeyboard.length > 0) {
        replyMarkup.inline_keyboard = inlineKeyboard;
      }
      
      console.log(`🔍 DEBUG: Sending text message with reply markup:`, JSON.stringify(replyMarkup));
      
      // Добавляем timeout для отправки сообщения
      const sendPromise = ctx.reply(htmlMessage, {
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined,
        ...parseModeHtml
      });
      
      // Timeout 10 секунд
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Message send timeout')), 10000);
      });
      
      await Promise.race([sendPromise, timeoutPromise]);
      console.log(`🔍 DEBUG: Text message sent successfully`);
      return;
    }

    // Если есть только один медиафайл
    if (mediaFiles.length === 1) {
      console.log(`🔍 DEBUG: Single media file detected`);
      const media = mediaFiles[0];
      const filePath = path.join(__dirname, 'uploads', media.filename);
      
      console.log(`🔍 DEBUG: Media file path: ${filePath}`);
      console.log(`🔍 DEBUG: File exists: ${fs.existsSync(filePath)}`);
      
      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
        console.log(`🔍 DEBUG: Media file not found, sending text only`);
        const replyMarkup = {};
        if (keyboard.length > 0) {
          replyMarkup.keyboard = keyboard;
          replyMarkup.resize_keyboard = true;
        }
        if (inlineKeyboard.length > 0) {
          replyMarkup.inline_keyboard = inlineKeyboard;
        }
        
        console.log(`🔍 DEBUG: Sending fallback text message`);
        
        // Добавляем timeout для отправки сообщения
        const sendPromise = ctx.reply(htmlMessage, {
          reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined,
          ...parseModeHtml
        });
        
        // Timeout 10 секунд
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Message send timeout')), 10000);
        });
        
        await Promise.race([sendPromise, timeoutPromise]);
        console.log(`🔍 DEBUG: Fallback text message sent successfully`);
        return;
      }

      const replyMarkup = {};
      if (keyboard.length > 0) {
        replyMarkup.keyboard = keyboard;
        replyMarkup.resize_keyboard = true;
      }
      if (inlineKeyboard.length > 0) {
        replyMarkup.inline_keyboard = inlineKeyboard;
      }

      const options = {
        caption: htmlMessage,
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined,
        ...parseModeHtml
      };

      console.log(`🔍 DEBUG: Sending media with options:`, JSON.stringify(options));

      // Добавляем timeout для отправки медиа
      const sendMediaPromise = (async () => {
        // Определяем тип медиа и отправляем соответствующим методом
        if (media.mimetype.startsWith('image/')) {
          console.log(`🔍 DEBUG: Sending as photo`);
          return await ctx.replyWithPhoto({ source: filePath }, options);
        } else if (media.mimetype.startsWith('video/')) {
          console.log(`🔍 DEBUG: Sending as video`);
          return await ctx.replyWithVideo({ source: filePath }, options);
        } else if (media.mimetype.startsWith('audio/')) {
          console.log(`🔍 DEBUG: Sending as audio`);
          return await ctx.replyWithAudio({ source: filePath }, options);
        } else if (media.mimetype.startsWith('application/')) {
          console.log(`🔍 DEBUG: Sending as document`);
          return await ctx.replyWithDocument({ source: filePath }, options);
        } else {
          console.log(`🔍 DEBUG: Sending as document (fallback)`);
          return await ctx.replyWithDocument({ source: filePath }, options);
        }
      })();
      
      // Timeout 15 секунд для медиа
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Media send timeout')), 15000);
      });
      
      await Promise.race([sendMediaPromise, timeoutPromise]);
      console.log(`🔍 DEBUG: Media message sent successfully`);
    } else {
      console.log(`🔍 DEBUG: Multiple media files detected`);
      // Множественные медиафайлы
      const mediaGroup = [];
      const validFiles = [];
      
      for (const media of mediaFiles) {
        const filePath = path.join(__dirname, 'uploads', media.filename);
        console.log(`🔍 DEBUG: Checking media file: ${filePath} (exists: ${fs.existsSync(filePath)})`);
        if (fs.existsSync(filePath)) {
          validFiles.push({ ...media, filePath });
        }
      }
      
      console.log(`🔍 DEBUG: Valid files found: ${validFiles.length}`);
      
      if (validFiles.length === 0) {
        console.log(`🔍 DEBUG: No valid media files, sending text only`);
        const replyMarkup = {};
        if (keyboard.length > 0) {
          replyMarkup.keyboard = keyboard;
          replyMarkup.resize_keyboard = true;
        }
        if (inlineKeyboard.length > 0) {
          replyMarkup.inline_keyboard = inlineKeyboard;
        }
        
        // Добавляем timeout для отправки сообщения
        const sendPromise = ctx.reply(htmlMessage, {
          reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined,
          ...parseModeHtml
        });
        
        // Timeout 10 секунд
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Message send timeout')), 10000);
        });
        
        await Promise.race([sendPromise, timeoutPromise]);
        console.log(`🔍 DEBUG: Fallback text message sent successfully`);
        return;
      }
      
      // Добавляем медиафайлы в группу
      for (const media of validFiles) {
        const mediaInput = { source: media.filePath };
        
        if (media.mimetype.startsWith('image/')) {
          mediaGroup.push({ type: 'photo', media: mediaInput });
        } else if (media.mimetype.startsWith('video/')) {
          mediaGroup.push({ type: 'video', media: mediaInput });
        } else if (media.mimetype.startsWith('audio/')) {
          mediaGroup.push({ type: 'audio', media: mediaInput });
        } else {
          mediaGroup.push({ type: 'document', media: mediaInput });
        }
      }
      
      const replyMarkup = {};
      if (keyboard.length > 0) {
        replyMarkup.keyboard = keyboard;
        replyMarkup.resize_keyboard = true;
      }
      if (inlineKeyboard.length > 0) {
        replyMarkup.inline_keyboard = inlineKeyboard;
      }
      
      console.log(`🔍 DEBUG: Sending media group with ${mediaGroup.length} files`);
      
      // Подпись и parse_mode только на первом элементе альбома (требование Telegram API)
      const mediaGroupWithCaption =
        htmlMessage !== ''
          ? mediaGroup.map((item, i) =>
              i === 0 ? { ...item, caption: htmlMessage, ...parseModeHtml } : item
            )
          : mediaGroup;

      // Добавляем timeout для отправки медиагруппы
      const sendGroupPromise = ctx.replyWithMediaGroup(mediaGroupWithCaption, {
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
      });
      
      // Timeout 20 секунд для медиагруппы
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Media group send timeout')), 20000);
      });
      
      await Promise.race([sendGroupPromise, timeoutPromise]);
      console.log(`🔍 DEBUG: Media group sent successfully`);
    }
  } catch (error) {
    console.error('Error sending media message:', error);
    
    // Обработка ошибки 403 (пользователь заблокировал бота)
    if (error.response && error.response.error_code === 403) {
      console.log(`⚠️ User blocked the bot (403 error), ignoring`);
      return;
    }
    
    // Обработка timeout ошибок
    if (error.message && error.message.includes('timeout')) {
      console.log(`⚠️ Message send timeout, skipping`);
      return;
    }
    
    // Fallback к текстовому сообщению
    try {
      console.log(`🔍 DEBUG: Attempting fallback to text message`);
      const replyMarkup = {};
      if (keyboard.length > 0) {
        replyMarkup.keyboard = keyboard;
        replyMarkup.resize_keyboard = true;
      }
      if (inlineKeyboard.length > 0) {
        replyMarkup.inline_keyboard = inlineKeyboard;
      }
      
      // Добавляем timeout для fallback
      const sendPromise = ctx.reply(htmlMessage, {
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined,
        ...parseModeHtml
      });
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Fallback timeout')), 5000);
      });
      
      await Promise.race([sendPromise, timeoutPromise]);
      console.log(`🔍 DEBUG: Fallback text message sent successfully`);
    } catch (fallbackError) {
      console.error('Error in fallback message sending:', fallbackError);
      // Если и fallback не работает, просто игнорируем ошибку
      if (fallbackError.response && fallbackError.response.error_code === 403) {
        console.log(`⚠️ User blocked the bot (403 error in fallback), ignoring`);
        return;
      }
    }
  }
}

// Универсальная функция для сохранения пользователя в MongoDB
// Функция для обработки источника из параметра start
// Поддерживает форматы:
// 1. Только источник: "google_ads" → source: google_ads, blockId: null
// 2. Только блок: "1757499906988" → source: 'direct', blockId: 1757499906988
// 3. Источник + блок: "google_ads:1757499906988" → source: google_ads, blockId: 1757499906988
function parseSourceFromStart(startParam) {
  if (!startParam) {
    return {
      source: 'direct',
      blockId: null,
      type: 'direct',
      details: {}
    };
  }
  
  const trimmed = startParam.trim();
  
  // Проверяем формат "источник:ID_блока"
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const source = parts[0].trim();
    const blockIdStr = parts[1].trim();
    
    // Проверяем, является ли blockId числом
    const blockId = !isNaN(blockIdStr) ? Number(blockIdStr) : blockIdStr;
  
  return {
      source: source || 'direct',
      blockId: blockId,
    type: 'deep_link',
    details: {
      campaign: source.includes('_') ? source.split('_').slice(1).join('_') : null,
      medium: source.split('_')[0] || null
      }
    };
  }
  
  // Проверяем, является ли параметр числом (ID блока)
  if (!isNaN(trimmed)) {
    return {
      source: 'direct',
      blockId: Number(trimmed),
      type: 'deep_link',
      details: {}
    };
  }
  
  // Иначе это источник (например: google_ads, facebook_campaign1)
  return {
    source: trimmed,
    blockId: null,
    type: 'deep_link',
    details: {
      campaign: trimmed.includes('_') ? trimmed.split('_').slice(1).join('_') : null,
      medium: trimmed.split('_')[0] || null
    }
  };
}

// Функция для отслеживания активности пользователя
async function trackUserActivity(userId, actionType = 'message') {
  try {
    const user = await User.findOne({ botId, userId });
    if (!user) {
      return;
    }
    
    const now = new Date();
    const currentTime = now.getTime();
    
    // Если у пользователя нет источника, устанавливаем 'direct' по умолчанию
    if (!user.firstSource) {
      await User.updateOne(
        { botId, userId },
        { $set: { firstSource: 'direct', firstSourceDate: now } }
      );
    }
    
    // Если это первое действие пользователя
    if (!user.lastActivityTime) {
      await User.updateOne(
        { botId, userId },
        {
          $set: {
            lastActivityTime: now,
            lastActivityAction: actionType,
            sessionStartTime: now,
            totalSessions: 1
          }
        }
      );
      return;
    }
    
    const lastActivityTime = user.lastActivityTime.getTime();
    const timeDiff = currentTime - lastActivityTime;
    
    // Если прошло меньше или равно 5 минут - добавляем время к активному времени
    if (timeDiff <= MAX_SESSION_INTERVAL) {
      const newActiveTime = (user.sourceActiveTime || 0) + timeDiff;
      
      await User.updateOne(
        { botId, userId },
        {
          $set: {
            sourceActiveTime: newActiveTime,
            lastActivityTime: now,
            lastActivityAction: actionType
          }
        }
      );
    } else {
      // Если прошло больше 5 минут - начинаем новую сессию
      await User.updateOne(
        { botId, userId },
        {
          $set: {
            lastActivityTime: now,
            lastActivityAction: actionType,
            sessionStartTime: now
          },
          $inc: { totalSessions: 1 }
        }
      );
    }
    
    // Отслеживаем активного пользователя для статистики (асинхронно)
    setImmediate(async () => {
      try {
        await trackActiveUser(botId, userId);
      } catch (error) {
        console.error('[STATS] Ошибка при отслеживании активного пользователя:', error);
      }
    });
  } catch (error) {
    console.error(`[TRACKING] Ошибка отслеживания активности пользователя ${userId}:`, error);
  }
}

async function saveUserToMongo(ctx) {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  try {
    console.log(`[MongoDB] saveUserToMongo: попытка сохранить пользователя:`, { botId, userId, from: ctx.from });
    
    // Обрабатываем источник из параметра start (если есть)
    let sourceData = null;
    if (ctx.parsedSource) {
      // Используем уже распарсенный источник из команды /start
      const startParam = ctx.startParam || '';
      sourceData = parseSourceFromStart(startParam);
    } else if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/start')) {
      const startParam = ctx.message.text.split(' ')[1]; // Получаем параметр после /start
      sourceData = parseSourceFromStart(startParam);
    } else if (ctx.startParam) {
      // Если параметр передан через ctx.startParam (для deep links)
      sourceData = parseSourceFromStart(ctx.startParam);
    }
    
    // Сначала проверяем, существует ли пользователь
    const existingUser = await User.findOne({ botId, userId });
    
    if (existingUser) {
      // Обновляем существующего пользователя (НЕ сбрасываем время подписки)
      const updateData = {
        isSubscribed: true,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name
      };
      
      // Устанавливаем источник только если его еще нет (сохраняем первый источник)
      if (sourceData && (!existingUser.firstSource || existingUser.firstSource === 'direct')) {
        updateData.firstSource = sourceData.source;
        updateData.firstSourceDate = new Date();
        updateData.sourceDetails = {
          type: sourceData.type,
          campaign: sourceData.details.campaign || null,
          medium: sourceData.details.medium || null,
          content: sourceData.details.content || null
        };
        console.log(`[MongoDB] saveUserToMongo: установлен источник ${sourceData.source} для пользователя ${userId}`);
      }
      
      // Автоматически устанавливаем loyaltyStartedAt если его нет и пользователь подписан
      let shouldCheckLoyalty = false;
      if (!existingUser.loyaltyStartedAt && existingUser.isSubscribed) {
        updateData.loyaltyStartedAt = existingUser.firstSubscribedAt || new Date();
        shouldCheckLoyalty = true;
        console.log(`[MongoDB] saveUserToMongo: устанавливаем loyaltyStartedAt для пользователя ${userId}: ${updateData.loyaltyStartedAt}`);
      }
      
      // Обновляем lastSubscribedAt только если пользователь был отписан
      if (!existingUser.isSubscribed) {
        updateData.lastSubscribedAt = new Date();
        console.log('[MongoDB] saveUserToMongo: пользователь переподписался, обновляем время');
      }
      
    const updateResult = await User.updateOne(
      { botId, userId },
        { $set: updateData }
      );
      console.log('[MongoDB] saveUserToMongo: пользователь обновлен:', updateResult);
      
      // НЕ запускаем немедленную проверку - периодическая проверка сама обработает всех пользователей
      // Это предотвращает множественные вызовы и спам промокодами
      if (shouldCheckLoyalty) {
        console.log(`[MongoDB] ℹ️ Пользователь ${userId} обновлен, будет обработан при следующей периодической проверке`);
      }
    } else {
      // Создаем нового пользователя
      const now = new Date();
      
      // Определяем источник для нового пользователя
      const source = sourceData ? sourceData.source : 'direct';
      const sourceType = sourceData ? sourceData.type : 'direct';
      const sourceDetails = sourceData ? sourceData.details : {};
      
      const newUser = new User({
          botId,
          userId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          firstSubscribedAt: now,
          lastSubscribedAt: now,
        isSubscribed: true,
          loyaltyStartedAt: now, // Автоматически устанавливаем время начала лояльности
          subscriptionHistory: [{ subscribedAt: now }],
          // Отслеживание источника
          firstSource: source,
          firstSourceDate: now,
          sourceDetails: {
            type: sourceType,
            campaign: sourceDetails.campaign || null,
            medium: sourceDetails.medium || null,
            content: sourceDetails.content || null
          },
          // Инициализация отслеживания активности
          sourceActiveTime: 0,
          sessionStartTime: now,
          lastActivityTime: now,
          lastActivityAction: 'command',
          totalSessions: 1
      });
      
      const saveResult = await newUser.save();
      console.log(`[MongoDB] saveUserToMongo: новый пользователь создан: ${saveResult._id}, источник: ${source}, loyaltyStartedAt=${now}`);
      
      // НЕ запускаем немедленную проверку - периодическая проверка сама обработает всех пользователей
      // Это предотвращает множественные вызовы и спам промокодами
      console.log(`[MongoDB] ℹ️ Новый пользователь ${userId} будет обработан при следующей периодической проверке`);
    }
    
    // Отслеживаем активность пользователя
    await trackUserActivity(userId, 'command');
    
    // Программа лояльности теперь работает через периодическую проверку
  } catch (err) {
    console.error('[MongoDB] saveUserToMongo: ошибка при сохранении пользователя:', err);
  }
}


// Глобальные переменные для состояния пользователей
const userCurrentBlock = new Map();
const userNavigationHistory = new Map();
const userQuizStates = new Map();
const userLastActivity = new Map();
const completedQuizzes = new Map();

// Константа для максимального интервала между действиями (5 минут в миллисекундах)
const MAX_SESSION_INTERVAL = 5 * 60 * 1000; // 5 минут

// Функция для получения эффективного времени подписки (с учетом пауз) - ГЛОБАЛЬНАЯ
const { effectiveTime: getEffectiveSubscriptionTime, normalizeChannel, isMember } = require('./loyaltyService');
const { service: loyaltyService, telegramClient } = require('./loyaltyRuntime');

// Кэш для проверки подписки на канал (избегаем повторных API-вызовов)
const subscriptionCache = new Map();
const CACHE_DURATION = 30 * 1000; // 30 секунд кэш (сокращено для оперативности)

// Блокировка для предотвращения одновременной выдачи промокодов одному пользователю
async function giveMissedLoyaltyPromoCodes(userId) {
  const [user, config] = await Promise.all([
    User.findOne({ botId, userId }).lean(), LoyaltyConfig.findOne({ botId }).lean()
  ]);
  if (user) return loyaltyService.checkUser(botId, user, config);
}

async function checkChannelSubscription(userId, channelId) {
  const channel = normalizeChannel(channelId);
  const cacheKey = userId + '_' + channelId;
  const cached = subscriptionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) return cached.isSubscribed;
  // API failures propagate; they do not mean the user unsubscribed.
  const member = await telegramClient(token).getChatMember(channel, userId);
  const subscribed = isMember(member);
  subscriptionCache.set(cacheKey, { isSubscribed: subscribed, timestamp: Date.now() });
  return subscribed;
}

function setupBotHandlers(bot, blocks, connections) {
  console.log('=== [BOOT] setupBotHandlers вызван ===');
  // Создаем карту диалогов для быстрого доступа
  const dialogMap = new Map();
  console.log(`[BOOT] Creating dialogMap from ${blocks.length} blocks:`);
  blocks.forEach(block => {
    const blockData = {
      message: block.message,
      buttons: block.buttons || [],
      mediaFiles: block.mediaFiles || [],
      type: block.type,
      name: block.name || block.id,
      questions: block.questions || [],
      currentQuestionIndex: block.currentQuestionIndex || 0,
      finalSuccessMessage: block.finalSuccessMessage,
      returnToStartOnComplete: block.returnToStartOnComplete
    };
    if (block.type === 'trivia') {
      blockData.correctAnswerVariants = block.correctAnswerVariants || [];
      blockData.successMessage = block.successMessage;
      blockData.failureMessage = block.failureMessage;
    }
    dialogMap.set(block.id, blockData);
    console.log(`[BOOT] dialogMap: ${block.id} -> ${block.type} (${(block.buttons || []).length} buttons)`);
    
    if (block.type === 'quiz') {
      console.log(`[BOOT] Quiz block ${block.id} questions:`, (block.questions || []).length);
    }
    if (block.type === 'trivia') {
      console.log(`[BOOT] Trivia block ${block.id} correctAnswerVariants:`, block.correctAnswerVariants || []);
    }
  });
  console.log(`[BOOT] Final dialogMap size: ${dialogMap.size}`);

  // Карта для отслеживания истории навигации пользователей
  // const userNavigationHistory = new Map(); // Удалено
  
  // Карта для отслеживания текущего блока каждого пользователя
  // const userCurrentBlock = new Map(); // Удалено
  
  // Карта для отслеживания состояния квиза каждого пользователя
  // const userQuizStates = new Map(); // Удалено
  
  // Карта для отслеживания завершенных квизов пользователей
  // const completedQuizzes = new Map(); // Удалено

  // Функция для очистки старых данных пользователей - ОТКЛЮЧЕНА
  function cleanupOldUserData() {
    console.log(`🧹 Memory cleanup DISABLED - keeping all user data`);
    console.log(`📊 Current stats - Active users: ${userCurrentBlock.size}, Quiz states: ${userQuizStates.size}, History: ${userNavigationHistory.size}`);
  }

  // Карта для отслеживания последней активности пользователей
  // const userLastActivity = new Map(); // Удалено

  // Очистка памяти ОТКЛЮЧЕНА - данные сохраняются навсегда
  // setInterval(cleanupOldUserData, 60 * 60 * 1000);
  
  // Мониторинг памяти БЕЗ очистки - только логирование
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    console.log(`📊 Memory usage: ${memPercent.toFixed(1)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB)`);
    console.log(`📊 Active users: ${userCurrentBlock.size}, Quiz states: ${userQuizStates.size}, History: ${userNavigationHistory.size}`);
    
    // Очистка памяти ОТКЛЮЧЕНА - данные сохраняются навсегда
    // if (memPercent > 80) {
    //   console.log(`⚠️ High memory usage: ${memPercent.toFixed(1)}%, triggering cleanup`);
    //   cleanupOldUserData();
    // }
    
    // Очистка памяти ОТКЛЮЧЕНА - данные сохраняются навсегда
    // if (userCurrentBlock.size > 10000) {
    //   console.log(`🚨 Too many users (${userCurrentBlock.size}), forcing aggressive cleanup`);
    //   const userArray = Array.from(userCurrentBlock.entries());
    //   const toRemove = userArray.slice(0, 2000);
    //   
    //   for (const [userId] of toRemove) {
    //     userCurrentBlock.delete(userId);
    //     userNavigationHistory.delete(userId);
    //     userLastActivity.delete(userId);
    //     completedQuizzes.delete(userId);
    //     userQuizStates.delete(userId);
    //   }
    //   console.log(`🧹 Aggressive cleanup: removed ${toRemove.length} users`);
    // }
  }, 30 * 60 * 1000); // Каждые 30 минут - только мониторинг

  // УДАЛЕНА ДУБЛИРУЮЩАЯСЯ ФУНКЦИЯ saveUserToMongo - используется глобальная версия

  // Функция для обработки подписки пользователя
  async function handleUserSubscription(userId) {
    try {
      console.log(`🔔 Обработка подписки пользователя: ${userId}`);
      
      let user = await User.findOne({ botId, userId });
      const now = new Date();
      
      if (!user) {
        // Создаем нового пользователя
        user = new User({
          botId,
          userId,
          isSubscribed: true,
          firstSubscribedAt: now,
          lastSubscribedAt: now,
          totalSubscribedTime: 0,
          pausedTime: 0
        });
        console.log(`✅ Создан новый подписчик: ${userId}`);
      } else {
        // Обновляем существующего пользователя
        user.isSubscribed = true;
        user.lastSubscribedAt = now;
        
        // Если пользователь был отписан, добавляем время паузы
        if (user.lastUnsubscribedAt) {
          const pauseDuration = now.getTime() - user.lastUnsubscribedAt.getTime();
          user.pausedTime += pauseDuration;
          user.lastUnsubscribedAt = null;
          console.log(`⏸️ Добавлено время паузы: ${Math.round(pauseDuration / 1000 / 60)} минут`);
        }
        
        // Если это первая подписка, устанавливаем firstSubscribedAt
        if (!user.firstSubscribedAt) {
          user.firstSubscribedAt = now;
        }
        
        console.log(`✅ Обновлен подписчик: ${userId}`);
      }

      // Добавляем запись в историю подписок
      if (!user.subscriptionHistory) {
        user.subscriptionHistory = [];
      }
      
      user.subscriptionHistory.push({
        subscribedAt: now
      });

      await user.save();
      console.log(`✅ Подписка пользователя ${userId} обработана`);
    } catch (error) {
      console.error('❌ Ошибка при обработке подписки:', error);
    }
  }

  // Функция для обработки отписки пользователя
  async function handleUserUnsubscription(userId) {
    try {
      console.log(`🔕 Обработка отписки пользователя: ${userId}`);
      
      const user = await User.findOne({ botId, userId });
      if (!user) {
        console.log(`❌ Пользователь ${userId} не найден`);
        return;
      }

      const now = new Date();
      user.isSubscribed = false;
      user.lastUnsubscribedAt = now;

      // Обновляем последнюю запись в истории подписок
      if (user.subscriptionHistory && user.subscriptionHistory.length > 0) {
        const lastRecord = user.subscriptionHistory[user.subscriptionHistory.length - 1];
        if (!lastRecord.unsubscribedAt) {
          lastRecord.unsubscribedAt = now;
          
          // Добавляем время подписки к общему времени
          if (lastRecord.subscribedAt) {
            const subscriptionDuration = now.getTime() - lastRecord.subscribedAt.getTime();
            user.totalSubscribedTime += subscriptionDuration;
            console.log(`⏱️ Добавлено время подписки: ${Math.round(subscriptionDuration / 1000 / 60)} минут`);
          }
        }
      }

      await user.save();
      console.log(`✅ Отписка пользователя ${userId} обработана`);
    } catch (error) {
      console.error('❌ Ошибка при обработке отписки:', error);
    }
  }

  // Функция getEffectiveSubscriptionTime теперь определена глобально выше


  // Функция для создания клавиатуры с кнопкой "Назад"
  async function createKeyboardWithBack(buttons, userId, currentBlockId) {
    try {
      console.log(`🔍 DEBUG: createKeyboardWithBack called for user ${userId}, block ${currentBlockId}`);
      
    const keyboard = [];
    const inlineKeyboard = [];
    
    // Добавляем кнопки по 2 в ряд
    if (buttons && buttons.length > 0) {
      for (let i = 0; i < buttons.length; i += 2) {
        const row = [];
        row.push({ text: buttons[i].text });
        
        // Добавляем вторую кнопку в ряд, если она есть
        if (i + 1 < buttons.length) {
          row.push({ text: buttons[i + 1].text });
        }
        
        keyboard.push(row);
      }
    }
    
    // Добавляем кнопку "Назад" если это не стартовый блок и не квиз
    const currentBlock = blocks.find(b => b.id === currentBlockId);
    if (currentBlockId !== 'start' && currentBlock && currentBlock.type !== 'quiz') {
      // Всегда добавляем кнопку "Назад" для не-стартовых блоков
      // Если есть история - вернется на предыдущий блок
      // Если истории нет (например, открыт через deep link) - вернется на стартовый блок
        keyboard.push([{ text: '⬅️ Назад' }]);
    }
    
      // Проверяем, включена ли программа лояльности для главного блока
      if (currentBlockId === 'start') {
        try {
          const loyaltyConfig = await LoyaltyConfig.findOne({ botId });
          if (loyaltyConfig && loyaltyConfig.isEnabled) {
            keyboard.push([{ text: '🎁 СИСТЕМА ЛОЯЛЬНОСТИ' }]);
          }
        } catch (error) {
          console.error('❌ Ошибка при проверке программы лояльности:', error);
        }
      }
      
      console.log(`🔍 DEBUG: createKeyboardWithBack completed, keyboard length: ${keyboard.length}`);
    return { keyboard, inlineKeyboard };
    } catch (error) {
      console.error('❌ Ошибка в createKeyboardWithBack:', error);
      console.error('❌ Stack trace:', error.stack);
      // Возвращаем пустую клавиатуру в caso ошибки
      return { keyboard: [], inlineKeyboard: [] };
    }
  }

  // Функция для создания клавиатуры с кнопкой лояльности
  async function createKeyboardWithLoyalty(buttons, userId, currentBlockId) {
    // Теперь createKeyboardWithBack уже включает проверку лояльности
    return await createKeyboardWithBack(buttons, userId, currentBlockId);
  }

  // Функция для получения информации о лояльности пользователя
  async function getLoyaltyInfo(userId) {
    try {
      const user = await User.findOne({ botId, userId });
      if (!user) {
        return '❌ Пользователь не найден';
      }

      const loyaltyConfig = await LoyaltyConfig.findOne({ botId });
      if (!loyaltyConfig || !loyaltyConfig.isEnabled) {
        return '❌ Программа лояльности не настроена';
      }

      // ВСЕГДА перепроверяем подписку на канал при каждом нажатии
      if (loyaltyConfig.channelSettings && loyaltyConfig.channelSettings.isRequired) {
        const channelId = loyaltyConfig.channelSettings.channelId;
        console.log(`🔍 LoyaltyConfig channelSettings:`, JSON.stringify(loyaltyConfig.channelSettings, null, 2));
        console.log(`🔍 Channel ID from config: "${channelId}" (type: ${typeof channelId})`);
        
        if (channelId) {
          // ОЧИЩАЕМ КЭШ ПЕРЕД ПРОВЕРКОЙ (чтобы получить актуальное состояние подписки)
          const cacheKey = `${userId}_${channelId}`;
          subscriptionCache.delete(cacheKey);
          console.log(`🗑️ Очищен кэш подписки для пользователя ${userId}, канал ${channelId}`);
          
          console.log(`🔄 Перепроверяем подписку пользователя ${userId} на канал ${channelId}`);
          const isSubscribed = await checkChannelSubscription(userId, channelId);
          
          if (!isSubscribed) {
            const channelTitle = loyaltyConfig.channelSettings.channelTitle || 
              loyaltyConfig.channelSettings.channelUsername || 
              channelId;
            const notSubscribedMessage = loyaltyConfig.channelSettings.notSubscribedMessage || 
              'Для участия в программе лояльности необходимо подписаться на наш канал!';
            
            let message = '🔒 ДОСТУП ОГРАНИЧЕН\n\n';
            message += `${notSubscribedMessage}\n\n`;
            message += `📢 Канал: ${channelTitle}\n\n`;
            message += '💡 Подпишитесь на канал и попробуйте снова!';
            
            return message;
          } else {
            console.log(`✅ Пользователь ${userId} подписан на канал ${channelId} - доступ разрешен`);
          }
        }
      }

      // Устанавливаем время начала программы лояльности, если его еще нет
      if (!user.loyaltyStartedAt) {
        await User.updateOne(
          { botId, userId },
          { $set: { loyaltyStartedAt: new Date() } }
        );
        console.log(`🎁 Установлено время начала программы лояльности для пользователя ${userId}`);
        // Обновляем объект пользователя для текущего запроса
        user.loyaltyStartedAt = new Date();
      }

      await giveMissedLoyaltyPromoCodes(userId);
      let loyalty = await Loyalty.findOne({ botId, userId });
      if (!loyalty) {
        // Создаем запись лояльности, если её нет (атомарно, чтобы избежать дубликатов)
        const existingLoyalty = await Loyalty.findOne({ botId, userId });
        if (!existingLoyalty) {
          // Создаем новую запись только если её действительно нет
        const newLoyalty = new Loyalty({
          botId,
          userId,
          rewards: {
            '1m': false,
            '24h': false,
            '7d': false,
            '30d': false,
            '90d': false,
            '180d': false,
            '360d': false
          }
        });
          try {
        await newLoyalty.save();
        console.log(`🎁 Создана запись лояльности для пользователя ${userId}`);
            loyalty = newLoyalty;
        
        // АВТОМАТИЧЕСКИ ВЫДАЕМ ВСЕ ПРОПУЩЕННЫЕ ПРОМОКОДЫ
        console.log(`🎁 [AUTO_REWARD] Автоматически выдаем пропущенные промокоды пользователю ${userId}`);
        await giveMissedLoyaltyPromoCodes(userId, newLoyalty);
          } catch (saveError) {
            // Если запись уже существует (race condition), просто получаем её
            if (saveError.code === 11000 || saveError.message.includes('duplicate')) {
              console.log(`ℹ️ Запись лояльности для пользователя ${userId} уже существует (race condition)`);
              loyalty = await Loyalty.findOne({ botId, userId });
            } else {
              throw saveError;
            }
          }
        } else {
          loyalty = existingLoyalty;
        }
        
        // Используем новую запись
        const effectiveTime = getEffectiveSubscriptionTime(user);
        const totalDays = Math.floor(effectiveTime / (1000 * 60 * 60 * 24));
        const totalHours = Math.floor(effectiveTime / (1000 * 60 * 60));
        const totalMinutes = Math.floor(effectiveTime / (1000 * 60));

        let message = '🎁 СИСТЕМА ЛОЯЛЬНОСТИ\n\n';
        message += `📅 Вы с нами: ${totalDays} дней, ${totalHours % 24} часов, ${totalMinutes % 60} минут\n\n`;
        
        // Показываем статус подписки
        if (user.isSubscribed) {
          message += `🟢 Статус: Подписан\n\n`;
        } else {
          message += `🔴 Статус: Отписан (время на паузе)\n\n`;
        }

        // Проверяем доступные периоды
        const enabledPeriods = [];
        const periods = [
          { key: '1m', name: '1 минута', minutes: 1 },
          { key: '24h', name: '24 часа', hours: 24 },
          { key: '7d', name: '7 дней', days: 7 },
          { key: '30d', name: '30 дней', days: 30 },
          { key: '90d', name: '90 дней', days: 90 },
          { key: '180d', name: '180 дней', days: 180 },
          { key: '360d', name: '360 дней', days: 360 }
        ];

        for (const period of periods) {
          const config = loyaltyConfig.messages[period.key];
          if (config && config.enabled) {
            enabledPeriods.push(period);
          }
        }

        if (enabledPeriods.length === 0) {
          message += '❌ Программа лояльности не настроена';
          return message;
        }

        // Проверяем текущее время в минутах
        const currentMinutes = Math.floor(effectiveTime / (1000 * 60));

        // Получаем все активированные промокоды пользователя для проверки
        const userPromoCodesNew = await LoyaltyPromoCode.find({
          botId,
          activatedBy: userId,
          activated: true
        }).lean();
        
        // Создаем Set для быстрой проверки периодов с выданными промокодами
        const rewardedPeriodsNew = new Set();
        userPromoCodesNew.forEach(promo => {
          if (promo.period) {
            rewardedPeriodsNew.add(promo.period);
          }
        });

        // Ищем следующий доступный бонус
        let nextBonus = null;
        let allRewarded = true;

        for (const period of enabledPeriods) {
          const periodMinutes = period.minutes || (period.hours * 60) || (period.days * 24 * 60);
          
          // Проверяем и флаг в newLoyalty.rewards, и наличие активированного промокода
          const isRewarded = rewardedPeriodsNew.has(period.key);
          
          if (!isRewarded) {
            allRewarded = false;
            if (currentMinutes >= periodMinutes) {
              // Бонус доступен сейчас
              message += `🎁 Следующий бонус: ${period.name} - ДОСТУПЕН СЕЙЧАС!\n\n`;
              message += '💡 Награда придет автоматически!';
              return message;
            } else if (!nextBonus) {
              nextBonus = { ...period, minutes: periodMinutes };
            }
          }
        }

        if (allRewarded) {
          message += '🎉 Поздравляем! Вы получили все доступные награды!\n\n';
          message += '💡 Следите за обновлениями программы лояльности!';
        } else if (nextBonus) {
          const remainingMinutes = nextBonus.minutes - currentMinutes;
          const remainingDays = Math.floor(remainingMinutes / (24 * 60));
          const remainingHours = Math.floor((remainingMinutes % (24 * 60)) / 60);
          const remainingMins = remainingMinutes % 60;
          
          message += `⏳ До следующего бонуса: ${nextBonus.name}\n\n`;
          
          if (remainingDays > 0) {
            message += `📅 Осталось: ${remainingDays} дней, ${remainingHours} часов, ${remainingMins} минут`;
          } else if (remainingHours > 0) {
            message += `⏰ Осталось: ${remainingHours} часов, ${remainingMins} минут`;
          } else {
            message += `⏰ Осталось: ${remainingMins} минут`;
          }
          
          message += '\n\n💡 Награда придет автоматически!';
        }

        // Добавляем список выданных промокодов для новой записи (уже загружены выше)
        // Сортируем по дате активации (новые первыми)
        const userPromoCodes = userPromoCodesNew.sort((a, b) => {
          const dateA = a.activatedAt ? new Date(a.activatedAt).getTime() : 0;
          const dateB = b.activatedAt ? new Date(b.activatedAt).getTime() : 0;
          return dateB - dateA; // Сортируем по убыванию (новые первыми)
        });

        if (userPromoCodes.length > 0) {
          message += '\n\n🎫 **ВАШИ ПОЛУЧЕННЫЕ ПРОМОКОДЫ:**\n\n';
          
          const periodLabels = {
            '1m': '1 минута',
            '24h': '24 часа',
            '7d': '7 дней',
            '30d': '30 дней',
            '90d': '90 дней',
            '180d': '180 дней',
            '360d': '360 дней'
          };

          userPromoCodes.forEach((promoCode, index) => {
            const periodLabel = periodLabels[promoCode.period] || promoCode.period;
            const activatedDate = new Date(promoCode.activatedAt).toLocaleDateString('ru-RU');
            message += `${index + 1}. ⏰ **${periodLabel}**\n`;
            message += `   🎫 Промокод: \`${promoCode.code}\`\n`;
            message += `   📅 Получен: ${activatedDate}\n\n`;
          });
          
          message += '💡 Используйте эти промокоды для получения бонусов!';
        } else {
          message += '\n\n🎫 **ВАШИ ПРОМОКОДЫ:**\n\n';
          message += '📭 Пока у вас нет полученных промокодов\n';
          message += '💡 Продолжайте участвовать в программе лояльности!';
        }

        return message;
      }

      // Используем эффективное время подписки (с учетом пауз)
      const effectiveTime = getEffectiveSubscriptionTime(user);
      const totalDays = Math.floor(effectiveTime / (1000 * 60 * 60 * 24));
      const totalHours = Math.floor(effectiveTime / (1000 * 60 * 60));
      const totalMinutes = Math.floor(effectiveTime / (1000 * 60));

      let message = '🎁 СИСТЕМА ЛОЯЛЬНОСТИ\n\n';
      message += `📅 Вы с нами: ${totalDays} дней, ${totalHours % 24} часов, ${totalMinutes % 60} минут\n\n`;
      
      // Показываем статус подписки
      if (user.isSubscribed) {
        message += `🟢 Статус: Подписан\n\n`;
      } else {
        message += `🔴 Статус: Отписан (время на паузе)\n\n`;
      }

      // Периоды лояльности (отсортированы по времени)
      const periods = [
        { key: '1m', name: '1 минута', minutes: 1 },
        { key: '24h', name: '24 часа', minutes: 24 * 60 },
        { key: '7d', name: '7 дней', minutes: 7 * 24 * 60 },
        { key: '30d', name: '30 дней', minutes: 30 * 24 * 60 },
        { key: '90d', name: '90 дней', minutes: 90 * 24 * 60 },
        { key: '180d', name: '180 дней', minutes: 180 * 24 * 60 },
        { key: '360d', name: '360 дней', minutes: 360 * 24 * 60 }
      ];

      // Фильтруем только включенные периоды
      const enabledPeriods = periods.filter(period => loyaltyConfig.messages[period.key]?.enabled);
      
      if (enabledPeriods.length === 0) {
        message += '❌ Программа лояльности не настроена';
        return message;
      }

      const currentMinutes = Math.floor(effectiveTime / (1000 * 60));
      
      // Находим следующий доступный бонус
      let nextBonus = null;
      let allRewarded = true;
      
      // Получаем все активированные промокоды пользователя для проверки
      const userPromoCodes = await LoyaltyPromoCode.find({
        botId,
        activatedBy: userId,
        activated: true
      }).lean();
      
      // Создаем Set для быстрой проверки периодов с выданными промокодами
      const rewardedPeriods = new Set();
      userPromoCodes.forEach(promo => {
        if (promo.period) {
          rewardedPeriods.add(promo.period);
        }
      });
      
      for (const period of enabledPeriods) {
        // Проверяем и флаг в loyalty.rewards, и наличие активированного промокода
        const isRewarded = rewardedPeriods.has(period.key);
        
        if (!isRewarded) {
          allRewarded = false;
          if (currentMinutes >= period.minutes) {
            // Бонус доступен сейчас
            message += `🎁 Следующий бонус: ${period.name} - ДОСТУПЕН СЕЙЧАС!\n\n`;
            message += '💡 Награда придет автоматически!';
            return message;
          } else {
            // Бонус еще не доступен
            if (!nextBonus || period.minutes < nextBonus.minutes) {
              nextBonus = period;
            }
          }
        }
      }

      if (allRewarded) {
        message += '🎉 Поздравляем! Вы получили все доступные награды!\n\n';
        message += '💡 Следите за обновлениями программы лояльности!';
      } else if (nextBonus) {
        const remainingMinutes = nextBonus.minutes - currentMinutes;
        const remainingDays = Math.floor(remainingMinutes / (24 * 60));
        const remainingHours = Math.floor((remainingMinutes % (24 * 60)) / 60);
        const remainingMins = remainingMinutes % 60;
        
        message += `⏳ До следующего бонуса: ${nextBonus.name}\n\n`;
        
        if (remainingDays > 0) {
          message += `📅 Осталось: ${remainingDays} дней, ${remainingHours} часов, ${remainingMins} минут`;
        } else if (remainingHours > 0) {
          message += `⏰ Осталось: ${remainingHours} часов, ${remainingMins} минут`;
        } else {
          message += `⏰ Осталось: ${remainingMins} минут`;
        }
        
        message += '\n\n💡 Награда придет автоматически!';
      }

      // Добавляем список выданных промокодов (уже загружены выше для проверки периодов)
      // Сортируем по дате активации (новые первыми)
      userPromoCodes.sort((a, b) => {
        const dateA = a.activatedAt ? new Date(a.activatedAt).getTime() : 0;
        const dateB = b.activatedAt ? new Date(b.activatedAt).getTime() : 0;
        return dateB - dateA; // Сортируем по убыванию (новые первыми)
      });

      if (userPromoCodes.length > 0) {
        message += '\n\n🎫 **ВАШИ ПОЛУЧЕННЫЕ ПРОМОКОДЫ:**\n\n';
        
        const periodLabels = {
          '1m': '1 минута',
          '24h': '24 часа',
          '7d': '7 дней',
          '30d': '30 дней',
          '90d': '90 дней',
          '180d': '180 дней',
          '360d': '360 дней'
        };

        userPromoCodes.forEach((promoCode, index) => {
          const periodLabel = periodLabels[promoCode.period] || promoCode.period;
          const activatedDate = new Date(promoCode.activatedAt).toLocaleDateString('ru-RU');
          message += `${index + 1}. ⏰ **${periodLabel}**\n`;
          message += `   🎫 Промокод: \`${promoCode.code}\`\n`;
          message += `   📅 Получен: ${activatedDate}\n\n`;
        });
        
        message += '💡 Используйте эти промокоды для получения бонусов!';
      } else {
        message += '\n\n🎫 **ВАШИ ПРОМОКОДЫ:**\n\n';
        message += '📭 Пока у вас нет полученных промокодов\n';
        message += '💡 Продолжайте участвовать в программе лояльности!';
      }

      return message;
    } catch (error) {
      console.error('❌ Ошибка при получении информации о лояльности:', error);
      return '❌ Ошибка при получении информации о лояльности';
    }
  }

  // Создаем карту соединений для быстрого доступа
  const connectionMap = new Map();
  console.log(`[BOOT] Creating connectionMap from ${connections.length} connections:`);
  connections.forEach(conn => {
    const key = `${String(conn.from.blockId)}_${String(conn.from.buttonId)}`;
    connectionMap.set(key, conn.to);
    console.log(`[BOOT] connectionMap: ${key} -> ${conn.to}`);
    console.log(`[BOOT] Connection details:`, JSON.stringify(conn, null, 2));
  });
  console.log(`[BOOT] Final connectionMap size: ${connectionMap.size}`);

  // Обработка команды /start
  bot.command('start', async (ctx) => {
    console.log('[COMMAND] /start received for user:', ctx.from?.id);
    
    // Обрабатываем параметр start для определения источника
    // В Telegraf параметр start доступен через ctx.startParam или через ctx.message.text
    let startParam = ctx.startParam;
    if (!startParam && ctx.message?.text) {
      const parts = ctx.message.text.split(' ');
      if (parts.length > 1) {
        startParam = parts.slice(1).join(' '); // Берем все после /start
      }
    }
    
    // Парсим параметр start для извлечения источника и ID блока
    const parsedStart = parseSourceFromStart(startParam);
    const sourceFromParam = parsedStart.source;
    const blockIdFromParam = parsedStart.blockId;
    
    if (startParam) {
      console.log(`[SOURCE] Параметр start: ${startParam}`);
      console.log(`[SOURCE] Распарсено - источник: ${sourceFromParam}, блок: ${blockIdFromParam || 'стартовый'}`);
      // Сохраняем параметр в ctx для использования в saveUserToMongo
      ctx.startParam = startParam;
      // Сохраняем распарсенный источник для использования в saveUserToMongo
      ctx.parsedSource = sourceFromParam;
    } else {
      console.log(`[SOURCE] Параметр start не найден, источник будет 'direct'`);
    }
    
    await saveUserToMongo(ctx);
    
    // Обрабатываем подписку пользователя
    const userId = ctx.from?.id;
    if (userId) {
      await handleUserSubscription(userId);
      
      // Отслеживаем статистику команды /start (независимо от того, какой блок открывается)
      setImmediate(async () => {
        try {
          await trackStartCommand(botId, userId);
          await trackActiveUser(botId, userId);
        } catch (error) {
          console.error('[STATS] Ошибка при отслеживании /start:', error);
        }
      });
    }
    
    // Очищаем состояние квиза пользователя
    userQuizStates.delete(userId);
    
    // Определяем, какой блок открыть
    let targetBlockId = 'start';
    let targetBlockName = 'Стартовый блок';
    
    // Специальная обработка для программы лояльности
    // Формат: loyalty или source:loyalty (например: google_ads:loyalty)
    if (startParam === 'loyalty' || blockIdFromParam === 'loyalty' || 
        (startParam && startParam.endsWith(':loyalty'))) {
      console.log(`[DEEP_LINK] Открываем программу лояльности по параметру start: ${startParam}`);
      const loyaltyInfo = await getLoyaltyInfo(userId);
      const startBlock = dialogMap.get('start');
      if (startBlock) {
        const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(startBlock.buttons || [], userId, 'start');
        await sendMediaMessage(ctx, loyaltyInfo, [], keyboard, inlineKeyboard);
      } else {
        // Если стартовый блок не найден, отправляем только информацию о лояльности
        await ctx.reply(loyaltyInfo);
      }
      userCurrentBlock.set(userId, 'start');
      userNavigationHistory.delete(userId);
      return;
    }
    
    // Если указан ID блока в параметре, используем его
    if (blockIdFromParam !== null && blockIdFromParam !== undefined) {
      // Пробуем найти блок по ID
      let requestedBlock = dialogMap.get(blockIdFromParam);
      
      if (requestedBlock) {
        targetBlockId = blockIdFromParam;
        targetBlockName = requestedBlock.name || String(targetBlockId);
        console.log(`[DEEP_LINK] Открываем блок по параметру start: ${startParam} (найден блок с ID: ${targetBlockId})`);
        
        // Если открываем не стартовый блок через deep link, очищаем историю
        if (targetBlockId !== 'start') {
          userNavigationHistory.delete(userId);
        }
      } else {
        console.log(`[DEEP_LINK] Блок с ID "${blockIdFromParam}" не найден, используем стартовый блок`);
        userNavigationHistory.delete(userId);
      }
    } else if (startParam && !isNaN(startParam)) {
      // Обратная совместимость: если параметр - число, но не был распарсен как блок
      let requestedBlock = dialogMap.get(Number(startParam));
      if (requestedBlock) {
        targetBlockId = Number(startParam);
        targetBlockName = requestedBlock.name || String(targetBlockId);
        console.log(`[DEEP_LINK] Открываем блок по параметру start: ${startParam} (найден блок с ID: ${targetBlockId})`);
        if (targetBlockId !== 'start') {
          userNavigationHistory.delete(userId);
        }
      } else {
        console.log(`[DEEP_LINK] Блок с ID "${startParam}" не найден, используем стартовый блок`);
        userNavigationHistory.delete(userId);
      }
    } else {
      // Если параметра нет или это только источник, используем стартовый блок
      userNavigationHistory.delete(userId);
    }
    
    // Устанавливаем текущий блок
    userCurrentBlock.set(userId, targetBlockId);
    
    // Получаем блок для отображения
    const targetBlock = dialogMap.get(targetBlockId);
    if (targetBlock) {
      // Обновляем статистику для правильного блока
      setImmediate(async () => {
        try {
          await trackBlockEnter(botId, userId, targetBlockId, targetBlockName);
          await trackBlockEnterWithPath(botId, userId, targetBlockId, targetBlockName);
        } catch (error) {
          console.error('[STATS] Ошибка при отслеживании входа в блок:', error);
        }
      });
      
      const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(targetBlock.buttons, userId, targetBlockId);
      await sendMediaMessage(ctx, targetBlock.message, targetBlock.mediaFiles, keyboard, inlineKeyboard);
    } else {
      await ctx.reply('Бот не настроен');
    }
  });

  // Обработка команды /help
  bot.command('help', async (ctx) => {
    console.log('[COMMAND] /help received for user:', ctx.from?.id);
    console.log('[DEBUG] /help ctx.from:', ctx.from);
    await saveUserToMongo(ctx);
    
    // Обрабатываем подписку пользователя
    const userId = ctx.from?.id;
    if (userId) {
      await handleUserSubscription(userId);
      // Отслеживаем активность пользователя
      await trackUserActivity(userId, 'command');
    }
    let currentBlockId = userCurrentBlock.get(userId);
    
    let helpMessage = '🤖 Помощь по использованию бота:\n\n';
    helpMessage += '📱 Как использовать:\n';
    helpMessage += '• Используйте кнопки для навигации\n';
    helpMessage += '• Нажимайте на кнопки вместо ввода текста\n';
    helpMessage += '• Кнопка "Назад" вернет вас к предыдущему блоку\n\n';
    helpMessage += '🔗 Кнопки с ссылками:\n';
    helpMessage += '• Если кнопка содержит ссылку, она откроется в браузере\n\n';
    helpMessage += '📊 Квизы:\n';
    helpMessage += '• Отвечайте на вопросы, выбирая правильные варианты\n';
    helpMessage += '• За правильные ответы вы можете получить промокоды\n\n';
    helpMessage += '💡 Советы:\n';
    helpMessage += '• Не вводите текст вручную - используйте кнопки\n';
    helpMessage += '• Если заблудились, нажмите /start для возврата в начало';
    
    if (currentBlockId) {
      const currentBlock = dialogMap.get(currentBlockId);
      if (currentBlock) {
        const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(currentBlock.buttons, userId, currentBlockId);
        
        await ctx.reply(helpMessage, {
          parse_mode: 'Markdown',
          reply_markup: {
            keyboard: keyboard,
            resize_keyboard: true
          }
        });
        return;
      }
    }
    
    await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
  });

  // Автоматическая регистрация обработчиков для всех команд из блоков
  blocks.forEach(block => {
    if (block.command) {
      const commandName = block.command.replace(/^\//, '');
      bot.command(commandName, async (ctx) => {
        await saveUserToMongo(ctx);
        
        // Обрабатываем подписку пользователя
        const userId = ctx.from?.id;
        if (userId) {
          await handleUserSubscription(userId);
        }
        
        userCurrentBlock.set(userId, block.id);
        const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(block.buttons, userId, block.id);
        await sendMediaMessage(ctx, block.message, block.mediaFiles, keyboard, inlineKeyboard);
      });
    }
  });

  // Обработка текстовых сообщений
  bot.on('text', async (ctx) => {
    try {
      const userId = ctx.from?.id;
      const messageText = ctx.message.text;
      
      // Отслеживаем активность пользователя
      if (userId) {
        await trackUserActivity(userId, 'message');
      }
      
      // Быстрая валидация входных данных
      if (!userId || !messageText || messageText.startsWith('/')) {
        return;
      }
      
      console.log(`💬 ${userId}: "${messageText}"`);
      
      // Асинхронно обрабатываем подписку и сохранение (не блокируем ответ)
      setImmediate(async () => {
        try {
          await handleUserSubscription(userId);
          await saveUserToMongo(ctx);
        } catch (error) {
          console.error('❌ Background error:', error);
        }
      });
      
      // Отслеживаем активность пользователя
      userLastActivity.set(userId, Date.now());
      
      // Получаем текущий блок пользователя
      let currentBlockId = userCurrentBlock.get(userId);
      
      // Инициализация пользователя если нужно
      if (!currentBlockId) {
        userCurrentBlock.set(userId, 'start');
        currentBlockId = 'start';
        
        // Отправляем приветственное сообщение
        const startBlock = dialogMap.get('start');
        if (startBlock) {
          const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(startBlock.buttons, userId, 'start');
          await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
          return;
        } else {
          await ctx.reply('Бот не настроен');
          return;
        }
      }
      
      // Получаем текущий блок
      const currentBlock = dialogMap.get(currentBlockId);
      if (!currentBlock) {
            userCurrentBlock.set(userId, 'start');
            const startBlock = dialogMap.get('start');
            if (startBlock) {
          const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(startBlock.buttons, userId, 'start');
              await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
            }
            return;
          }
      
      // Обработка кнопки "Назад"
      if (messageText === '⬅️ Назад') {
        const history = userNavigationHistory.get(userId) || [];
        if (history.length > 0) {
          const previousBlockId = history.pop();
          userNavigationHistory.set(userId, history);
          userCurrentBlock.set(userId, previousBlockId);
          
          const previousBlock = dialogMap.get(previousBlockId);
          if (previousBlock) {
            // Отслеживаем статистику (асинхронно)
            setImmediate(async () => {
              try {
                await trackButtonClick(botId, userId, currentBlockId, 'back', '⬅️ Назад');
                await trackBlockTransition(botId, userId, currentBlockId, previousBlockId, 'back', '⬅️ Назад', previousBlock.message?.substring(0, 50) || '');
                await trackBlockEnter(botId, userId, previousBlockId, previousBlock.message?.substring(0, 50) || '');
                await trackActiveUser(botId, userId);
              } catch (error) {
                console.error('[STATS] Ошибка при отслеживании кнопки "Назад":', error);
              }
            });
            
            const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(previousBlock.buttons, userId, previousBlockId);
            await sendMediaMessage(ctx, previousBlock.message, previousBlock.mediaFiles, keyboard, inlineKeyboard);
          }
        } else {
          // Если нет истории, возвращаемся к началу
          userCurrentBlock.set(userId, 'start');
          const startBlock = dialogMap.get('start');
          if (startBlock) {
            const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(startBlock.buttons, userId, 'start');
            await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
          }
        }
        return;
      }
      
      // Викторина: проверка текстового ответа (нормализация: регистр, пробелы, Unicode)
      if (currentBlock && currentBlock.type === 'trivia') {
        try {
          const alreadyPassed = await TriviaStats.findOne({
            botId,
            userId,
            blockId: currentBlockId,
            success: true
          });
          if (alreadyPassed) {
            await ctx.reply('Вы уже проходили эту викторину!');
            userCurrentBlock.set(userId, 'start');
            const startBlock = dialogMap.get('start');
            if (startBlock) {
              const { keyboard, inlineKeyboard } = await createKeyboardWithBack(startBlock.buttons, userId, 'start');
              await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
            }
            return;
          }
        } catch (e) {
          console.error('❌ Error checking trivia already passed:', e);
        }
        const normalizeAnswer = (str) => {
          if (str == null || typeof str !== 'string') return '';
          return String(str)
            .normalize('NFC')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, ' ');
        };
        const userNormalized = normalizeAnswer(messageText);
        const variants = (currentBlock.correctAnswerVariants || []).map(normalizeAnswer).filter(Boolean);
        const isCorrect = variants.length > 0 && variants.some(v => userNormalized === v);
        
        let promoCode = '';
        if (isCorrect) {
          try {
            const availablePromo = await PromoCode.findOne({
              botId,
              quizId: currentBlockId,
              activated: false
            });
            if (availablePromo) {
              await PromoCode.updateOne(
                { _id: availablePromo._id },
                { activated: true, activatedBy: userId, activatedAt: new Date() }
              );
              promoCode = availablePromo.code;
              console.log(`🎁 Выдан ваучер ${promoCode} пользователю ${userId} за викторину ${currentBlockId}`);
            }
          } catch (err) {
            console.error('❌ Ошибка при выдаче ваучера за викторину:', err);
          }
        }
        
        try {
          await TriviaStats.create({
            botId,
            userId,
            blockId: currentBlockId,
            success: isCorrect,
            userAnswer: messageText || '',
            promoCode: promoCode || ''
          });
        } catch (err) {
          console.error('❌ TriviaStats save error:', err);
        }
        
        if (isCorrect) {
          const successText = currentBlock.successMessage || 'Поздравляем! Верно!';
          let fullHtml = formatMessageWithMarkdownLinksToHtml(successText);
          if (promoCode) {
            fullHtml += '\n\n🎁 Ваш ваучер: <code>' + escapeTelegramHtml(promoCode) + '</code>';
          }
          await ctx.reply(fullHtml, { parse_mode: 'HTML' });
          userCurrentBlock.set(userId, 'start');
          const startBlock = dialogMap.get('start');
          if (startBlock) {
            const { keyboard, inlineKeyboard } = await createKeyboardWithBack(startBlock.buttons, userId, 'start');
            await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
          }
        } else {
          await ctx.reply(
            formatMessageWithMarkdownLinksToHtml(currentBlock.failureMessage || 'Попробуйте ещё раз.'),
            { parse_mode: 'HTML' }
          );
        }
        return;
      }
      
      // Проверяем, не пытается ли пользователь пройти квест повторно
      if (currentBlockId === 'start') {
        
        // Обработка кнопки "СИСТЕМА ЛОЯЛЬНОСТИ"
        if (messageText === '🎁 СИСТЕМА ЛОЯЛЬНОСТИ') {
          const loyaltyInfo = await getLoyaltyInfo(userId);
          const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(currentBlock.buttons, userId, currentBlockId);
          await sendMediaMessage(ctx, loyaltyInfo, [], keyboard, inlineKeyboard);
          return;
        }
        
        // Находим кнопку и проверяем, ведет ли она к квизу
        const button = currentBlock.buttons?.find(btn => btn.text === messageText);
        if (button) {
          const connectionKey = `${String(currentBlockId)}_${String(button.id)}`;
          const nextBlockId = connectionMap.get(connectionKey);
            const nextBlock = dialogMap.get(nextBlockId);
          
          if (nextBlock && nextBlock.type === 'quiz') {
            // Проверяем в памяти (быстро)
            const quizKey = `${userId}_${nextBlockId}`;
            if (completedQuizzes.has(quizKey)) {
              await ctx.reply('Вы уже прошли этот квест!');
            return;
          }
            
            // Проверяем в MongoDB (надежно)
            try {
              const existingQuizStats = await QuizStats.findOne({
                botId: botId,
                userId: userId,
                blockId: nextBlockId
              });
              
              if (existingQuizStats) {
                console.log(`🔍 DEBUG: User ${userId} already completed quiz ${nextBlockId} (from MongoDB)`);
                // Добавляем в память для быстрого доступа
                completedQuizzes.set(quizKey, true);
                await ctx.reply('Вы уже прошли этот квест!');
            return;
          }
            } catch (error) {
              console.error('❌ Error checking existing quiz stats:', error);
            }
          }
        }
      }
      
      // Проверяем, находится ли пользователь в квизе (по состоянию, а не по блоку)
      const quizState = userQuizStates.get(userId);
      if (quizState && !quizState.isCompleted) {
        // Получаем блок квиза
        const quizBlock = dialogMap.get(quizState.blockId);
        if (!quizBlock || quizBlock.type !== 'quiz') {
            userQuizStates.delete(userId);
            return;
          }
          
        const questions = quizBlock.questions || [];
        const currentQuestion = questions[quizState.currentQuestionIndex];
        
        if (!currentQuestion) {
          console.log(`❌ Question ${quizState.currentQuestionIndex} not found`);
          await ctx.reply('Ошибка в квизе');
          return;
        }
        
        // Проверяем, не отвечал ли пользователь уже на этот вопрос
        const alreadyAnswered = quizState.answers.some(a => a.questionIndex === quizState.currentQuestionIndex);
        console.log(`🔍 DEBUG: Already answered: ${alreadyAnswered}`);
        
        if (alreadyAnswered) {
          console.log(`⚠️ User already answered question ${quizState.currentQuestionIndex}, ignoring duplicate`);
              return;
        }
        
        // Ищем кнопку с ответом
        const answerButton = currentQuestion.buttons.find(btn => btn.text === messageText);
        if (!answerButton) {
          console.log(`❌ Answer button not found for: ${messageText}`);
          await ctx.reply('Пожалуйста, выберите один из предложенных вариантов ответа');
            return;
          }
          
        console.log(`🔍 DEBUG: Answer button found:`, answerButton);
          
              // Сохраняем ответ
        quizState.answers.push({
          questionIndex: quizState.currentQuestionIndex,
          answer: messageText,
          isCorrect: answerButton.isCorrect
        });
        
        // Проверяем правильность ответа
        if (!answerButton.isCorrect) {
          console.log(`❌ Wrong answer for question ${quizState.currentQuestionIndex}`);
        } else {
          console.log(`✅ Correct answer for question ${quizState.currentQuestionIndex}`);
        }
        
        // Переходим к следующему вопросу
        quizState.currentQuestionIndex++;
        
        // Проверяем, завершен ли квиз
        if (quizState.currentQuestionIndex >= questions.length) {
          // Квиз завершен
          quizState.isCompleted = true;
          quizState.endTime = Date.now();
          
          // Сохраняем статистику в MongoDB
          const correctAnswers = quizState.answers.filter(a => a.isCorrect).length;
          const totalQuestions = questions.length;
          const percentage = Math.round((correctAnswers / totalQuestions) * 100);
          const completionTime = Math.round((quizState.endTime - quizState.startTime) / 1000);
          
          try {
            console.log(`💾 Saving quiz stats to MongoDB:`, {
              botId,
              userId,
              blockId: quizState.blockId,
              correctAnswers,
              totalQuestions,
              percentage,
              completionTime,
              answersCount: quizState.answers.length
            });
            
            // Используем upsert для обновления существующей записи или создания новой
            await QuizStats.updateOne(
              { 
                botId: botId, 
                userId: userId, 
                blockId: quizState.blockId 
              },
              {
                botId: botId,
                userId: userId,
                blockId: quizState.blockId,
                correctAnswers: correctAnswers,
                totalQuestions: totalQuestions,
                percentage: percentage,
                completionTime: completionTime,
                answers: quizState.answers,
                completedAt: new Date()
              },
              { upsert: true }
            );
            
            console.log(`✅ Quiz stats saved to MongoDB for user ${userId}`);
            
            // Добавляем в память для быстрого доступа
            const quizKey = `${userId}_${quizState.blockId}`;
            completedQuizzes.set(quizKey, true);
            console.log(`✅ Quiz completion marked in memory: ${quizKey}`);
                  } catch (error) {
            console.error('❌ Error saving quiz stats:', error);
            console.error('❌ Error details:', error.message);
          }
          
           // Получаем промокод для успешного прохождения
           let promoCode = '';
           if (correctAnswers === totalQuestions) {
             try {
               // Ищем доступный промокод для этого квиза
               const availablePromo = await PromoCode.findOne({
                 botId: botId,
                 quizId: quizState.blockId,
                 activated: false
               });
               
               if (availablePromo) {
                 // Активируем промокод
                 await PromoCode.updateOne(
                   { _id: availablePromo._id },
                   {
                     activated: true,
                     activatedBy: userId,
                     activatedAt: new Date()
                   }
                 );
                 
                 promoCode = availablePromo.code;
                 console.log(`🎁 Выдан промокод ${promoCode} пользователю ${userId} за квиз ${quizState.blockId}`);
                      } else {
                 console.log(`🎁 Нет доступных промокодов для квиза ${quizState.blockId}`);
               }
             } catch (error) {
               console.error('❌ Ошибка при выдаче промокода:', error);
             }
           }
           
           // Отправляем финальное сообщение (HTML: ссылки [текст](url), промокод в <code>)
           const statsSuffix = `\n\n📊 Статистика:\n✅ Правильных ответов: ${correctAnswers}/${totalQuestions}\n📈 Процент: ${percentage}%\n⏱️ Время прохождения: ${completionTime} сек`;
           let finalHtml;
           if (correctAnswers === totalQuestions) {
             const successMessage = quizBlock.finalSuccessMessage || '🏆 Поздравляем! Вы успешно прошли квиз!';
             finalHtml = formatMessageWithMarkdownLinksToHtml(successMessage) + escapeTelegramHtml(statsSuffix);
             if (promoCode) {
               finalHtml += '\n\n🎁 Ваш промокод: <code>' + escapeTelegramHtml(promoCode) + '</code>';
             }
           } else {
             const failMsg = quizBlock.finalFailureMessage || '❌ Квест завершен. Попробуйте еще раз!';
             finalHtml = formatMessageWithMarkdownLinksToHtml(failMsg) + escapeTelegramHtml(statsSuffix);
           }

          await ctx.reply(finalHtml, { parse_mode: 'HTML' });
          
          // Если настроено возвращение в начало
          if (quizBlock.returnToStartOnComplete) {
            console.log(`🔍 DEBUG: Returning to start after quiz completion`);
                  userCurrentBlock.set(userId, 'start');
            userQuizStates.delete(userId);
            userNavigationHistory.delete(userId);
                  
                  const startBlock = dialogMap.get('start');
                  if (startBlock) {
              const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(startBlock.buttons, userId, 'start');
              await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
              console.log(`✅ Returned to start block after quiz completion`);
            }
          }
          
          return;
                  } else {
          // Следующий вопрос
          const nextQuestion = questions[quizState.currentQuestionIndex];
          const { keyboard, inlineKeyboard } = await createKeyboardWithBack(nextQuestion.buttons, userId, quizState.blockId);
          await sendMediaMessage(ctx, nextQuestion.message, nextQuestion.mediaFiles, keyboard, inlineKeyboard);
        }
        
                  return;
      }
      
      // Обработка кнопки "СИСТЕМА ЛОЯЛЬНОСТИ"
      if (messageText === '🎁 СИСТЕМА ЛОЯЛЬНОСТИ') {
        console.log(`🔍 DEBUG: Processing "СИСТЕМА ЛОЯЛЬНОСТИ" button`);
        
        try {
          const loyaltyInfo = await getLoyaltyInfo(userId);
          await ctx.reply(loyaltyInfo, { parse_mode: 'Markdown' });
          
          // Возвращаемся к главному блоку
                const startBlock = dialogMap.get('start');
                if (startBlock) {
            const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(startBlock.buttons, userId, 'start');
                  await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
                }
          return;
                } catch (error) {
          console.error('❌ Ошибка при обработке системы лояльности:', error);
          await ctx.reply('❌ Ошибка при получении информации о лояльности');
                return;
              }
            }

      // Обработка кнопки "Назад"
      if (messageText === '⬅️ Назад') {
        console.log(`🔍 DEBUG: Processing "Назад" button`);
        console.log(`🔍 DEBUG: Current block type: ${currentBlock.type}`);
        console.log(`🔍 DEBUG: User history:`, userNavigationHistory.get(userId));
        
        // Если пользователь в квизе, НЕ очищаем состояние квиза (сохраняем для продолжения)
        const quizState = userQuizStates.get(userId);
        if (quizState && !quizState.isCompleted) {
          console.log(`🔍 DEBUG: User in quiz, keeping quiz state for continuation`);
        }
        
        const userHistory = userNavigationHistory.get(userId);
        
        if (userHistory && userHistory.length > 0) {
          const previousBlockId = userHistory.pop();
          console.log(`🔍 DEBUG: Previous block ID: ${previousBlockId}`);
          const prevBlock = dialogMap.get(previousBlockId);
          
          if (prevBlock) {
            userCurrentBlock.set(userId, previousBlockId);
            userNavigationHistory.set(userId, userHistory);
            
            // Отслеживаем статистику (асинхронно)
            setImmediate(async () => {
              try {
                await trackButtonClick(botId, userId, currentBlockId, 'back', '⬅️ Назад');
                await trackBlockTransition(botId, userId, currentBlockId, previousBlockId, 'back', '⬅️ Назад', prevBlock.message?.substring(0, 50) || '');
                await trackBlockEnter(botId, userId, previousBlockId, prevBlock.message?.substring(0, 50) || '');
                await trackActiveUser(botId, userId);
              } catch (error) {
                console.error('[STATS] Ошибка при отслеживании кнопки "Назад":', error);
              }
            });
            
            const { keyboard, inlineKeyboard } = await createKeyboardWithBack(prevBlock.buttons, userId, previousBlockId);
            await sendMediaMessage(ctx, prevBlock.message, prevBlock.mediaFiles, keyboard, inlineKeyboard);
            console.log(`✅ Navigated back to block ${previousBlockId}`);
            return;
          } else {
            console.log(`❌ Previous block ${previousBlockId} not found in dialogMap`);
          }
                  } else {
          console.log(`❌ No user history found`);
                  }
                  
        await ctx.reply('Нет предыдущего блока');
                  return;
      }
      
      // Обработка обычных блоков с кнопками
      console.log(`🔍 DEBUG: Processing regular block with buttons`);
      console.log(`🔍 DEBUG: Current block buttons:`, currentBlock.buttons?.map(b => ({ id: b.id, text: b.text })));
      console.log(`🔍 DEBUG: Looking for button with text: "${messageText}"`);
      
      const button = currentBlock.buttons?.find(btn => btn.text === messageText);
      
      
      if (!button) {
        console.log(`❌ Button "${messageText}" not found in current block`);
        console.log(`❌ Available buttons:`, currentBlock.buttons?.map(b => b.text));
        await ctx.reply('Я вас не понимаю, воспользуйтесь пожалуйста кнопками.');
              return;
      }
            
            // Проверяем, является ли кнопка ссылкой
            if (button.url && button.url.trim() !== '') {
              // Отслеживаем нажатие кнопки-ссылки
              setImmediate(async () => {
                try {
                  await trackButtonClick(botId, userId, currentBlockId, button.id, button.text);
                  await trackActiveUser(botId, userId);
                } catch (error) {
                  console.error('[STATS] Ошибка при отслеживании кнопки-ссылки:', error);
                }
              });
              
              await ctx.reply(`🔗 ${button.text}`, {
                reply_markup: {
                  inline_keyboard: [[{ text: button.text, url: button.url.trim() }]]
                }
              });
              return;
            }
            
      // Обычная кнопка - переход к следующему блоку
      const connectionKey = `${String(currentBlockId)}_${String(button.id)}`;
      const nextBlockId = connectionMap.get(connectionKey);
      
      if (!nextBlockId || !dialogMap.has(nextBlockId)) {
        await ctx.reply('Ошибка маршрутизации: не найден следующий блок.');
                return;
              }
            
      // Переходим к следующему блоку
              const nextBlock = dialogMap.get(nextBlockId);
              
      // Викторина: если пользователь уже проходил её — не пускаем
      if (nextBlock.type === 'trivia') {
        try {
          const alreadyPassed = await TriviaStats.findOne({
            botId,
            userId,
            blockId: nextBlockId,
            success: true
          });
          if (alreadyPassed) {
            await ctx.reply('Вы уже проходили эту викторину!');
            return;
          }
        } catch (e) {
          console.error('❌ Error checking trivia already passed:', e);
        }
      }
              
      // Добавляем текущий блок в историю (только если следующий блок не квиз)
      if (nextBlock.type !== 'quiz') {
              let userHistory = userNavigationHistory.get(userId) || [];
              userHistory.push(currentBlockId);
              userNavigationHistory.set(userId, userHistory);
      }
              
              // Обновляем текущий блок пользователя
              userCurrentBlock.set(userId, nextBlockId);
      console.log(`🔍 DEBUG: Updated user current block to: ${nextBlockId}`);
      
      // Отслеживаем статистику (асинхронно, не блокируем ответ)
      setImmediate(async () => {
        try {
          await trackButtonClick(botId, userId, currentBlockId, button.id, button.text);
          await trackBlockTransition(botId, userId, currentBlockId, nextBlockId, button.id, button.text, nextBlock.message?.substring(0, 50) || '');
          await trackBlockEnter(botId, userId, nextBlockId, nextBlock.message?.substring(0, 50) || '');
          await trackActiveUser(botId, userId);
        } catch (error) {
          console.error('[STATS] Ошибка при отслеживании перехода:', error);
        }
      });
      
      // Если следующий блок - квиз, инициализируем состояние квиза и показываем первый вопрос
      if (nextBlock.type === 'quiz') {
        console.log(`🔍 DEBUG: Starting quiz for user ${userId}`);
        
        // Проверяем, не завершил ли пользователь уже этот квиз
        const quizKey = `${userId}_${nextBlockId}`;
        if (completedQuizzes.has(quizKey)) {
          console.log(`🔍 DEBUG: User ${userId} already completed quiz ${nextBlockId} (from memory)`);
          await ctx.reply('Вы уже прошли этот квест!');
          return;
        }
        
        // Проверяем в MongoDB
        try {
          const existingQuizStats = await QuizStats.findOne({
            botId: botId,
            userId: userId,
            blockId: nextBlockId
          });
          
          if (existingQuizStats) {
            console.log(`🔍 DEBUG: User ${userId} already completed quiz ${nextBlockId} (from MongoDB)`);
            // Добавляем в память для быстрого доступа
            completedQuizzes.set(quizKey, true);
            await ctx.reply('Вы уже прошли этот квест!');
            return;
          }
        } catch (error) {
          console.error('❌ Error checking existing quiz stats:', error);
        }
                
                // Инициализируем состояние квиза
                const quizState = {
          blockId: nextBlockId,
                  currentQuestionIndex: 0,
          startTime: Date.now(),
                  answers: [],
          isCompleted: false
                };
                userQuizStates.set(userId, quizState);
        console.log(`🔍 DEBUG: Quiz state initialized:`, quizState);
        
        // Показываем первый вопрос квиза
        const questions = nextBlock.questions || [];
        if (questions.length > 0) {
          const firstQuestion = questions[0];
          console.log(`🔍 DEBUG: Showing first question: ${firstQuestion.message}`);
          const { keyboard, inlineKeyboard } = await createKeyboardWithBack(firstQuestion.buttons, userId, nextBlockId);
          await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles, keyboard, inlineKeyboard);
        } else {
          console.log(`❌ No questions found in quiz block`);
          await ctx.reply('Квиз не настроен');
        }
      } else {
        // Отправляем следующий блок (только для не-квизов)
        const { keyboard, inlineKeyboard } = await createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
              await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard, inlineKeyboard);
      }
      
      console.log(`✅ Successfully navigated to block ${nextBlockId}`);
      return;
    } catch (error) {
      console.error('❌ Critical error in message handler:', error);
      console.error('📄 Error stack:', error.stack);
      console.error('📄 Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
        response: error.response
      });
      
      // Обработка ошибки 403 (пользователь заблокировал бота)
      if (error.response && error.response.error_code === 403) {
        console.log(`⚠️ User blocked the bot (403 error in message handler), ignoring`);
        return;
      }
      
      // Попытка отправить сообщение об ошибке пользователю
      try {
        console.log(`🔍 DEBUG: Attempting to send error message to user`);
        console.log(`🔍 DEBUG: Error details:`, {
          message: error.message,
          name: error.name,
          code: error.code,
          stack: error.stack
        });
        await ctx.reply('Произошла ошибка. Попробуйте еще раз или нажмите /start для перезапуска.');
        console.log(`🔍 DEBUG: Error message sent successfully`);
      } catch (replyError) {
        console.error('❌ Error sending error message:', replyError);
        console.error('❌ Reply error details:', {
          message: replyError.message,
          name: replyError.name,
          code: replyError.code
        });
      }
      
      // Принудительная очистка памяти при критической ошибке
      try {
        cleanupOldUserData();
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
      }
    }
  });

  // Обработка любых callback_query (нажатий на inline-кнопки)
  bot.on('callback_query', async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    // Отслеживаем активность пользователя
    await trackUserActivity(userId, 'callback');
    
    // Асинхронно обрабатываем подписку и сохранение (не блокируем ответ)
    setImmediate(async () => {
      try {
        await handleUserSubscription(userId);
    await saveUserToMongo(ctx);
      } catch (error) {
        console.error('❌ Background callback error:', error);
      }
    });
    
    // Отвечаем на callback_query для предотвращения повторных запросов
    await ctx.answerCbQuery();
  });
}

// Функция для обновления меню команд Telegram
async function updateBotCommands(bot, blocks) {
  const commands = blocks
    .filter(block => block.command)
    .map(block => ({
      command: block.command.replace(/^\//, ''),
      description: (block.description || '').substring(0, 50)
    }))
    .sort((a, b) => a.command.localeCompare(b.command));
  if (commands.length > 0) {
    await bot.telegram.setMyCommands(commands);
    console.log('Меню команд Telegram обновлено:', commands);
  } else {
    await bot.telegram.setMyCommands([]);
    console.log('Меню команд Telegram очищено');
  }
}

// Пример функции проверки и выдачи бонуса за лояльность
const { createLoyaltySweep } = require('./loyaltySweep');
const loyaltySweep = createLoyaltySweep({ User, LoyaltyConfig, service: loyaltyService, botId,
  publish: progress => { if (process.connected) process.send({ type: 'loyalty-progress', progress }); }
});
let loyaltyTimer;
function startLoyaltyChecker() {
  clearInterval(loyaltyTimer);
  loyaltyTimer = setInterval(loyaltySweep.runBatch, 5000);
  setTimeout(loyaltySweep.runBatch, 5000);
}

// Функция для загрузки завершенных квизов из MongoDB
async function loadCompletedQuizzes() {
  try {
    console.log('=== [BOOT] Загружаем завершенные квизы из MongoDB ===');
    const completedQuizzesFromDB = await QuizStats.find({ botId });
    
    console.log(`=== [BOOT] Найдено ${completedQuizzesFromDB.length} завершенных квизов ===`);
    
    for (const quizStat of completedQuizzesFromDB) {
      const quizKey = `${quizStat.userId}_${quizStat.blockId}`;
      completedQuizzes.set(quizKey, true);
    }
    
    console.log(`=== [BOOT] Загружено ${completedQuizzes.size} завершенных квизов в память ===`);
  } catch (error) {
    console.error('❌ Error loading completed quizzes:', error);
  }
}

async function startBot() {
  console.log('=== [BOOT] startBot вызван ===');
  bot = new Telegraf(token, { telegram: { agent: require('./telegramAgent') } });
  
  // Счетчик ошибок для автоматического перезапуска
  let errorCount = 0;
  const maxErrors = 10;
  const errorWindow = 5 * 60 * 1000; // 5 минут
  
  // Функция для обработки критических ошибок
  const handleCriticalError = (error) => {
    errorCount++;
    console.error(`❌ Critical bot error #${errorCount}:`, error);
    
    if (errorCount >= maxErrors) {
      console.error(`🚨 Too many errors (${errorCount}), but continuing to run...`);
      // Не завершаем процесс, а просто логируем и сбрасываем счетчик
      errorCount = Math.max(0, errorCount - 5);
    }
    
    // Сброс счетчика ошибок через 10 минут
    setTimeout(() => {
      errorCount = Math.max(0, errorCount - 1);
    }, errorWindow);
  };
  
  // Загружаем завершенные квизы из MongoDB
  await loadCompletedQuizzes();
  
  // Настраиваем обработчики
  setupBotHandlers(bot, state.blocks, state.connections);

  // Обновляем меню команд Telegram
  await updateBotCommands(bot, state.blocks);
  
  // Оптимизированный логгер для всех апдейтов Telegram
  bot.use((ctx, next) => {
    // Логируем только основную информацию для производительности
    console.log(`📨 ${ctx.updateType} from ${ctx.from?.id || 'unknown'}: ${ctx.message?.text || 'no text'}`);
    return next();
  });

  // Обработчик ошибок бота
  bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    handleCriticalError(err);
  });
  
  // Проверяем подключение к Telegram API
  try {
    console.log('=== [BOOT] Проверяем подключение к Telegram API... ===');
    const botInfo = await bot.telegram.getMe();
    console.log('=== [BOOT] Telegram API доступен, bot info:', botInfo);
  } catch (apiError) {
    console.error('=== [BOOT] Ошибка подключения к Telegram API:', apiError);
    console.error('=== [BOOT] Проверьте интернет-соединение и доступность api.telegram.org');
    process.exit(1);
  }

  // Проверяем сетевые настройки
  try {
    console.log('=== [BOOT] Проверяем сетевые настройки... ===');
    const { exec } = require('child_process');
    exec('ping -c 1 api.telegram.org', (error, stdout, stderr) => {
      if (error) {
        console.error('=== [BOOT] Проблемы с сетью:', error);
      } else {
        console.log('=== [BOOT] Сеть работает, ping успешен');
      }
    });
  } catch (networkError) {
    console.error('=== [BOOT] Ошибка проверки сети:', networkError);
  }

  // Очищаем webhook перед запуском
  try {
    console.log('=== [BOOT] Очищаем webhook... ===');
    await bot.telegram.deleteWebhook();
    console.log('=== [BOOT] Webhook очищен ===');
  } catch (webhookError) {
    console.error('=== [BOOT] Ошибка очистки webhook:', webhookError);
  }

  // Запускаем бота в polling режиме
    console.log('=== [BOOT] Запускаем bot.launch() в polling режиме... ===');
    
  // Запускаем бота синхронно
  console.log('=== [BOOT] Запускаем bot.launch() синхронно... ===');
  
  // Запускаем проверку программы лояльности СРАЗУ, не дожидаясь завершения bot.launch()
  // так как bot.launch() может не завершиться синхронно
  console.log('=== [BOOT] Запускаем автоматическую проверку программы лояльности ===');
  startLoyaltyChecker();
  
  // Report successful Telegram polling to the supervisor.
  const callApi = bot.telegram.callApi.bind(bot.telegram);
  bot.telegram.callApi = async (method, ...args) => {
    const result = await callApi(method, ...args);
    if (method === 'getUpdates' && process.connected) {
      process.send({ type: 'polling-ok' });
    }
    return result;
  };

  // launch() lasts for the whole polling loop; register shutdown handlers now.
  bot.launch().then(() => {
    console.error('Telegram polling stopped unexpectedly');
    process.exit(1);
  }).catch((error) => {
    console.error('Telegram polling failed:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.once('SIGINT', async () => {
    console.log('=== [SHUTDOWN] Received SIGINT, stopping bot gracefully ===');
    try {
      await bot.stop('SIGINT');
      console.log('=== [SHUTDOWN] Bot stopped successfully ===');
      process.exit(0);
  } catch (error) {
      console.error('=== [SHUTDOWN] Error stopping bot:', error);
    process.exit(1);
  }
  });
  
  process.once('SIGTERM', async () => {
    console.log('=== [SHUTDOWN] Received SIGTERM, stopping bot gracefully ===');
    try {
      await bot.stop('SIGTERM');
      console.log('=== [SHUTDOWN] Bot stopped successfully ===');
      process.exit(0);
    } catch (error) {
      console.error('=== [SHUTDOWN] Error stopping bot:', error);
      process.exit(1);
    }
  });
  
  // Обработчик необработанных ошибок
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
}

console.log('=== [BOOT] botProcess.js запускается ===');

mongoose.connection.on('connected', () => {
  console.log('=== [BOOT] Mongoose connected ===');
});
mongoose.connection.on('error', (err) => {
  console.error('=== [BOOT] Mongoose connection error ===', err);
});

async function bootstrapBot() {
  await mongoReady;

  const botDocument = await Bot.findOne({ id: botId }).lean();
  if (!botDocument) {
    throw new Error(`Bot ${botId} was not found in MongoDB`);
  }

  if (!botDocument.token) {
    throw new Error(`Bot ${botId} has no Telegram token`);
  }

  if (!botDocument.editorState || !Array.isArray(botDocument.editorState.blocks) || !Array.isArray(botDocument.editorState.connections)) {
    throw new Error(`Bot ${botId} has an invalid editorState`);
  }

  token = botDocument.token;
  state = botDocument.editorState;

  console.log('=== [BOOT] Bot configuration loaded from MongoDB ===', {
    botId,
    blocks: state.blocks.length,
    connections: state.connections.length,
    editorStateBytes: Buffer.byteLength(JSON.stringify(state), 'utf8')
  });

  const userCount = await User.countDocuments({ botId });
  console.log(`[MongoDB] Users for botId=${botId}: ${userCount}`);

  await startBot();
}

bootstrapBot().catch(error => {
  console.error(`❌ Failed to bootstrap bot ${botId}:`, error);
  process.exit(1);
});
