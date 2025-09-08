const { Telegraf } = require('telegraf');
const { User } = require('./models');
const { Loyalty } = require('./models');
const mongoose = require('mongoose');
const MONGO_URI = 'mongodb://157.230.20.252:27017/tg_const_main';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected (botProcess.js)'))
  .catch(err => {
    console.error('❌ MongoDB connection error (botProcess.js):', err);
    process.exit(1);
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

  // Функция для очистки старых данных пользователей (оптимизация памяти)
  function cleanupOldUserData() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 часа
    
    console.log(`🧹 Starting memory cleanup...`);
    console.log(`🧹 Before cleanup - Active users: ${userCurrentBlock.size}, Quiz states: ${userQuizStates.size}, History: ${userNavigationHistory.size}`);
    
    // Очищаем старые состояния квизов
    let cleanedQuizStates = 0;
    for (const [userId, quizState] of userQuizStates.entries()) {
      if (now - quizState.startTime > maxAge) {
        userQuizStates.delete(userId);
        cleanedQuizStates++;
      }
    }
    
    // Очищаем неактивных пользователей (не было активности более 30 минут)
    const inactiveThreshold = 30 * 60 * 1000; // 30 минут
    let cleanedUsers = 0;
    for (const [userId, lastActivity] of userLastActivity.entries()) {
      if (now - lastActivity > inactiveThreshold) {
        userCurrentBlock.delete(userId);
        userNavigationHistory.delete(userId);
        userLastActivity.delete(userId);
        completedQuizzes.delete(userId);
        cleanedUsers++;
      }
    }
    
    // Принудительная очистка если слишком много пользователей
    if (userCurrentBlock.size > 1000) {
      console.log(`🧹 Too many users (${userCurrentBlock.size}), forcing cleanup...`);
      const userArray = Array.from(userCurrentBlock.entries());
      const toRemove = userArray.slice(0, 500); // Удаляем 500 самых старых
      
      for (const [userId] of toRemove) {
        userCurrentBlock.delete(userId);
        userNavigationHistory.delete(userId);
        userLastActivity.delete(userId);
        completedQuizzes.delete(userId);
        userQuizStates.delete(userId);
      }
      console.log(`🧹 Forced cleanup: removed ${toRemove.length} users`);
    }
    
    console.log(`🧹 Memory cleanup completed. Cleaned: ${cleanedQuizStates} quiz states, ${cleanedUsers} users`);
    console.log(`🧹 After cleanup - Active users: ${userCurrentBlock.size}, Quiz states: ${userQuizStates.size}, History: ${userNavigationHistory.size}`);
    
    // Принудительная сборка мусора
    if (global.gc) {
      global.gc();
      console.log(`🧹 Garbage collection triggered`);
    }
  }

  // Карта для отслеживания последней активности пользователей
  // const userLastActivity = new Map(); // Удалено

  // Запускаем очистку памяти каждые 15 минут (более часто)
  setInterval(cleanupOldUserData, 15 * 60 * 1000);
  
  // Дополнительная очистка при высоком использовании памяти
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    console.log(`📊 Memory usage: ${memPercent.toFixed(1)}% (${Math.round(memUsage.heapUsed / 1024 / 1024)}MB / ${Math.round(memUsage.heapTotal / 1024 / 1024)}MB)`);
    console.log(`📊 Active users: ${userCurrentBlock.size}, Quiz states: ${userQuizStates.size}, History: ${userNavigationHistory.size}`);
    
    if (memPercent > 80) {
      console.log(`⚠️ High memory usage: ${memPercent.toFixed(1)}%, triggering cleanup`);
      cleanupOldUserData();
    }
    
    // Проверка на утечку памяти
    if (userCurrentBlock.size > 2000) {
      console.log(`🚨 Too many users (${userCurrentBlock.size}), forcing aggressive cleanup`);
      const userArray = Array.from(userCurrentBlock.entries());
      const toRemove = userArray.slice(0, 1000); // Удаляем 1000 самых старых
      
      for (const [userId] of toRemove) {
        userCurrentBlock.delete(userId);
        userNavigationHistory.delete(userId);
        userLastActivity.delete(userId);
        completedQuizzes.delete(userId);
        userQuizStates.delete(userId);
      }
      console.log(`🧹 Aggressive cleanup: removed ${toRemove.length} users`);
    }
  }, 5 * 60 * 1000); // Каждые 5 минут

  // Функция для создания клавиатуры с кнопкой "Назад"
  function createKeyboardWithBack(buttons, userId, currentBlockId) {
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
    
    return { keyboard, inlineKeyboard };
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
    
    // Очищаем историю навигации пользователя
    const userId = ctx.from?.id;
    userNavigationHistory.delete(userId);
    
    // Очищаем состояние квиза пользователя
    userQuizStates.delete(userId);
    
    // Устанавливаем текущий блок как стартовый
    userCurrentBlock.set(userId, 'start');
    
    const startBlock = dialogMap.get('start');
    if (startBlock) {
      const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
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
    const userId = ctx.from?.id;
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
        const { keyboard, inlineKeyboard } = createKeyboardWithBack(currentBlock.buttons, userId, currentBlockId);
        
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
        const userId = ctx.from?.id;
        userCurrentBlock.set(userId, block.id);
        const { keyboard, inlineKeyboard } = createKeyboardWithBack(block.buttons, userId, block.id);
        await sendMediaMessage(ctx, block.message, block.mediaFiles, keyboard, inlineKeyboard);
      });
    }
  });

  // Обработка текстовых сообщений
  bot.on('text', async (ctx) => {
    console.log('=== [EVENT] Получено текстовое сообщение ===');
    console.log('[EVENT] ctx.from:', ctx.from);
    
    try {
      const userId = ctx.from?.id;
      const messageText = ctx.message.text;
      
      console.log(`🔍 DEBUG: Message: "${messageText}" from user ${userId}`);
      
      // Валидация входных данных
      if (!userId) {
        console.log('❌ No user ID, ignoring message');
        return;
      }
      
      if (!messageText || messageText.length < 1) {
        console.log('❌ Empty message, ignoring');
        return;
      }
      
      if (messageText.startsWith('/')) {
        console.log('❌ Command message, ignoring (handled by command handlers)');
        return;
      }
      
      // Сохраняем пользователя в MongoDB
      try {
        await saveUserToMongo(ctx);
        console.log('✅ User saved to MongoDB');
      } catch (error) {
        console.error('❌ Error saving user:', error);
        // Продолжаем работу даже если не удалось сохранить пользователя
      }
      
      // Отслеживаем активность пользователя
      userLastActivity.set(userId, Date.now());
      
      // Получаем текущий блок пользователя
      let currentBlockId = userCurrentBlock.get(userId);
      console.log(`🔍 DEBUG: Current block: ${currentBlockId}`);
      
      // Инициализация пользователя если нужно
      if (!currentBlockId) {
        console.log(`🔍 DEBUG: Initializing new user ${userId}`);
        userCurrentBlock.set(userId, 'start');
        currentBlockId = 'start';
        
        // Отправляем приветственное сообщение
        const startBlock = dialogMap.get('start');
        if (startBlock) {
          const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
          await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
          console.log(`✅ Welcome message sent to user ${userId}`);
          return;
        } else {
          await ctx.reply('Бот не настроен');
          return;
        }
      }
      
      // Получаем текущий блок
      const currentBlock = dialogMap.get(currentBlockId);
      if (!currentBlock) {
        console.log(`❌ Current block ${currentBlockId} not found, resetting to start`);
            userCurrentBlock.set(userId, 'start');
            const startBlock = dialogMap.get('start');
            if (startBlock) {
              const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
              await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
            }
            return;
          }
      
      console.log(`🔍 DEBUG: Processing in block ${currentBlockId} (type: ${currentBlock.type})`);
      
      // Обработка квизов - проверяем, находится ли пользователь в квизе
      if (currentBlock.type === 'quiz') {
        console.log(`🔍 DEBUG: Processing quiz block`);
        console.log(`🔍 DEBUG: Current block ID: ${currentBlockId}`);
        console.log(`🔍 DEBUG: User current block: ${userCurrentBlock.get(userId)}`);
        console.log(`🔍 DEBUG: Message text: "${messageText}"`);
        
        // Проверяем, что пользователь действительно находится в блоке квиза
        if (userCurrentBlock.get(userId) !== currentBlockId) {
          console.log(`🔍 DEBUG: User not in quiz block, current block: ${userCurrentBlock.get(userId)}, expected: ${currentBlockId}`);
          return;
        }
        
        // Получаем состояние квиза пользователя
        let quizState = userQuizStates.get(userId);
        
        // Если квиз не начат, инициализируем его и показываем первый вопрос
        if (!quizState) {
          console.log(`🔍 DEBUG: Initializing quiz for user ${userId}`);
          quizState = {
            blockId: currentBlockId,
            currentQuestionIndex: 0,
            startTime: Date.now(),
            answers: [],
            isCompleted: false
          };
          userQuizStates.set(userId, quizState);
          
          // Показываем первый вопрос
          const questions = currentBlock.questions || [];
          console.log(`🔍 DEBUG: First quiz entry - questions count: ${questions.length}`);
          
          if (questions.length > 0) {
            const firstQuestion = questions[0];
            console.log(`🔍 DEBUG: First question: ${firstQuestion.message}`);
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(firstQuestion.buttons, userId, currentBlockId);
            await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles, keyboard, inlineKeyboard);
            return;
          } else {
            console.log(`❌ No questions found in quiz block on first entry`);
            await ctx.reply('Квиз не настроен');
            return;
          }
        }
        
        // Если квиз уже начат, обрабатываем ответ
        if (quizState && !quizState.isCompleted) {
          console.log(`🔍 DEBUG: Processing quiz answer for question ${quizState.currentQuestionIndex}`);
          console.log(`🔍 DEBUG: Quiz state:`, quizState);
          
          const questions = currentBlock.questions || [];
          const currentQuestion = questions[quizState.currentQuestionIndex];
          
          console.log(`🔍 DEBUG: Current question:`, currentQuestion);
          
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
          
          // Отправляем сообщение о результате
          if (answerButton.isCorrect) {
            await ctx.reply('Правильно!');
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            await ctx.reply('Неправильно. Попробуйте еще раз.');
            return;
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
              const quizStats = new QuizStats({
                botId: botId,
                userId: userId,
                blockId: currentBlockId,
                correctAnswers: correctAnswers,
                totalQuestions: totalQuestions,
                percentage: percentage,
                completionTime: completionTime,
                answers: quizState.answers,
                completedAt: new Date()
              });
              
              await quizStats.save();
              console.log(`✅ Quiz stats saved to MongoDB for user ${userId}`);
            } catch (error) {
              console.error('❌ Error saving quiz stats:', error);
            }
            
            // Отправляем финальное сообщение
            const finalMessage = `${currentBlock.finalSuccessMessage || 'Поздравляем! Вы успешно прошли квиз!'}\n\n📊 **Статистика:**\n✅ Правильных ответов: ${correctAnswers}/${totalQuestions}\n📈 Процент: ${percentage}%\n⏱️ Время прохождения: ${completionTime} сек`;
            
            await ctx.reply(finalMessage, { parse_mode: 'Markdown' });
            
            // Если настроено возвращение в начало
            if (currentBlock.returnToStartOnComplete) {
              console.log(`🔍 DEBUG: Returning to start after quiz completion`);
              userCurrentBlock.set(userId, 'start');
              userQuizStates.delete(userId);
              userNavigationHistory.delete(userId);
              
              const startBlock = dialogMap.get('start');
              if (startBlock) {
                const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
                await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
                console.log(`✅ Returned to start block after quiz completion`);
              }
            }
            
            return;
                } else {
            // Следующий вопрос
            const nextQuestion = questions[quizState.currentQuestionIndex];
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextQuestion.buttons, userId, currentBlockId);
            await sendMediaMessage(ctx, nextQuestion.message, nextQuestion.mediaFiles, keyboard, inlineKeyboard);
          }
          
          return;
        }
        
        // Если квиз завершен, показываем сообщение и возвращаем в главное меню
        if (quizState && quizState.isCompleted) {
          console.log(`🔍 DEBUG: Quiz already completed, returning to start`);
          await ctx.reply('Вы уже прошли этот квиз! Возвращаемся в главное меню.');
          
          userCurrentBlock.set(userId, 'start');
          userQuizStates.delete(userId);
          userNavigationHistory.delete(userId);
          
          const startBlock = dialogMap.get('start');
          if (startBlock) {
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
            await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
          }
          return;
        }
        
        return;
      }
      
      // Обработка кнопки "Назад"
      if (messageText === '⬅️ Назад') {
        console.log(`🔍 DEBUG: Processing "Назад" button`);
        console.log(`🔍 DEBUG: Current block type: ${currentBlock.type}`);
        console.log(`🔍 DEBUG: User history:`, userNavigationHistory.get(userId));
        
        // Если пользователь в квизе, очищаем состояние квиза
        if (currentBlock.type === 'quiz') {
          console.log(`🔍 DEBUG: Exiting quiz, clearing quiz state`);
          userQuizStates.delete(userId);
        }
        
        const userHistory = userNavigationHistory.get(userId);
        
        if (userHistory && userHistory.length > 0) {
          const previousBlockId = userHistory.pop();
          console.log(`🔍 DEBUG: Previous block ID: ${previousBlockId}`);
          const prevBlock = dialogMap.get(previousBlockId);
          
          if (prevBlock) {
            userCurrentBlock.set(userId, previousBlockId);
            userNavigationHistory.set(userId, userHistory);
            
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(prevBlock.buttons, userId, previousBlockId);
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
      
      // Обработка квизов
      if (currentBlock.type === 'quiz') {
        console.log(`🔍 DEBUG: Processing quiz block`);
        
        // Получаем состояние квиза пользователя
        let quizState = userQuizStates.get(userId);
        
        // Если квиз не начат, инициализируем его и показываем первый вопрос
        if (!quizState) {
          console.log(`🔍 DEBUG: Initializing quiz for user ${userId}`);
          quizState = {
            blockId: currentBlockId,
            currentQuestionIndex: 0,
            startTime: Date.now(),
            answers: [],
            isCompleted: false
          };
          userQuizStates.set(userId, quizState);
          
          // Показываем первый вопрос
          const questions = currentBlock.questions || [];
          console.log(`🔍 DEBUG: First quiz entry - questions count: ${questions.length}`);
          console.log(`🔍 DEBUG: First quiz entry - questions:`, JSON.stringify(questions, null, 2));
          
          if (questions.length > 0) {
            const firstQuestion = questions[0];
            console.log(`🔍 DEBUG: First question:`, JSON.stringify(firstQuestion, null, 2));
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(firstQuestion.buttons, userId, currentBlockId);
            // НЕ показываем сообщение блока квиза, только первый вопрос
            await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles, keyboard, inlineKeyboard);
            return;
          } else {
            console.log(`❌ No questions found in quiz block on first entry`);
            await ctx.reply('Квиз не настроен');
            return;
          }
        }
        
        // Если квиз уже начат, но пользователь снова нажал кнопку - показываем текущий вопрос
        if (quizState && !quizState.isCompleted) {
          console.log(`🔍 DEBUG: Quiz already started, showing current question ${quizState.currentQuestionIndex}`);
          const questions = currentBlock.questions || [];
          const currentQuestion = questions[quizState.currentQuestionIndex];
          
          if (currentQuestion) {
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(currentQuestion.buttons, userId, currentBlockId);
            await sendMediaMessage(ctx, currentQuestion.message, currentQuestion.mediaFiles, keyboard, inlineKeyboard);
            return;
          }
        }
        
        // Если квиз завершен, показываем сообщение и возвращаем в главное меню
        if (quizState && quizState.isCompleted) {
          console.log(`🔍 DEBUG: Quiz already completed, returning to start`);
          await ctx.reply('Вы уже прошли этот квиз! Возвращаемся в главное меню.');
          
          // Возвращаем в главное меню
                  userCurrentBlock.set(userId, 'start');
          userQuizStates.delete(userId);
                  
                  const startBlock = dialogMap.get('start');
                  if (startBlock) {
                    const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
            await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
          }
          return;
        }
        
        
        // Получаем текущий вопрос
        const questions = currentBlock.questions || [];
        console.log(`🔍 DEBUG: Quiz questions count: ${questions.length}`);
        console.log(`🔍 DEBUG: Quiz questions:`, JSON.stringify(questions, null, 2));
        
        if (questions.length === 0) {
          console.log(`❌ No questions found in quiz block`);
          await ctx.reply('Квиз не настроен');
          return;
        }
        
        const currentQuestion = questions[quizState.currentQuestionIndex];
        if (!currentQuestion) {
          console.log(`❌ Question ${quizState.currentQuestionIndex} not found`);
          await ctx.reply('Ошибка в квизе');
                  return;
        }
        
        // Обрабатываем ответ пользователя
        const userAnswer = currentQuestion.buttons?.find(btn => btn.text === messageText);
        if (!userAnswer) {
          console.log(`❌ Answer "${messageText}" not found in question`);
          await ctx.reply('Выберите один из предложенных вариантов');
                  return;
                }
        
        // Проверяем, не отвечал ли пользователь уже на этот вопрос
        const alreadyAnswered = quizState.answers.some(a => a.questionIndex === quizState.currentQuestionIndex);
        console.log(`🔍 DEBUG: Checking if already answered question ${quizState.currentQuestionIndex}`);
        console.log(`🔍 DEBUG: Current answers:`, quizState.answers.map(a => ({ questionIndex: a.questionIndex, answer: a.answer })));
        console.log(`🔍 DEBUG: Already answered: ${alreadyAnswered}`);
        
        if (alreadyAnswered) {
          console.log(`⚠️ User already answered question ${quizState.currentQuestionIndex}, ignoring duplicate`);
          return;
        }
        
        // Сохраняем ответ
        quizState.answers.push({
          questionIndex: quizState.currentQuestionIndex,
          answer: messageText,
          isCorrect: userAnswer.isCorrect || false,
          timestamp: Date.now()
        });
        
        console.log(`🔍 DEBUG: User answered: "${messageText}", correct: ${userAnswer.isCorrect}`);
        
        // Проверяем правильность ответа
        if (userAnswer.isCorrect) {
          console.log(`✅ Correct answer for question ${quizState.currentQuestionIndex}`);
          
          // Показываем сообщение об успехе
          const successMessage = currentQuestion.successMessage || 'Правильно!';
          await ctx.reply(successMessage);
          
          // Небольшая пауза перед следующим вопросом
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Переходим к следующему вопросу
          quizState.currentQuestionIndex++;
          
          if (quizState.currentQuestionIndex >= questions.length) {
            // Квиз завершен
            console.log(`🎉 Quiz completed for user ${userId}`);
            quizState.isCompleted = true;
            quizState.completionTime = Date.now();
            
            // Сохраняем результат в MongoDB
            try {
              const { QuizStats } = require('./models');
              const quizStats = new QuizStats({
                botId,
                userId,
                quizBlockId: currentBlockId,
                answers: quizState.answers,
                score: quizState.answers.filter(a => a.isCorrect).length,
                totalQuestions: questions.length,
                completionTime: quizState.completionTime - quizState.startTime,
                completedAt: new Date()
              });
              
              await quizStats.save();
              console.log(`✅ Quiz stats saved to MongoDB for user ${userId}`);
            } catch (error) {
              console.error('❌ Error saving quiz stats:', error);
            }
            
            // Отправляем финальное сообщение с статистикой
            const correctAnswers = quizState.answers.filter(a => a.isCorrect).length;
            const totalQuestions = questions.length;
            const percentage = Math.round((correctAnswers / totalQuestions) * 100);
            const completionTime = Math.round((quizState.completionTime - quizState.startTime) / 1000);
            
            const finalMessage = `${currentBlock.finalSuccessMessage || 'Поздравляем! Вы успешно прошли квиз!'}\n\n📊 **Статистика:**\n✅ Правильных ответов: ${correctAnswers}/${totalQuestions}\n📈 Процент: ${percentage}%\n⏱️ Время прохождения: ${completionTime} сек`;
            
            await ctx.reply(finalMessage, { parse_mode: 'Markdown' });
            
            // Если настроено возвращение в начало
            if (currentBlock.returnToStartOnComplete) {
              console.log(`🔍 DEBUG: Returning to start after quiz completion`);
                userCurrentBlock.set(userId, 'start');
              userQuizStates.delete(userId);
              
              // Очищаем историю навигации
              userNavigationHistory.delete(userId);
              
                const startBlock = dialogMap.get('start');
                if (startBlock) {
                  const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
                  await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
                console.log(`✅ Returned to start block after quiz completion`);
              }
            }
            
            return;
          } else {
            // Следующий вопрос
            const nextQuestion = questions[quizState.currentQuestionIndex];
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextQuestion.buttons, userId, currentBlockId);
            await sendMediaMessage(ctx, nextQuestion.message, nextQuestion.mediaFiles, keyboard, inlineKeyboard);
            return;
          }
        } else {
          // Неправильный ответ
          console.log(`❌ Wrong answer for question ${quizState.currentQuestionIndex}`);
          
          const failureMessage = currentQuestion.failureMessage || 'Неправильно. Попробуйте еще раз.';
          await ctx.reply(failureMessage);
          
          // Показываем тот же вопрос снова
          const { keyboard, inlineKeyboard } = createKeyboardWithBack(currentQuestion.buttons, userId, currentBlockId);
          await sendMediaMessage(ctx, currentQuestion.message, currentQuestion.mediaFiles, keyboard, inlineKeyboard);
                  return;
                }
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
      
      console.log(`✅ Button "${messageText}" found, processing...`);
            
            // Проверяем, является ли кнопка ссылкой
            if (button.url && button.url.trim() !== '') {
        console.log(`🔗 Link button: ${button.url}`);
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
      
      console.log(`🔍 DEBUG: Connection key: ${connectionKey}`);
      console.log(`🔍 DEBUG: Next block ID: ${nextBlockId}`);
      console.log(`🔍 DEBUG: Available connections:`, Array.from(connectionMap.entries()));
      console.log(`🔍 DEBUG: Available blocks:`, Array.from(dialogMap.keys()));
      
      if (!nextBlockId || !dialogMap.has(nextBlockId)) {
        console.log(`❌ No valid next block found`);
        console.log(`❌ Connection key "${connectionKey}" not found in connectionMap`);
        console.log(`❌ Next block ID "${nextBlockId}" not found in dialogMap`);
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
      
      // Если следующий блок - квиз, очищаем состояние квиза и показываем первый вопрос
      if (nextBlock.type === 'quiz') {
        userQuizStates.delete(userId);
        console.log(`🔍 DEBUG: Skipping quiz block message, will show first question instead`);
        
        // Показываем первый вопрос квиза
        const questions = nextBlock.questions || [];
        if (questions.length > 0) {
          const firstQuestion = questions[0];
          console.log(`🔍 DEBUG: Showing first question: ${firstQuestion.message}`);
          const { keyboard, inlineKeyboard } = createKeyboardWithBack(firstQuestion.buttons, userId, nextBlockId);
          await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles, keyboard, inlineKeyboard);
        } else {
          console.log(`❌ No questions found in quiz block`);
          await ctx.reply('Квиз не настроен');
        }
      } else {
        // Отправляем следующий блок (только для не-квизов)
        const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
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
    console.log('[DEBUG] on callback_query ctx:', JSON.stringify(ctx, null, 2));
    console.log('[DEBUG] on callback_query ctx.from:', ctx.from);
    await saveUserToMongo(ctx);
    // ... твоя логика обработки callback
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

async function startBot() {
  console.log('=== [BOOT] startBot вызван ===');
  const bot = new Telegraf(token);
  
  // Счетчик ошибок для автоматического перезапуска
  let errorCount = 0;
  const maxErrors = 10;
  const errorWindow = 5 * 60 * 1000; // 5 минут
  
  // Функция для обработки критических ошибок
  const handleCriticalError = (error) => {
    errorCount++;
    console.error(`❌ Critical bot error #${errorCount}:`, error);
    
    if (errorCount >= maxErrors) {
      console.error(`🚨 Too many errors (${errorCount}), restarting bot...`);
      process.exit(1); // Docker перезапустит контейнер
    }
    
    // Сброс счетчика ошибок через 5 минут
    setTimeout(() => {
      errorCount = Math.max(0, errorCount - 1);
    }, errorWindow);
  };
  
  // Настраиваем обработчики
  setupBotHandlers(bot, state.blocks, state.connections);

  // Обновляем меню команд Telegram
  await updateBotCommands(bot, state.blocks);
  
  // Глобальный логгер для всех апдейтов Telegram (всегда включен)
  bot.use((ctx, next) => {
    console.log('=== [EVENT] Incoming update ===');
    console.log('[EVENT] Update type:', ctx.updateType);
    console.log('[EVENT] Update:', JSON.stringify(ctx.update, null, 2));
    console.log('[EVENT] Message text:', ctx.message?.text);
    console.log('[EVENT] User ID:', ctx.from?.id);
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