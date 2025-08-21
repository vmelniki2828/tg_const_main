const { Telegraf } = require('telegraf');

// Получаем параметры из аргументов командной строки
const [token, stateJson] = process.argv.slice(2);

// Проверяем аргументы
if (!token || !stateJson) {
  console.error('Missing required arguments: token and state');
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

// Функция для создания резервной копии статистики
function createStatsBackup(stats, originalPath) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Создаем папку для бэкапов если её нет
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Создаем имя файла с timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `quizStats-backup-${timestamp}.json`);
    
    // Сохраняем бэкап
    fs.writeFileSync(backupPath, JSON.stringify(stats, null, 2));
    console.log(`💾 Backup created: ${backupPath}`);
    
    // Удаляем старые бэкапы (оставляем только последние 5)
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('quizStats-backup-'))
      .sort()
      .reverse();
    
    if (backupFiles.length > 5) {
      backupFiles.slice(5).forEach(file => {
        fs.unlinkSync(path.join(backupDir, file));
        console.log(`🗑️ Removed old backup: ${file}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error creating backup:', error);
  }
}

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

function setupBotHandlers(bot, blocks, connections) {
  // Создаем карту диалогов для быстрого доступа
  const dialogMap = new Map();
  blocks.forEach(block => {
    dialogMap.set(block.id, {
      message: block.message,
      buttons: block.buttons || [],
      mediaFiles: block.mediaFiles || [],
      type: block.type
    });
  });

  // Карта для отслеживания истории навигации пользователей
  const userNavigationHistory = new Map();
  
  // Карта для отслеживания текущего блока каждого пользователя
  const userCurrentBlock = new Map();
  
  // Карта для отслеживания состояния квиза каждого пользователя
  const userQuizStates = new Map();
  
  // Карта для отслеживания завершенных квизов пользователей
  const completedQuizzes = new Map();

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
  const userLastActivity = new Map();

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
  connections.forEach(conn => {
    const key = `${conn.from.blockId}_${conn.from.buttonId}`;
    connectionMap.set(key, conn.to);
  });

  // Обработка команды /start
  bot.command('start', async (ctx) => {
    const userId = ctx.from.id;
    
    // Очищаем историю навигации пользователя
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
    const userId = ctx.from.id;
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

  // Обработка текстовых сообщений
  bot.on('text', async (ctx) => {
    try {
      const messageText = ctx.message.text;
      const userId = ctx.from.id;
      let currentBlockId = userCurrentBlock.get(userId);
      
      // Отслеживаем активность пользователя
      userLastActivity.set(userId, Date.now());
      
      console.log(`🔍 DEBUG: Received message: "${messageText}" from user ${userId} in block ${currentBlockId}`);
      console.log(`🔍 DEBUG: User quiz state exists: ${userQuizStates.has(userId)}`);
      console.log(`🔍 DEBUG: User completed quizzes: ${Array.from(completedQuizzes.get(userId) || [])}`);
      console.log(`🔍 DEBUG: User navigation history: ${JSON.stringify(userNavigationHistory.get(userId) || [])}`);
      
      // Игнорируем очень короткие сообщения (менее 1 символа)
      if (messageText.length < 1) {
        console.log(`🔍 DEBUG: Message too short, ignoring`);
        return;
      }
      
      // Игнорируем команды, которые обрабатываются отдельно
      if (messageText.startsWith('/')) {
        console.log(`🔍 DEBUG: Command message, ignoring`);
        return;
      }
      
      console.log(`🔍 DEBUG: Starting message processing for user ${userId}`);
      
      // --- ВАЖНО: Автоматическая инициализация пользователя ---
      if (!currentBlockId) {
        console.log(`🔍 DEBUG: User ${userId} not initialized, setting to start block`);
        userCurrentBlock.set(userId, 'start');
        currentBlockId = 'start';
        
        // Отправляем приветственное сообщение
        const startBlock = dialogMap.get('start');
        if (startBlock) {
          const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
          await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
          console.log(`🔍 DEBUG: Sent welcome message to user ${userId}`);
          return;
        }
      }
      // --- конец инициализации ---
      
      // --- ВАЖНО: Проверка завершённости квиза в самом начале ---
      if (currentBlockId) {
        const currentBlock = blocks.find(b => b.id === currentBlockId);
        if (currentBlock && currentBlock.type === 'quiz') {
          const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
          if (userCompletedQuizzes.has(currentBlock.id)) {
            console.log(`🔍 DEBUG: User is in completed quiz block, redirecting to start`);
            await ctx.reply('Вы уже проходили этот квиз. Результаты не будут сохранены повторно.');
            userQuizStates.delete(userId);
            userCurrentBlock.set(userId, 'start');
            const startBlock = dialogMap.get('start');
            if (startBlock) {
              const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
              await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
            }
            return;
          }
        }
      }
      // --- конец проверки ---

      // --- Новая логика: Ответ на сообщения, не совпадающие с кнопками ---
      const currentBlock = dialogMap.get(currentBlockId);
      if (currentBlock) {
        const buttonLabels = currentBlock.buttons.map(button => button.text);
        if (!buttonLabels.includes(messageText)) {
          await ctx.reply('Я вас не понимаю, воспользуйтесь пожалуйста кнопками.');
          return;
        }
      }
      // --- конец новой логики ---
      
      // Обработка кнопки "Назад"
      if (messageText === '⬅️ Назад') {
        const userHistory = userNavigationHistory.get(userId);
        if (userHistory && userHistory.length > 0) {
          const previousBlockId = userHistory.pop();
          const prevBlock = dialogMap.get(previousBlockId);
          
          if (prevBlock) {
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(prevBlock.buttons, userId, previousBlockId);
            await sendMediaMessage(ctx, prevBlock.message, prevBlock.mediaFiles, keyboard, inlineKeyboard);
            userCurrentBlock.set(userId, previousBlockId);
            userNavigationHistory.set(userId, userHistory);
            return;
          }
        }
        await ctx.reply('Нет предыдущего блока');
        return;
      }
      
      // Специальная обработка квизов (только для незавершённых квизов)
      if (currentBlockId) {
        const currentBlock = blocks.find(b => b.id === currentBlockId);
        
        if (currentBlock && currentBlock.type === 'quiz') {
          console.log(`🔍 DEBUG: Processing quiz block: ${currentBlock.id}`);
          
          // Дополнительная проверка завершённости квиза
          const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
          if (userCompletedQuizzes.has(currentBlock.id)) {
            console.log(`🔍 DEBUG: Quiz is completed, redirecting to start`);
            await ctx.reply('Вы уже проходили этот квиз. Результаты не будут сохранены повторно.');
            userQuizStates.delete(userId);
            userCurrentBlock.set(userId, 'start');
            const startBlock = dialogMap.get('start');
            if (startBlock) {
              const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
              await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
            }
            return;
          }
          
          // Проверяем, есть ли состояние квиза для пользователя
          const existingQuizState = userQuizStates.get(userId);
          if (!existingQuizState) {
            // Если нет состояния квиза, значит пользователь только что попал в квиз
            // Инициализируем состояние квиза
            const newQuizState = {
              currentQuestionIndex: 0,
              answers: [],
              startTime: Date.now()
            };
            userQuizStates.set(userId, newQuizState);
            
            // Отправляем первый вопрос
            const firstQuestion = currentBlock.questions[0];
            if (firstQuestion) {
              // Создаем клавиатуру по 2 кнопки в ряд для квиза
              const keyboard = [];
              for (let i = 0; i < firstQuestion.buttons.length; i += 2) {
                const row = [];
                row.push({ text: firstQuestion.buttons[i].text });
                
                // Добавляем вторую кнопку в ряд, если она есть
                if (i + 1 < firstQuestion.buttons.length) {
                  row.push({ text: firstQuestion.buttons[i + 1].text });
                }
                
                keyboard.push(row);
              }
              
              await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles || [], keyboard, []);
              return;
            }
          }
          
          // Получаем состояние квиза (оно уже должно существовать после инициализации выше)
          const userQuizState = userQuizStates.get(userId);
          if (!userQuizState) {
            // Если по какой-то причине состояние квиза не найдено, игнорируем сообщение
            return;
          }
          
          const currentQuestion = currentBlock.questions[userQuizState.currentQuestionIndex];
          
          if (currentQuestion) {
            const selectedButton = currentQuestion.buttons.find(btn => btn.text === messageText);
            
            if (selectedButton) {
              // Сохраняем ответ
              userQuizState.answers.push({
                questionIndex: userQuizState.currentQuestionIndex,
                selectedAnswer: messageText,
                isCorrect: selectedButton.isCorrect
              });
              
              // Переходим к следующему вопросу или завершаем квиз
              if (userQuizState.currentQuestionIndex < currentBlock.questions.length - 1) {
                userQuizState.currentQuestionIndex++;
                userQuizStates.set(userId, userQuizState);
                
                const nextQuestion = currentBlock.questions[userQuizState.currentQuestionIndex];
                
                // Создаем клавиатуру по 2 кнопки в ряд для квиза
                const keyboard = [];
                for (let i = 0; i < nextQuestion.buttons.length; i += 2) {
                  const row = [];
                  row.push({ text: nextQuestion.buttons[i].text });
                  
                  // Добавляем вторую кнопку в ряд, если она есть
                  if (i + 1 < nextQuestion.buttons.length) {
                    row.push({ text: nextQuestion.buttons[i + 1].text });
                  }
                  
                  keyboard.push(row);
                }
                
                await sendMediaMessage(ctx, nextQuestion.message, nextQuestion.mediaFiles || [], keyboard, []);
                return;
              } else {
                // Квиз завершен, показываем результаты
                console.log(`🔍 DEBUG: Quiz completed, processing results`);
                const correctAnswers = userQuizState.answers.filter(answer => answer.isCorrect).length;
                const totalQuestions = currentBlock.questions.length;
                const successRate = (correctAnswers / totalQuestions) * 100;
                
                let resultMessage = `📊 Результаты квиза:\n`;
                resultMessage += `✅ Правильных ответов: ${correctAnswers} из ${totalQuestions}\n`;
                resultMessage += `📈 Процент успешности: ${successRate.toFixed(1)}%\n\n`;
                
                // Показываем результаты по каждому вопросу
                userQuizState.answers.forEach((answer, index) => {
                  resultMessage += `${answer.isCorrect ? '✅' : '❌'} Вопрос ${index + 1}: ${answer.isCorrect ? 'Правильно' : 'Неправильно'}\n`;
                });
                
                resultMessage += '\n';
                
                // Проверяем успешность (100% для прохождения)
                const isSuccessful = successRate === 100;
                
                if (isSuccessful) {
                  resultMessage += `🎉 ${currentBlock.finalSuccessMessage || 'Поздравляем! Вы успешно прошли квиз!'}\n`;
                  
                  // Пытаемся выдать промокод
                  try {
                    const { getRandomPromoCode } = require('./promoCodeManager.js');
                    const promoCode = await getRandomPromoCode(currentBlock.id);
                    if (promoCode) {
                      resultMessage += `🎁 Ваш промокод: ${promoCode}\n`;
                    } else {
                      resultMessage += `⚠️ К сожалению, промокоды закончились\n`;
                    }
                  } catch (error) {
                    console.error('Error getting promo code:', error);
                    resultMessage += `⚠️ Ошибка при выдаче промокода: ${error.message}\n`;
                  }
                } else {
                  resultMessage += `❌ ${currentBlock.finalFailureMessage || 'К сожалению, вы не прошли квиз. Нужно ответить правильно на все вопросы.'}\n`;
                }
                
                // Синхронно сохраняем статистику напрямую в файл
                try {
                  const fs = require('fs');
                  const path = require('path');
                  const statsPath = path.join(__dirname, 'quizStats.json');
                  
                  console.log(`📊 Saving quiz stats for block ${currentBlock.id}, user ${userId}`);
                  console.log(`📁 Stats file path: ${statsPath}`);
                  console.log(`🔍 File exists: ${fs.existsSync(statsPath)}`);
                  
                  // Читаем существующую статистику
                  let stats = {};
                  if (fs.existsSync(statsPath)) {
                    try {
                      const fileContent = fs.readFileSync(statsPath, 'utf8');
                      console.log(`📄 File content length: ${fileContent.length} characters`);
                      if (fileContent.trim()) {
                        stats = JSON.parse(fileContent);
                        console.log(`✅ Loaded existing stats for ${Object.keys(stats).length} quizzes`);
                      } else {
                        console.log(`⚠️ File is empty, starting with empty stats`);
                      }
                    } catch (parseError) {
                      console.error('❌ Error parsing existing stats file:', parseError);
                      console.error('📄 File content:', fs.readFileSync(statsPath, 'utf8'));
                      stats = {};
                    }
                  } else {
                    console.log('📝 Stats file does not exist, creating new one');
                  }
                  
                  // Инициализируем статистику для квиза если её нет
                  if (!stats[currentBlock.id]) {
                    stats[currentBlock.id] = {
                      totalAttempts: 0,
                      successfulCompletions: 0,
                      failedAttempts: 0,
                      userAttempts: []
                    };
                    console.log(`Initialized stats for quiz ${currentBlock.id}`);
                  }
                  
                  const quizStats = stats[currentBlock.id];
                  quizStats.totalAttempts++;
                  
                  if (isSuccessful) {
                    quizStats.successfulCompletions++;
                  } else {
                    quizStats.failedAttempts++;
                  }
                  
                  // Создаем объект попытки пользователя
                  const userAttempt = {
                    userId: userId,
                    userName: ctx.from.first_name || ctx.from.username || `User ${userId}`,
                    userLastName: ctx.from.last_name || '',
                    username: ctx.from.username || '',
                    timestamp: Date.now(),
                    success: isSuccessful,
                    score: correctAnswers,
                    totalQuestions: totalQuestions,
                    successRate: successRate,
                    duration: Date.now() - userQuizState.startTime,
                    answers: userQuizState.answers
                  };
                  
                  // Добавляем попытку пользователя
                  quizStats.userAttempts.push(userAttempt);
                  
                  // Ограничиваем количество попыток в истории (максимум 1000)
                  if (quizStats.userAttempts.length > 1000) {
                    quizStats.userAttempts = quizStats.userAttempts.slice(-1000);
                  }
                  
                  // Сохраняем в файл
                  const statsJson = JSON.stringify(stats, null, 2);
                  console.log(`💾 Writing ${statsJson.length} characters to file`);
                  fs.writeFileSync(statsPath, statsJson);
                  
                  // Создаем резервную копию
                  createStatsBackup(stats, statsPath);
                  
                  // Проверяем, что файл действительно записался
                  const verifyContent = fs.readFileSync(statsPath, 'utf8');
                  console.log(`✅ File written successfully, verification length: ${verifyContent.length}`);
                  
                  console.log(`🎉 Quiz stats saved successfully for block ${currentBlock.id}`);
                  console.log(`👤 User ${userAttempt.userName} (${userId}) attempt recorded`);
                  console.log(`📊 Total attempts for this quiz: ${quizStats.totalAttempts}`);
                  console.log(`✅ Successful completions: ${quizStats.successfulCompletions}`);
                  console.log(`❌ Failed attempts: ${quizStats.failedAttempts}`);
                  
                } catch (error) {
                  console.error('❌ Error saving quiz stats:', error);
                  console.error('📄 Error details:', error.stack);
                  console.error('📁 Current directory:', __dirname);
                  console.error('🔍 File permissions check...');
                  try {
                    const fs = require('fs');
                    const path = require('path');
                    const statsPath = path.join(__dirname, 'quizStats.json');
                    console.error(`📁 File exists: ${fs.existsSync(statsPath)}`);
                    if (fs.existsSync(statsPath)) {
                      const stats = fs.statSync(statsPath);
                      console.error(`📄 File permissions: ${stats.mode.toString(8)}`);
                      console.error(`📄 File size: ${stats.size} bytes`);
                    }
                  } catch (permError) {
                    console.error('❌ Error checking file permissions:', permError);
                  }
                }
                
                console.log(`🔍 DEBUG: After stats saving, proceeding to quiz completion`);
                console.log(`🔍 DEBUG: About to enter quiz completion block`);
                
                try {
                  // Отмечаем квиз как завершенный для этого пользователя
                  let userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
                  userCompletedQuizzes.add(currentBlock.id);
                  completedQuizzes.set(userId, userCompletedQuizzes);
                  console.log(`🔍 DEBUG: Marked quiz ${currentBlock.id} as completed for user ${userId}`);
                  
                  // Очищаем состояние квиза и устанавливаем стартовый блок
                  userQuizStates.delete(userId);
                  userCurrentBlock.set(userId, 'start');
                  console.log(`🔍 DEBUG: Cleared quiz state and set user ${userId} to start block`);
                  
                  // Возвращаемся к стартовому блоку
                  const startBlock = dialogMap.get('start');
                  console.log(`🔍 DEBUG: Start block found: ${!!startBlock}`);
                  
                  if (startBlock) {
                    const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
                    console.log(`🔍 DEBUG: Created keyboard for start block`);
                    
                    // Сначала отправляем результаты квиза
                    console.log(`🔍 DEBUG: Sending quiz results`);
                    await ctx.reply(resultMessage);
                    console.log(`🔍 DEBUG: Quiz results sent successfully`);
                    
                    // Затем отправляем сообщение стартового блока
                    const replyMarkup = {};
                    if (keyboard.length > 0) {
                      replyMarkup.keyboard = keyboard;
                      replyMarkup.resize_keyboard = true;
                    }
                    if (inlineKeyboard.length > 0) {
                      replyMarkup.inline_keyboard = inlineKeyboard;
                    }
                    
                    console.log(`🔍 DEBUG: Sending start block message`);
                    console.log(`🔍 DEBUG: Start block message: ${startBlock.message}`);
                    console.log(`🔍 DEBUG: Reply markup: ${JSON.stringify(replyMarkup)}`);
                    
                    await ctx.reply(startBlock.message, {
                      reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
                    });
                    console.log(`🔍 DEBUG: Start block message sent successfully`);
                    console.log(`🔍 DEBUG: Successfully returned to start block`);
                  } else {
                    console.log(`🔍 DEBUG: Start block not found, sending only results`);
                    await ctx.reply(resultMessage);
                    console.log(`🔍 DEBUG: Only results sent successfully`);
                  }
                  
                  console.log(`🔍 DEBUG: Quiz completion finished, returning`);
                  return;
                } catch (completionError) {
                  console.error('❌ Error during quiz completion:', completionError);
                  console.error('📄 Completion error details:', completionError.stack);
                  console.log(`🔍 DEBUG: Fallback - sending only results due to error`);
                  try {
                    await ctx.reply(resultMessage);
                    console.log(`🔍 DEBUG: Fallback results sent successfully`);
                  } catch (fallbackError) {
                    console.error('❌ Error sending fallback results:', fallbackError);
                  }
                  return;
                }
              }
            }
          }
        }
      }
      
      // Обычная обработка кнопок (не квиз)
      let found = false;
      
      if (currentBlockId) {
        const currentBlock = blocks.find(b => b.id === currentBlockId);
        if (currentBlock) {
          console.log(`Processing message "${messageText}" in block ${currentBlockId}`);
          console.log(`Available buttons:`, currentBlock.buttons?.map(b => ({ text: b.text, url: b.url })));
          
          const button = (currentBlock.buttons || []).find(btn => btn.text === messageText);
          if (button) {
            console.log(`🔍 DEBUG: Found button "${messageText}" in current block ${currentBlockId}`);
            console.log(`🔍 DEBUG: Button details:`, button);
            
            // Проверяем, является ли кнопка ссылкой
            if (button.url && button.url.trim() !== '') {
              console.log(`Button "${messageText}" is a link: ${button.url}`);
              // Отправляем inline-кнопку для открытия ссылки в браузере
              await ctx.reply(`🔗 ${button.text}`, {
                reply_markup: {
                  inline_keyboard: [[{ text: button.text, url: button.url.trim() }]]
                }
              });
              console.log(`Link button processed successfully, returning`);
              found = true;
              return;
            }
            
            // Если это обычная кнопка (не ссылка), переходим к следующему блоку
            const nextBlockId = connectionMap.get(`${currentBlockId}_${button.id}`);
            console.log(`🔍 DEBUG: Next block ID for button ${button.id}: ${nextBlockId}`);
            
            const nextBlockData = blocks.find(b => b.id === nextBlockId);
            
            // --- ВАЖНО: Проверка завершённости квиза ДО изменения состояния ---
            if (nextBlockData && nextBlockData.type === 'quiz') {
              const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              if (userCompletedQuizzes.has(nextBlockId)) {
                console.log(`🔍 DEBUG: Quiz already completed, redirecting to start`);
                await ctx.reply('Вы уже проходили этот квиз. Результаты не будут сохранены повторно.');
                userQuizStates.delete(userId);
                userCurrentBlock.set(userId, 'start');
                const startBlock = dialogMap.get('start');
                if (startBlock) {
                  const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
                  await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
                }
                found = true;
                return;
              }
            }
            // --- конец блока проверки ---
            
            if (nextBlockId && dialogMap.has(nextBlockId)) {
              console.log(`🔍 DEBUG: Transitioning to next block: ${nextBlockId}`);
              const nextBlock = dialogMap.get(nextBlockId);
              
              // Добавляем текущий блок в историю навигации
              let userHistory = userNavigationHistory.get(userId) || [];
              userHistory.push(currentBlockId);
              userNavigationHistory.set(userId, userHistory);
              
              // Обновляем текущий блок пользователя
              userCurrentBlock.set(userId, nextBlockId);
              
              // Специальная обработка для квизов
              const nextBlockData = blocks.find(b => b.id === nextBlockId);
              if (nextBlockData && nextBlockData.type === 'quiz') {
                console.log(`🔍 DEBUG: Transitioning to quiz block: ${nextBlockId}`);
                
                // Очищаем историю навигации для квиза
                userNavigationHistory.delete(userId);
                
                // Инициализируем состояние квиза
                const quizState = {
                  currentQuestionIndex: 0,
                  answers: [],
                  startTime: Date.now()
                };
                userQuizStates.set(userId, quizState);
                
                // Отправляем первый вопрос квиза с медиафайлами
                const firstQuestion = nextBlockData.questions[0];
                if (firstQuestion) {
                  // Создаем клавиатуру по 2 кнопки в ряд для квиза
                  const keyboard = [];
                  for (let i = 0; i < firstQuestion.buttons.length; i += 2) {
                    const row = [];
                    row.push({ text: firstQuestion.buttons[i].text });
                    
                    // Добавляем вторую кнопку в ряд, если она есть
                    if (i + 1 < firstQuestion.buttons.length) {
                      row.push({ text: firstQuestion.buttons[i + 1].text });
                    }
                    
                    keyboard.push(row);
                  }
                  
                  console.log('Sending first quiz question:', firstQuestion.message, 'with mediaFiles:', firstQuestion.mediaFiles);
                  await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles || [], keyboard, []);
                  found = true;
                  return;
                }
              }
              
              const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
              
              await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard, inlineKeyboard);
              found = true;
              console.log(`🔍 DEBUG: Successfully processed button "${messageText}" and transitioned to block ${nextBlockId}`);
              return;
            } else {
              console.log(`🔍 DEBUG: No next block found for button ${button.id} (${nextBlockId})`);
            }
          } else {
            console.log(`🔍 DEBUG: Button "${messageText}" not found in current block ${currentBlockId}`);
          }
        }
      }
      
      // Если не нашли в текущем блоке, ищем во всех блоках (fallback)
      if (!found) {
        console.log(`Button not found in current block, searching in all blocks...`);
        for (const block of blocks) {
          const button = (block.buttons || []).find(btn => btn.text === messageText);
          if (button) {
            console.log(`Found button "${messageText}" in block ${block.id} (fallback)`);
            console.log(`Button details:`, button);
            
            // Проверяем, является ли кнопка ссылкой
            if (button.url && button.url.trim() !== '') {
              console.log(`Button "${messageText}" is a link: ${button.url}`);
              // Отправляем inline-кнопку для открытия ссылки в браузере
              await ctx.reply(`🔗 ${button.text}`, {
                reply_markup: {
                  inline_keyboard: [[{ text: button.text, url: button.url.trim() }]]
                }
              });
              console.log(`Link button processed successfully in fallback, returning`);
              found = true;
              return;
            }
            
            // Если это обычная кнопка (не ссылка), переходим к следующему блоку
            const nextBlockId = connectionMap.get(`${block.id}_${button.id}`);
            const nextBlockData = blocks.find(b => b.id === nextBlockId);
            
            // --- ВАЖНО: Проверка завершённости квиза ДО изменения состояния ---
            if (nextBlockData && nextBlockData.type === 'quiz') {
              const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              if (userCompletedQuizzes.has(nextBlockId)) {
                console.log(`🔍 DEBUG: Quiz already completed (fallback), redirecting to start`);
                await ctx.reply('Вы уже проходили этот квиз. Результаты не будут сохранены повторно.');
                userQuizStates.delete(userId);
                userCurrentBlock.set(userId, 'start');
                const startBlock = dialogMap.get('start');
                if (startBlock) {
                  const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
                  await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
                }
                found = true;
                return;
              }
            }
            // --- конец блока проверки ---
            
            if (nextBlockId && dialogMap.has(nextBlockId)) {
              const nextBlock = dialogMap.get(nextBlockId);
              
              // Добавляем текущий блок в историю навигации
              let userHistory = userNavigationHistory.get(userId) || [];
              userHistory.push(block.id);
              userNavigationHistory.set(userId, userHistory);
              
              // Обновляем текущий блок пользователя
              userCurrentBlock.set(userId, nextBlockId);
              
              // Специальная обработка для квизов
              const nextBlockData = blocks.find(b => b.id === nextBlockId);
              if (nextBlockData && nextBlockData.type === 'quiz') {
                console.log('Transitioning to quiz block (fallback):', nextBlockId);
                
                // Очищаем историю навигации для квиза
                userNavigationHistory.delete(userId);
                
                // Инициализируем состояние квиза
                const quizState = {
                  currentQuestionIndex: 0,
                  answers: [],
                  startTime: Date.now()
                };
                userQuizStates.set(userId, quizState);
                
                // Отправляем первый вопрос квиза с медиафайлами
                const firstQuestion = nextBlockData.questions[0];
                if (firstQuestion) {
                  // Создаем клавиатуру по 2 кнопки в ряд для квиза
                  const keyboard = [];
                  for (let i = 0; i < firstQuestion.buttons.length; i += 2) {
                    const row = [];
                    row.push({ text: firstQuestion.buttons[i].text });
                    
                    // Добавляем вторую кнопку в ряд, если она есть
                    if (i + 1 < firstQuestion.buttons.length) {
                      row.push({ text: firstQuestion.buttons[i + 1].text });
                    }
                    
                    keyboard.push(row);
                  }
                  
                  console.log('Sending first quiz question (fallback):', firstQuestion.message, 'with mediaFiles:', firstQuestion.mediaFiles);
                  await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles || [], keyboard, []);
                  found = true;
                  return;
                }
              }
              
              const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
              
              await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard, inlineKeyboard);
              found = true;
              console.log(`🔍 DEBUG: Successfully processed button "${messageText}" in fallback and transitioned to block ${nextBlockId}`);
              return;
            }
          }
        }
      }
      
      // Если не найдено соответствие, игнорируем сообщение
      if (!found) {
        console.log(`No button found for message "${messageText}", ignoring`);
      }
      return;
    } catch (error) {
      console.error('❌ Critical error in message handler:', error);
      console.error('📄 Error stack:', error.stack);
      
      // Обработка ошибки 403 (пользователь заблокировал бота)
      if (error.response && error.response.error_code === 403) {
        console.log(`⚠️ User blocked the bot (403 error in message handler), ignoring`);
        return;
      }
      
      // Попытка отправить сообщение об ошибке пользователю
      try {
        await ctx.reply('Произошла ошибка. Попробуйте еще раз или нажмите /start для перезапуска.');
      } catch (replyError) {
        console.error('❌ Error sending error message:', replyError);
      }
      
      // Принудительная очистка памяти при критической ошибке
      try {
        cleanupOldUserData();
      } catch (cleanupError) {
        console.error('❌ Error during cleanup:', cleanupError);
      }
    }
  });
}

async function startBot() {
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
  
  // Обработчик ошибок бота
  bot.catch((err, ctx) => {
    console.error('❌ Bot error:', err);
    handleCriticalError(err);
  });
  
  // Запускаем бота
  try {
    await bot.launch();
    console.log('Bot started successfully');
    
    // Сброс счетчика ошибок при успешном запуске
    errorCount = 0;
  } catch (error) {
    console.error('Failed to start bot:', error);
    handleCriticalError(error);
    process.exit(1);
  }
  
  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
  
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

startBot();