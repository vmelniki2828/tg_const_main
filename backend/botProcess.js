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

// Функция для отправки медиафайлов (оптимизированная)
async function sendMediaMessage(ctx, message, mediaFiles, keyboard, inlineKeyboard = []) {
  const fs = require('fs');
  const path = require('path');
  
  try {
    // Проверяем, что mediaFiles существует и не пустой
    if (!mediaFiles || !Array.isArray(mediaFiles) || mediaFiles.length === 0) {
      // Если нет медиафайлов, отправляем только текст
      const replyMarkup = {};
      if (keyboard.length > 0) {
        replyMarkup.keyboard = keyboard;
        replyMarkup.resize_keyboard = true;
      }
      if (inlineKeyboard.length > 0) {
        replyMarkup.inline_keyboard = inlineKeyboard;
      }
      
      await ctx.reply(message, {
        reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
      });
      return;
    }

    // Если есть только один медиафайл
    if (mediaFiles.length === 1) {
      const media = mediaFiles[0];
      const filePath = path.join(__dirname, 'uploads', media.filename);
      
      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
        const replyMarkup = {};
        if (keyboard.length > 0) {
          replyMarkup.keyboard = keyboard;
          replyMarkup.resize_keyboard = true;
        }
        if (inlineKeyboard.length > 0) {
          replyMarkup.inline_keyboard = inlineKeyboard;
        }
        
        await ctx.reply(message, {
          reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
        });
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

      // Определяем тип медиа и отправляем соответствующим методом
      if (media.mimetype.startsWith('image/')) {
        await ctx.replyWithPhoto({ source: filePath }, options);
      } else if (media.mimetype.startsWith('video/')) {
        await ctx.replyWithVideo({ source: filePath }, options);
      } else if (media.mimetype.startsWith('audio/')) {
        await ctx.replyWithAudio({ source: filePath }, options);
      } else if (media.mimetype.startsWith('application/')) {
        await ctx.replyWithDocument({ source: filePath }, options);
      } else {
        await ctx.replyWithDocument({ source: filePath }, options);
      }
    } else {
      // Множественные медиафайлы
      const mediaGroup = [];
      const validFiles = [];
      
      for (const media of mediaFiles) {
        const filePath = path.join(__dirname, 'uploads', media.filename);
        if (fs.existsSync(filePath)) {
          validFiles.push({ ...media, filePath });
        }
      }
      
      if (validFiles.length === 0) {
        const replyMarkup = {};
        if (keyboard.length > 0) {
          replyMarkup.keyboard = keyboard;
          replyMarkup.resize_keyboard = true;
        }
        if (inlineKeyboard.length > 0) {
          replyMarkup.inline_keyboard = inlineKeyboard;
        }
        
        await ctx.reply(message, {
          reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
        });
        return;
      }
      
      // Добавляем медиафайлы в группу
      for (let i = 0; i < validFiles.length; i++) {
        const media = validFiles[i];
        const mediaItem = {
          type: media.mimetype.startsWith('image/') ? 'photo' : 
                media.mimetype.startsWith('video/') ? 'video' : 
                media.mimetype.startsWith('audio/') ? 'audio' : 'document',
          media: { source: media.filePath }
        };
        
        // Добавляем подпись только к первому элементу
        if (i === 0) {
          mediaItem.caption = message;
        }
        
        mediaGroup.push(mediaItem);
      }
      
      // Отправляем медиагруппу
      await ctx.replyWithMediaGroup(mediaGroup);
      
      // Отправляем клавиатуру отдельно
      if (keyboard.length > 0 || inlineKeyboard.length > 0) {
        const replyMarkup = {};
        if (keyboard.length > 0) {
          replyMarkup.keyboard = keyboard;
          replyMarkup.resize_keyboard = true;
        }
        if (inlineKeyboard.length > 0) {
          replyMarkup.inline_keyboard = inlineKeyboard;
        }
        
        await ctx.reply('Выберите действие:', { reply_markup: replyMarkup });
      }
    }
  } catch (error) {
    console.error('Error sending media message:', error);
    // Fallback к текстовому сообщению
    const replyMarkup = {};
    if (keyboard.length > 0) {
      replyMarkup.keyboard = keyboard;
      replyMarkup.resize_keyboard = true;
    }
    if (inlineKeyboard.length > 0) {
      replyMarkup.inline_keyboard = inlineKeyboard;
    }
    
    await ctx.reply(message, {
      reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
    });
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
    const messageText = ctx.message.text;
    const userId = ctx.from.id;
    let currentBlockId = userCurrentBlock.get(userId);
    
    console.log(`Received message: "${messageText}" from user ${userId} in block ${currentBlockId}`);
    
    // Игнорируем очень короткие сообщения (менее 1 символа)
    if (messageText.length < 1) {
      return;
    }
    
    // Игнорируем команды, которые обрабатываются отдельно
    if (messageText.startsWith('/')) {
      return;
    }
    
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
    
    // Специальная обработка квизов
    
    if (currentBlockId) {
      const currentBlock = blocks.find(b => b.id === currentBlockId);
      
      if (currentBlock && currentBlock.type === 'quiz') {
        // Проверяем, не прошел ли пользователь уже этот квиз
        const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
                 if (userCompletedQuizzes.has(currentBlock.id)) {
           await ctx.reply('Вы уже проходили этот квиз. Результаты не будут сохранены повторно.');
           // Возвращаем пользователя к предыдущему блоку из истории
           const userHistory = userNavigationHistory.get(userId);
           if (userHistory && userHistory.length > 0) {
             const previousBlockId = userHistory[userHistory.length - 1];
             userCurrentBlock.set(userId, previousBlockId);
             const prevBlock = dialogMap.get(previousBlockId);
             if (prevBlock) {
               const { keyboard, inlineKeyboard } = createKeyboardWithBack(prevBlock.buttons, userId, previousBlockId);
               await sendMediaMessage(ctx, prevBlock.message, prevBlock.mediaFiles, keyboard, inlineKeyboard);
             }
           } else {
             // Если нет истории, возвращаемся к стартовому блоку
             userCurrentBlock.set(userId, 'start');
             const startBlock = dialogMap.get('start');
             if (startBlock) {
               const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
               await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
             }
           }
           return;
         }
        
        const userQuizState = userQuizStates.get(userId) || {
          currentQuestionIndex: 0,
          answers: [],
          startTime: Date.now()
        };
        
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
              
              // Отмечаем квиз как завершенный для этого пользователя
              let userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              userCompletedQuizzes.add(currentBlock.id);
              completedQuizzes.set(userId, userCompletedQuizzes);
              
              // Очищаем состояние квиза и устанавливаем стартовый блок
              userQuizStates.delete(userId);
              userCurrentBlock.set(userId, 'start');
              
              // Возвращаемся к стартовому блоку
              const startBlock = dialogMap.get('start');
              if (startBlock) {
                const { keyboard, inlineKeyboard } = createKeyboardWithBack(startBlock.buttons, userId, 'start');
                
                // Сначала отправляем результаты квиза
                await ctx.reply(resultMessage);
                
                // Затем отправляем сообщение стартового блока
                const replyMarkup = {};
                if (keyboard.length > 0) {
                  replyMarkup.keyboard = keyboard;
                  replyMarkup.resize_keyboard = true;
                }
                if (inlineKeyboard.length > 0) {
                  replyMarkup.inline_keyboard = inlineKeyboard;
                }
                
                await ctx.reply(startBlock.message, {
                  reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
                });
              } else {
                await ctx.reply(resultMessage);
              }
              
              return;
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
          console.log(`Found button "${messageText}" in current block ${currentBlockId}`);
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
            console.log(`Link button processed successfully, returning`);
            return;
          }
          
          // Если это обычная кнопка (не ссылка), переходим к следующему блоку
          const nextBlockId = connectionMap.get(`${currentBlockId}_${button.id}`);
          if (nextBlockId && dialogMap.has(nextBlockId)) {
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
              console.log('Transitioning to quiz block:', nextBlockId);
              
              // Проверяем, не прошел ли пользователь уже этот квиз
              const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              if (userCompletedQuizzes.has(nextBlockId)) {
                await ctx.reply('Вы уже проходили этот квиз. Результаты не будут сохранены повторно.');
                return;
              }
              
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
                return;
              }
            }
            
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
            
            await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard, inlineKeyboard);
            found = true;
          }
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
            return;
          }
          
          // Если это обычная кнопка (не ссылка), переходим к следующему блоку
          const nextBlockId = connectionMap.get(`${block.id}_${button.id}`);
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
              
              // Проверяем, не прошел ли пользователь уже этот квиз
              const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              if (userCompletedQuizzes.has(nextBlockId)) {
                await ctx.reply('Вы уже проходили этот квиз. Результаты не будут сохранены повторно.');
                return;
              }
              
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
                return;
              }
            }
            
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
            
            await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard, inlineKeyboard);
            return;
          }
        }
      }
    }
    
    // Если не найдено соответствие, игнорируем сообщение
    console.log(`No button found for message "${messageText}", ignoring`);
    return;
  });
}

async function startBot() {
  const bot = new Telegraf(token);
  
  // Настраиваем обработчики
  setupBotHandlers(bot, state.blocks, state.connections);
  
  // Запускаем бота
  try {
    await bot.launch();
    console.log('Bot started successfully');
  } catch (error) {
    console.error('Failed to start bot:', error);
    process.exit(1);
  }
  
  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

startBot();
