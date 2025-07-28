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
async function sendMediaMessage(ctx, message, mediaFiles, keyboard, inlineKeyboard = []) {
  const fs = require('fs');
  const path = require('path');
  
  console.log('sendMediaMessage called with:', {
    message: message,
    mediaFilesCount: mediaFiles ? mediaFiles.length : 0,
    mediaFiles: mediaFiles,
    keyboardLength: keyboard.length,
    inlineKeyboardLength: inlineKeyboard.length
  });
  
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
      
      console.log('Processing single media file:', media.filename, 'at path:', filePath);
      
      // Проверяем существование файла
      if (!fs.existsSync(filePath)) {
        console.error('Media file not found:', filePath);
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
          const replyMarkup = {};
          if (keyboard.length > 0) {
            replyMarkup.keyboard = keyboard;
            replyMarkup.resize_keyboard = true;
          }
          if (inlineKeyboard.length > 0) {
            replyMarkup.inline_keyboard = inlineKeyboard;
          }
          mediaGroup[0].media.reply_markup = Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined;
        }

        await ctx.telegram.sendMediaGroup(ctx.chat.id, mediaGroup);
      } else {
        // Если все файлы не найдены, отправляем только текст
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
    
    console.log('Media message sent successfully');
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

// Функция для настройки обработчиков бота
function setupBotHandlers(bot, blocks, connections) {
  console.log('Setting up handlers with blocks:', blocks.length, 'connections:', connections.length);
  
  // Создаем карту диалогов для быстрого доступа
  const dialogMap = new Map();
  blocks.forEach(block => {
    dialogMap.set(block.id, {
      message: block.message,
      buttons: block.buttons || [],
      mediaFiles: block.mediaFiles || [],
      type: block.type
    });
    console.log(`Block ${block.id}: "${block.message}" with ${(block.buttons || []).length} buttons and ${(block.mediaFiles || []).length} media files`);
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
    
    // Добавляем кнопки
    if (buttons && buttons.length > 0) {
      buttons.forEach(btn => {
        // Все кнопки добавляем в обычную клавиатуру для отображения
        keyboard.push([{ text: btn.text }]);
      });
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
    console.log(`Connection: ${key} -> ${conn.to}`);
  });

  // Обработка команды /start
  bot.command('start', async (ctx) => {
    console.log('Received /start command');
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
      
      console.log('Sending start message:', startBlock.message, 'with keyboard:', keyboard, 'inlineKeyboard:', inlineKeyboard);
      
      // Проверяем есть ли медиафайлы
      if (startBlock.mediaFiles && Array.isArray(startBlock.mediaFiles) && startBlock.mediaFiles.length > 0) {
        await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
      } else {
        const replyMarkup = {};
        if (keyboard.length > 0) {
          replyMarkup.keyboard = keyboard;
          replyMarkup.resize_keyboard = true;
        }
        if (inlineKeyboard.length > 0) {
          replyMarkup.inline_keyboard = inlineKeyboard;
        }
        
        await sendMediaMessage(ctx, startBlock.message, startBlock.mediaFiles, keyboard, inlineKeyboard);
      }
    } else {
      console.log('Start block not found');
      await ctx.reply('Бот не настроен');
    }
  });

  // Обработка текстовых сообщений
  bot.on('text', async (ctx) => {
    const messageText = ctx.message.text;
    const userId = ctx.from.id;
    console.log('Received text message:', messageText);
    
    // Обработка кнопки "Назад"
    if (messageText === '⬅️ Назад') {
      const userHistory = userNavigationHistory.get(userId);
      if (userHistory && userHistory.length > 0) {
        // Получаем предыдущий блок из истории
        const previousBlockId = userHistory.pop();
        const prevBlock = dialogMap.get(previousBlockId);
        
        if (prevBlock) {
          const { keyboard, inlineKeyboard } = createKeyboardWithBack(prevBlock.buttons, userId, previousBlockId);
          
          console.log('Going back to previous block:', previousBlockId, 'History remaining:', userHistory.length);
          
          // Проверяем есть ли медиафайлы
          if (prevBlock.mediaFiles && Array.isArray(prevBlock.mediaFiles) && prevBlock.mediaFiles.length > 0) {
            await sendMediaMessage(ctx, prevBlock.message, prevBlock.mediaFiles, keyboard, inlineKeyboard);
          } else {
            const replyMarkup = {};
            if (keyboard.length > 0) {
              replyMarkup.keyboard = keyboard;
              replyMarkup.resize_keyboard = true;
            }
            if (inlineKeyboard.length > 0) {
              replyMarkup.inline_keyboard = inlineKeyboard;
            }
            
            await ctx.reply(prevBlock.message, {
              reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
            });
          }
          
          // Обновляем текущий блок пользователя
          userCurrentBlock.set(userId, previousBlockId);
          
          // Обновляем историю
          userNavigationHistory.set(userId, userHistory);
          return;
        }
      }
      await ctx.reply('Нет предыдущего блока');
      return;
    }
    
    // Специальная обработка квизов
    const currentBlockId = userCurrentBlock.get(userId);
    if (currentBlockId) {
      const currentBlock = blocks.find(b => b.id === currentBlockId);
      if (currentBlock && currentBlock.type === 'quiz') {
        // Обработка ответов в квизе
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
              const keyboard = nextQuestion.buttons.map(btn => [{ text: btn.text }]);
              
              console.log(`Quiz: User ${userId} answered question ${userQuizState.currentQuestionIndex - 1}, moving to question ${userQuizState.currentQuestionIndex}`);
              console.log('Sending next quiz question:', nextQuestion.message, 'with mediaFiles:', nextQuestion.mediaFiles);
              
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
                const question = currentBlock.questions[index];
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
                  resultMessage += `⚠️ Ошибка при выдаче промокода\n`;
                }
              } else {
                resultMessage += `❌ ${currentBlock.finalFailureMessage || 'К сожалению, вы не прошли квиз. Нужно ответить правильно на все вопросы.'}\n`;
              }
              
              // Записываем статистику
              try {
                const fs = require('fs');
                const path = require('path');
                const statsPath = path.join(__dirname, 'quizStats.json');
                
                // Проверяем права доступа к директории
                const dirPath = path.dirname(statsPath);
                console.log(`📁 Директория: ${dirPath}`);
                console.log(`🔐 Права на директорию: ${fs.statSync(dirPath).mode.toString(8)}`);
                
                // Проверяем, можем ли мы писать в директорию
                try {
                  const testFile = path.join(dirPath, 'test-write.tmp');
                  fs.writeFileSync(testFile, 'test');
                  fs.unlinkSync(testFile);
                  console.log(`✅ Права на запись в директорию есть`);
                } catch (writeError) {
                  console.log(`❌ Нет прав на запись в директорию: ${writeError.message}`);
                }
                
                console.log(`📊 Сохраняем статистику для квиза ${currentBlock.id}`);
                console.log(`📁 Путь к файлу: ${statsPath}`);
                
                let stats = {};
                if (fs.existsSync(statsPath)) {
                  console.log(`✅ Файл статистики существует`);
                  const fileContent = fs.readFileSync(statsPath, 'utf8');
                  console.log(`📄 Содержимое файла: ${fileContent}`);
                  stats = JSON.parse(fileContent);
                } else {
                  console.log(`❌ Файл статистики не существует, создаем новый`);
                }
                
                if (!stats[currentBlock.id]) {
                  console.log(`📊 Создаем новую запись для квиза ${currentBlock.id}`);
                  stats[currentBlock.id] = {
                    totalAttempts: 0,
                    successfulCompletions: 0,
                    failedAttempts: 0,
                    userAttempts: []
                  };
                }
                
                const quizStats = stats[currentBlock.id];
                quizStats.totalAttempts++;
                
                if (isSuccessful) {
                  quizStats.successfulCompletions++;
                  console.log(`✅ Успешное прохождение квиза`);
                } else {
                  quizStats.failedAttempts++;
                  console.log(`❌ Неудачное прохождение квиза`);
                }
                
                const userAttempt = {
                  userId: userId,
                  userName: ctx.from.first_name || ctx.from.username || `User ${userId}`,
                  timestamp: Date.now(),
                  success: isSuccessful,
                  score: correctAnswers,
                  duration: Date.now() - userQuizState.startTime
                };
                
                quizStats.userAttempts.push(userAttempt);
                console.log(`👤 Добавлена попытка пользователя:`, userAttempt);
                
                const statsJson = JSON.stringify(stats, null, 2);
                console.log(`💾 Записываем статистику: ${statsJson}`);
                
                fs.writeFileSync(statsPath, statsJson);
                console.log(`✅ Статистика успешно сохранена для блока ${currentBlock.id}`);
                
                // Проверяем, что файл действительно записался
                if (fs.existsSync(statsPath)) {
                  const savedContent = fs.readFileSync(statsPath, 'utf8');
                  console.log(`✅ Файл сохранен, размер: ${savedContent.length} символов`);
                } else {
                  console.log(`❌ Файл не был создан!`);
                }
              } catch (error) {
                console.error('❌ Error saving quiz stats:', error);
                console.error('❌ Stack trace:', error.stack);
                
                // Попробуем альтернативный способ - отправить статистику через HTTP
                console.log(`🔄 Пробуем альтернативный способ сохранения статистики...`);
                try {
                  const http = require('http');
                  const postData = JSON.stringify({
                    quizId: currentBlock.id,
                    userId: userId,
                    userName: ctx.from.first_name || ctx.from.username || `User ${userId}`,
                    timestamp: Date.now(),
                    success: isSuccessful,
                    score: correctAnswers,
                    duration: Date.now() - userQuizState.startTime
                  });
                  
                  const options = {
                    hostname: 'localhost',
                    port: 3001,
                    path: '/api/quiz-stats',
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Content-Length': Buffer.byteLength(postData)
                    }
                  };
                  
                  const req = http.request(options, (res) => {
                    console.log(`📊 Статистика отправлена через HTTP, статус: ${res.statusCode}`);
                  });
                  
                  req.on('error', (e) => {
                    console.error(`❌ Ошибка HTTP запроса: ${e.message}`);
                  });
                  
                  req.write(postData);
                  req.end();
                } catch (httpError) {
                  console.error('❌ Ошибка при отправке статистики через HTTP:', httpError);
                }
              }
              
              // Отмечаем квиз как завершенный для этого пользователя
              let userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              userCompletedQuizzes.add(currentBlock.id);
              completedQuizzes.set(userId, userCompletedQuizzes);
              console.log(`Quiz ${currentBlock.id} marked as completed for user ${userId}`);
              
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
            return;
          }
          
          const nextBlockId = connectionMap.get(`${currentBlockId}_${button.id}`);
          if (nextBlockId && dialogMap.has(nextBlockId)) {
            const nextBlock = dialogMap.get(nextBlockId);
            
            // Добавляем текущий блок в историю навигации пользователя
            let userHistory = userNavigationHistory.get(userId) || [];
            userHistory.push(currentBlockId);
            
            // Ограничиваем размер истории (максимум 10 блоков)
            if (userHistory.length > 10) {
              userHistory = userHistory.slice(-10);
            }
            
            userNavigationHistory.set(userId, userHistory);
            
            // Обновляем текущий блок пользователя
            userCurrentBlock.set(userId, nextBlockId);
            
            console.log('Navigation history for user', userId, ':', userHistory);
            console.log('Current block updated to:', nextBlockId);
            
            // Если переходим к квизу, проверяем не проходил ли пользователь его уже
            const nextBlockData = blocks.find(b => b.id === nextBlockId);
            if (nextBlockData && nextBlockData.type === 'quiz') {
              // Проверяем, не завершал ли пользователь этот квиз ранее
              const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              if (userCompletedQuizzes.has(nextBlockId)) {
                await ctx.reply('❌ Вы уже проходили этот квиз. Каждый квиз можно пройти только один раз.');
                return;
              }
              
              userNavigationHistory.delete(userId);
              console.log('Cleared navigation history for quiz transition');
              
              // Инициализируем состояние квиза
              const quizState = {
                currentQuestionIndex: 0,
                answers: [],
                startTime: Date.now()
              };
              userQuizStates.set(userId, quizState);
              console.log('Initialized quiz state for user', userId);
              
              // Отправляем первый вопрос квиза
              const firstQuestion = nextBlockData.questions[0];
              if (firstQuestion) {
                const keyboard = firstQuestion.buttons.map(btn => [{ text: btn.text }]);
                console.log('Sending first quiz question (fallback):', firstQuestion.message, 'with mediaFiles:', firstQuestion.mediaFiles);
                await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles || [], keyboard, []);
                return;
              }
            }
            
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
            
            console.log('Sending response:', nextBlock.message, 'with keyboard:', keyboard, 'inlineKeyboard:', inlineKeyboard);
            
            // Проверяем есть ли медиафайлы
            if (nextBlock.mediaFiles && Array.isArray(nextBlock.mediaFiles) && nextBlock.mediaFiles.length > 0) {
              await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard, inlineKeyboard);
            } else {
              const replyMarkup = {};
              if (keyboard.length > 0) {
                replyMarkup.keyboard = keyboard;
                replyMarkup.resize_keyboard = true;
              }
              if (inlineKeyboard.length > 0) {
                replyMarkup.inline_keyboard = inlineKeyboard;
              }
              
              await ctx.reply(nextBlock.message, {
                reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
              });
            }
            found = true;
          } else {
            console.log(`No connection found for button ${button.id} in block ${currentBlockId}`);
          }
        }
      }
    }
    
    // Если не нашли в текущем блоке, ищем во всех блоках (fallback)
    if (!found) {
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
            return;
          }
          
          const nextBlockId = connectionMap.get(`${block.id}_${button.id}`);
          if (nextBlockId && dialogMap.has(nextBlockId)) {
            const nextBlock = dialogMap.get(nextBlockId);
            
            // Добавляем текущий блок в историю навигации пользователя
            let userHistory = userNavigationHistory.get(userId) || [];
            userHistory.push(block.id);
            
            // Ограничиваем размер истории (максимум 10 блоков)
            if (userHistory.length > 10) {
              userHistory = userHistory.slice(-10);
            }
            
            userNavigationHistory.set(userId, userHistory);
            
            // Обновляем текущий блок пользователя
            userCurrentBlock.set(userId, nextBlockId);
            
            console.log('Navigation history for user', userId, ':', userHistory);
            console.log('Current block updated to:', nextBlockId);
            
            // Если переходим к квизу, проверяем не проходил ли пользователь его уже
            const nextBlockData = blocks.find(b => b.id === nextBlockId);
            if (nextBlockData && nextBlockData.type === 'quiz') {
              // Проверяем, не завершал ли пользователь этот квиз ранее
              const userCompletedQuizzes = completedQuizzes.get(userId) || new Set();
              if (userCompletedQuizzes.has(nextBlockId)) {
                await ctx.reply('❌ Вы уже проходили этот квиз. Каждый квиз можно пройти только один раз.');
                return;
              }
              
              userNavigationHistory.delete(userId);
              console.log('Cleared navigation history for quiz transition');
              
              // Инициализируем состояние квиза
              const quizState = {
                currentQuestionIndex: 0,
                answers: [],
                startTime: Date.now()
              };
              userQuizStates.set(userId, quizState);
              console.log('Initialized quiz state for user', userId);
              
              // Отправляем первый вопрос квиза
              const firstQuestion = nextBlockData.questions[0];
              if (firstQuestion) {
                const keyboard = firstQuestion.buttons.map(btn => [{ text: btn.text }]);
                console.log('Sending first quiz question (fallback):', firstQuestion.message, 'with mediaFiles:', firstQuestion.mediaFiles);
                await sendMediaMessage(ctx, firstQuestion.message, firstQuestion.mediaFiles || [], keyboard, []);
                return;
              }
            }
            
            const { keyboard, inlineKeyboard } = createKeyboardWithBack(nextBlock.buttons, userId, nextBlockId);
            
            console.log('Sending response:', nextBlock.message, 'with keyboard:', keyboard, 'inlineKeyboard:', inlineKeyboard);
            
            // Проверяем есть ли медиафайлы
            if (nextBlock.mediaFiles && Array.isArray(nextBlock.mediaFiles) && nextBlock.mediaFiles.length > 0) {
              await sendMediaMessage(ctx, nextBlock.message, nextBlock.mediaFiles, keyboard, inlineKeyboard);
            } else {
              const replyMarkup = {};
              if (keyboard.length > 0) {
                replyMarkup.keyboard = keyboard;
                replyMarkup.resize_keyboard = true;
              }
              if (inlineKeyboard.length > 0) {
                replyMarkup.inline_keyboard = inlineKeyboard;
              }
              
              await ctx.reply(nextBlock.message, {
                reply_markup: Object.keys(replyMarkup).length > 0 ? replyMarkup : undefined
              });
            }
            found = true;
            break;
          } else {
            console.log(`No connection found for button ${button.id} in block ${block.id}`);
          }
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