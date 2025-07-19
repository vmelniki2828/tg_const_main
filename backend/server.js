const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Храним активные процессы ботов
const activeProcesses = new Map();

const STATE_FILE = path.join(__dirname, 'editorState.json');

// Функция для ожидания
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Вспомогательная функция для чтения состояния
async function readState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading state:', error);
    return {
      bots: [],
      activeBot: null
    };
  }
}

// Вспомогательная функция для сохранения состояния
async function writeState(state) {
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Error writing state:', error);
    throw new Error('Failed to save state');
  }
}

// Функция для остановки конкретного бота
async function stopBot(botId) {
  if (activeProcesses.has(botId)) {
    const process = activeProcesses.get(botId);
    console.log(`Stopping bot ${botId}...`);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        console.log(`Force killing bot ${botId}...`);
        process.kill('SIGKILL');
        activeProcesses.delete(botId);
        resolve();
      }, 5000);

      process.once('exit', () => {
        clearTimeout(timeout);
        activeProcesses.delete(botId);
        console.log(`Bot ${botId} stopped`);
        resolve();
      });

      process.kill('SIGTERM');
    });
  }
  return Promise.resolve();
}

// Функция для запуска бота
async function startBot(bot) {
  console.log(`Starting bot ${bot.id}...`);
  
  const botProcess = spawn('node', [
    path.join(__dirname, 'botProcess.js'),
    bot.token,
    JSON.stringify(bot.editorState)
  ]);

  return new Promise((resolve, reject) => {
    let isResolved = false;
    let startTimeout;

    const cleanup = () => {
      clearTimeout(startTimeout);
      botProcess.stdout.removeAllListeners();
      botProcess.stderr.removeAllListeners();
      botProcess.removeAllListeners('exit');
    };

    botProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Bot ${bot.id} output:`, output);
      
      if (output.includes('Bot started successfully')) {
        isResolved = true;
        cleanup();
        resolve(botProcess);
      }
    });

    botProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`Bot ${bot.id} error:`, error);
    });

    botProcess.on('exit', (code) => {
      if (!isResolved) {
        cleanup();
        reject(new Error(`Bot process exited with code ${code}`));
      }
    });

    startTimeout = setTimeout(() => {
      if (!isResolved) {
        cleanup();
        console.log(`Bot ${bot.id} launch timeout, assuming it's running`);
        resolve(botProcess);
      }
    }, 20000); // Увеличиваем таймаут до 20 секунд
  });
}

// Обновление состояния конкретного бота
app.put('/api/bots/:id', async (req, res) => {
  try {
    const { name, token, editorState } = req.body;
    console.log('PUT /api/bots/:id - Request body:', { name, token: token ? '***' : 'undefined', editorState });
    
    const state = await readState();
    const botIndex = state.bots.findIndex(b => b.id === req.params.id);
    
    if (botIndex === -1) {
      console.log('Bot not found:', req.params.id);
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    console.log('Found bot at index:', botIndex);

    // Обновляем данные бота
    const updatedBot = {
      ...state.bots[botIndex],
      name: name || state.bots[botIndex].name,
      token: token || state.bots[botIndex].token,
      editorState: editorState || state.bots[botIndex].editorState
    };

    console.log('Updated bot state:', updatedBot);
    state.bots[botIndex] = updatedBot;

    await writeState(state);
    console.log('State saved successfully');
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating bot:', error);
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// Активация бота
app.post('/api/bots/:id/activate', async (req, res) => {
  try {
    console.log('POST /api/bots/:id/activate - Bot ID:', req.params.id);
    
    const state = await readState();
    const bot = state.bots.find(b => b.id === req.params.id);
    
    if (!bot) {
      console.log('Bot not found for activation:', req.params.id);
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    console.log('Found bot for activation:', { id: bot.id, name: bot.name, isActive: bot.isActive });

    // Проверяем токен
    if (!bot.token) {
      console.log('Bot token is missing');
      res.status(400).json({ error: 'Bot token is missing' });
      return;
    }

    // Проверяем состояние редактора
    if (!bot.editorState || !bot.editorState.blocks || !bot.editorState.connections) {
      console.log('Invalid editor state');
      res.status(400).json({ error: 'Invalid editor state' });
      return;
    }

    // Проверяем наличие стартового блока
    const startBlock = bot.editorState.blocks.find(b => b.id === 'start');
    if (!startBlock) {
      console.log('Start block is missing');
      res.status(400).json({ error: 'Missing start block in editor state' });
      return;
    }

    console.log('All validations passed, starting bot activation...');

    // Останавливаем текущий бот, если он запущен
    if (activeProcesses.has(bot.id)) {
      console.log(`Bot ${bot.id} is already running, stopping it first...`);
      await stopBot(bot.id);
      await wait(3000); // Увеличиваем время ожидания
    }

    // Запускаем новый процесс бота
    try {
      console.log(`Starting new bot process for ${bot.id}...`);
      const botProcess = await startBot(bot);
      
      // Сохраняем процесс и обновляем состояние
      activeProcesses.set(bot.id, botProcess);
      state.activeBot = bot.id;
      state.bots = state.bots.map(b => ({
        ...b,
        isActive: b.id === bot.id
      }));
      
      await writeState(state);
      console.log(`Bot ${bot.id} activated successfully`);
      res.json({ success: true });
    } catch (error) {
      console.error(`Error starting bot ${bot.id}:`, error);
      res.status(500).json({ error: error.message });
    }
  } catch (error) {
    console.error('Error in activate endpoint:', error);
    res.status(500).json({ error: 'Failed to activate bot' });
  }
});

// Получение списка ботов
app.get('/api/bots', async (req, res) => {
  try {
    const state = await readState();
    const botsList = state.bots.map(({ id, name, isActive }) => ({ id, name, isActive }));
    res.json({ bots: botsList, activeBot: state.activeBot });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load bots list' });
  }
});

// Создание нового бота
app.post('/api/bots', async (req, res) => {
  try {
    const { name, token } = req.body;
    const state = await readState();
    
    const newBot = {
      id: Date.now().toString(),
      name,
      token,
      isActive: false,
      editorState: {
        blocks: [
          {
            id: 'start',
            type: 'start',
            position: { x: 2500, y: 2500 },
            message: 'Начало диалога',
            buttons: []
          }
        ],
        connections: [],
        pan: { x: 0, y: 0 },
        scale: 1
      }
    };

    state.bots.push(newBot);
    await writeState(state);
    
    res.json({ id: newBot.id, name: newBot.name, isActive: newBot.isActive });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create bot' });
  }
});

// Получение состояния конкретного бота
app.get('/api/bots/:id', async (req, res) => {
  try {
    const state = await readState();
    const bot = state.bots.find(b => b.id === req.params.id);
    if (!bot) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }
    res.json(bot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load bot state' });
  }
});

// Удаление бота
app.delete('/api/bots/:id', async (req, res) => {
  try {
    const state = await readState();
    const botIndex = state.bots.findIndex(b => b.id === req.params.id);
    
    if (botIndex === -1) {
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    // Останавливаем бота если он запущен
    await stopBot(req.params.id);

    // Удаляем бота из списка
    state.bots.splice(botIndex, 1);
    
    // Если удаляем активного бота, сбрасываем activeBot
    if (state.activeBot === req.params.id) {
      state.activeBot = null;
    }

    await writeState(state);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete bot' });
  }
});

// Обработка завершения сервера
async function shutdownServer(signal) {
  console.log(`Received ${signal}, shutting down...`);
  
  // Останавливаем все боты
  for (const [botId] of activeProcesses.entries()) {
    await stopBot(botId);
  }
  
  process.exit(0);
}

process.on('SIGINT', () => shutdownServer('SIGINT'));
process.on('SIGTERM', () => shutdownServer('SIGTERM'));

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 