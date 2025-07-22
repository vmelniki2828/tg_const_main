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

// Функция для отправки медиафайлов
async function sendMediaMessage(ctx, message, mediaFiles, keyboard) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    if (!mediaFiles || mediaFiles.length === 0) {
      // Если нет медиафайлов, отправляем только текст
      await ctx.reply(message, {
        reply_markup: {
          keyboard,
          resize_keyboard: true
        }
      });
      return;
    }

    // Если есть только один медиафайл
    if (mediaFiles.length === 1) {
      const media = mediaFiles[0];
      const filePath = path.join(__dirname, 'uploads', media.filename);
      
      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
        console.error('Media file not found:', filePath);
        await ctx.reply(message, {
          reply_markup: {
            keyboard,
            resize_keyboard: true
          }
        });
        return;
      }

      const options = {
        caption: message,
        reply_markup: {
          keyboard,
          resize_keyboard: true
        }
      };

      // Определяем тип медиа и отправляем соответствующим методом
      if (media.mimetype.startsWith('image/')) {
        await ctx.replyWithPhoto({ source: filePath }, options);
      } else if (media.mimetype.startsWith('video/')) {
        await ctx.replyWithVideo({ source: filePath }, options);
      } else if (media.mimetype.startsWith('audio/')) {
        await ctx.replyWithAudio({ source: filePath }, options);
      } else if (media.mimetype === 'application/pdf' || media.mimetype.startsWith('application/')) {
        await ctx.replyWithDocument({ source: filePath }, options);
      } else {
        // Для остальных типов файлов отправляем как документ
        await ctx.replyWithDocument({ source: filePath }, options);
      }
    } else {
      // Если несколько медиафайлов, отправляем их группой
      const mediaGroup = [];
      
      for (const media of mediaFiles) {
        const filePath = path.join(__dirname, 'uploads', media.filename);
        
        if (!fs.existsSync(filePath)) {
          console.error('Media file not found:', filePath);
          continue;
        }

        if (media.mimetype.startsWith('image/')) {
          mediaGroup.push({ type: 'photo', media: { source: filePath } });
        } else if (media.mimetype.startsWith('video/')) {
          mediaGroup.push({ type: 'video', media: { source: filePath } });
        } else if (media.mimetype.startsWith('audio/')) {
          mediaGroup.push({ type: 'audio', media: { source: filePath } });
        } else {
          mediaGroup.push({ type: 'document', media: { source: filePath } });
        }
      }

      if (mediaGroup.length > 0) {
        // Добавляем подпись к первому элементу
        if (mediaGroup[0].media) {
          mediaGroup[0].media.caption = message;
          mediaGroup[0].media.reply_markup = {
            keyboard,
            resize_keyboard: true
          };
        }

        await ctx.telegram.sendMediaGroup(ctx.chat.id, mediaGroup);
      } else {
        // Если все файлы не найдены, отправляем только текст
        await ctx.reply(message, {
          reply_markup: {
            keyboard,
            resize_keyboard: true
          }
        });
      }
    }
    
    console.log('Media message sent successfully');
  } catch (error) {
    console.error('Error sending media message:', error);
    // Fallback к текстовому сообщению
    await ctx.reply(message, {
      reply_markup: {
        keyboard,
        resize_keyboard: true
      }
    });
  }
}

// Функция для настройки обработчиков бота
function setupBotHandlers(bot, blocks, connections) {
  console.log('Setting up handlers with blocks:', blocks.length, 'connections:', connections.length);
  
  // Создаем карту диалогов для быстрого доступа
  const dialogMap = new Map();
  blocks.forEach(block => {
    dialogMap.set(block.id, {
      message: block.message,
      buttons: block.buttons || [],
      mediaFiles: block.mediaFiles || []
    });
    console.log(`Block ${block.id}: "${block.message}" with ${block.buttons.length} buttons and ${block.mediaFiles.length} media files`);
  });

  // Создаем карту соединений для быстрого доступа
  const connectionMap = new Map();
  connections.forEach(conn => {
    const key = `${conn.from.blockId}_${conn.from.buttonId}`;
    connectionMap.set(key, conn.to);
    console.log(`Connection: ${key} -> ${conn.to}`);
  });

  // Обработка команды /start
  bot.command('start', async (ctx) => {
    console.log('Received /start command');
    const startBlock = dialogMap.get('start');
    if (startBlock) {
      const keyboard = startBlock.buttons.length > 0 ? 
        startBlock.buttons.map(btn => [{ text: btn.text }]) : 
        [];
      
      console.log('Sending start message:', startBlock.message, 'with keyboard:', keyboard);
      
      // Проверяем есть ли медиафайлы
      if (startBlock.mediaFiles && startBlock.mediaFiles.length > 0) {
        await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard);
      } else {
        await ctx.reply(startBlock.message, {
          reply_markup: {
            keyboard,
            resize_keyboard: true
          }
        });
      }
    } else {
      console.log('Start block not found');
      await ctx.reply('Бот не настроен');
    }
  });

  // Обработка текстовых сообщений
  bot.on('text', async (ctx) => {
    const messageText = ctx.message.text;
    console.log('Received text message:', messageText);
    
    // Ищем блок, у которого есть кнопка с таким текстом
    let found = false;
    for (const block of blocks) {
      const button = (block.buttons || []).find(btn => btn.text === messageText);
      if (button) {
        console.log(`Found button "${messageText}" in block ${block.id}`);
        const nextBlockId = connectionMap.get(`${block.id}_${button.id}`);
        if (nextBlockId && dialogMap.has(nextBlockId)) {
          const nextBlock = dialogMap.get(nextBlockId);
          const keyboard = nextBlock.buttons.length > 0 ? 
            nextBlock.buttons.map(btn => [{ text: btn.text }]) : 
            [];
          
          console.log('Sending response:', nextBlock.message, 'with keyboard:', keyboard);
          
          // Проверяем есть ли медиафайлы
          if (nextBlock.mediaFiles && nextBlock.mediaFiles.length > 0) {
            await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard);
          } else {
            await ctx.reply(nextBlock.message, {
              reply_markup: {
                keyboard,
                resize_keyboard: true
              }
            });
          }
          found = true;
          break;
        } else {
          console.log(`No connection found for button ${button.id} in block ${block.id}`);
        }
      }
    }
    
    if (!found) {
      console.log('No matching button found for message:', messageText);
      await ctx.reply('Кнопка не найдена');
    }
  });

  // Обработка ошибок
  bot.catch((err) => {
    console.error('Bot error:', err);
  });
}

async function startBot() {
  try {
    // Создаем бота
    console.log('Creating bot instance...');
    const bot = new Telegraf(token);

    // Проверяем токен
    console.log('Checking bot token...');
    const me = await bot.telegram.getMe();
    console.log('Bot token is valid, username:', me.username);

    // Настраиваем обработчики
    console.log('Setting up handlers...');
    setupBotHandlers(bot, state.blocks, state.connections);

    // Удаляем вебхук
    console.log('Deleting webhook...');
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('Webhook deleted successfully');

    // Запускаем бота
    console.log('Launching bot...');
    
    // Запускаем бота и ждем завершения
    await bot.launch();
    console.log('Bot started successfully');

    // Обработка остановки
    process.once('SIGINT', async () => {
      console.log('Stopping bot...');
      await bot.stop('SIGINT');
      process.exit(0);
    });

    process.once('SIGTERM', async () => {
      console.log('Stopping bot...');
      await bot.stop('SIGTERM');
      process.exit(0);
    });

  } catch (error) {
    console.error('Error starting bot:', error);
    process.exit(1);
  }
}

// Запускаем бота
startBot(); 