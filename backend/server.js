const express = require('express');
const cors = require('cors');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(cors());
app.use(express.json());

let bot = null;
let dialogChains = {
  blocks: [],
  connections: [],
  startBlockId: null
};

// Функция для создания клавиатуры из кнопок
const createKeyboard = (blockId) => {
  const block = dialogChains.blocks.find(b => b.id === blockId);
  if (!block || !block.buttons) return {};

  // Группируем кнопки по 2 в ряд для лучшей визуальной организации
  const buttonRows = [];
  for (let i = 0; i < block.buttons.length; i += 2) {
    const row = block.buttons.slice(i, i + 2).map(button => ({
      text: button.text
    }));
    buttonRows.push(row);
  }

  // Добавляем кнопку возврата в главное меню, если это не стартовый блок
  if (blockId !== dialogChains.startBlockId) {
    buttonRows.push([{ text: '🏠 Главное меню' }]);
  }

  return {
    reply_markup: {
      keyboard: buttonRows,
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
};

// Функция для отправки сообщения блока
const sendBlockMessage = async (chatId, blockId) => {
  const block = dialogChains.blocks.find(b => b.id === blockId);
  if (!block) return;
  
  // Проверяем наличие текста сообщения
  if (!block.message || block.message.trim() === '') {
    console.warn(`Warning: Empty message in block ${blockId}`);
    return;
  }

  try {
    await bot.sendMessage(
      chatId,
      block.message,
      createKeyboard(blockId)
    );
  } catch (error) {
    console.error(`Error sending message for block ${blockId}:`, error);
    throw error;
  }
};

// Функция для поиска следующего блока по кнопке
const findNextBlock = (currentBlockId, buttonText) => {
  // Находим текущий блок
  const currentBlock = dialogChains.blocks.find(b => b.id === currentBlockId);
  if (!currentBlock) return null;

  // Находим кнопку по тексту
  const button = currentBlock.buttons.find(btn => btn.text === buttonText);
  if (!button) return null;

  // Ищем связь для этой кнопки
  const connection = dialogChains.connections.find(
    conn => conn.from.blockId === currentBlockId && conn.from.buttonId === button.id
  );

  // Возвращаем ID следующего блока
  return connection ? connection.to : null;
};

app.post('/api/setup-bot', async (req, res) => {
  const { botToken, welcomeMessage } = req.body;

  // Проверяем наличие обязательных параметров
  if (!botToken) {
    return res.status(400).json({ 
      success: false, 
      error: 'Bot token is required' 
    });
  }

  if (!welcomeMessage || welcomeMessage.trim() === '') {
    return res.status(400).json({ 
      success: false, 
      error: 'Welcome message is required' 
    });
  }

  try {
    if (bot) {
      bot.stopPolling();
    }

    bot = new TelegramBot(botToken, { polling: true });

    // Обработчик команды /start
    bot.onText(/\/start/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        await bot.sendMessage(chatId, welcomeMessage);
        
        // Если есть стартовый блок, начинаем с него
        if (dialogChains.startBlockId) {
          await sendBlockMessage(chatId, dialogChains.startBlockId);
        }
      } catch (error) {
        console.error('Error in /start handler:', error);
      }
    });

    // Обработчик текстовых сообщений (для кнопок меню)
    bot.on('message', async (msg) => {
      if (msg.text === '/start') return;

      const chatId = msg.chat.id;
      const buttonText = msg.text;

      try {
        // Обработка возврата в главное меню
        if (buttonText === '🏠 Главное меню') {
          if (dialogChains.startBlockId) {
            await sendBlockMessage(chatId, dialogChains.startBlockId);
          }
          return;
        }

        // Находим блок, которому принадлежит нажатая кнопка
        let currentBlockId = null;
        for (const block of dialogChains.blocks) {
          if (block.buttons.some(btn => btn.text === buttonText)) {
            currentBlockId = block.id;
            break;
          }
        }

        if (currentBlockId) {
          const nextBlockId = findNextBlock(currentBlockId, buttonText);
          if (nextBlockId) {
            await sendBlockMessage(chatId, nextBlockId);
          }
        }
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });

    // Проверяем подключение к боту
    try {
      const me = await bot.getMe();
      console.log('Bot connected successfully:', me.username);
    } catch (error) {
      console.error('Failed to connect to bot:', error);
      return res.status(400).json({ 
        success: false, 
        error: 'Failed to connect to bot. Please check your token.' 
      });
    }

    // Отправляем успешный ответ только после полной настройки бота
    res.json({ 
      success: true, 
      message: 'Bot successfully configured',
      activeConnections: dialogChains.connections.length,
      totalBlocks: dialogChains.blocks.length
    });
  } catch (error) {
    console.error('Error setting up bot:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error'
    });
  }
});

// Endpoint для обновления цепочек диалогов
app.post('/api/update-dialog-chains', (req, res) => {
  try {
    const { blocks, connections, startBlockId } = req.body;
    
    // Проверяем корректность данных
    if (!Array.isArray(blocks) || !Array.isArray(connections)) {
      throw new Error('Invalid data format');
    }

    // Проверяем наличие стартового блока
    if (!blocks.find(b => b.id === startBlockId)) {
      throw new Error('Start block not found');
    }

    // Проверяем наличие сообщений в блоках
    const emptyBlocks = blocks.filter(b => !b.message || b.message.trim() === '');
    if (emptyBlocks.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Some blocks have empty messages',
        emptyBlocks: emptyBlocks.map(b => b.id)
      });
    }

    // Проверяем корректность связей
    for (const conn of connections) {
      const fromBlock = blocks.find(b => b.id === conn.from.blockId);
      const toBlock = blocks.find(b => b.id === conn.to);
      
      if (!fromBlock || !toBlock) {
        throw new Error('Invalid connection: block not found');
      }
      
      if (!fromBlock.buttons.find(btn => btn.id === conn.from.buttonId)) {
        throw new Error('Invalid connection: button not found');
      }
    }

    // Сохраняем данные
    dialogChains = {
      blocks: blocks || [],
      connections: connections || [],
      startBlockId
    };

    res.json({ 
      success: true, 
      message: 'Dialog chains updated successfully',
      activeConnections: connections.length,
      totalBlocks: blocks.length
    });
  } catch (error) {
    console.error('Error updating dialog chains:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 