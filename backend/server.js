const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const mongoose = require('mongoose');
const { QuizStats, Bot, User, PromoCode, Loyalty, LoyaltyConfig, LoyaltyPromoCode } = require('./models');

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
mongoose.connect(MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
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

// Memory storage для промокодов лояльности
const loyaltyPromoCodeUpload = multer({ 
  storage: multer.memoryStorage(),
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
    console.log('📊 Загружаем статистику квизов из MongoDB...');
    
    // Получаем все записи QuizStats из MongoDB
    const quizStatsRecords = await QuizStats.find({});
    console.log(`📊 Найдено ${quizStatsRecords.length} записей в MongoDB`);
    
    // Группируем по blockId (ID квиза)
    const stats = {};
    
    for (const record of quizStatsRecords) {
      const quizId = record.blockId;
      
      if (!stats[quizId]) {
        stats[quizId] = {
          totalAttempts: 0,
          successfulCompletions: 0,
          failedAttempts: 0,
          averageScore: 0,
          userAttempts: []
        };
      }
      
      // Увеличиваем счетчики
      stats[quizId].totalAttempts++;
      
      if (record.percentage === 100) {
        stats[quizId].successfulCompletions++;
      } else {
        stats[quizId].failedAttempts++;
      }
      
      // Получаем информацию о пользователе из User коллекции
      let userInfo = {
        userName: 'Пользователь',
        userLastName: '',
        username: ''
      };
      
      try {
        const user = await User.findOne({ 
          botId: record.botId, 
          userId: record.userId 
        });
        if (user) {
          userInfo = {
            userName: user.firstName || 'Пользователь',
            userLastName: user.lastName || '',
            username: user.username || ''
          };
        }
      } catch (error) {
        console.error('❌ Error fetching user info:', error);
      }
      
      // Получаем промокод, если он был выдан
      let promoCode = '';
      if (record.percentage === 100) {
        try {
          const promo = await PromoCode.findOne({
            botId: record.botId,
            quizId: record.blockId,
            activatedBy: record.userId,
            activated: true
          });
          if (promo) {
            promoCode = promo.code;
          }
        } catch (error) {
          console.error('❌ Error fetching promo code:', error);
        }
      }
      
      // Добавляем попытку пользователя
      stats[quizId].userAttempts.push({
        userId: record.userId,
        userName: userInfo.userName,
        userLastName: userInfo.userLastName,
        username: userInfo.username,
        success: record.percentage === 100,
        score: record.correctAnswers,
        successRate: record.percentage,
        timestamp: record.completedAt.getTime(),
        duration: record.completionTime * 1000, // конвертируем в миллисекунды
        answers: record.answers.map(answer => ({
          selectedAnswer: answer.answer,
          isCorrect: answer.isCorrect
        })),
        promoCode: promoCode
      });
    }
    
    // Вычисляем средний балл для каждого квиза
    Object.keys(stats).forEach(quizId => {
      const quizStats = stats[quizId];
      if (quizStats.userAttempts.length > 0) {
        const totalScore = quizStats.userAttempts.reduce((sum, attempt) => sum + attempt.score, 0);
        quizStats.averageScore = Math.round((totalScore / quizStats.userAttempts.length) * 10) / 10;
      }
    });
    
    console.log(`📊 Сформирована статистика для ${Object.keys(stats).length} квизов`);
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting quiz stats:', error);
    res.status(500).json({ error: 'Failed to get quiz stats' });
  }
});

// Эндпоинт для восстановления статистики из бэкапа (удален - теперь используется MongoDB)

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
    console.log(`🎁 Загружаем промокоды для квиза ${quizId} из MongoDB...`);
    
    // Получаем botId из параметров запроса или из активного бота
    const botId = req.query.botId;
    if (!botId) {
      return res.status(400).json({ error: 'botId не указан' });
    }
    
    // Ищем промокоды для данного квиза и бота
    const promoCodes = await PromoCode.find({ 
      botId: botId,
      quizId: quizId 
    });
    
    console.log(`🎁 Найдено ${promoCodes.length} промокодов для квиза ${quizId}`);
    
    const promoCodesList = promoCodes.map(promo => ({
      code: promo.code,
      user: promo.activatedBy ? promo.activatedBy.toString() : '',
      activated: promo.activated,
      activatedBy: promo.activatedBy || null,
      activatedAt: promo.activatedAt
    }));
    
    const totalPromoCodes = promoCodesList.length;
    const usedPromoCodes = promoCodesList.filter(promo => promo.activated).length;
    const availablePromoCodes = totalPromoCodes - usedPromoCodes;
    
    console.log(`🎁 Статистика промокодов: всего ${totalPromoCodes}, использовано ${usedPromoCodes}, доступно ${availablePromoCodes}`);
    
    res.json({
      quizId: quizId,
      hasPromoCodes: totalPromoCodes > 0,
      totalPromoCodes: totalPromoCodes,
      availablePromoCodes: availablePromoCodes,
      usedPromoCodes: usedPromoCodes,
      promoCodesList: promoCodesList
    });
    
  } catch (error) {
    console.error('❌ Promo codes error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для загрузки файла с промокодами
app.post('/api/upload-promocodes', promoCodeUpload.single('promocodes'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const { quizId, botId } = req.body; // Получаем ID квиза и бота из тела запроса
    if (!quizId) {
      return res.status(400).json({ error: 'ID квиза не указан' });
    }
    if (!botId) {
      return res.status(400).json({ error: 'ID бота не указан' });
    }

    const filePath = req.file.path;
    console.log(`🎁 Загружаем промокоды для квиза ${quizId} и бота ${botId}:`, filePath);

    // Читаем файл и парсим промокоды
    const fs = require('fs');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1); // Пропускаем заголовок
    
    const promoCodes = dataLines.map(line => {
      const [code] = line.split(',').map(field => field.trim());
      return {
        botId: botId,
        code: code,
        quizId: quizId,
        activated: false
      };
    }).filter(item => item.code); // Фильтруем пустые строки

    console.log(`🎁 Найдено ${promoCodes.length} промокодов в файле`);

    // Удаляем старые промокоды для этого квиза и бота
    await PromoCode.deleteMany({ botId: botId, quizId: quizId });
    console.log(`🎁 Удалены старые промокоды для квиза ${quizId}`);

    // Сохраняем новые промокоды в MongoDB
    await PromoCode.insertMany(promoCodes);
    console.log(`🎁 Сохранено ${promoCodes.length} промокодов в MongoDB`);

    // Удаляем временный файл
    fs.unlinkSync(filePath);

    res.json({ 
      success: true, 
      message: `Файл с промокодами успешно загружен для квиза ${quizId}`,
      filename: req.file.originalname,
      quizId: quizId,
      botId: botId,
      count: promoCodes.length
    });
  } catch (error) {
    console.error('❌ Promo codes upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Эндпоинт для удаления промокодов квиза
app.delete('/api/quiz-promocodes/:quizId', async (req, res) => {
  try {
    const { quizId } = req.params;
    const { botId } = req.query;
    
    if (!quizId) {
      return res.status(400).json({ error: 'ID квиза не указан' });
    }
    if (!botId) {
      return res.status(400).json({ error: 'ID бота не указан' });
    }

    console.log(`🎁 Удаляем промокоды для квиза ${quizId} и бота ${botId}`);
    
    // Удаляем промокоды из MongoDB
    const result = await PromoCode.deleteMany({ 
      botId: botId, 
      quizId: quizId 
    });
    
    console.log(`🎁 Удалено ${result.deletedCount} промокодов`);
    
    res.json({ 
      success: true, 
      message: `Промокоды для квиза ${quizId} успешно удалены`,
      quizId: quizId,
      botId: botId,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('❌ Promo codes deletion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Удалены все функции и вызовы, связанные с файлами (writeState, readState, restoreStatsFromBackup, state.json, editorState.json, бэкапы)
// Весь backend теперь работает только с MongoDB

// API для программы лояльности
app.get('/api/loyalty-config/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    
    // Ищем конфигурацию программы лояльности
    const loyaltyConfig = await LoyaltyConfig.findOne({ botId });
    
    if (loyaltyConfig) {
      res.json(loyaltyConfig);
    } else {
      // Возвращаем дефолтную конфигурацию
      res.json({
        isEnabled: false,
        messages: {
          '1m': { enabled: false, message: '' },
          '24h': { enabled: false, message: '' },
          '7d': { enabled: false, message: '' },
          '30d': { enabled: false, message: '' },
          '90d': { enabled: false, message: '' },
          '180d': { enabled: false, message: '' },
          '360d': { enabled: false, message: '' }
        }
      });
    }
  } catch (error) {
    console.error('❌ Error fetching loyalty config:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty config' });
  }
});

app.put('/api/loyalty-config/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const config = req.body;
    
    // Сохраняем или обновляем конфигурацию
    await LoyaltyConfig.updateOne(
      { botId },
      { 
        botId,
        ...config,
        updatedAt: new Date()
      },
      { upsert: true }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error saving loyalty config:', error);
    res.status(500).json({ error: 'Failed to save loyalty config' });
  }
});

app.get('/api/available-promocodes/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    
    // Получаем все промокоды для бота
    const promoCodes = await PromoCode.find({ botId });
    
    res.json(promoCodes);
  } catch (error) {
    console.error('❌ Error fetching promocodes:', error);
    res.status(500).json({ error: 'Failed to fetch promocodes' });
  }
});

// API для промокодов программы лояльности
app.get('/api/loyalty-promocodes/:botId/:period', async (req, res) => {
  try {
    const { botId, period } = req.params;
    
    // Получаем промокоды для конкретного периода
    const promoCodes = await LoyaltyPromoCode.find({ botId, period });
    
    const stats = {
      total: promoCodes.length,
      available: promoCodes.filter(p => !p.activated).length,
      used: promoCodes.filter(p => p.activated).length
    };
    
    res.json({ promoCodes, stats });
  } catch (error) {
    console.error('❌ Error fetching loyalty promocodes:', error);
    res.status(500).json({ error: 'Failed to fetch loyalty promocodes' });
  }
});

app.post('/api/loyalty-promocodes/:botId/:period', loyaltyPromoCodeUpload.single('promocodes'), async (req, res) => {
  try {
    const { botId, period } = req.params;
    
    console.log(`[LOYALTY] Загрузка промокодов для бота ${botId}, периода ${period}`);
    
    if (!req.file) {
      console.log('[LOYALTY] Файл не загружен');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`[LOYALTY] Файл загружен: ${req.file.originalname}, размер: ${req.file.size} bytes`);
    
    // Читаем CSV файл
    const csvContent = req.file.buffer.toString('utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    console.log(`[LOYALTY] Найдено ${lines.length} строк в CSV файле`);
    
    // Удаляем существующие промокоды для этого периода
    const deleteResult = await LoyaltyPromoCode.deleteMany({ botId, period });
    console.log(`[LOYALTY] Удалено ${deleteResult.deletedCount} существующих промокодов`);
    
    // Добавляем новые промокоды
    const promoCodes = lines.map(line => ({
      botId,
      period,
      code: line.trim()
    }));
    
    console.log(`[LOYALTY] Создано ${promoCodes.length} промокодов для вставки`);
    
    const insertResult = await LoyaltyPromoCode.insertMany(promoCodes);
    console.log(`[LOYALTY] Вставлено ${insertResult.length} промокодов в базу данных`);
    
    res.json({ 
      success: true, 
      message: `Загружено ${promoCodes.length} промокодов для периода ${period}` 
    });
  } catch (error) {
    console.error('❌ Error uploading loyalty promocodes:', error);
    res.status(500).json({ error: 'Failed to upload loyalty promocodes' });
  }
});

app.delete('/api/loyalty-promocodes/:botId/:period', async (req, res) => {
  try {
    const { botId, period } = req.params;
    
    await LoyaltyPromoCode.deleteMany({ botId, period });
    
    res.json({ success: true, message: `Промокоды для периода ${period} удалены` });
  } catch (error) {
    console.error('❌ Error deleting loyalty promocodes:', error);
    res.status(500).json({ error: 'Failed to delete loyalty promocodes' });
  }
});

// Старые функции удалены - теперь используется MongoDB напрямую

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

// Глобальная карта активных процессов ботов
const activeProcesses = new Map();

// Мониторинг состояния ботов
setInterval(async () => {
  try {
    console.log(`🔍 Monitoring: ${activeProcesses.size} bots running`);
    
    // Проверяем каждый активный процесс
    for (const [botId, process] of activeProcesses.entries()) {
      if (process.killed || process.exitCode !== null) {
        console.log(`⚠️ Bot ${botId} process is dead, removing from active list`);
        activeProcesses.delete(botId);
        
        // Обновляем статус в БД
        await Bot.updateOne({ id: botId }, { $set: { isActive: false } });
        console.log(`📝 Bot ${botId} marked as inactive in database`);
      }
    }
    
    // Проверяем, есть ли активные боты в БД, которые не запущены
    const activeBotsInDB = await Bot.find({ isActive: true });
    for (const bot of activeBotsInDB) {
      if (!activeProcesses.has(bot.id)) {
        console.log(`🔄 Bot ${bot.id} is active in DB but not running, attempting restart...`);
        try {
          await startBot(bot);
          console.log(`✅ Bot ${bot.id} restarted successfully`);
        } catch (error) {
          console.error(`❌ Failed to restart bot ${bot.id}:`, error);
          // Помечаем бота как неактивного
          await Bot.updateOne({ id: bot.id }, { $set: { isActive: false } });
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in bot monitoring:', error);
  }
}, 30000); // Проверяем каждые 30 секунд

// Получение editorState из MongoDB для запуска botProcess.js
async function startBot(bot) {
  console.log(`Starting bot ${bot.id}...`);
  
  // Проверяем, не запущен ли уже бот
  if (activeProcesses.has(bot.id)) {
    console.log(`Bot ${bot.id} is already running`);
    return activeProcesses.get(bot.id);
  }
  
  // Получаем editorState из MongoDB
  const botDoc = await Bot.findOne({ id: bot.id });
  if (!botDoc) throw new Error('Bot not found in MongoDB');
  
  const botProcess = spawn('node', [
    path.join(__dirname, 'botProcess.js'),
    bot.token,
    bot.id,
    JSON.stringify(botDoc.editorState)
  ]);

  // Сохраняем процесс в карте
  activeProcesses.set(bot.id, botProcess);

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
      console.log(`Bot ${bot.id} process exited with code ${code}`);
      activeProcesses.delete(bot.id);
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

// Функция для остановки бота
async function stopBot(botId) {
  console.log(`Stopping bot ${botId}...`);
  
  const botProcess = activeProcesses.get(botId);
  if (!botProcess) {
    console.log(`Bot ${botId} is not running`);
    return true;
  }

  return new Promise((resolve) => {
    // Обновляем статус в базе данных
    Bot.updateOne({ id: botId }, { $set: { isActive: false } })
      .then(() => {
        console.log(`Bot ${botId} status updated to inactive`);
      })
      .catch(err => {
        console.error(`Error updating bot ${botId} status:`, err);
      });

    // Останавливаем процесс
    botProcess.kill('SIGTERM');
    
    // Ждем завершения процесса
    const timeout = setTimeout(() => {
      console.log(`Bot ${botId} didn't stop gracefully, force killing`);
      botProcess.kill('SIGKILL');
      activeProcesses.delete(botId);
      resolve(true);
    }, 10000);

    botProcess.on('exit', (code) => {
      clearTimeout(timeout);
      activeProcesses.delete(botId);
      console.log(`Bot ${botId} stopped with code ${code}`);
      resolve(true);
    });
  });
}

// Функция для ожидания
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

    // Обновляем статус в базе данных
    await Bot.updateOne({ id: bot.id }, { $set: { isActive: false } });
    
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
    // Добавляем информацию о том, какие боты реально запущены
    const botsWithStatus = bots.map(bot => ({
      ...bot.toObject(),
      isRunning: activeProcesses.has(bot.id)
    }));
    res.json({ bots: botsWithStatus, activeBot: null });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load bots', details: error.message });
  }
});

// Получение статуса конкретного бота
app.get('/api/bots/:id/status', async (req, res) => {
  try {
    const bot = await Bot.findOne({ id: req.params.id });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    const isRunning = activeProcesses.has(bot.id);
    res.json({ 
      id: bot.id, 
      isActive: bot.isActive, 
      isRunning: isRunning,
      status: isRunning ? 'running' : 'stopped'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get bot status', details: error.message });
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
    activeBots: activeProcesses.size,
    totalBots: 0 // Будем получать из MongoDB
  };
  
  // Получаем общее количество ботов
  Bot.countDocuments({})
    .then(count => {
      health.totalBots = count;
      res.json(health);
    })
    .catch(err => {
      console.error('Error getting bot count:', err);
      res.json(health);
    });
});

// Эндпоинт для получения общей статистики системы
app.get('/api/system-stats', async (req, res) => {
  try {
    const totalBots = await Bot.countDocuments({});
    const activeBots = await Bot.countDocuments({ isActive: true });
    const runningBots = activeProcesses.size;
    const totalUsers = await User.countDocuments({});
    const totalQuizStats = await QuizStats.countDocuments({});
    
    res.json({
      bots: {
        total: totalBots,
        active: activeBots,
        running: runningBots
      },
      users: {
        total: totalUsers
      },
      quizzes: {
        total: totalQuizStats
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting system stats:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
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
  
  // Ждем подключения к MongoDB
  await new Promise((resolve) => {
    if (mongoose.connection.readyState === 1) {
      resolve();
    } else {
      mongoose.connection.once('connected', resolve);
    }
  });
  
  console.log('✅ MongoDB connection confirmed, starting initialization...');
  
  // Загружаем активные боты из MongoDB
  try {
    const activeBots = await Bot.find({ isActive: true });
    console.log(`🤖 Loaded ${activeBots.length} active bots from MongoDB`);
    
    // Запускаем все активные боты
    for (const bot of activeBots) {
      try {
        await startBot(bot);
        console.log(`✅ Bot ${bot.id} started successfully`);
      } catch (error) {
        console.error(`❌ Failed to start bot ${bot.id}:`, error);
        // Обновляем статус бота на неактивный в случае ошибки
        await Bot.updateOne({ id: bot.id }, { $set: { isActive: false } });
      }
    }
  } catch (error) {
    console.error('Error loading active bots:', error);
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