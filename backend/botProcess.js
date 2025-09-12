const { Telegraf } = require('telegraf');
const { User, QuizStats, PromoCode, Loyalty, LoyaltyConfig, LoyaltyPromoCode } = require('./models');
const mongoose = require('mongoose');
const MONGO_URI = process.env.MONGO_URI || 'mongodb://157.230.20.252:27017/tg_const_main';
mongoose.connect(MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
  .then(() => console.log('✅ MongoDB connected (botProcess.js)'))
  .catch(err => {
    console.error('❌ MongoDB connection error (botProcess.js):', err);
    console.error('❌ Retrying MongoDB connection in 5 seconds...');
    setTimeout(() => {
      mongoose.connect(MONGO_URI, { 
        useNewUrlParser: true, 
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000
      }).catch(retryErr => {
        console.error('❌ MongoDB retry failed:', retryErr);
    process.exit(1);
      });
    }, 5000);
  });

// Получаем параметры из аргументов командной строки
const [token, botId, stateJson] = process.argv.slice(2);

if (!token || !botId || !stateJson) {
  console.error('Missing required arguments: token, botId, stateJson');
  process.exit(1);
}

// Парсим состояние
let state;
try {
  state = JSON.parse(stateJson);
  if (!state.blocks || !state.connections) {
    throw new Error('Invalid state format');
  }
} catch (error) {
  console.error('Failed to parse state:', error);
  process.exit(1);
}

// Кэш для промокодов
const promoCodeCache = new Map();

// Функция для отправки медиафайлов (оптимизированная)
async function sendMediaMessage(ctx, message, mediaFiles, keyboard, inlineKeyboard = []) {
  const fs = require('fs');
  const path = require('path');
  
  console.log(`🔍 DEBUG: sendMediaMessage called with:`);
  console.log(`  - message: ${message.substring(0, 50)}...`);
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
      const sendPromise = ctx.reply(message, {
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
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
        const sendPromise = ctx.reply(message, {
          reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
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
        caption: message,
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
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
        const sendPromise = ctx.reply(message, {
          reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
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
      
      // Добавляем timeout для отправки медиагруппы
      const sendGroupPromise = ctx.replyWithMediaGroup(mediaGroup, {
        caption: message,
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
      const sendPromise = ctx.reply(message, {
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
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
async function saveUserToMongo(ctx) {
  if (!ctx.from) return;
  const userId = ctx.from.id;
  try {
    console.log(`[MongoDB] saveUserToMongo: попытка сохранить пользователя:`, { botId, userId, from: ctx.from });
    
    // Сначала проверяем, существует ли пользователь
    const existingUser = await User.findOne({ botId, userId });
    
    if (existingUser) {
      // Обновляем существующего пользователя
    const updateResult = await User.updateOne(
      { botId, userId },
      {
          $set: {
            lastSubscribedAt: new Date(),
            isSubscribed: true,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name
          }
        }
      );
      console.log('[MongoDB] saveUserToMongo: пользователь обновлен:', updateResult);
    } else {
      // Создаем нового пользователя
      const newUser = new User({
          botId,
          userId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
          lastName: ctx.from.last_name,
          firstSubscribedAt: new Date(),
          lastSubscribedAt: new Date(),
        isSubscribed: true,
        subscriptionHistory: [{ subscribedAt: new Date() }]
      });
      
      const saveResult = await newUser.save();
      console.log('[MongoDB] saveUserToMongo: новый пользователь создан:', saveResult._id);
    }
    
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

// Глобальная переменная для бота
let bot;

// Функция для проверки подписки пользователя на канал (глобальная)
async function checkChannelSubscription(userId, channelId) {
  try {
    console.log(`🔍 Проверяем подписку пользователя ${userId} на канал ${channelId}`);
    
    if (!channelId) {
      console.log('❌ ID канала не указан');
      return false;
    }
    
    // Нормализуем ID канала - убираем лишние пробелы и приводим к строке
    let normalizedChannelId = String(channelId).trim();
    console.log(`🔍 Исходный ID канала: "${channelId}"`);
    console.log(`🔍 Нормализованный ID канала: "${normalizedChannelId}"`);
    
    // Если ID начинается с @, оставляем как есть
    // Если ID начинается с -, оставляем как есть (это правильный формат для супергрупп)
    // Если ID начинается с 100, добавляем - (это супергруппа)
    // Если ID начинается с другими цифрами, добавляем @
    if (normalizedChannelId.startsWith('@')) {
      console.log(`🔍 ID канала уже содержит @: ${normalizedChannelId}`);
    } else if (normalizedChannelId.startsWith('-')) {
      console.log(`🔍 ID канала начинается с - (супергруппа): ${normalizedChannelId}`);
    } else if (normalizedChannelId.startsWith('100')) {
      // Если ID начинается с 100, это супергруппа - добавляем минус
      normalizedChannelId = '-' + normalizedChannelId;
      console.log(`🔍 Добавили - к ID супергруппы: ${normalizedChannelId}`);
    } else if (/^\d+$/.test(normalizedChannelId)) {
      // Если это только цифры (не начинается с 100), добавляем @
      normalizedChannelId = '@' + normalizedChannelId;
      console.log(`🔍 Добавили @ к числовому ID: ${normalizedChannelId}`);
    } else {
      console.log(`🔍 ID канала в неизвестном формате: ${normalizedChannelId}`);
    }
    
    console.log(`🔍 Финальный ID для проверки: "${normalizedChannelId}"`);
    
    // Сначала проверяем, существует ли канал
    try {
      const chat = await bot.telegram.getChat(normalizedChannelId);
      console.log(`✅ Канал найден:`, {
        id: chat.id,
        title: chat.title,
        type: chat.type
      });
    } catch (chatError) {
      console.log(`❌ Канал не найден: ${chatError.message}`);
      return false;
    }
    
    // Проверяем подписку через Telegram API
    const chatMember = await bot.telegram.getChatMember(normalizedChannelId, userId);
    console.log(`🔍 Статус подписки: ${chatMember.status}`);
    console.log(`🔍 Полная информация о членстве:`, JSON.stringify(chatMember, null, 2));
    
    // Статусы, которые считаются подпиской
    const subscribedStatuses = ['member', 'administrator', 'creator'];
    const isSubscribed = subscribedStatuses.includes(chatMember.status);
    
    console.log(`✅ Пользователь ${userId} ${isSubscribed ? 'подписан' : 'не подписан'} на канал ${normalizedChannelId}`);
    return isSubscribed;
    
  } catch (error) {
    console.error(`❌ Ошибка проверки подписки пользователя ${userId} на канал ${channelId}:`, error);
    console.error(`❌ Детали ошибки:`, {
      message: error.message,
      code: error.code,
      response: error.response ? {
        error_code: error.response.error_code,
        description: error.response.description
      } : null
    });
    
    // Если канал не найден
    if (error.response && error.response.error_code === 400 && error.response.description && error.response.description.includes('chat not found')) {
      console.log('❌ Канал не найден - проверьте правильность ID канала');
      return false;
    }
    
    // Если пользователь не найден в канале
    if (error.response && error.response.error_code === 400 && error.response.description && error.response.description.includes('user not found')) {
      console.log('❌ Пользователь не найден в канале');
      return false;
    }
    
    // Если нет прав на просмотр участников
    if (error.response && error.response.error_code === 400 && error.response.description && error.response.description.includes('member list is inaccessible')) {
      console.log('❌ Нет прав на просмотр участников канала - добавьте бота как администратора');
      return false;
    }
    
    // Если канал не найден или пользователь заблокировал бота
    if (error.response && error.response.error_code === 400) {
      console.log('❌ Канал недоступен или пользователь заблокировал бота');
      return false;
    }
    
    return false;
  }
}

function setupBotHandlers(bot, blocks, connections) {
  console.log('=== [BOOT] setupBotHandlers вызван ===');
  // Создаем карту диалогов для быстрого доступа
  const dialogMap = new Map();
  console.log(`[BOOT] Creating dialogMap from ${blocks.length} blocks:`);
  blocks.forEach(block => {
    dialogMap.set(block.id, {
      message: block.message,
      buttons: block.buttons || [],
      mediaFiles: block.mediaFiles || [],
      type: block.type,
      questions: block.questions || [],
      currentQuestionIndex: block.currentQuestionIndex || 0,
      finalSuccessMessage: block.finalSuccessMessage,
      returnToStartOnComplete: block.returnToStartOnComplete
    });
    console.log(`[BOOT] dialogMap: ${block.id} -> ${block.type} (${(block.buttons || []).length} buttons)`);
    
    // Диагностика квизов
    if (block.type === 'quiz') {
      console.log(`[BOOT] Quiz block ${block.id} questions:`, (block.questions || []).length);
      console.log(`[BOOT] Quiz block ${block.id} questions data:`, JSON.stringify(block.questions, null, 2));
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

  // Функция для сохранения пользователя в MongoDB
  async function saveUserToMongo(ctx) {
    try {
      const userId = ctx.from?.id;
      if (!userId) {
        console.log('❌ No user ID in context');
        return;
      }

      const userData = {
        botId,
        userId,
        username: ctx.from?.username,
        firstName: ctx.from?.first_name,
        lastName: ctx.from?.last_name,
        isSubscribed: true, // Предполагаем, что пользователь подписан при взаимодействии с ботом
        firstSubscribedAt: new Date(),
        lastSubscribedAt: new Date()
      };

      // Проверяем, существует ли пользователь
      let user = await User.findOne({ botId, userId });
      
      if (!user) {
        // Создаем нового пользователя
        user = new User(userData);
        console.log(`✅ Создан новый пользователь: ${userId}`);
      } else {
        // Обновляем существующего пользователя
        user.username = userData.username;
        user.firstName = userData.firstName;
        user.lastName = userData.lastName;
        user.isSubscribed = true;
        user.lastSubscribedAt = new Date();
        
        // Если это первая подписка, устанавливаем firstSubscribedAt
        if (!user.firstSubscribedAt) {
          user.firstSubscribedAt = new Date();
        }
        
        console.log(`✅ Обновлен пользователь: ${userId}`);
      }

      await user.save();
      console.log(`✅ Пользователь ${userId} сохранен в MongoDB`);
    } catch (error) {
      console.error('❌ Ошибка при сохранении пользователя в MongoDB:', error);
    }
  }

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

  // Функция для получения эффективного времени подписки (с учетом пауз)
  function getEffectiveSubscriptionTime(user) {
    if (!user) return 0;
    
    const now = new Date();
    let totalTime = user.totalSubscribedTime || 0;
    
    // Если пользователь сейчас подписан, добавляем время с последней подписки
    if (user.isSubscribed && user.lastSubscribedAt) {
      const currentSubscriptionTime = now.getTime() - user.lastSubscribedAt.getTime();
      totalTime += currentSubscriptionTime;
    }
    
    // Вычитаем время паузы
    totalTime -= (user.pausedTime || 0);
    
    return Math.max(0, totalTime); // Не может быть отрицательным
  }


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
      const userHistory = userNavigationHistory.get(userId);
      if (userHistory && userHistory.length > 0) {
        keyboard.push([{ text: '⬅️ Назад' }]);
      }
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
          console.log(`🔄 Перепроверяем подписку пользователя ${userId} на канал ${channelId}`);
          const isSubscribed = await checkChannelSubscription(userId, channelId);
          
          if (!isSubscribed) {
            const channelUsername = loyaltyConfig.channelSettings.channelUsername || channelId;
            const notSubscribedMessage = loyaltyConfig.channelSettings.notSubscribedMessage || 
              'Для участия в программе лояльности необходимо подписаться на наш канал!';
            
            let message = '🔒 **ДОСТУП ОГРАНИЧЕН**\n\n';
            message += `${notSubscribedMessage}\n\n`;
            message += `📢 **Канал:** ${channelUsername}\n\n`;
            message += '💡 **Подпишитесь на канал и попробуйте снова!**';
            
            return message;
          } else {
            console.log(`✅ Пользователь ${userId} подписан на канал ${channelId} - доступ разрешен`);
          }
        }
      }

      const loyalty = await Loyalty.findOne({ botId, userId });
      if (!loyalty) {
        return '❌ Информация о лояльности не найдена';
      }

      // Используем эффективное время подписки (с учетом пауз)
      const effectiveTime = getEffectiveSubscriptionTime(user);
      const totalDays = Math.floor(effectiveTime / (1000 * 60 * 60 * 24));
      const totalHours = Math.floor(effectiveTime / (1000 * 60 * 60));
      const totalMinutes = Math.floor(effectiveTime / (1000 * 60));

      let message = '🎁 **СИСТЕМА ЛОЯЛЬНОСТИ**\n\n';
      message += `📅 **Вы с нами:** ${totalDays} дней, ${totalHours % 24} часов, ${totalMinutes % 60} минут\n\n`;
      
      // Показываем статус подписки
      if (user.isSubscribed) {
        message += `🟢 **Статус:** Подписан\n\n`;
      } else {
        message += `🔴 **Статус:** Отписан (время на паузе)\n\n`;
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
        message += '❌ **Программа лояльности не настроена**';
        return message;
      }

      const currentMinutes = Math.floor(effectiveTime / (1000 * 60));
      
      // Находим следующий доступный бонус
      let nextBonus = null;
      let allRewarded = true;
      
      for (const period of enabledPeriods) {
        const isRewarded = loyalty.rewards[period.key] || false;
        
        if (!isRewarded) {
          allRewarded = false;
          if (currentMinutes >= period.minutes) {
            // Бонус доступен сейчас
            message += `🎁 **Следующий бонус:** ${period.name} - **ДОСТУПЕН СЕЙЧАС!**\n\n`;
            message += '💡 **Награда придет автоматически!**';
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
        message += '🎉 **Поздравляем! Вы получили все доступные награды!**\n\n';
        message += '💡 **Следите за обновлениями программы лояльности!**';
      } else if (nextBonus) {
        const remainingMinutes = nextBonus.minutes - currentMinutes;
        const remainingDays = Math.floor(remainingMinutes / (24 * 60));
        const remainingHours = Math.floor((remainingMinutes % (24 * 60)) / 60);
        const remainingMins = remainingMinutes % 60;
        
        message += `⏳ **До следующего бонуса:** ${nextBonus.name}\n\n`;
        
        if (remainingDays > 0) {
          message += `📅 **Осталось:** ${remainingDays} дней, ${remainingHours} часов, ${remainingMins} минут`;
        } else if (remainingHours > 0) {
          message += `⏰ **Осталось:** ${remainingHours} часов, ${remainingMins} минут`;
        } else {
          message += `⏰ **Осталось:** ${remainingMins} минут`;
        }
        
        message += '\n\n💡 **Награда придет автоматически!**';
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
    console.log('[DEBUG] /start ctx:', JSON.stringify(ctx, null, 2));
    console.log('[DEBUG] /start ctx.from:', ctx.from);
    await saveUserToMongo(ctx);
    
    // Обрабатываем подписку пользователя
    const userId = ctx.from?.id;
    if (userId) {
      await handleUserSubscription(userId);
    }
    
    // Очищаем историю навигации пользователя
    userNavigationHistory.delete(userId);
    
    // Очищаем состояние квиза пользователя
    userQuizStates.delete(userId);
    
    // Устанавливаем текущий блок как стартовый
    userCurrentBlock.set(userId, 'start');
    
    const startBlock = dialogMap.get('start');
    if (startBlock) {
      const { keyboard, inlineKeyboard } = await createKeyboardWithLoyalty(startBlock.buttons, userId, 'start');
      await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
    } else {
      await ctx.reply('Бот не настроен');
    }
  });

  // Обработка команды /help
  bot.command('help', async (ctx) => {
    console.log('[DEBUG] /help ctx:', JSON.stringify(ctx, null, 2));
    console.log('[DEBUG] /help ctx.from:', ctx.from);
    await saveUserToMongo(ctx);
    
    // Обрабатываем подписку пользователя
    const userId = ctx.from?.id;
    if (userId) {
      await handleUserSubscription(userId);
    }
    let currentBlockId = userCurrentBlock.get(userId);
    
    let helpMessage = '🤖 **Помощь по использованию бота:**\n\n';
    helpMessage += '📱 **Как использовать:**\n';
    helpMessage += '• Используйте кнопки для навигации\n';
    helpMessage += '• Нажимайте на кнопки вместо ввода текста\n';
    helpMessage += '• Кнопка "Назад" вернет вас к предыдущему блоку\n\n';
    helpMessage += '🔗 **Кнопки с ссылками:**\n';
    helpMessage += '• Если кнопка содержит ссылку, она откроется в браузере\n\n';
    helpMessage += '📊 **Квизы:**\n';
    helpMessage += '• Отвечайте на вопросы, выбирая правильные варианты\n';
    helpMessage += '• За правильные ответы вы можете получить промокоды\n\n';
    helpMessage += '💡 **Советы:**\n';
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
           
           // Отправляем финальное сообщение
           let finalMessage;
           if (correctAnswers === totalQuestions) {
             // Все ответы правильные - показываем сообщение об успехе
             const successMessage = quizBlock.finalSuccessMessage || '🏆 Поздравляем! Вы успешно прошли квиз!';
             const statsMessage = `\n\n📊 **Статистика:**\n✅ Правильных ответов: ${correctAnswers}/${totalQuestions}\n📈 Процент: ${percentage}%\n⏱️ Время прохождения: ${completionTime} сек`;
             const promoMessage = promoCode ? `\n\n🎁 **Ваш промокод:** \`${promoCode}\`` : '';
             
             finalMessage = successMessage + statsMessage + promoMessage;
                  } else {
             // Не все ответы правильные - показываем сообщение о неудаче
             finalMessage = `${quizBlock.finalFailureMessage || '❌ Квест завершен. Попробуйте еще раз!'}\n\n📊 **Статистика:**\n✅ Правильных ответов: ${correctAnswers}/${totalQuestions}\n📈 Процент: ${percentage}%\n⏱️ Время прохождения: ${completionTime} сек`;
           }
          
          await ctx.reply(finalMessage, { parse_mode: 'Markdown' });
          
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
              
      // Добавляем текущий блок в историю (только если следующий блок не квиз)
      if (nextBlock.type !== 'quiz') {
              let userHistory = userNavigationHistory.get(userId) || [];
              userHistory.push(currentBlockId);
              userNavigationHistory.set(userId, userHistory);
      }
              
              // Обновляем текущий блок пользователя
              userCurrentBlock.set(userId, nextBlockId);
      console.log(`🔍 DEBUG: Updated user current block to: ${nextBlockId}`);
      
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
async function checkAndRewardLoyalty(userId, thresholdKey) {
  let loyalty = await Loyalty.findOne({ userId });
  if (!loyalty) {
    loyalty = new Loyalty({ userId, rewards: {} });
  }
  if (!loyalty.rewards[thresholdKey]) {
    // Выдаём бонус (отправка сообщения, промокода и т.д.)
    // ... твоя логика выдачи ...
    loyalty.rewards[thresholdKey] = true;
    await loyalty.save();
    return true; // Бонус выдан
  }
  return false; // Уже получал
}

// Функция для периодической проверки программы лояльности
function startLoyaltyChecker() {
  console.log('[LOYALTY] Запуск периодической проверки программы лояльности');
  
  // Проверяем каждую минуту
  setInterval(async () => {
    // Проверяем, что бот инициализирован
    if (!bot) {
      console.log('[LOYALTY] Бот еще не инициализирован, пропускаем проверку');
              return;
            }
    try {
      console.log('[LOYALTY] Периодическая проверка программы лояльности');
      
      // Получаем конфигурацию программы лояльности
      const loyaltyConfig = await LoyaltyConfig.findOne({ botId });
      if (!loyaltyConfig) {
        console.log('[LOYALTY] Конфигурация программы лояльности не найдена для бота', botId);
        return;
      }
      if (!loyaltyConfig.isEnabled) {
        console.log('[LOYALTY] Программа лояльности отключена');
                return;
              }
      
      console.log('[LOYALTY] Программа лояльности включена, проверяем пользователей');
      
      // Получаем всех пользователей бота
      const users = await User.find({ botId, isSubscribed: true });
      console.log(`[LOYALTY] Найдено ${users.length} подписанных пользователей`);
      
      for (const user of users) {
        try {
          // Перепроверяем подписку на канал, если требуется
          if (loyaltyConfig.channelSettings && loyaltyConfig.channelSettings.isRequired) {
            const channelId = loyaltyConfig.channelSettings.channelId;
            if (channelId) {
              console.log(`[LOYALTY] Перепроверяем подписку пользователя ${user.userId} на канал ${channelId}`);
              const isSubscribed = await checkChannelSubscription(user.userId, channelId);
              
              if (!isSubscribed) {
                console.log(`[LOYALTY] Пользователь ${user.userId} не подписан на канал ${channelId}, пропускаем`);
                continue; // Пропускаем этого пользователя
              } else {
                console.log(`[LOYALTY] Пользователь ${user.userId} подписан на канал ${channelId}, продолжаем`);
              }
            }
          }
          
          // Получаем или создаем запись лояльности
          let loyaltyRecord = await Loyalty.findOne({ botId, userId: user.userId });
          if (!loyaltyRecord) {
            loyaltyRecord = new Loyalty({
              botId,
              userId: user.userId,
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
            await loyaltyRecord.save();
            console.log(`[LOYALTY] Создана запись лояльности для пользователя ${user.userId}`);
          }
          
          // Вычисляем время подписки
          const subscriptionTime = Date.now() - user.firstSubscribedAt.getTime();
          const minutes = Math.floor(subscriptionTime / (1000 * 60));
          const hours = Math.floor(subscriptionTime / (1000 * 60 * 60));
          const days = Math.floor(subscriptionTime / (1000 * 60 * 60 * 24));
          
          console.log(`[LOYALTY] Пользователь ${user.userId}: подписан ${minutes} минут, ${hours} часов, ${days} дней`);
          
          // Проверяем каждый период
          const periods = [
            { key: '1m', minutes: 1 },
            { key: '24h', hours: 24 },
            { key: '7d', days: 7 },
            { key: '30d', days: 30 },
            { key: '90d', days: 90 },
            { key: '180d', days: 180 },
            { key: '360d', days: 360 }
          ];
          
          for (const period of periods) {
            const config = loyaltyConfig.messages[period.key];
            if (!config || !config.enabled) {
              console.log(`[LOYALTY] Период ${period.key} отключен`);
              continue;
            }
            
            // Проверяем, достиг ли пользователь этого периода
            let hasReachedPeriod = false;
            if (period.minutes && minutes >= period.minutes) hasReachedPeriod = true;
            if (period.hours && hours >= period.hours) hasReachedPeriod = true;
            if (period.days && days >= period.days) hasReachedPeriod = true;
            
            console.log(`[LOYALTY] Период ${period.key}: достигнут=${hasReachedPeriod}, уже получен=${loyaltyRecord.rewards[period.key]}`);
            
            // Проверяем, не получал ли уже награду за этот период
            if (hasReachedPeriod && !loyaltyRecord.rewards[period.key]) {
              console.log(`[LOYALTY] Пользователь ${user.userId} достиг периода ${period.key}, отправляем сообщение`);
              
              // Отправляем сообщение
              let message = config.message;
              if (!message) {
                const periodLabels = {
                  '1m': '1 минуту',
                  '24h': '24 часа',
                  '7d': '7 дней',
                  '30d': '30 дней',
                  '90d': '90 дней',
                  '180d': '180 дней',
                  '360d': '360 дней'
                };
                message = `Поздравляем! Вы с нами уже ${periodLabels[period.key]}! 🎉`;
              }
              
              // Ищем доступный промокод для этого периода
              const availablePromoCodes = await LoyaltyPromoCode.find({
                botId,
                period: period.key,
                activated: false
              });
              
              if (availablePromoCodes.length > 0) {
                // Выбираем случайный промокод
                const randomIndex = Math.floor(Math.random() * availablePromoCodes.length);
                const selectedPromoCode = availablePromoCodes[randomIndex];
                
                message += `\n\n🎁 Ваш промокод: \`${selectedPromoCode.code}\``;
                
                // Помечаем промокод как использованный
                await LoyaltyPromoCode.updateOne(
                  { _id: selectedPromoCode._id },
                  { 
                    activated: true, 
                    activatedBy: user.userId, 
                    activatedAt: new Date() 
                  }
                );
                console.log(`[LOYALTY] Промокод ${selectedPromoCode.code} активирован для пользователя ${user.userId} за период ${period.key}`);
              } else {
                console.log(`[LOYALTY] Нет доступных промокодов для периода ${period.key}`);
              }
              
              // Отправляем сообщение пользователю
              await bot.telegram.sendMessage(user.userId, message, { parse_mode: 'Markdown' });
              console.log(`[LOYALTY] Сообщение отправлено пользователю ${user.userId}`);
              
              // Отмечаем, что награда выдана
              await Loyalty.updateOne(
                { botId, userId: user.userId },
                { [`rewards.${period.key}`]: true }
              );
              
              console.log(`[LOYALTY] Награда за период ${period.key} выдана пользователю ${user.userId}`);
            }
          }
          
        } catch (userError) {
          console.error(`[LOYALTY] Ошибка при проверке пользователя ${user.userId}:`, userError);
        }
      }
      
    } catch (error) {
      console.error('[LOYALTY] Ошибка при периодической проверке программы лояльности:', error);
    }
  }, 10000); // Проверяем каждые 10 секунд для тестирования
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
  bot = new Telegraf(token);
  
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
  
  // Запускаем периодическую проверку программы лояльности сразу
  startLoyaltyChecker();
  
  try {
    await bot.launch();
    console.log('=== [BOOT] Bot started successfully in polling mode ===');
    console.log('Bot started successfully');
  } catch (launchError) {
    console.error('=== [BOOT] Bot launch failed:', launchError);
    console.error('=== [BOOT] Пробуем запуск без await...');
    
    // Альтернативный запуск
    bot.launch().then(() => {
      console.log('=== [BOOT] Bot started successfully (alternative) ===');
    }).catch((altError) => {
      console.error('=== [BOOT] Alternative launch failed:', altError);
    });
    }
    
    // Сброс счетчика ошибок при успешном запуске
    errorCount = 0;
  
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
    handleCriticalError(error);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    handleCriticalError(reason);
  });
}

// Проверка наличия пользователей при запуске
User.countDocuments({ botId }).then(count => {
  if (count === 0) {
    console.log(`[MongoDB] Коллекция users пуста для botId=${botId}`);
  } else {
    console.log(`[MongoDB] В коллекции users уже есть ${count} пользователей для botId=${botId}`);
  }
}).catch(err => {
  console.error('[MongoDB] Ошибка при подсчёте пользователей:', err);
});

// Логируем editorState при запуске
console.log('=== editorState при запуске ===');
console.dir(state, { depth: 5 });
console.log('==============================');

console.log('=== [BOOT] botProcess.js запускается ===');

mongoose.connection.on('connected', () => {
  console.log('=== [BOOT] Mongoose connected ===');
});
mongoose.connection.on('error', (err) => {
  console.error('=== [BOOT] Mongoose connection error ===', err);
});

console.log('=== [BOOT] Аргументы запуска:', { token, botId, stateJsonLength: stateJson.length });

try {
  state = JSON.parse(stateJson);
  console.log('=== [BOOT] editorState успешно распарсен ===');
  console.log('=== [BOOT] blocks:', Array.isArray(state.blocks) ? state.blocks.length : 'нет');
  console.log('=== [BOOT] connections:', Array.isArray(state.connections) ? state.connections.length : 'нет');
} catch (error) {
  console.error('=== [BOOT] Ошибка парсинга editorState:', error);
  process.exit(1);
}

startBot();