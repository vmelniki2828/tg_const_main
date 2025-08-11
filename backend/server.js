const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');

// Загружаем переменные окружения
try {
  require('dotenv').config();
} catch (error) {
  console.log('⚠️ dotenv not available, using default environment variables');
}

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Настройка CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Настройка multer для загрузки файлов
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    // Создаем папку если её нет
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя файла
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Настройка multer для загрузки файлов с промокодами
const promoCodeStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const promoCodeDir = path.join(__dirname, 'promocodes');
    // Создаем папку если её нет
    if (!fs.existsSync(promoCodeDir)) {
      fs.mkdirSync(promoCodeDir, { recursive: true });
    }
    cb(null, promoCodeDir);
  },
  filename: function (req, file, cb) {
    // Сохраняем оригинальное имя файла
    cb(null, file.originalname);
  }
});

const promoCodeUpload = multer({ 
  storage: promoCodeStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB лимит для CSV файлов
  },
  fileFilter: function (req, file, cb) {
    // Разрешаем только CSV файлы
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только CSV файлы'), false);
    }
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB лимит
  },
  fileFilter: function (req, file, cb) {
    // Разрешаем только изображения, видео, аудио и документы
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/avi', 'video/mov', 'video/wmv',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый тип файла'), false);
    }
  }
});

// Статические файлы для загрузок
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Эндпоинт для загрузки медиафайлов
app.post('/api/upload-media', upload.single('media'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: `/uploads/${req.file.filename}`
    };

    console.log('File uploaded:', fileInfo);
    res.json({ success: true, file: fileInfo });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для удаления медиафайлов
app.delete('/api/delete-media', async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Имя файла не указано' });
    }

    const filePath = path.join(__dirname, 'uploads', filename);
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
      console.log(`File not found for deletion: ${filePath}`);
      return res.json({ success: true, message: 'Файл уже удален или не существует' });
    }

    // Удаляем файл
    await fsPromises.unlink(filePath);
    console.log(`File deleted successfully: ${filename}`);
    
    res.json({ success: true, message: 'Файл успешно удален' });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Ошибка при удалении файла' });
  }
});

// Эндпоинт для очистки неиспользуемых медиафайлов
app.post('/api/cleanup-unused-media', async (req, res) => {
  try {
    const { usedFilenames } = req.body;
    
    if (!usedFilenames || !Array.isArray(usedFilenames)) {
      return res.status(400).json({ error: 'Список используемых файлов не указан' });
    }

    const uploadsDir = path.join(__dirname, 'uploads');
    
    // Проверяем существование папки uploads
    if (!fs.existsSync(uploadsDir)) {
      return res.json({ success: true, message: 'Папка uploads не существует', deletedCount: 0 });
    }

    // Получаем список всех файлов в папке uploads
    const files = await fsPromises.readdir(uploadsDir);
    const usedFilenamesSet = new Set(usedFilenames);
    
    let deletedCount = 0;
    const errors = [];

    // Удаляем файлы, которые не используются
    for (const file of files) {
      if (!usedFilenamesSet.has(file)) {
        try {
          const filePath = path.join(uploadsDir, file);
          await fsPromises.unlink(filePath);
          console.log(`Unused file deleted: ${file}`);
          deletedCount++;
        } catch (error) {
          console.error(`Error deleting unused file ${file}:`, error);
          errors.push({ file, error: error.message });
        }
      }
    }

    res.json({ 
      success: true, 
      message: `Очистка завершена. Удалено файлов: ${deletedCount}`,
      deletedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error cleaning up unused media:', error);
    res.status(500).json({ error: 'Ошибка при очистке неиспользуемых файлов' });
  }
});

// Эндпоинт для получения статистики квизов
app.get('/api/quiz-stats', async (req, res) => {
  try {
    const stats = await readQuizStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting quiz stats:', error);
    res.status(500).json({ error: 'Failed to get quiz stats' });
  }
});

// Эндпоинт для восстановления статистики из бэкапа
app.post('/api/restore-stats', async (req, res) => {
  try {
    const restored = await restoreStatsFromBackup();
    if (restored) {
      res.json({ success: true, message: 'Статистика восстановлена из бэкапа' });
    } else {
      res.status(404).json({ error: 'Бэкап не найден' });
    }
  } catch (error) {
    console.error('Error restoring stats:', error);
    res.status(500).json({ error: 'Failed to restore stats' });
  }
});

// Эндпоинт для добавления статистики квиза (от ботов)
app.post('/api/quiz-stats', async (req, res) => {
  try {
    console.log('📊 Получена статистика от бота:', req.body);
    const { quizId, userAttempt } = req.body;
    
    const stats = await readQuizStats();
    
    if (!stats[quizId]) {
      stats[quizId] = {
        totalAttempts: 0,
        successfulCompletions: 0,
        failedAttempts: 0,
        userAttempts: []
      };
    }
    
    const quizStats = stats[quizId];
    quizStats.totalAttempts++;
    
    if (userAttempt.success) {
      quizStats.successfulCompletions++;
    } else {
      quizStats.failedAttempts++;
    }
    
    // Добавляем полную информацию о попытке пользователя
    quizStats.userAttempts.push(userAttempt);
    
    // Ограничиваем количество попыток в истории (максимум 1000)
    if (quizStats.userAttempts.length > 1000) {
      quizStats.userAttempts = quizStats.userAttempts.slice(-1000);
    }
    
    await writeQuizStats(stats);
    console.log(`✅ Статистика для квиза ${quizId} обновлена через API`);
    console.log(`📊 Добавлена попытка пользователя ${userAttempt.userName} (${userAttempt.userId})`);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error adding quiz stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для получения статистики промокодов конкретного квиза
app.get('/api/quiz-promocodes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    
    // Путь к файлу промокодов квиза
    const promoCodesPath = path.join(__dirname, 'promocodes', `quiz_${quizId}.csv`);
    
    if (!fs.existsSync(promoCodesPath)) {
      return res.json({
        quizId: quizId,
        hasPromoCodes: false,
        totalPromoCodes: 0,
        availablePromoCodes: 0,
        usedPromoCodes: 0,
        promoCodesList: []
      });
    }
    
    // Читаем файл промокодов
    const fileContent = fs.readFileSync(promoCodesPath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // Пропускаем заголовок
    
    const promoCodesList = dataLines.map(line => {
      const [code, user, activated] = line.split(',').map(field => field.trim());
      return {
        code: code,
        user: user || '',
        activated: activated === '1' || activated === 'true',
        activatedBy: activated === '1' || activated === 'true' ? user : null
      };
    }).filter(item => item.code); // Фильтруем пустые строки
    
    const totalPromoCodes = promoCodesList.length;
    const usedPromoCodes = promoCodesList.filter(pc => pc.activated).length;
    const availablePromoCodes = totalPromoCodes - usedPromoCodes;
    
    res.json({
      quizId: quizId,
      hasPromoCodes: true,
      totalPromoCodes: totalPromoCodes,
      availablePromoCodes: availablePromoCodes,
      usedPromoCodes: usedPromoCodes,
      promoCodesList: promoCodesList
    });
    
  } catch (error) {
    console.error('Error reading promo codes stats:', error);
    res.status(500).json({ error: 'Ошибка чтения статистики промокодов' });
  }
});

// Эндпоинт для загрузки файла с промокодами
app.post('/api/upload-promocodes', promoCodeUpload.single('promocodes'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const { quizId } = req.body; // Получаем ID квиза из тела запроса
    if (!quizId) {
      return res.status(400).json({ error: 'ID квиза не указан' });
    }

    const filePath = req.file.path;
    console.log(`Promo codes file uploaded for quiz ${quizId}:`, filePath);

    // Импортируем функции для работы с промокодами
    const { loadPromoCodesFromFile } = require('./promoCodeManager');
    
    // Загружаем промокоды из файла для конкретного квиза
    const success = loadPromoCodesFromFile(filePath, quizId);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Файл с промокодами успешно загружен для квиза ${quizId}`,
        filename: req.file.originalname,
        path: filePath,
        quizId: quizId
      });
    } else {
      res.status(400).json({ 
        error: 'Ошибка при загрузке промокодов из файла' 
      });
    }
  } catch (error) {
    console.error('Promo codes upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для удаления промокодов квиза
app.delete('/api/quiz-promocodes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    
    if (!quizId) {
      return res.status(400).json({ error: 'ID квиза не указан' });
    }

    // Импортируем функцию для удаления промокодов
    const { deleteQuizPromoCodes } = require('./promoCodeManager');
    
    const success = deleteQuizPromoCodes(quizId);
    
    if (success) {
      res.json({ 
        success: true, 
        message: `Промокоды для квиза ${quizId} успешно удалены`,
        quizId: quizId
      });
    } else {
      res.status(500).json({ 
        error: 'Ошибка при удалении промокодов квиза' 
      });
    }
  } catch (error) {
    console.error('Promo codes deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Храним активные процессы ботов
const activeProcesses = new Map();

// Файл для хранения статистики квизов
const QUIZ_STATS_FILE = path.join(__dirname, 'quizStats.json');

const STATE_FILE = path.join(__dirname, 'editorState.json');

// Функция для ожидания
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Вспомогательная функция для чтения состояния
async function readState() {
  try {
    const data = await fsPromises.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading state:', error);
    return {
      bots: [],
      activeBot: null
    };
  }
}

// Функции для работы со статистикой квизов
async function readQuizStats() {
  try {
    console.log('📊 Читаем файл статистики:', QUIZ_STATS_FILE);
    
    // Проверяем существование файла
    if (!fs.existsSync(QUIZ_STATS_FILE)) {
      console.log('❌ Файл статистики не существует, создаем пустой');
      await fsPromises.writeFile(QUIZ_STATS_FILE, '{}');
      return {};
    }
    
    const data = await fsPromises.readFile(QUIZ_STATS_FILE, 'utf8');
    console.log('📄 Содержимое файла:', data);
    
    if (!data || data.trim() === '') {
      console.log('❌ Файл статистики пустой, возвращаем пустой объект');
      return {};
    }
    
    const stats = JSON.parse(data);
    console.log('📊 Статистика прочитана успешно, квизов:', Object.keys(stats).length);
    console.log('📊 Ключи квизов:', Object.keys(stats));
    return stats;
  } catch (error) {
    console.error('❌ Error reading quiz stats:', error);
    console.log('📊 Возвращаем пустую статистику');
    return {};
  }
}

// Функция для восстановления статистики из бэкапа
async function restoreStatsFromBackup() {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      console.log('📁 Папка бэкапов не существует');
      return false;
    }
    
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('quizStats-backup-') && file.endsWith('.json'))
      .sort()
      .reverse();
    
    if (backupFiles.length === 0) {
      console.log('📁 Бэкапы не найдены');
      return false;
    }
    
    const latestBackup = backupFiles[0];
    const backupPath = path.join(backupDir, latestBackup);
    
    console.log(`📁 Восстанавливаем из бэкапа: ${latestBackup}`);
    
    const backupData = await fsPromises.readFile(backupPath, 'utf8');
    const backupStats = JSON.parse(backupData);
    
    // Восстанавливаем статистику
    await fsPromises.writeFile(QUIZ_STATS_FILE, JSON.stringify(backupStats, null, 2));
    
    console.log(`✅ Статистика восстановлена из бэкапа: ${latestBackup}`);
    console.log(`📊 Восстановлено квизов: ${Object.keys(backupStats).length}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error restoring from backup:', error);
    return false;
  }
}

async function writeQuizStats(stats) {
  try {
    console.log('📝 Записываем статистику в файл:', QUIZ_STATS_FILE);
    console.log('📊 Данные для записи:', JSON.stringify(stats, null, 2));
    
    await fsPromises.writeFile(QUIZ_STATS_FILE, JSON.stringify(stats, null, 2));
    
    // Проверяем, что файл записался
    if (fs.existsSync(QUIZ_STATS_FILE)) {
      const savedData = await fsPromises.readFile(QUIZ_STATS_FILE, 'utf8');
      console.log('✅ Файл записан успешно, размер:', savedData.length, 'символов');
    } else {
      console.log('❌ Файл не был создан!');
    }
  } catch (error) {
    console.error('❌ Error writing quiz stats:', error);
    console.error('❌ Stack trace:', error.stack);
  }
}

// Вспомогательная функция для сохранения состояния
async function writeState(state) {
  try {
    await fsPromises.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
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

// Деактивация бота
app.post('/api/bots/:id/deactivate', async (req, res) => {
  try {
    console.log('POST /api/bots/:id/deactivate - Bot ID:', req.params.id);
    
    const state = await readState();
    const bot = state.bots.find(b => b.id === req.params.id);
    
    if (!bot) {
      console.log('Bot not found for deactivation:', req.params.id);
      res.status(404).json({ error: 'Bot not found' });
      return;
    }

    console.log('Found bot for deactivation:', { id: bot.id, name: bot.name, isActive: bot.isActive });

    // Останавливаем бота
    await stopBot(bot.id);
    await wait(1000); // Даем время на остановку

    // Обновляем состояние
    state.bots = state.bots.map(b => ({
      ...b,
      isActive: b.id === bot.id ? false : b.isActive
    }));

    if (state.activeBot === bot.id) {
      state.activeBot = null;
    }

    await writeState(state);
    console.log(`Bot ${bot.id} deactivated successfully`);
    res.json({ success: true });
  } catch (error) {
    console.error('Error in deactivate endpoint:', error);
    res.status(500).json({ error: 'Failed to deactivate bot' });
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
            buttons: [],
            mediaFiles: null
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

// Экспорт статистики квизов в XLSX файл
app.post('/api/export-quiz-stats', async (req, res) => {
  try {
    const { stats, promoCodesStats, blocks } = req.body;
    
    console.log(`📊 Starting XLSX export with ${blocks.length} quizzes and ${Object.keys(stats).length} stats entries`);
    
    // Подсчитываем общее количество записей для прогресс-бара
    const totalAttemptsCount = Object.values(stats).reduce((sum, quiz) => sum + (quiz.userAttempts?.length || 0), 0);
    const totalPromosCount = Object.values(promoCodesStats).reduce((sum, quiz) => sum + (quiz.promoCodesList?.length || 0), 0);
    
    console.log(`📊 Total records to process: ${totalAttemptsCount} attempts + ${totalPromosCount} promocodes`);
    
    // Проверяем наличие библиотеки ExcelJS
    let ExcelJS;
    try {
      ExcelJS = require('exceljs');
      console.log('✅ ExcelJS library loaded successfully');
    } catch (excelError) {
      console.error('❌ Error loading ExcelJS library:', excelError);
      throw new Error(`ExcelJS library not available: ${excelError.message}`);
    }
    
    // Импортируем ExcelJS
    const workbook = new ExcelJS.Workbook();
    
    // Создаем лист "Общая статистика"
    const overviewSheet = workbook.addWorksheet('Общая статистика');
    
    // Заголовки для общей статистики
    overviewSheet.columns = [
      { header: 'Дата экспорта', key: 'exportDate', width: 20 },
      { header: 'Количество квизов', key: 'quizCount', width: 15 },
      { header: 'Всего попыток', key: 'totalAttempts', width: 15 },
      { header: 'Успешных попыток', key: 'successfulAttempts', width: 18 },
      { header: 'Неудачных попыток', key: 'failedAttempts', width: 18 },
      { header: 'Общая успешность (%)', key: 'overallSuccessRate', width: 20 }
    ];
    
    const totalAttempts = Object.values(stats).reduce((sum, quiz) => sum + quiz.totalAttempts, 0);
    const totalSuccessful = Object.values(stats).reduce((sum, quiz) => sum + quiz.successfulCompletions, 0);
    const totalFailed = Object.values(stats).reduce((sum, quiz) => sum + quiz.failedAttempts, 0);
    const overallSuccessRate = totalAttempts > 0 ? ((totalSuccessful / totalAttempts) * 100).toFixed(1) : 0;
    
    overviewSheet.addRow({
      exportDate: new Date().toLocaleString('ru-RU'),
      quizCount: blocks.length,
      totalAttempts: totalAttempts,
      successfulAttempts: totalSuccessful,
      failedAttempts: totalFailed,
      overallSuccessRate: overallSuccessRate
    });
    
    // Создаем лист "Статистика по квизам"
    const quizStatsSheet = workbook.addWorksheet('Статистика по квизам');
    
    quizStatsSheet.columns = [
      { header: 'ID квиза', key: 'quizId', width: 15 },
      { header: 'Название квиза', key: 'quizName', width: 30 },
      { header: 'Количество вопросов', key: 'questionCount', width: 18 },
      { header: 'Всего попыток', key: 'totalAttempts', width: 15 },
      { header: 'Успешных попыток', key: 'successfulAttempts', width: 18 },
      { header: 'Неудачных попыток', key: 'failedAttempts', width: 18 },
      { header: 'Успешность (%)', key: 'successRate', width: 15 },
      { header: 'Всего промокодов', key: 'totalPromoCodes', width: 18 },
      { header: 'Доступных промокодов', key: 'availablePromoCodes', width: 20 },
      { header: 'Выданных промокодов', key: 'usedPromoCodes', width: 20 }
    ];
    
    blocks.forEach(quiz => {
      const quizStats = stats[quiz.id] || {
        totalAttempts: 0,
        successfulCompletions: 0,
        failedAttempts: 0,
        userAttempts: []
      };
      
      const promoStats = promoCodesStats[quiz.id] || {
        hasPromoCodes: false,
        totalPromoCodes: 0,
        availablePromoCodes: 0,
        usedPromoCodes: 0,
        promoCodesList: []
      };
      
      const successRate = quizStats.totalAttempts > 0 
        ? ((quizStats.successfulCompletions / quizStats.totalAttempts) * 100).toFixed(1) 
        : 0;
      
      quizStatsSheet.addRow({
        quizId: quiz.id,
        quizName: quiz.message || `Квиз ${quiz.id}`,
        questionCount: quiz.questions?.length || 0,
        totalAttempts: quizStats.totalAttempts,
        successfulAttempts: quizStats.successfulCompletions,
        failedAttempts: quizStats.failedAttempts,
        successRate: successRate,
        totalPromoCodes: promoStats.totalPromoCodes,
        availablePromoCodes: promoStats.availablePromoCodes,
        usedPromoCodes: promoStats.usedPromoCodes
      });
    });
    
    // Создаем лист "Попытки пользователей"
    const userAttemptsSheet = workbook.addWorksheet('Попытки пользователей');
    
    userAttemptsSheet.columns = [
      { header: 'ID квиза', key: 'quizId', width: 15 },
      { header: 'Название квиза', key: 'quizName', width: 30 },
      { header: 'ID пользователя', key: 'userId', width: 15 },
      { header: 'Имя пользователя', key: 'userName', width: 20 },
      { header: 'Фамилия пользователя', key: 'userLastName', width: 20 },
      { header: 'Username', key: 'username', width: 15 },
      { header: 'Дата попытки', key: 'attemptDate', width: 20 },
      { header: 'Результат', key: 'result', width: 12 },
      { header: 'Баллы', key: 'score', width: 10 },
      { header: 'Процент успешности', key: 'successRate', width: 18 },
      { header: 'Время прохождения (сек)', key: 'duration', width: 22 },
      { header: 'Полученный промокод', key: 'promoCode', width: 20 },
      { header: 'Ответы пользователя', key: 'answers', width: 50 }
    ];
    
    let totalAttemptsProcessed = 0;
    
    blocks.forEach(quiz => {
      const quizStats = stats[quiz.id] || { userAttempts: [] };
      
      console.log(`📊 Processing quiz ${quiz.id}: ${quizStats.userAttempts.length} attempts`);
      
      // Обрабатываем ВСЕ попытки без ограничений
      quizStats.userAttempts.forEach((attempt, index) => {
        // Показываем прогресс каждые 1000 записей
        if (totalAttemptsProcessed > 0 && totalAttemptsProcessed % 1000 === 0) {
          console.log(`📊 Progress: ${totalAttemptsProcessed}/${totalAttemptsCount} attempts processed`);
        }
        
        // Формируем строку с ответами пользователя (ограничиваем длину для производительности)
        const answersString = attempt.answers ? 
          attempt.answers.slice(0, 20).map((answer, index) => 
            `Вопрос ${index + 1}: ${answer.selectedAnswer.substring(0, 100)} (${answer.isCorrect ? 'Правильно' : 'Неправильно'})`
          ).join('; ') : '';
        
        userAttemptsSheet.addRow({
          quizId: quiz.id,
          quizName: quiz.message || `Квиз ${quiz.id}`,
          userId: attempt.userId,
          userName: (attempt.userName || `Пользователь ${attempt.userId}`).substring(0, 100),
          userLastName: (attempt.userLastName || '').substring(0, 100),
          username: attempt.username ? `@${attempt.username}` : '',
          attemptDate: new Date(attempt.timestamp).toLocaleString('ru-RU'),
          result: attempt.success ? 'Успешно' : 'Неудачно',
          score: attempt.score !== undefined ? `${attempt.score}/${quiz.questions?.length || 0}` : '',
          successRate: attempt.successRate ? `${attempt.successRate.toFixed(1)}%` : '',
          duration: attempt.duration ? Math.round(attempt.duration / 1000) : '',
          promoCode: attempt.promoCode || '',
          answers: answersString.substring(0, 1000) // Увеличиваем лимит для ответов
        });
        
        totalAttemptsProcessed++;
      });
    });
    
    console.log(`📊 All attempts processed: ${totalAttemptsProcessed}/${totalAttemptsCount}`);
    
    // Создаем лист "Промокоды"
    const promoCodesSheet = workbook.addWorksheet('Промокоды');
    
    promoCodesSheet.columns = [
      { header: 'ID квиза', key: 'quizId', width: 15 },
      { header: 'Название квиза', key: 'quizName', width: 30 },
      { header: 'Промокод', key: 'promoCode', width: 20 },
      { header: 'Статус', key: 'status', width: 12 },
      { header: 'Выдан пользователю', key: 'activatedBy', width: 20 },
      { header: 'Дата выдачи', key: 'activatedAt', width: 20 }
    ];
    
    let totalPromosProcessed = 0;
    
    blocks.forEach(quiz => {
      const promoStats = promoCodesStats[quiz.id] || { promoCodesList: [] };
      
      console.log(`📊 Processing promocodes for quiz ${quiz.id}: ${promoStats.promoCodesList.length} promocodes`);
      
      // Обрабатываем ВСЕ промокоды без ограничений
      promoStats.promoCodesList.forEach((promo, index) => {
        // Показываем прогресс каждые 1000 записей
        if (totalPromosProcessed > 0 && totalPromosProcessed % 1000 === 0) {
          console.log(`📊 Progress: ${totalPromosProcessed}/${totalPromosCount} promocodes processed`);
        }
        
        promoCodesSheet.addRow({
          quizId: quiz.id,
          quizName: quiz.message || `Квиз ${quiz.id}`,
          promoCode: promo.code,
          status: promo.activated ? 'Использован' : 'Доступен',
          activatedBy: promo.activatedBy || '',
          activatedAt: promo.activatedAt ? new Date(promo.activatedAt).toLocaleString('ru-RU') : ''
        });
        
        totalPromosProcessed++;
      });
    });
    
    console.log(`📊 All promocodes processed: ${totalPromosProcessed}/${totalPromosCount}`);
    
    // Применяем стили к заголовкам
    [overviewSheet, quizStatsSheet, userAttemptsSheet, promoCodesSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
    });
    
    // Генерируем XLSX файл
    const buffer = await workbook.xlsx.writeBuffer();
    
    console.log(`📊 XLSX file generated, size: ${Math.round(buffer.length / 1024)}KB`);
    
    // Устанавливаем заголовки для скачивания XLSX файла
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="quiz-stats-${new Date().toISOString().split('T')[0]}.xlsx"`);
    
    // Отправляем XLSX данные
    res.send(buffer);
    
  } catch (error) {
    console.error('Error exporting quiz stats to XLSX:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code
    });
    res.status(500).json({ 
      error: 'Ошибка при экспорте статистики',
      details: error.message 
    });
  }
});

// Тестовый endpoint для проверки ExcelJS
app.get('/api/test-excel', async (req, res) => {
  try {
    console.log('🧪 Testing ExcelJS library...');
    
    let ExcelJS;
    try {
      ExcelJS = require('exceljs');
      console.log('✅ ExcelJS library loaded successfully');
    } catch (excelError) {
      console.error('❌ Error loading ExcelJS library:', excelError);
      return res.status(500).json({ 
        error: 'ExcelJS library not available',
        details: excelError.message 
      });
    }
    
    // Создаем простой тестовый файл
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Test');
    
    worksheet.columns = [
      { header: 'Test Column', key: 'test', width: 15 }
    ];
    
    worksheet.addRow({ test: 'Test Data' });
    
    const buffer = await workbook.xlsx.writeBuffer();
    console.log('✅ Test XLSX file generated successfully');
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="test.xlsx"');
    res.send(buffer);
    
  } catch (error) {
    console.error('❌ Error in test Excel endpoint:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeUsers: 0 // Будем получать из botProcess.js позже
  };
  
  res.json(health);
});

// API endpoint для получения статистики ботов

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

// Запускаем сервер
app.listen(PORT, HOST, async () => {
  console.log(`🚀 Server running on ${HOST}:${PORT}`);
  
  // Пытаемся восстановить статистику из бэкапа при запуске
  try {
    const stats = await readQuizStats();
    if (Object.keys(stats).length === 0) {
      console.log('📊 Статистика пустая, пытаемся восстановить из бэкапа...');
      const restored = await restoreStatsFromBackup();
      if (restored) {
        console.log('✅ Статистика восстановлена из бэкапа при запуске');
      } else {
        console.log('📊 Бэкап не найден, начинаем с пустой статистики');
      }
    } else {
      console.log(`📊 Загружена статистика: ${Object.keys(stats).length} квизов`);
    }
  } catch (error) {
    console.error('❌ Error during startup stats check:', error);
  }
  
  // Загружаем состояние ботов
  try {
    const state = await readState();
    console.log(`🤖 Loaded ${state.bots.length} bots from state`);
    
    // Запускаем все боты
    for (const bot of state.bots) {
      if (bot.active) {
        await startBot(bot);
      }
    }
  } catch (error) {
    console.error('Error loading state:', error);
  }
}); 