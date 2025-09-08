const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const mongoose = require('mongoose');
const { QuizStats, Bot, User, PromoCode, Loyalty } = require('./models');

// Загружаем переменные окружения
try {
  require('dotenv').config();
} catch (error) {
  console.log('⚠️ dotenv not available, using default environment variables');
}

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '0.0.0.0';

// Подключение к MongoDB
const MONGO_URI = 'mongodb://157.230.20.252:27017/tg_const_main';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

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

// Удалены все функции и вызовы, связанные с файлами (writeState, readState, restoreStatsFromBackup, state.json, editorState.json, бэкапы)
// Весь backend теперь работает только с MongoDB

// Заменить функции readQuizStats и writeQuizStats на работу с MongoDB
async function readQuizStats() {
  try {
    const statsArr = await QuizStats.find({});
    const stats = {};
    statsArr.forEach(qs => {
      stats[qs.quizId] = {
        userAttempts: qs.attempts,
        totalAttempts: qs.attempts.length,
        successfulCompletions: qs.attempts.filter(a => a.success).length,
        failedAttempts: qs.attempts.filter(a => !a.success).length
      };
    });
    return stats;
  } catch (error) {
    console.error('❌ Error reading quiz stats from MongoDB:', error);
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
    for (const quizId in stats) {
      const quizStats = stats[quizId];
      await QuizStats.updateOne(
        { quizId },
        { $set: { quizId, attempts: quizStats.userAttempts } },
        { upsert: true }
      );
    }
    console.log('📝 Статистика квизов сохранена в MongoDB');
  } catch (error) {
    console.error('❌ Error writing quiz stats to MongoDB:', error);
  }
}

// Получение editorState из MongoDB для запуска botProcess.js
async function startBot(bot) {
  console.log(`Starting bot ${bot.id}...`);
  // Получаем editorState из MongoDB
  const botDoc = await Bot.findOne({ id: bot.id });
  if (!botDoc) throw new Error('Bot not found in MongoDB');
  const botProcess = spawn('node', [
    path.join(__dirname, 'botProcess.js'),
    bot.token,
    bot.id,
    JSON.stringify(botDoc.editorState)
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

// Обновление editorState только в MongoDB
app.put('/api/bots/:id', async (req, res) => {
  try {
    const { name, token, editorState } = req.body;
    // Обновить в MongoDB
    await Bot.updateOne(
      { id: req.params.id },
      { $set: {
        name,
        token,
        editorState
      }}
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update bot' });
  }
});

// Активация бота
app.post('/api/bots/:id/activate', async (req, res) => {
  try {
    const bot = await Bot.findOne({ id: req.params.id });
    if (!bot) {
      console.error('Bot not found for activation:', req.params.id);
      return res.status(404).json({ error: 'Bot not found' });
    }
    if (!bot.token) {
      console.error('Bot token is missing for activation:', req.params.id);
      return res.status(400).json({ error: 'Bot token is missing' });
    }
    if (!bot.editorState || !bot.editorState.blocks || !bot.editorState.connections) {
      console.error('Invalid editor state for activation:', req.params.id, bot.editorState);
      return res.status(400).json({ error: 'Invalid editor state' });
    }
    // Обновляем isActive в базе
    await Bot.updateOne({ id: req.params.id }, { $set: { isActive: true } });
    console.log('All validations passed, starting bot activation for:', req.params.id);
    try {
      await startBot(bot);
      console.log('Bot process started successfully for:', req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error starting bot process:', error);
      res.status(500).json({ error: 'Failed to start bot process', details: error.message });
    }
  } catch (error) {
    console.error('Error in activate endpoint:', error);
    res.status(500).json({ error: 'Failed to activate bot', details: error.message });
  }
});

// Деактивация бота
app.post('/api/bots/:id/deactivate', async (req, res) => {
  try {
    console.log('POST /api/bots/:id/deactivate - Bot ID:', req.params.id);
    
    const bot = await Bot.findOne({ id: req.params.id });
    
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
    // state.bots = state.bots.map(b => ({
    //   ...b,
    //   isActive: b.id === bot.id ? false : b.isActive
    // }));

    // if (state.activeBot === bot.id) {
    //   state.activeBot = null;
    // }

    // await writeState(state);
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
    const bots = await Bot.find({});
    res.json({ bots, activeBot: null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load bots', details: error.message });
  }
});

// Создание нового бота
app.post('/api/bots', async (req, res) => {
  try {
    const { name, token } = req.body;
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
    // Сохраняем только в MongoDB
    await Bot.create(newBot);
    res.json({ id: newBot.id, name: newBot.name, isActive: newBot.isActive });
  } catch (error) {
    console.error('Failed to create bot:', error);
    res.status(500).json({ error: 'Failed to create bot', details: error.message });
  }
});

// Получение состояния конкретного бота
app.get('/api/bots/:id', async (req, res) => {
  try {
    const bot = await Bot.findOne({ id: req.params.id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    res.json(bot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load bot', details: error.message });
  }
});

// Удаление бота
app.delete('/api/bots/:id', async (req, res) => {
  try {
    const botId = req.params.id;
    const bot = await Bot.findOne({ id: botId });
    if (!bot) {
      console.error('Bot not found for deletion:', botId);
      return res.status(404).json({ error: 'Bot not found' });
    }
    console.log('Deleting bot:', botId);
    try {
      await stopBot(botId);
      console.log('Bot process stopped (if was running):', botId);
    } catch (stopError) {
      console.error('Error stopping bot process:', stopError);
    }
    try {
      await Bot.deleteOne({ id: botId });
      await User.deleteMany({ botId });
      await QuizStats.deleteMany({ botId });
      await PromoCode.deleteMany({ botId });
      await Loyalty.deleteMany({ botId });
      console.log('Bot and all related data deleted from MongoDB:', botId);
      res.json({ success: true });
    } catch (deleteError) {
      console.error('Error deleting bot or related data:', deleteError);
      res.status(500).json({ error: 'Failed to delete bot or related data', details: deleteError.message });
    }
  } catch (error) {
    console.error('Error in delete endpoint:', error);
    res.status(500).json({ error: 'Failed to delete bot', details: error.message });
  }
});

// Экспорт статистики квизов в XLSX файл
app.post('/api/export-quiz-stats', async (req, res) => {
  try {
    const { stats, promoCodesStats, blocks } = req.body;
    const csvSections = [];

    // 1. Общая статистика
    csvSections.push('Общая статистика');
    csvSections.push([
      'Дата экспорта',
      'Количество квизов',
      'Всего попыток',
      'Успешных попыток',
      'Неудачных попыток',
      'Общая успешность (%)'
    ].join(','));
    const totalAttempts = Object.values(stats).reduce((sum, quiz) => sum + quiz.totalAttempts, 0);
    const totalSuccessful = Object.values(stats).reduce((sum, quiz) => sum + quiz.successfulCompletions, 0);
    const totalFailed = Object.values(stats).reduce((sum, quiz) => sum + quiz.failedAttempts, 0);
    const overallSuccessRate = totalAttempts > 0 ? ((totalSuccessful / totalAttempts) * 100).toFixed(1) : 0;
    csvSections.push([
      new Date().toLocaleString('ru-RU'),
      blocks.length,
      totalAttempts,
      totalSuccessful,
      totalFailed,
      overallSuccessRate
    ].join(','));
    csvSections.push('');

    // 2. Статистика по квизам
    csvSections.push('Статистика по квизам');
    csvSections.push([
      'ID квиза',
      'Название квиза',
      'Количество вопросов',
      'Всего попыток',
      'Успешных попыток',
      'Неудачных попыток',
      'Успешность (%)',
      'Всего промокодов',
      'Доступных промокодов',
      'Выданных промокодов'
    ].join(','));
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
      csvSections.push([
        quiz.id,
        `"${(quiz.message || `Квиз ${quiz.id}`).replace(/"/g, '""')}"`,
        quiz.questions?.length || 0,
        quizStats.totalAttempts,
        quizStats.successfulCompletions,
        quizStats.failedAttempts,
        successRate,
        promoStats.totalPromoCodes,
        promoStats.availablePromoCodes,
        promoStats.usedPromoCodes
      ].join(','));
    });
    csvSections.push('');

    // 3. Попытки пользователей
    csvSections.push('Попытки пользователей');
    csvSections.push([
      'ID квиза',
      'Название квиза',
      'ID пользователя',
      'Имя пользователя',
      'Фамилия пользователя',
      'Username',
      'Дата попытки',
      'Результат',
      'Баллы',
      'Процент успешности',
      'Время прохождения (сек)',
      'Полученный промокод',
      'Ответы пользователя'
    ].join(','));
    blocks.forEach(quiz => {
      const quizStats = stats[quiz.id] || { userAttempts: [] };
      quizStats.userAttempts.forEach((attempt) => {
        const answersString = attempt.answers ? 
          attempt.answers.slice(0, 20).map((answer, idx) => 
            `Вопрос ${idx + 1}: ${answer.selectedAnswer ? answer.selectedAnswer.replace(/"/g, '""').substring(0, 100) : ''} (${answer.isCorrect ? 'Правильно' : 'Неправильно'})`
          ).join('; ') : '';
        csvSections.push([
          quiz.id,
          `"${(quiz.message || `Квиз ${quiz.id}`).replace(/"/g, '""')}"`,
          attempt.userId,
          `"${(attempt.userName || `Пользователь ${attempt.userId}`).replace(/"/g, '""').substring(0, 100)}"`,
          `"${(attempt.userLastName || '').replace(/"/g, '""').substring(0, 100)}"`,
          attempt.username ? `@${attempt.username}` : '',
          new Date(attempt.timestamp).toLocaleString('ru-RU'),
          attempt.success ? 'Успешно' : 'Неудачно',
          attempt.score !== undefined ? `${attempt.score}/${quiz.questions?.length || 0}` : '',
          attempt.successRate ? `${attempt.successRate.toFixed(1)}%` : '',
          attempt.duration ? Math.round(attempt.duration / 1000) : '',
          attempt.promoCode || '',
          `"${answersString.replace(/"/g, '""').substring(0, 1000)}"`
        ].join(','));
      });
    });
    csvSections.push('');

    // 4. Промокоды
    csvSections.push('Промокоды');
    csvSections.push([
      'ID квиза',
      'Название квиза',
      'Промокод',
      'Статус',
      'Выдан пользователю',
      'Дата выдачи'
    ].join(','));
    blocks.forEach(quiz => {
      const promoStats = promoCodesStats[quiz.id] || { promoCodesList: [] };
      promoStats.promoCodesList.forEach((promo) => {
        csvSections.push([
          quiz.id,
          `"${(quiz.message || `Квиз ${quiz.id}`).replace(/"/g, '""')}"`,
          promo.code,
          promo.activated ? 'Использован' : 'Доступен',
          promo.activatedBy || '',
          promo.activatedAt ? new Date(promo.activatedAt).toLocaleString('ru-RU') : ''
        ].join(','));
      });
    });

    const csvContent = csvSections.join('\r\n');
    const fileName = `quiz-stats-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting quiz stats to CSV:', error);
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

// ВАЖНО: Все операции с User, QuizStats, PromoCode, Loyalty всегда используют botId как фильтр!
// Пример создания пользователя:
// await User.create({ botId, userId, ... });
// Пример поиска пользователей:
// await User.find({ botId });
// Аналогично для QuizStats, PromoCode, Loyalty

// Endpoint /api/bots/:id/full уже реализует правильную агрегацию по botId:
// Возвращает bot, users, quizStats, promoCodes, loyalties — все по botId

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

app.get('/api/bots/:id/full', async (req, res) => {
  try {
    const botId = req.params.id;
    const bot = await Bot.findOne({ id: botId });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    const users = await User.find({ botId });
    const quizStats = await QuizStats.find({ botId });
    const promoCodes = await PromoCode.find({ botId });
    const loyalties = await Loyalty.find({ botId });
    res.json({ bot, users, quizStats, promoCodes, loyalties });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load full bot info', details: error.message });
  }
}); 