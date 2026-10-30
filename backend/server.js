const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const multer = require('multer');
const mongoose = require('mongoose');
const { 
  QuizStats,
  TriviaStats,
  Bot, 
  User, 
  PromoCode, 
  Loyalty, 
  LoyaltyConfig, 
  LoyaltyPromoCode,
  DailyActivityStats,
  BlockStats,
  ButtonStats,
  UserNavigationPath,
  Giveaway
} = require('./models');

// Функция для вычисления эффективного времени подписки (копия из botProcess.js)
const { effectiveTime: getEffectiveSubscriptionTime, PERIODS, safeError } = require('./loyaltyService');
const { service: loyaltyService } = require('./loyaltyRuntime');
const { createLoyaltyJobs, registerLoyaltyJobRoutes } = require('./loyaltyJobs');
const loyaltyJobs = createLoyaltyJobs({ ...require('./models'), service: loyaltyService });

// Функция для автоматической выдачи промокодов пользователям, которые достигли периода
async function distributePromoCodesToEligibleUsers(botId, period) {
  const job = await loyaltyJobs.start(botId, period);
  return { job, totalUsersChecked: 0, usersEligible: 0, promoCodesDistributed: 0, errors: 0, details: [] };
}

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
const MONGO_URI = process.env.MONGO_URI || 'mongodb://157.230.20.252:27017/tg_const_main';
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

// Мониторинг состояния подключения к MongoDB
mongoose.connection.on('connected', () => {
  console.log('🔗 MongoDB подключена');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Ошибка MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ MongoDB отключена');
  console.log('🔄 Попытка переподключения к MongoDB...');
  setTimeout(() => {
    mongoose.connect(MONGO_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000
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
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

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
    fileSize: 100 * 1024 * 1024 // 100MB лимит для CSV файлов (увеличено с 10MB)
  },
  fileFilter: function (req, file, cb) {
    console.log('📁 [MULTER_PROMOCODES] Проверка файла:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Разрешаем только CSV файлы
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      console.log('✅ [MULTER_PROMOCODES] Файл принят:', file.originalname);
      cb(null, true);
    } else {
      console.error('❌ [MULTER_PROMOCODES] Файл отклонен:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        reason: 'Неподдерживаемый тип файла'
      });
      cb(new Error('Разрешены только CSV файлы'), false);
    }
  }
});

// Memory storage для промокодов лояльности
const loyaltyPromoCodeUpload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB лимит для CSV файлов (увеличено с 10MB)
  },
  fileFilter: function (req, file, cb) {
    console.log('📁 [MULTER_LOYALTY] Проверка файла:', {
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    
    // Разрешаем только CSV файлы
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      console.log('✅ [MULTER_LOYALTY] Файл принят:', file.originalname);
      cb(null, true);
    } else {
      console.error('❌ [MULTER_LOYALTY] Файл отклонен:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        reason: 'Неподдерживаемый тип файла'
      });
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

// Middleware для обработки ошибок multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ [MULTER_ERROR] Ошибка multer:', error);
    console.error('❌ [MULTER_ERROR] Детали ошибки:', {
      code: error.code,
      message: error.message,
      field: error.field,
      requestUrl: req.url,
      requestMethod: req.method,
      requestBody: req.body
    });
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ 
        error: 'Файл слишком большой',
        details: `Максимальный размер файла: 100MB`,
        code: error.code
      });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ 
        error: 'Слишком много файлов',
        details: 'Можно загрузить только один файл за раз',
        code: error.code
      });
    }
    
    return res.status(400).json({ 
      error: 'Ошибка загрузки файла',
      details: error.message,
      code: error.code
    });
  }
  
  if (error.message === 'Разрешены только CSV файлы') {
    console.error('❌ [FILE_TYPE_ERROR] Неподдерживаемый тип файла:', error.message);
    console.error('❌ [FILE_TYPE_ERROR] Детали запроса:', {
      requestUrl: req.url,
      requestMethod: req.method,
      requestBody: req.body
    });
    return res.status(400).json({ 
      error: 'Неподдерживаемый тип файла',
      details: 'Разрешены только CSV файлы'
    });
  }
  
  next(error);
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
        } catch (err) {
          console.error('❌ Error fetching promo code:', err);
        }
      }
      
      // Добавляем попытку пользователя (защита от отсутствующих полей в старых записях)
      const answers = Array.isArray(record.answers) ? record.answers : [];
      const completedAt = record.completedAt && typeof record.completedAt.getTime === 'function' ? record.completedAt : new Date();
      const completionTime = typeof record.completionTime === 'number' ? record.completionTime : 0;
      
      stats[quizId].userAttempts.push({
        userId: record.userId,
        userName: userInfo.userName,
        userLastName: userInfo.userLastName,
        username: userInfo.username,
        success: record.percentage === 100,
        score: record.correctAnswers,
        successRate: record.percentage,
        timestamp: completedAt.getTime(),
        duration: completionTime * 1000,
        answers: answers.map(answer => ({
          selectedAnswer: answer && answer.answer,
          isCorrect: answer && answer.isCorrect
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

// Эндпоинт для получения статистики викторин
app.get('/api/trivia-stats', async (req, res) => {
  try {
    const records = await TriviaStats.find({});
    const stats = {};
    for (const record of records) {
      const blockId = record.blockId;
      if (!stats[blockId]) {
        stats[blockId] = {
          totalAttempts: 0,
          successfulCompletions: 0,
          failedAttempts: 0,
          userAttempts: []
        };
      }
      stats[blockId].totalAttempts++;
      if (record.success) {
        stats[blockId].successfulCompletions++;
      } else {
        stats[blockId].failedAttempts++;
      }
      let userInfo = { userName: 'Пользователь', userLastName: '', username: '' };
      try {
        const user = await User.findOne({ botId: record.botId, userId: record.userId });
        if (user) {
          userInfo = {
            userName: user.firstName || 'Пользователь',
            userLastName: user.lastName || '',
            username: user.username || ''
          };
        }
      } catch (e) {
        console.error('❌ Error fetching user for trivia stats:', e);
      }
      const completedAt = record.completedAt && typeof record.completedAt.getTime === 'function' ? record.completedAt : new Date();
      stats[blockId].userAttempts.push({
        userId: record.userId,
        userName: userInfo.userName,
        userLastName: userInfo.userLastName,
        username: userInfo.username,
        success: record.success,
        userAnswer: record.userAnswer || '',
        promoCode: record.promoCode || '',
        timestamp: completedAt.getTime()
      });
    }
    res.json(stats);
  } catch (error) {
    console.error('❌ Error getting trivia stats:', error);
    res.status(500).json({ error: 'Failed to get trivia stats' });
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
    
    // Ограничиваем количество попыток в истории (максимум 10000)
    if (quizStats.userAttempts.length > 10000) {
      quizStats.userAttempts = quizStats.userAttempts.slice(-10000);
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
  console.log('📁 [UPLOAD_PROMOCODES] Начало загрузки промокодов');
  console.log('📁 [UPLOAD_PROMOCODES] Request body:', req.body);
  console.log('📁 [UPLOAD_PROMOCODES] Request file:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size,
    path: req.file.path
  } : 'No file');
  
  try {
    if (!req.file) {
      console.error('❌ [UPLOAD_PROMOCODES] Файл не был загружен');
      console.error('❌ [UPLOAD_PROMOCODES] Request details:', {
        body: req.body,
        files: req.files,
        file: req.file
      });
      return res.status(400).json({ error: 'Файл не был загружен' });
    }

    const { quizId, botId } = req.body; // Получаем ID квиза и бота из тела запроса
    console.log('📁 [UPLOAD_PROMOCODES] Параметры:', { quizId, botId });
    
    if (!quizId) {
      console.error('❌ [UPLOAD_PROMOCODES] ID квиза не указан');
      return res.status(400).json({ error: 'ID квиза не указан' });
    }
    if (!botId) {
      console.error('❌ [UPLOAD_PROMOCODES] ID бота не указан');
      return res.status(400).json({ error: 'ID бота не указан' });
    }

    const filePath = req.file.path;
    console.log(`🎁 [UPLOAD_PROMOCODES] Загружаем промокоды для квиза ${quizId} и бота ${botId}:`, filePath);
    console.log(`🎁 [UPLOAD_PROMOCODES] Информация о файле:`, {
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      path: filePath
    });

    // Читаем файл и парсим промокоды
    const fs = require('fs');
    console.log('📁 [UPLOAD_PROMOCODES] Читаем файл...');
    
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
      console.log(`📁 [UPLOAD_PROMOCODES] Файл прочитан, размер: ${fileContent.length} символов`);
    } catch (readError) {
      console.error('❌ [UPLOAD_PROMOCODES] Ошибка чтения файла:', readError);
      console.error('❌ [UPLOAD_PROMOCODES] Детали ошибки:', {
        message: readError.message,
        code: readError.code,
        errno: readError.errno,
        path: filePath
      });
      throw new Error(`Ошибка чтения файла: ${readError.message}`);
    }
    
    const lines = fileContent.split('\n').filter(line => line.trim());
    console.log(`📁 [UPLOAD_PROMOCODES] Найдено ${lines.length} строк в файле`);
    
    const dataLines = lines.slice(1); // Пропускаем заголовок
    console.log(`📁 [UPLOAD_PROMOCODES] Строк данных (без заголовка): ${dataLines.length}`);
    
    const promoCodes = dataLines.map((line, index) => {
      try {
        const [code] = line.split(',').map(field => field.trim());
        if (!code) {
          console.log(`⚠️ [UPLOAD_PROMOCODES] Пустая строка ${index + 2}: "${line}"`);
          return null;
        }
        return {
          botId: botId,
          code: code,
          quizId: quizId,
          activated: false
        };
      } catch (parseError) {
        console.error(`❌ [UPLOAD_PROMOCODES] Ошибка парсинга строки ${index + 2}: "${line}"`, parseError);
        return null;
      }
    }).filter(item => item); // Фильтруем пустые строки

    console.log(`🎁 [UPLOAD_PROMOCODES] Найдено ${promoCodes.length} валидных промокодов в файле`);

    // Удаляем старые промокоды для этого квиза и бота
    if (!botId || !quizId) {
      throw new Error('botId и quizId обязательны для удаления промокодов');
    }
    console.log(`🎁 [UPLOAD_PROMOCODES] Удаляем старые промокоды для квиза ${quizId} и бота ${botId}`);
    
    let deleteResult;
    try {
      protectFromMassDelete('PromoCode.deleteMany', { botId, quizId });
      deleteResult = await PromoCode.deleteMany({ botId, quizId });
      console.log(`🎁 [UPLOAD_PROMOCODES] Удалено ${deleteResult.deletedCount} старых промокодов`);
    } catch (deleteError) {
      console.error('❌ [UPLOAD_PROMOCODES] Ошибка удаления старых промокодов:', deleteError);
      console.error('❌ [UPLOAD_PROMOCODES] Детали ошибки удаления:', {
        message: deleteError.message,
        code: deleteError.code,
        botId,
        quizId
      });
      throw new Error(`Ошибка удаления старых промокодов: ${deleteError.message}`);
    }

    // Сохраняем новые промокоды в MongoDB с обработкой дубликатов
    let savedCount = 0;
    let skippedCount = 0;
    const errorDetails = []; // Массив для сбора деталей ошибок
    const duplicates = []; // Массив для сбора дубликатов
    const skippedCodes = []; // Массив для сбора пропущенных промокодов
    
    console.log(`🎁 [UPLOAD_PROMOCODES] Начинаем сохранение ${promoCodes.length} промокодов в MongoDB`);
    
    for (const promoCode of promoCodes) {
      try {
        // Проверяем, существует ли уже такой промокод
        const existingPromo = await PromoCode.findOne({ code: promoCode.code });
        
        if (existingPromo) {
          // Это дубликат - обновляем существующий
          const updateResult = await PromoCode.updateOne(
            { code: promoCode.code },
            promoCode,
            { upsert: true }
          );
          savedCount++;
          
          // Записываем информацию о дубликате
          duplicates.push({
            code: promoCode.code,
            existingBotId: existingPromo.botId,
            existingQuizId: existingPromo.quizId,
            newBotId: promoCode.botId,
            newQuizId: promoCode.quizId,
            action: 'updated'
          });
          
          console.log(`🔄 [UPLOAD_PROMOCODES] Обновлен существующий промокод: ${promoCode.code}`);
        } else {
          // Новый промокод - создаем
          const updateResult = await PromoCode.updateOne(
            { code: promoCode.code },
            promoCode,
            { upsert: true }
          );
          savedCount++;
          
          console.log(`✅ [UPLOAD_PROMOCODES] Создан новый промокод: ${promoCode.code}`);
        }
      } catch (error) {
        console.error(`❌ [UPLOAD_PROMOCODES] Ошибка сохранения промокода ${promoCode.code}:`, error);
        console.error(`❌ [UPLOAD_PROMOCODES] Детали ошибки сохранения:`, {
          message: error.message,
          code: error.code,
          promoCode: promoCode.code,
          botId: promoCode.botId,
          quizId: promoCode.quizId
        });
        
        // Собираем детали ошибки для анализа
        errorDetails.push({
          promoCode: promoCode.code,
          error: error.message,
          code: error.code,
          type: error.name
        });
        
        // Собираем информацию о пропущенном промокоде
        skippedCodes.push({
          code: promoCode.code,
          botId: promoCode.botId,
          quizId: promoCode.quizId,
          error: error.message,
          errorCode: error.code,
          errorType: error.name
        });
        
        skippedCount++;
      }
    }
    
    console.log(`🎁 [UPLOAD_PROMOCODES] Сохранено ${savedCount} промокодов в MongoDB, пропущено ${skippedCount}`);
    console.log(`🔄 [UPLOAD_PROMOCODES] Найдено дубликатов: ${duplicates.length}`);
    console.log(`❌ [UPLOAD_PROMOCODES] Пропущенных промокодов: ${skippedCodes.length}`);

    // Удаляем временный файл
    try {
      fs.unlinkSync(filePath);
      console.log(`📁 [UPLOAD_PROMOCODES] Временный файл ${filePath} удален`);
    } catch (unlinkError) {
      console.error('⚠️ [UPLOAD_PROMOCODES] Ошибка удаления временного файла:', unlinkError);
      console.error('⚠️ [UPLOAD_PROMOCODES] Детали ошибки удаления файла:', {
        message: unlinkError.message,
        code: unlinkError.code,
        path: filePath
      });
      // Не прерываем выполнение, так как файл уже обработан
    }

    console.log(`✅ [UPLOAD_PROMOCODES] Загрузка промокодов завершена успешно`);
    console.log(`📊 [UPLOAD_PROMOCODES] Итоговая статистика:`, {
      totalCodes: promoCodes.length,
      savedCount,
      skippedCount,
      duplicatesCount: duplicates.length,
      skippedCodesCount: skippedCodes.length,
      quizId,
      botId,
      filename: req.file.originalname
    });

    // Анализ причин неудачных загрузок
    if (skippedCount > 0) {
      console.log(`⚠️ [UPLOAD_PROMOCODES] АНАЛИЗ ПРИЧИН НЕУДАЧНЫХ ЗАГРУЗОК:`);
      console.log(`📊 [UPLOAD_PROMOCODES] Всего промокодов в файле: ${promoCodes.length}`);
      console.log(`✅ [UPLOAD_PROMOCODES] Успешно загружено: ${savedCount}`);
      console.log(`❌ [UPLOAD_PROMOCODES] Пропущено: ${skippedCount}`);
      console.log(`🔄 [UPLOAD_PROMOCODES] Дубликатов найдено: ${duplicates.length}`);
      console.log(`📈 [UPLOAD_PROMOCODES] Процент успеха: ${Math.round((savedCount / promoCodes.length) * 100)}%`);
      
      if (skippedCount === promoCodes.length) {
        console.log(`🚨 [UPLOAD_PROMOCODES] КРИТИЧЕСКАЯ ПРОБЛЕМА: Не загружен ни один промокод!`);
        console.log(`🔍 [UPLOAD_PROMOCODES] Возможные причины:`);
        console.log(`   - Проблемы с подключением к MongoDB`);
        console.log(`   - Ошибки в схеме данных`);
        console.log(`   - Проблемы с правами доступа к базе данных`);
        console.log(`   - Неправильный формат данных в файле`);
      } else if (skippedCount > savedCount) {
        console.log(`⚠️ [UPLOAD_PROMOCODES] ПРОБЛЕМА: Больше половины промокодов не загружено!`);
        console.log(`🔍 [UPLOAD_PROMOCODES] Возможные причины:`);
        console.log(`   - Дубликаты промокодов в файле`);
        console.log(`   - Проблемы с валидацией данных`);
        console.log(`   - Ошибки в структуре промокодов`);
      } else {
        console.log(`ℹ️ [UPLOAD_PROMOCODES] Частичная загрузка: ${skippedCount} промокодов пропущено`);
        console.log(`🔍 [UPLOAD_PROMOCODES] Возможные причины:`);
        console.log(`   - Дубликаты некоторых промокодов`);
        console.log(`   - Ошибки валидации отдельных записей`);
        console.log(`   - Проблемы с отдельными строками файла`);
      }
      
      // Детальный анализ ошибок
      if (errorDetails.length > 0) {
        console.log(`🔍 [UPLOAD_PROMOCODES] ДЕТАЛЬНЫЙ АНАЛИЗ ОШИБОК:`);
        
        // Группируем ошибки по типам
        const errorGroups = {};
        errorDetails.forEach(err => {
          const key = `${err.type}:${err.code}`;
          if (!errorGroups[key]) {
            errorGroups[key] = { count: 0, examples: [] };
          }
          errorGroups[key].count++;
          if (errorGroups[key].examples.length < 3) {
            errorGroups[key].examples.push(err.promoCode);
          }
        });
        
        Object.keys(errorGroups).forEach(key => {
          const group = errorGroups[key];
          console.log(`   📊 ${key}: ${group.count} ошибок`);
          console.log(`      Примеры промокодов: ${group.examples.join(', ')}`);
        });
        
        // Показываем первые 5 ошибок полностью
        console.log(`🔍 [UPLOAD_PROMOCODES] ПЕРВЫЕ 5 ОШИБОК:`);
        errorDetails.slice(0, 5).forEach((err, index) => {
          console.log(`   ${index + 1}. Промокод: "${err.promoCode}"`);
          console.log(`      Ошибка: ${err.error}`);
          console.log(`      Код: ${err.code}`);
          console.log(`      Тип: ${err.type}`);
        });
        
        if (errorDetails.length > 5) {
          console.log(`   ... и еще ${errorDetails.length - 5} ошибок`);
        }
      }
    } else {
      console.log(`🎉 [UPLOAD_PROMOCODES] ОТЛИЧНО: Все промокоды загружены успешно!`);
      console.log(`📊 [UPLOAD_PROMOCODES] Успешность: 100%`);
    }

    // Логирование дубликатов
    if (duplicates.length > 0) {
      console.log(`🔄 [UPLOAD_PROMOCODES] СПИСОК ДУБЛИКАТОВ:`);
      duplicates.forEach((dup, index) => {
        console.log(`   ${index + 1}. Промокод: "${dup.code}"`);
        console.log(`      Было: бот ${dup.existingBotId}, квиз ${dup.existingQuizId}`);
        console.log(`      Стало: бот ${dup.newBotId}, квиз ${dup.newQuizId}`);
        console.log(`      Действие: ${dup.action}`);
      });
    }

    // Логирование пропущенных промокодов
    if (skippedCodes.length > 0) {
      console.log(`❌ [UPLOAD_PROMOCODES] СПИСОК ПРОПУЩЕННЫХ ПРОМОКОДОВ:`);
      skippedCodes.forEach((skipped, index) => {
        console.log(`   ${index + 1}. Промокод: "${skipped.code}"`);
        console.log(`      Бот: ${skipped.botId}, Квиз: ${skipped.quizId}`);
        console.log(`      Ошибка: ${skipped.error}`);
        console.log(`      Код ошибки: ${skipped.errorCode}`);
        console.log(`      Тип ошибки: ${skipped.errorType}`);
      });
    }

      res.json({ 
        success: true, 
        message: `Файл с промокодами успешно загружен для квиза ${quizId}`,
        filename: req.file.originalname,
      quizId: quizId,
      botId: botId,
      count: savedCount,
      skipped: skippedCount,
      skippedCodes: skippedCodes,
      skippedCodesCount: skippedCodes.length,
      duplicates: duplicates,
      duplicatesCount: duplicates.length,
      statistics: {
        totalCodes: promoCodes.length,
        savedCount,
        skippedCount,
        skippedCodesCount: skippedCodes.length,
        duplicatesCount: duplicates.length,
        successRate: Math.round((savedCount / promoCodes.length) * 100)
      }
    });
  } catch (error) {
    console.error('❌ [UPLOAD_PROMOCODES] Критическая ошибка загрузки промокодов:', error);
    console.error('❌ [UPLOAD_PROMOCODES] Детали критической ошибки:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      requestBody: req.body,
      requestFile: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      } : 'No file'
    });
    
    // Удаляем временный файл в случае ошибки
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`📁 [UPLOAD_PROMOCODES] Временный файл ${req.file.path} удален после ошибки`);
      } catch (unlinkError) {
        console.error('⚠️ [UPLOAD_PROMOCODES] Ошибка удаления временного файла после ошибки:', unlinkError);
      }
    }
    
    res.status(500).json({ 
      error: error.message,
      details: 'Подробности в логах сервера'
    });
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
    if (!botId || !quizId) {
      throw new Error('botId и quizId обязательны для удаления промокодов');
    }
    protectFromMassDelete('PromoCode.deleteMany', { botId, quizId });
    const result = await PromoCode.deleteMany({ 
      botId, 
      quizId 
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

// API для промокодов программы лояльности - УДАЛЕН ДУБЛИРУЮЩИЙСЯ ЭНДПОИНТ
// Используется эндпоинт ниже (строка 3149)

app.post('/api/loyalty-promocodes/:botId/:period', loyaltyPromoCodeUpload.single('promocodes'), async (req, res) => {
  console.log('📁 [LOYALTY_PROMOCODES] Начало загрузки промокодов лояльности');
  console.log('📁 [LOYALTY_PROMOCODES] Параметры:', { botId: req.params.botId, period: req.params.period });
  console.log('📁 [LOYALTY_PROMOCODES] Request body:', req.body);
  console.log('📁 [LOYALTY_PROMOCODES] Request file:', req.file ? {
    fieldname: req.file.fieldname,
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  } : 'No file');
  
  try {
    const { botId, period } = req.params;
    
    console.log(`[LOYALTY] Загрузка промокодов для бота ${botId}, периода ${period}`);
    
    if (!req.file) {
      console.error('❌ [LOYALTY_PROMOCODES] Файл не загружен');
      console.error('❌ [LOYALTY_PROMOCODES] Request details:', {
        body: req.body,
        files: req.files,
        file: req.file
      });
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`[LOYALTY] Файл загружен: ${req.file.originalname}, размер: ${req.file.size} bytes`);
    
    // Читаем CSV файл
    console.log('📁 [LOYALTY_PROMOCODES] Читаем CSV файл из буфера...');
    let csvContent;
    try {
      csvContent = req.file.buffer.toString('utf8');
      console.log(`📁 [LOYALTY_PROMOCODES] CSV файл прочитан, размер: ${csvContent.length} символов`);
    } catch (bufferError) {
      console.error('❌ [LOYALTY_PROMOCODES] Ошибка чтения буфера файла:', bufferError);
      console.error('❌ [LOYALTY_PROMOCODES] Детали ошибки буфера:', {
        message: bufferError.message,
        code: bufferError.code,
        bufferSize: req.file.buffer ? req.file.buffer.length : 'No buffer'
      });
      throw new Error(`Ошибка чтения файла: ${bufferError.message}`);
    }
    
    const lines = csvContent.split('\n').filter(line => line.trim());
    console.log(`[LOYALTY] Найдено ${lines.length} строк в CSV файле`);
    
    // НЕ УДАЛЯЕМ существующие промокоды - добавляем новые к существующему пулу
    console.log(`[LOYALTY_PROMOCODES] Добавляем новые промокоды к существующему пулу для бота ${botId}, периода ${period}`);
    
    // Добавляем новые промокоды - берем только первый столбец (Code)
    console.log(`[LOYALTY_PROMOCODES] Обрабатываем ${lines.length} строк для создания промокодов`);
    
    const promoCodes = lines.map((line, index) => {
      try {
        const trimmedLine = line.trim();
        // Пропускаем заголовки
        if (trimmedLine.toLowerCase().includes('code') && trimmedLine.toLowerCase().includes('user')) {
          console.log(`[LOYALTY] Пропускаем заголовок: "${trimmedLine}"`);
          return null;
        }
        
        // Берем только первый столбец (до первой запятой)
        const code = trimmedLine.split(',')[0].trim();
        if (!code) {
          console.log(`⚠️ [LOYALTY_PROMOCODES] Пустая строка ${index + 1}: "${trimmedLine}"`);
          return null;
        }
        
        console.log(`[LOYALTY] Обработка строки: "${trimmedLine}" -> код: "${code}"`);
        return {
          botId,
          period,
          code: code
        };
      } catch (parseError) {
        console.error(`❌ [LOYALTY_PROMOCODES] Ошибка парсинга строки ${index + 1}: "${line}"`, parseError);
        return null;
      }
    }).filter(promo => promo && promo.code && promo.code.length > 0); // Фильтруем пустые коды и null
    
    console.log(`[LOYALTY] Создано ${promoCodes.length} промокодов для вставки`);
    
    if (promoCodes.length === 0) {
      console.error('❌ [LOYALTY_PROMOCODES] Не найдено валидных промокодов');
      return res.status(400).json({ error: 'Не найдено валидных промокодов' });
    }
    
    // Сохраняем все промокоды в базу данных с обработкой дубликатов
    let savedCount = 0;
    let saveSkippedCount = 0;
    const loyaltyErrorDetails = []; // Массив для сбора деталей ошибок лояльности
    const loyaltyDuplicates = []; // Массив для сбора дубликатов лояльности
    const loyaltySkippedCodes = []; // Массив для сбора пропущенных промокодов лояльности
    
    console.log(`[LOYALTY_PROMOCODES] Начинаем сохранение ${promoCodes.length} промокодов в MongoDB`);
    
    for (const promoCode of promoCodes) {
      try {
        // Проверяем, существует ли уже такой промокод лояльности
        const existingPromo = await LoyaltyPromoCode.findOne({ 
          botId: promoCode.botId, 
          period: promoCode.period, 
          code: promoCode.code 
        });
        
        if (existingPromo) {
          // Это дубликат - просто пропускаем (не загружаем)
          loyaltyDuplicates.push({
            code: promoCode.code,
            botId: promoCode.botId,
            period: promoCode.period,
            action: 'skipped'
          });
          
          console.log(`🔄 [LOYALTY_PROMOCODES] Пропущен дубликат промокода: ${promoCode.code} (уже существует)`);
        } else {
          // Новый промокод - добавляем к существующим
          const newPromoCode = new LoyaltyPromoCode({
            botId: promoCode.botId,
            period: promoCode.period,
            code: promoCode.code,
            activated: false
          });
          await newPromoCode.save();
          savedCount++;
          
          console.log(`✅ [LOYALTY_PROMOCODES] Добавлен новый промокод: ${promoCode.code}`);
        }
  } catch (error) {
        console.error(`❌ [LOYALTY_PROMOCODES] Ошибка сохранения промокода лояльности ${promoCode.code}:`, error);
        console.error(`❌ [LOYALTY_PROMOCODES] Детали ошибки сохранения:`, {
          message: error.message,
          code: error.code,
          promoCode: promoCode.code,
          botId: promoCode.botId,
          period: promoCode.period
        });
        
        // Собираем детали ошибки для анализа
        loyaltyErrorDetails.push({
          promoCode: promoCode.code,
          error: error.message,
          code: error.code,
          type: error.name,
          botId: promoCode.botId,
          period: promoCode.period
        });
        
        // Собираем информацию о пропущенном промокоде лояльности
        loyaltySkippedCodes.push({
          code: promoCode.code,
          botId: promoCode.botId,
          period: promoCode.period,
          error: error.message,
          errorCode: error.code,
          errorType: error.name
        });
        
        saveSkippedCount++;
      }
    }
    
    console.log(`[LOYALTY_PROMOCODES] Сохранено ${savedCount} промокодов в MongoDB, пропущено ${saveSkippedCount}`);
    console.log(`🔄 [LOYALTY_PROMOCODES] Найдено дубликатов лояльности: ${loyaltyDuplicates.length}`);
    console.log(`❌ [LOYALTY_PROMOCODES] Пропущенных промокодов лояльности: ${loyaltySkippedCodes.length}`);
    
    console.log(`✅ [LOYALTY_PROMOCODES] Загрузка промокодов лояльности завершена успешно`);
    console.log(`📊 [LOYALTY_PROMOCODES] Итоговая статистика:`, {
      totalCodes: promoCodes.length,
      savedCount,
      saveSkippedCount,
      duplicatesCount: loyaltyDuplicates.length,
      skippedCodesCount: loyaltySkippedCodes.length,
      botId,
      period,
      filename: req.file.originalname
    });

    // Анализ причин неудачных загрузок промокодов лояльности
    if (saveSkippedCount > 0) {
      console.log(`⚠️ [LOYALTY_PROMOCODES] АНАЛИЗ ПРИЧИН НЕУДАЧНЫХ ЗАГРУЗОК:`);
      console.log(`📊 [LOYALTY_PROMOCODES] Всего промокодов в файле: ${promoCodes.length}`);
      console.log(`✅ [LOYALTY_PROMOCODES] Успешно загружено: ${savedCount}`);
      console.log(`❌ [LOYALTY_PROMOCODES] Пропущено: ${saveSkippedCount}`);
      console.log(`🔄 [LOYALTY_PROMOCODES] Дубликатов найдено: ${loyaltyDuplicates.length}`);
      console.log(`📈 [LOYALTY_PROMOCODES] Процент успеха: ${Math.round((savedCount / promoCodes.length) * 100)}%`);
      
      if (saveSkippedCount === promoCodes.length) {
        console.log(`🚨 [LOYALTY_PROMOCODES] КРИТИЧЕСКАЯ ПРОБЛЕМА: Не загружен ни один промокод лояльности!`);
        console.log(`🔍 [LOYALTY_PROMOCODES] Возможные причины:`);
        console.log(`   - Проблемы с подключением к MongoDB`);
        console.log(`   - Ошибки в схеме LoyaltyPromoCode`);
        console.log(`   - Проблемы с правами доступа к базе данных`);
        console.log(`   - Неправильный формат данных в файле`);
        console.log(`   - Ошибки в индексах базы данных`);
      } else if (saveSkippedCount > savedCount) {
        console.log(`⚠️ [LOYALTY_PROMOCODES] ПРОБЛЕМА: Больше половины промокодов лояльности не загружено!`);
        console.log(`🔍 [LOYALTY_PROMOCODES] Возможные причины:`);
        console.log(`   - Дубликаты промокодов в файле`);
        console.log(`   - Проблемы с валидацией данных`);
        console.log(`   - Ошибки в структуре промокодов`);
        console.log(`   - Конфликты с существующими промокодами`);
      } else {
        console.log(`ℹ️ [LOYALTY_PROMOCODES] Частичная загрузка: ${saveSkippedCount} промокодов лояльности пропущено`);
        console.log(`🔍 [LOYALTY_PROMOCODES] Возможные причины:`);
        console.log(`   - Дубликаты некоторых промокодов`);
        console.log(`   - Ошибки валидации отдельных записей`);
        console.log(`   - Проблемы с отдельными строками файла`);
        console.log(`   - Конфликты с существующими промокодами`);
      }
      
      // Детальный анализ ошибок лояльности
      if (loyaltyErrorDetails.length > 0) {
        console.log(`🔍 [LOYALTY_PROMOCODES] ДЕТАЛЬНЫЙ АНАЛИЗ ОШИБОК:`);
        
        // Группируем ошибки по типам
        const loyaltyErrorGroups = {};
        loyaltyErrorDetails.forEach(err => {
          const key = `${err.type}:${err.code}`;
          if (!loyaltyErrorGroups[key]) {
            loyaltyErrorGroups[key] = { count: 0, examples: [] };
          }
          loyaltyErrorGroups[key].count++;
          if (loyaltyErrorGroups[key].examples.length < 3) {
            loyaltyErrorGroups[key].examples.push(err.promoCode);
          }
        });
        
        Object.keys(loyaltyErrorGroups).forEach(key => {
          const group = loyaltyErrorGroups[key];
          console.log(`   📊 ${key}: ${group.count} ошибок`);
          console.log(`      Примеры промокодов: ${group.examples.join(', ')}`);
        });
        
        // Показываем первые 5 ошибок полностью
        console.log(`🔍 [LOYALTY_PROMOCODES] ПЕРВЫЕ 5 ОШИБОК:`);
        loyaltyErrorDetails.slice(0, 5).forEach((err, index) => {
          console.log(`   ${index + 1}. Промокод: "${err.promoCode}" (${err.botId}/${err.period})`);
          console.log(`      Ошибка: ${err.error}`);
          console.log(`      Код: ${err.code}`);
          console.log(`      Тип: ${err.type}`);
        });
        
        if (loyaltyErrorDetails.length > 5) {
          console.log(`   ... и еще ${loyaltyErrorDetails.length - 5} ошибок`);
        }
      }
    } else {
      console.log(`🎉 [LOYALTY_PROMOCODES] ОТЛИЧНО: Все промокоды лояльности загружены успешно!`);
      console.log(`📊 [LOYALTY_PROMOCODES] Успешность: 100%`);
    }

    // Логирование дубликатов лояльности
    if (loyaltyDuplicates.length > 0) {
      console.log(`🔄 [LOYALTY_PROMOCODES] СПИСОК ДУБЛИКАТОВ ЛОЯЛЬНОСТИ:`);
      loyaltyDuplicates.forEach((dup, index) => {
        console.log(`   ${index + 1}. Промокод: "${dup.code}" (${dup.botId}/${dup.period})`);
        console.log(`      Действие: ${dup.action}`);
      });
    }

    // Логирование пропущенных промокодов лояльности
    if (loyaltySkippedCodes.length > 0) {
      console.log(`❌ [LOYALTY_PROMOCODES] СПИСОК ПРОПУЩЕННЫХ ПРОМОКОДОВ ЛОЯЛЬНОСТИ:`);
      loyaltySkippedCodes.forEach((skipped, index) => {
        console.log(`   ${index + 1}. Промокод: "${skipped.code}"`);
        console.log(`      Бот: ${skipped.botId}, Период: ${skipped.period}`);
        console.log(`      Ошибка: ${skipped.error}`);
        console.log(`      Код ошибки: ${skipped.errorCode}`);
        console.log(`      Тип ошибки: ${skipped.errorType}`);
      });
    }
    
    // АВТОМАТИЧЕСКАЯ ВЫДАЧА ПРОМОКОДОВ ПОЛЬЗОВАТЕЛЯМ (после загрузки)
    console.log(`🎁 [AUTO_DISTRIBUTE] Начинаем автоматическую выдачу промокодов для периода ${period}`);
    
    const distributionResults = await distributePromoCodesToEligibleUsers(botId, period);
    
    res.json({
      success: true,
      message: `Успешно добавлено ${savedCount} новых промокодов для периода ${period}${loyaltyDuplicates.length > 0 ? `, пропущено дубликатов: ${loyaltyDuplicates.length}` : ''}`,
      totalCodes: savedCount,
      skippedCodes: loyaltySkippedCodes,
      skippedCodesCount: loyaltySkippedCodes.length,
      duplicates: loyaltyDuplicates,
      duplicatesCount: loyaltyDuplicates.length,
      period: period,
      statistics: {
        totalCodes: promoCodes.length,
        savedCount,
        skippedCount: saveSkippedCount,
        skippedCodesCount: loyaltySkippedCodes.length,
        duplicatesCount: loyaltyDuplicates.length,
        successRate: Math.round((savedCount / promoCodes.length) * 100)
      },
      autoDistribution: distributionResults
    });
    
  } catch (error) {
    console.error('❌ [LOYALTY_PROMOCODES] Критическая ошибка загрузки промокодов лояльности:', error);
    console.error('❌ [LOYALTY_PROMOCODES] Детали критической ошибки:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack,
      requestParams: req.params,
      requestBody: req.body,
      requestFile: req.file ? {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      } : 'No file'
    });
    
    res.status(500).json({ 
      error: error.message,
      details: 'Подробности в логах сервера'
    });
  }
});

app.delete('/api/loyalty-promocodes/:botId/:period', async (req, res) => {
  try {
    const { botId, period } = req.params;
    
    if (!botId || !period) {
      throw new Error('botId и period обязательны для удаления промокодов лояльности');
    }
    protectFromMassDelete('LoyaltyPromoCode.deleteMany', { botId, period });
    await LoyaltyPromoCode.deleteMany({ botId, period });
    
    res.json({ success: true, message: `Промокоды для периода ${period} удалены` });
  } catch (error) {
    console.error('❌ Error deleting loyalty promocodes:', error);
    res.status(500).json({ error: 'Failed to delete loyalty promocodes' });
  }
});

// Просмотр активных процессов ботов
app.get('/api/active-processes', async (req, res) => {
  try {
    const processes = Array.from(activeProcesses.entries()).map(([botId, process]) => ({
      botId,
      isRunning: !process.killed && process.exitCode === null,
      killed: process.killed,
      exitCode: process.exitCode,
      pid: process.pid
    }));
    
    res.json({
      success: true,
      totalProcesses: activeProcesses.size,
      processes: processes
    });
  } catch (error) {
    console.error('[ACTIVE_PROCESSES] Ошибка получения процессов:', error);
    res.status(500).json({ error: 'Failed to get active processes', details: error.message });
  }
});

// Остановка всех ботов и очистка процессов
app.post('/api/stop-all-bots', async (req, res) => {
  try {
    console.log('[STOP_ALL] Запрос на остановку всех ботов');
    
    const activeProcessesCount = activeProcesses.size;
    console.log(`[STOP_ALL] Найдено ${activeProcessesCount} активных процессов`);
    
    if (activeProcessesCount === 0) {
      return res.json({ 
        success: true, 
        message: 'Нет активных процессов для остановки',
        stoppedCount: 0
      });
    }
    
    let stoppedCount = 0;
    const stopPromises = [];
    
    // Останавливаем все активные процессы
    for (const [botId, process] of activeProcesses.entries()) {
      console.log(`[STOP_ALL] Останавливаем бота ${botId}...`);
      
      const stopPromise = new Promise((resolve) => {
        if (process.killed || process.exitCode !== null) {
          console.log(`[STOP_ALL] Бот ${botId} уже остановлен`);
          activeProcesses.delete(botId);
          stoppedCount++;
          resolve();
          return;
        }
        
        // Останавливаем процесс
        process.kill('SIGTERM');
        
        // Ждем завершения процесса
        const timeout = setTimeout(() => {
          console.log(`[STOP_ALL] Бот ${botId} не остановился, принудительно завершаем`);
          process.kill('SIGKILL');
          activeProcesses.delete(botId);
          stoppedCount++;
          resolve();
        }, 5000);
        
        process.on('exit', (code) => {
          clearTimeout(timeout);
          activeProcesses.delete(botId);
          console.log(`[STOP_ALL] Бот ${botId} остановлен с кодом ${code}`);
          stoppedCount++;
          resolve();
        });
      });
      
      stopPromises.push(stopPromise);
    }
    
    // Ждем остановки всех процессов
    await Promise.all(stopPromises);
    
    console.log(`[STOP_ALL] Остановлено ${stoppedCount} ботов`);
    console.log(`[STOP_ALL] Осталось активных процессов: ${activeProcesses.size}`);
    
    res.json({ 
      success: true, 
      message: `Остановлено ${stoppedCount} ботов`,
      stoppedCount: stoppedCount,
      remainingProcesses: activeProcesses.size
    });
  } catch (error) {
    console.error('[STOP_ALL] Ошибка остановки ботов:', error);
    res.status(500).json({ error: 'Failed to stop bots', details: error.message });
  }
});

// Восстановление ботов из резервной копии
app.post('/api/restore-bots', async (req, res) => {
  try {
    console.log('[RESTORE] Запрос на восстановление ботов');
    
    // Проверяем текущее состояние
    const currentBots = await Bot.find({});
    console.log(`[RESTORE] Текущих ботов в MongoDB: ${currentBots.length}`);
    
    if (currentBots.length > 0) {
      console.log(`[RESTORE] Боты уже есть в MongoDB, восстановление не требуется`);
      return res.json({ 
        success: true, 
        message: `Восстановление не требуется, найдено ${currentBots.length} ботов`,
        bots: currentBots.map(b => ({ id: b.id, name: b.name, isActive: b.isActive }))
      });
    }
    
    // Ищем последние резервные копии
    const backupDir = './backend/backups';
    const fs = require('fs');
    
    if (!fs.existsSync(backupDir)) {
      return res.status(404).json({ error: 'Папка backups не найдена' });
    }
    
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('backup_') && file.endsWith('.json'))
      .sort()
      .reverse(); // Новые файлы сначала
    
    console.log(`[RESTORE] Найдено ${backupFiles.length} резервных копий`);
    
    if (backupFiles.length === 0) {
      return res.status(404).json({ error: 'Резервные копии не найдены' });
    }
    
    let restoredBots = 0;
    
    // Восстанавливаем из последних резервных копий
    for (const backupFile of backupFiles.slice(0, 10)) { // Берем последние 10
      try {
        const backupPath = path.join(backupDir, backupFile);
        const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
        
        if (backupData.bot) {
          // Проверяем, что такого бота еще нет
          const existingBot = await Bot.findOne({ id: backupData.bot.id });
          if (!existingBot) {
            await Bot.create(backupData.bot);
            console.log(`[RESTORE] ✅ Восстановлен бот ${backupData.bot.id} (${backupData.bot.name})`);
            restoredBots++;
          }
        }
  } catch (error) {
        console.error(`[RESTORE] ❌ Ошибка восстановления из ${backupFile}:`, error.message);
      }
    }
    
    const finalBots = await Bot.find({});
    console.log(`[RESTORE] Восстановлено ${restoredBots} ботов, всего в MongoDB: ${finalBots.length}`);
    
    res.json({ 
      success: true, 
      message: `Восстановлено ${restoredBots} ботов`,
      restoredCount: restoredBots,
      totalBots: finalBots.length,
      bots: finalBots.map(b => ({ id: b.id, name: b.name, isActive: b.isActive }))
    });
  } catch (error) {
    console.error('[RESTORE] Ошибка восстановления:', error);
    res.status(500).json({ error: 'Failed to restore bots', details: error.message });
  }
});

// Эндпоинт для экспорта статистики программы лояльности в CSV
app.get('/api/export-loyalty-stats/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    console.log(`[LOYALTY] Экспорт статистики программы лояльности для бота ${botId}`);
    
    // Получаем всех пользователей с их данными лояльности
    const users = await User.find({ botId });
    const loyaltyConfig = await LoyaltyConfig.findOne({ botId });
    
    // Получаем все активированные промокоды для пользователей
    const activatedPromoCodes = await LoyaltyPromoCode.find({ 
      botId, 
      activated: true 
    });
    
    // Создаем Map для быстрого поиска промокодов по userId и периоду
    // Если у пользователя несколько промокодов за период, берем первый (самый ранний)
    const promoCodesMap = new Map();
    activatedPromoCodes
      .sort((a, b) => (a.activatedAt || 0) - (b.activatedAt || 0)) // Сортируем по дате активации
      .forEach(promoCode => {
        const key = `${promoCode.activatedBy}_${promoCode.period}`;
        // Сохраняем только первый промокод за период (если уже есть - не перезаписываем)
        if (!promoCodesMap.has(key)) {
          promoCodesMap.set(key, promoCode.code);
        }
      });
    
    // Формируем CSV данные
    let csvContent = 'User ID,Username,First Name,Last Name,Subscribed At,First Subscribed At,Is Subscribed,1m Reward,1m PromoCode,24h Reward,24h PromoCode,7d Reward,7d PromoCode,30d Reward,30d PromoCode,90d Reward,90d PromoCode,180d Reward,180d PromoCode,360d Reward,360d PromoCode\n';
    
    users.forEach(user => {
      
      // Получаем промокоды для каждого периода
      const getPromoCode = (period) => {
        const key = `${user.userId}_${period}`;
        return promoCodesMap.get(key) || '';
      };
      
      const row = [
        user.userId || '',
        (user.username || '').replace(/,/g, ';'), // Заменяем запятые на точку с запятой
        (user.firstName || '').replace(/,/g, ';'),
        (user.lastName || '').replace(/,/g, ';'),
        user.subscribedAt ? new Date(user.subscribedAt).toISOString() : '',
        user.firstSubscribedAt ? new Date(user.firstSubscribedAt).toISOString() : '',
        user.isSubscribed ? 'Да' : 'Нет',
        Boolean(getPromoCode('1m')) ? 'Да' : 'Нет',
        getPromoCode('1m'),
        Boolean(getPromoCode('24h')) ? 'Да' : 'Нет',
        getPromoCode('24h'),
        Boolean(getPromoCode('7d')) ? 'Да' : 'Нет',
        getPromoCode('7d'),
        Boolean(getPromoCode('30d')) ? 'Да' : 'Нет',
        getPromoCode('30d'),
        Boolean(getPromoCode('90d')) ? 'Да' : 'Нет',
        getPromoCode('90d'),
        Boolean(getPromoCode('180d')) ? 'Да' : 'Нет',
        getPromoCode('180d'),
        Boolean(getPromoCode('360d')) ? 'Да' : 'Нет',
        getPromoCode('360d')
      ].join(',');
      
      csvContent += row + '\n';
    });
    
    // Добавляем статистику по промокодам
    csvContent += '\n\nПромокоды программы лояльности:\n';
    csvContent += 'Period,Total Codes,Available Codes,Used Codes\n';
    
    const periods = ['1m', '24h', '7d', '30d', '90d', '180d', '360d'];
    for (const period of periods) {
      const promoCodes = await LoyaltyPromoCode.find({ botId, period });
      const total = promoCodes.length;
      const available = promoCodes.filter(p => !p.activated).length;
      const used = promoCodes.filter(p => p.activated).length;
      
      csvContent += `${period},${total},${available},${used}\n`;
    }
    
    // Добавляем информацию о конфигурации
    if (loyaltyConfig) {
      csvContent += '\n\nКонфигурация программы лояльности:\n';
      csvContent += 'Period,Enabled,Message\n';
      
      periods.forEach(period => {
        const config = loyaltyConfig.messages[period];
        if (config) {
          const message = (config.message || '').replace(/,/g, ';').replace(/\n/g, ' ');
          csvContent += `${period},${config.enabled ? 'Да' : 'Нет'},"${message}"\n`;
        }
      });
    }
    
    // Устанавливаем заголовки для скачивания файла
    const filename = `loyalty-stats-${botId}-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Отправляем CSV файл
    res.send('\ufeff' + csvContent); // BOM для корректного отображения кириллицы в Excel
    
    console.log(`[LOYALTY] Статистика экспортирована: ${users.length} пользователей, ${activatedPromoCodes.length} назначенных ваучеров`);
    
  } catch (error) {
    console.error('❌ Error exporting loyalty stats:', error);
    res.status(500).json({ error: 'Failed to export loyalty statistics' });
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
let monitoringBots = false;
let shuttingDown = false;

// Мониторинг состояния ботов
setInterval(async () => {
  if (monitoringBots || shuttingDown) return;
  monitoringBots = true;
  try {
    console.log(`🔍 Monitoring: ${activeProcesses.size} bots running`);
    
    // Проверяем каждый активный процесс
    for (const [botId, process] of activeProcesses.entries()) {
      if (process.killed || process.exitCode !== null) {
        console.log(`⚠️ Bot ${botId} process is dead, removing from active list`);
        activeProcesses.delete(botId);
        
        // isActive is the desired state: failed processes must be restarted.
      } else if (process.pollingReady && Date.now() - process.lastPollAt > 150000) {
        console.error(`Bot ${botId} polling stalled; restarting process`);
        process.kill('SIGKILL');
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
          // Keep the desired state so the next monitor pass retries.
        }
      }
    }
  } catch (error) {
    console.error('❌ Error in bot monitoring:', error);
  } finally {
    monitoringBots = false;
  }
}, 30000); // Проверяем каждые 30 секунд

// Получение editorState из MongoDB для запуска botProcess.js
async function startBot(bot) {
  if (shuttingDown) throw new Error("Server is shutting down");
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
    bot.id
  ], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });

  // Сохраняем процесс в карте
  activeProcesses.set(bot.id, botProcess);

  return new Promise((resolve, reject) => {
    let isResolved = false;
    let startTimeout;

    const cleanup = () => {
      clearTimeout(startTimeout);
    };

    botProcess.on('message', (message) => {
      if (message?.type === 'loyalty-progress') { botProcess.loyaltyProgress = message.progress; return; }
      if (message?.type !== 'polling-ok') return;
      botProcess.pollingReady = true;
      botProcess.lastPollAt = Date.now();
      if (!isResolved) {
        isResolved = true;
        cleanup();
        resolve(botProcess);
      }
    });

    botProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`Bot ${bot.id} output:`, output);

    });

    botProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error(`Bot ${bot.id} error:`, error);
    });

    botProcess.on('exit', (code) => {
      console.log(`Bot ${bot.id} process exited with code ${code}`);
      if (activeProcesses.get(bot.id) === botProcess) activeProcesses.delete(bot.id);
      if (!isResolved) {
        cleanup();
        reject(new Error(`Bot process exited with code ${code}`));
      }
    });

    botProcess.on('error', (error) => {
      if (activeProcesses.get(bot.id) === botProcess) activeProcesses.delete(bot.id);
      cleanup();
      if (!isResolved) {
        isResolved = true;
        reject(error);
      }
    });

    startTimeout = setTimeout(() => {
      if (!isResolved) {
        cleanup();
        isResolved = true;
        botProcess.kill('SIGKILL');
        reject(new Error(`Bot ${bot.id} did not confirm Telegram polling within 90 seconds`));
      }
    }, 90000);
  });
}

// Функция для остановки бота
async function stopBot(botId, { deactivate = true } = {}) {
  console.log(`Stopping bot ${botId}...`);
  
  const botProcess = activeProcesses.get(botId);
  if (!botProcess) {
    console.log(`Bot ${botId} is not running`);
    return true;
  }

  return new Promise((resolve) => {
    // Обновляем статус в базе данных
    if (deactivate) Bot.updateOne({ id: botId }, { $set: { isActive: false } })
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

// Обновление только настроек бота (название и токен) без изменения editorState и других данных
app.put('/api/bots/:id/settings', async (req, res) => {
  try {
    const { name, token } = req.body;
    const botId = req.params.id;
    
    // Проверяем, что бот существует
    const bot = await Bot.findOne({ id: botId });
    if (!bot) {
      return res.status(404).json({ error: 'Bot not found' });
    }
    
    // Обновляем только name и token, не трогая editorState, статистику и другие данные
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (token !== undefined) updateData.token = token;
    
    await Bot.updateOne(
      { id: botId },
      { $set: updateData }
    );
    
    console.log(`[BOT_SETTINGS] Обновлены настройки бота ${botId}:`, updateData);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating bot settings:', error);
    res.status(500).json({ error: 'Failed to update bot settings', details: error.message });
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

// Функция защиты от массового удаления
function protectFromMassDelete(operation, filter) {
  const timestamp = new Date().toISOString();
  console.log(`[PROTECTION] ${timestamp} - Операция удаления: ${operation}`);
  console.log(`[PROTECTION] Фильтр:`, filter);
  
  // Проверяем, что есть фильтр
  if (!filter || Object.keys(filter).length === 0) {
    console.error(`[PROTECTION] ❌ БЛОКИРОВКА: Попытка удаления без фильтра!`);
    throw new Error('PROTECTION: Mass delete blocked - no filter provided');
  }
  
  // Проверяем, что есть конкретный идентификатор
  if (!filter.id && !filter._id && !filter.botId) {
    console.error(`[PROTECTION] ❌ БЛОКИРОВКА: Попытка удаления без конкретного ID!`);
    throw new Error('PROTECTION: Mass delete blocked - no specific ID provided');
  }
  
  console.log(`[PROTECTION] ✅ Операция разрешена`);
}

// Проверка состояния MongoDB
app.get('/api/health', async (req, res) => {
  try {
    const mongoState = mongoose.connection.readyState;
    const mongoStateText = {
      0: 'disconnected',
      1: 'connected', 
      2: 'connecting',
      3: 'disconnecting'
    }[mongoState] || 'unknown';
    
    const desiredBots = mongoState === 1 ? await Bot.find({ isActive: true }).select('id').lean() : [];
    const unavailableBots = desiredBots.filter(({ id }) => {
      const child = activeProcesses.get(id);
      return !child || child.killed || child.exitCode !== null || !child.pollingReady || Date.now() - child.lastPollAt > 150000;
    }).map(({ id }) => id);
    const healthy = mongoState === 1 && unavailableBots.length === 0;

    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'OK' : 'DEGRADED',
      bots: { desired: desiredBots.length, polling: desiredBots.length - unavailableBots.length, unavailable: unavailableBots },
      mongodb: {
        state: mongoState,
        stateText: mongoStateText,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: 'Health check failed', details: error.message });
  }
});

// Получение списка ботов
app.get('/api/bots', async (req, res) => {
  try {
    console.log(`[BOT_GET] Запрос списка ботов`);
    console.log(`[BOT_GET] Состояние MongoDB: ${mongoose.connection.readyState} (1=connected, 2=connecting, 0=disconnected)`);
    
    if (mongoose.connection.readyState !== 1) {
      console.error('[BOT_GET] MongoDB не подключена!');
      return res.status(500).json({ error: 'MongoDB not connected' });
    }
    
    const bots = await Bot.find({});
    console.log(`[BOT_GET] Найдено ботов в MongoDB: ${bots.length}`);
    
    if (bots.length === 0) {
      // Проверяем, есть ли вообще коллекция ботов
      const collections = await mongoose.connection.db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      console.log(`[BOT_GET] ⚠️ Ботов нет! Доступные коллекции:`, collectionNames);
      
      // Проверяем, есть ли индексы в коллекции ботов
      try {
        const indexes = await mongoose.connection.db.collection('bots').indexes();
        console.log(`[BOT_GET] Индексы в коллекции bots:`, indexes.length);
      } catch (err) {
        console.log(`[BOT_GET] Ошибка при проверке индексов:`, err.message);
      }
    } else {
      console.log(`[BOT_GET] Список ботов:`, bots.map(b => ({ id: b.id, name: b.name, isActive: b.isActive })));
    }
    // Добавляем информацию о том, какие боты реально запущены
    const botsWithStatus = bots.map(bot => ({
      ...bot.toObject(),
      isRunning: activeProcesses.has(bot.id)
    }));
    console.log(`[BOT_GET] Активных процессов: ${activeProcesses.size}`);
    res.json({ bots: botsWithStatus, activeBot: null });
  } catch (error) {
    console.error('[BOT_GET] Ошибка при получении ботов:', error);
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
    console.log(`[BOT_CREATE] Создаем бота с ID: ${newBot.id}`);
    console.log(`[BOT_CREATE] Состояние MongoDB: ${mongoose.connection.readyState} (1=connected, 2=connecting, 0=disconnected)`);
    
    if (mongoose.connection.readyState !== 1) {
      console.error('[BOT_CREATE] MongoDB не подключена!');
      return res.status(500).json({ error: 'MongoDB not connected' });
    }
    
    const createdBot = await Bot.create(newBot);
    console.log(`[BOT_CREATE] Бот успешно создан в MongoDB:`, { id: createdBot.id, name: createdBot.name });
    
    // Дополнительная проверка что бот действительно сохранился
    const verifyBot = await Bot.findOne({ id: newBot.id });
    if (!verifyBot) {
      console.error(`[BOT_CREATE] КРИТИЧЕСКАЯ ОШИБКА: Бот ${newBot.id} не найден после создания!`);
      throw new Error('Bot not found after creation');
    }
    console.log(`[BOT_CREATE] ✅ Проверка: бот ${newBot.id} действительно сохранён в MongoDB`);
    
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
      // Проверяем, что botId корректный перед удалением
      if (!botId || botId === 'undefined' || botId === 'null') {
        throw new Error('Invalid botId provided');
      }
      
      console.log(`[DELETE] Удаляем данные для бота: ${botId}`);
      
      // Удаляем только данные конкретного бота
      console.log(`[DELETE] Начинаем удаление данных для бота: ${botId}`);
      
      // Дополнительная проверка - убеждаемся, что botId не пустой
      if (!botId || botId.trim() === '') {
        throw new Error('botId не может быть пустым');
      }
      
      // Критическая проверка - предотвращаем удаление всех данных
      if (botId === 'all' || botId === '*' || botId === 'undefined' || botId === 'null' || !botId) {
        throw new Error('КРИТИЧЕСКАЯ ОШИБКА: Попытка удалить все данные! Операция заблокирована.');
      }
      
      // Дополнительная проверка на случайные значения
      if (botId.length < 10 || botId.includes(' ') || botId.includes('..')) {
        throw new Error('КРИТИЧЕСКАЯ ОШИБКА: Подозрительный botId! Операция заблокирована.');
      }
      
      // Создаем резервную копию перед удалением
      console.log(`[BACKUP] Создаем резервную копию данных для бота ${botId}...`);
      const backupData = {
        bot: await Bot.findOne({ id: botId }),
        users: await User.find({ botId }),
        quizStats: await QuizStats.find({ botId }),
        promoCodes: await PromoCode.find({ botId }),
        loyalties: await Loyalty.find({ botId }),
        loyaltyPromoCodes: await LoyaltyPromoCode.find({ botId })
      };
      
      // Сохраняем резервную копию в файл
      const fs = require('fs');
      const backupDir = './backend/backups';
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const backupFile = `${backupDir}/backup_${botId}_${Date.now()}.json`;
      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
      console.log(`[BACKUP] Резервная копия сохранена: ${backupFile}`);
      
      // Используем защиту от массового удаления
      protectFromMassDelete('Bot.deleteOne', { id: botId });
      protectFromMassDelete('User.deleteMany', { botId });
      protectFromMassDelete('QuizStats.deleteMany', { botId });
      protectFromMassDelete('PromoCode.deleteMany', { botId });
      protectFromMassDelete('Loyalty.deleteMany', { botId });
      protectFromMassDelete('LoyaltyPromoCode.deleteMany', { botId });
      
      const deleteResults = await Promise.all([
        Bot.deleteOne({ id: botId }),
        User.deleteMany({ botId }),
        QuizStats.deleteMany({ botId }),
        PromoCode.deleteMany({ botId }),
        Loyalty.deleteMany({ botId }),
        LoyaltyPromoCode.deleteMany({ botId })
      ]);
      
      console.log(`[DELETE] Результаты удаления для бота ${botId}:`, {
        bots: deleteResults[0].deletedCount,
        users: deleteResults[1].deletedCount,
        quizStats: deleteResults[2].deletedCount,
        promoCodes: deleteResults[3].deletedCount,
        loyalty: deleteResults[4].deletedCount,
        loyaltyPromoCodes: deleteResults[5].deletedCount
      });
      
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

// Экспорт статистики викторин в CSV
app.post('/api/export-trivia-stats', async (req, res) => {
  try {
    const { stats, blocks } = req.body;
    const csvSections = [];

    csvSections.push('Общая статистика викторин');
    csvSections.push([
      'Дата экспорта',
      'Количество викторин',
      'Всего попыток',
      'Успешных попыток',
      'Неудачных попыток',
      'Общая успешность (%)'
    ].join(','));
    const totalAttempts = Object.values(stats || {}).reduce((sum, t) => sum + (t.totalAttempts || 0), 0);
    const totalSuccessful = Object.values(stats || {}).reduce((sum, t) => sum + (t.successfulCompletions || 0), 0);
    const totalFailed = Object.values(stats || {}).reduce((sum, t) => sum + (t.failedAttempts || 0), 0);
    const overallRate = totalAttempts > 0 ? ((totalSuccessful / totalAttempts) * 100).toFixed(1) : 0;
    csvSections.push([
      new Date().toLocaleString('ru-RU'),
      (blocks || []).length,
      totalAttempts,
      totalSuccessful,
      totalFailed,
      overallRate
    ].join(','));
    csvSections.push('');

    csvSections.push('Статистика по викторинам');
    csvSections.push([
      'ID викторины',
      'Название',
      'Всего попыток',
      'Успешных',
      'Неудачных',
      'Успешность (%)'
    ].join(','));
    (blocks || []).forEach(trivia => {
      const t = stats[trivia.id] || { totalAttempts: 0, successfulCompletions: 0, failedAttempts: 0 };
      const rate = t.totalAttempts > 0 ? ((t.successfulCompletions / t.totalAttempts) * 100).toFixed(1) : 0;
      csvSections.push([
        trivia.id,
        `"${(trivia.message || `Викторина ${trivia.id}`).replace(/"/g, '""')}"`,
        t.totalAttempts,
        t.successfulCompletions,
        t.failedAttempts,
        rate
      ].join(','));
    });
    csvSections.push('');

    csvSections.push('Попытки пользователей');
    csvSections.push([
      'ID викторины',
      'Название',
      'ID пользователя',
      'Имя',
      'Фамилия',
      'Username',
      'Ответ',
      'Результат',
      'Ваучер',
      'Дата попытки'
    ].join(','));
    (blocks || []).forEach(trivia => {
      const t = stats[trivia.id] || { userAttempts: [] };
      (t.userAttempts || []).forEach((attempt) => {
        csvSections.push([
          trivia.id,
          `"${(trivia.message || `Викторина ${trivia.id}`).replace(/"/g, '""')}"`,
          attempt.userId,
          `"${(attempt.userName || '').replace(/"/g, '""')}"`,
          `"${(attempt.userLastName || '').replace(/"/g, '""')}"`,
          attempt.username ? `@${attempt.username}` : '',
          `"${(attempt.userAnswer || '').replace(/"/g, '""')}"`,
          attempt.success ? 'Верно' : 'Неверно',
          attempt.promoCode || '',
          new Date(attempt.timestamp).toLocaleString('ru-RU')
        ].join(','));
      });
    });

    const csvContent = csvSections.join('\r\n');
    const fileName = `trivia-stats-${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting trivia stats to CSV:', error);
    res.status(500).json({ error: 'Ошибка при экспорте статистики викторин', details: error.message });
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

// Эндпоинт для исправления пропущенных промокодов лояльности для существующих пользователей
    
// Эндпоинт для повторной отправки сообщений с промокодами лояльности
app.post('/api/resend-loyalty-promocode-messages/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    console.log(`📨 [RESEND_MESSAGES] Начинаем повторную отправку сообщений с промокодами для бота ${botId}`);
    
    // Получаем все активированные промокоды лояльности за последние 24 часа
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const activatedPromoCodes = await LoyaltyPromoCode.find({
      botId,
      activated: true,
      activatedAt: { $gte: twentyFourHoursAgo }
    }).sort({ activatedAt: -1 });
    
    console.log(`📨 [RESEND_MESSAGES] Найдено ${activatedPromoCodes.length} активированных промокодов за последние 24 часа`);
    
    if (activatedPromoCodes.length === 0) {
      return res.json({
        success: true,
        message: 'Нет активированных промокодов за последние 24 часа',
        statistics: {
          totalPromoCodes: 0,
          messagesSent: 0,
          errors: 0
        },
        results: []
      });
    }
    
    // Получаем токен бота для отправки сообщений
    const bot = await Bot.findOne({ id: botId });
    if (!bot || !bot.token) {
      return res.status(400).json({ 
        error: 'Бот не найден или токен не настроен' 
      });
    }
    
    const { Telegraf } = require('telegraf');
    const telegramBot = new Telegraf(bot.token, { telegram: { agent: require('./telegramAgent') } });
    
    let messagesSent = 0;
    let errors = 0;
    const results = [];
    
    // Группируем промокоды по пользователям
    const promoCodesByUser = {};
    activatedPromoCodes.forEach(promoCode => {
      if (!promoCodesByUser[promoCode.activatedBy]) {
        promoCodesByUser[promoCode.activatedBy] = [];
      }
      promoCodesByUser[promoCode.activatedBy].push(promoCode);
    });
    
    console.log(`📨 [RESEND_MESSAGES] Найдено ${Object.keys(promoCodesByUser).length} пользователей для отправки сообщений`);
    
    // Отправляем сообщения каждому пользователю
    for (const [userId, userPromoCodes] of Object.entries(promoCodesByUser)) {
      try {
        console.log(`📨 [RESEND_MESSAGES] Отправляем сообщение пользователю ${userId} с ${userPromoCodes.length} промокодами`);
        
        // Получаем информацию о пользователе
        const user = await User.findOne({ botId, userId: parseInt(userId) });
        const userName = user ? (user.username || user.firstName || `Пользователь ${userId}`) : `Пользователь ${userId}`;
        
        // Создаем сообщение с промокодами
        let message = `🎁 **ВАШИ ПРОМОКОДЫ ЗА ЛОЯЛЬНОСТЬ!**\n\n`;
        message += `Привет, ${userName}! 👋\n\n`;
        message += `Вы получили промокоды за участие в программе лояльности:\n\n`;
        
        // Добавляем каждый промокод
        userPromoCodes.forEach((promoCode, index) => {
          const periodLabels = {
            '1m': '1 минута',
            '24h': '24 часа', 
            '7d': '7 дней',
            '30d': '30 дней',
            '90d': '90 дней',
            '180d': '180 дней',
            '360d': '360 дней'
          };
          
          const periodLabel = periodLabels[promoCode.period] || promoCode.period;
          message += `${index + 1}. ⏰ **${periodLabel}**\n`;
          message += `   🎫 Промокод: \`${promoCode.code}\`\n\n`;
        });
        
        message += `💡 **Используйте эти промокоды для получения бонусов!**\n\n`;
        message += `🎉 Спасибо за участие в программе лояльности!`;
        
        // Отправляем сообщение
        await telegramBot.telegram.sendMessage(userId, message, { parse_mode: 'Markdown' });
        
        messagesSent++;
        results.push({
          userId: parseInt(userId),
          userName,
          promoCodesCount: userPromoCodes.length,
          promoCodes: userPromoCodes.map(pc => ({
            period: pc.period,
            code: pc.code,
            activatedAt: pc.activatedAt
          })),
          status: 'sent'
        });
        
        console.log(`✅ [RESEND_MESSAGES] Сообщение отправлено пользователю ${userId} (${userName})`);
        
        // Небольшая пауза между отправками
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ [RESEND_MESSAGES] Ошибка отправки сообщения пользователю ${userId}:`, error);
        errors++;
        
        results.push({
          userId: parseInt(userId),
          userName: `Пользователь ${userId}`,
          promoCodesCount: userPromoCodes.length,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`📨 [RESEND_MESSAGES] Отправка сообщений завершена:`);
    console.log(`   - Всего промокодов: ${activatedPromoCodes.length}`);
    console.log(`   - Отправлено сообщений: ${messagesSent}`);
    console.log(`   - Ошибок: ${errors}`);
    
    res.json({
      success: true,
      message: `Повторная отправка сообщений завершена`,
      statistics: {
        totalPromoCodes: activatedPromoCodes.length,
        messagesSent,
        errors
      },
      results
    });
    
  } catch (error) {
    console.error('❌ [RESEND_MESSAGES] Критическая ошибка:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Подробности в логах сервера'
    });
  }
});

// Эндпоинт для диагностики и исправления несоответствий между наградами и промокодами лояльности
    
// Эндпоинт для диагностики дублированных промокодов лояльности
app.get('/api/diagnose-duplicate-promocodes/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    console.log(`🔍 [DIAGNOSE_DUPLICATES] Диагностика дублированных промокодов для бота ${botId}`);
    
    // Получаем всех пользователей с активированными промокодами
    const activatedPromoCodes = await LoyaltyPromoCode.find({
      botId,
      activated: true
    }).sort({ activatedBy: 1, period: 1, activatedAt: 1 });
    
    console.log(`🔍 [DIAGNOSE_DUPLICATES] Найдено ${activatedPromoCodes.length} активированных промокодов`);
    
    // Группируем промокоды по пользователям и периодам
    const userPeriodMap = {};
    const duplicates = [];
    
    activatedPromoCodes.forEach(promoCode => {
      const key = `${promoCode.activatedBy}_${promoCode.period}`;
      
      if (!userPeriodMap[key]) {
        userPeriodMap[key] = [];
      }
      
      userPeriodMap[key].push(promoCode);
    });
    
    // Находим дубликаты
    Object.entries(userPeriodMap).forEach(([key, promoCodes]) => {
      if (promoCodes.length > 1) {
        const [userId, period] = key.split('_');
        
        // Сортируем по дате активации
        promoCodes.sort((a, b) => new Date(a.activatedAt) - new Date(b.activatedAt));
        
        duplicates.push({
          userId: parseInt(userId),
          period: period,
          totalPromoCodes: promoCodes.length,
          promoCodes: promoCodes.map(pc => ({
            code: pc.code,
            activatedAt: pc.activatedAt,
            _id: pc._id
          })),
          keepPromoCode: promoCodes[0].code, // Оставляем первый (самый ранний)
          removePromoCodes: promoCodes.slice(1).map(pc => pc.code) // Удаляем остальные
        });
      }
    });
    
    console.log(`🔍 [DIAGNOSE_DUPLICATES] Найдено ${duplicates.length} случаев дублирования`);
    
    // Получаем информацию о пользователях
    const userIds = [...new Set(duplicates.map(d => d.userId))];
    const users = await User.find({ botId, userId: { $in: userIds } });
    const userMap = new Map();
    users.forEach(user => userMap.set(user.userId, user));
    
    // Добавляем информацию о пользователях
    duplicates.forEach(duplicate => {
      const user = userMap.get(duplicate.userId);
      duplicate.userInfo = {
        username: user?.username,
        firstName: user?.firstName,
        lastName: user?.lastName
      };
    });
    
    res.json({
      success: true,
      message: `Диагностика дублированных промокодов завершена`,
      statistics: {
        totalActivatedPromoCodes: activatedPromoCodes.length,
        duplicateCases: duplicates.length,
        affectedUsers: userIds.length
      },
      duplicates
    });
    
  } catch (error) {
    console.error('❌ [DIAGNOSE_DUPLICATES] Критическая ошибка:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Подробности в логах сервера'
    });
  }
});

// Эндпоинт для очистки дублированных промокодов для конкретного бота
app.post('/api/cleanup-duplicate-promocodes/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    console.log(`🧹 [CLEANUP_DUPLICATES] Очистка дублированных промокодов для бота ${botId}`);
    
    // Получаем дублированные промокоды
    const activatedPromoCodes = await LoyaltyPromoCode.find({
      botId,
      activated: true
    }).sort({ activatedBy: 1, period: 1, activatedAt: 1 });
    
    const userPeriodMap = {};
    const duplicatesToRemove = [];
    
    // Группируем промокоды по пользователям и периодам
    activatedPromoCodes.forEach(promoCode => {
      const key = `${promoCode.activatedBy}_${promoCode.period}`;
      
      if (!userPeriodMap[key]) {
        userPeriodMap[key] = [];
      }
      
      userPeriodMap[key].push(promoCode);
    });
    
    // Находим дубликаты для удаления
    Object.entries(userPeriodMap).forEach(([key, promoCodes]) => {
      if (promoCodes.length > 1) {
        // Сортируем по дате активации (оставляем первый, удаляем остальные)
        promoCodes.sort((a, b) => new Date(a.activatedAt) - new Date(b.activatedAt));
        
        // Добавляем все кроме первого в список для удаления
        duplicatesToRemove.push(...promoCodes.slice(1));
      }
    });
    
    console.log(`🧹 [CLEANUP_DUPLICATES] Найдено ${duplicatesToRemove.length} дублированных промокодов для удаления`);
    
    const cleanupResults = [];
    
    // Деактивируем дублированные промокоды (не удаляем, чтобы сохранить историю)
    for (const promoCode of duplicatesToRemove) {
      try {
        // Деактивируем промокод вместо удаления
        await LoyaltyPromoCode.updateOne(
          { _id: promoCode._id },
          {
            $set: {
              activated: false,
              activatedBy: null,
              activatedAt: null
            },
            $unset: { allocationKey: 1 }
          }
        );
        
        cleanupResults.push({
          userId: promoCode.activatedBy,
          period: promoCode.period,
          removedPromoCode: promoCode.code,
          removedAt: promoCode.activatedAt,
          status: 'deactivated'
        });
        
        console.log(`✅ [CLEANUP_DUPLICATES] Деактивирован дублированный промокод ${promoCode.code} для пользователя ${promoCode.activatedBy}, периода ${promoCode.period}`);
        
      } catch (error) {
        console.error(`❌ [CLEANUP_DUPLICATES] Ошибка деактивации промокода ${promoCode.code}:`, error);
        
        cleanupResults.push({
          userId: promoCode.activatedBy,
          period: promoCode.period,
          removedPromoCode: promoCode.code,
          removedAt: promoCode.activatedAt,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log(`🧹 [CLEANUP_DUPLICATES] Очистка завершена: деактивировано ${cleanupResults.filter(r => r.status === 'deactivated').length} промокодов`);
    
    res.json({
      success: true,
      message: `Очистка дублированных промокодов завершена`,
      statistics: {
        totalDuplicatesFound: duplicatesToRemove.length,
        successfullyDeactivated: cleanupResults.filter(r => r.status === 'deactivated').length,
        errors: cleanupResults.filter(r => r.status === 'error').length
      },
      cleanupResults
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP_DUPLICATES] Критическая ошибка:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Подробности в логах сервера'
    });
  }
});

// Эндпоинт для очистки дублированных промокодов для ВСЕХ ботов
app.post('/api/cleanup-duplicate-promocodes-all', async (req, res) => {
  try {
    console.log(`🧹 [CLEANUP_DUPLICATES_ALL] Очистка дублированных промокодов для всех ботов`);
    
    // Получаем все боты
    const bots = await Bot.find({}, { id: 1 });
    console.log(`🧹 [CLEANUP_DUPLICATES_ALL] Найдено ${bots.length} ботов`);
    
    const allResults = [];
    
    for (const bot of bots) {
      try {
        // Получаем дублированные промокоды для этого бота
        const activatedPromoCodes = await LoyaltyPromoCode.find({
          botId: bot.id,
          activated: true
        }).sort({ activatedBy: 1, period: 1, activatedAt: 1 });
        
        const userPeriodMap = {};
        const duplicatesToRemove = [];
        
        // Группируем промокоды по пользователям и периодам
        activatedPromoCodes.forEach(promoCode => {
          const key = `${promoCode.activatedBy}_${promoCode.period}`;
          
          if (!userPeriodMap[key]) {
            userPeriodMap[key] = [];
          }
          
          userPeriodMap[key].push(promoCode);
        });
        
        // Находим дубликаты для удаления
        Object.entries(userPeriodMap).forEach(([key, promoCodes]) => {
          if (promoCodes.length > 1) {
            // Сортируем по дате активации (оставляем первый, деактивируем остальные)
            promoCodes.sort((a, b) => new Date(a.activatedAt) - new Date(b.activatedAt));
            
            // Добавляем все кроме первого в список для деактивации
            duplicatesToRemove.push(...promoCodes.slice(1));
          }
        });
        
        if (duplicatesToRemove.length > 0) {
          console.log(`🧹 [CLEANUP_DUPLICATES_ALL] Бот ${bot.id}: найдено ${duplicatesToRemove.length} дубликатов`);
          
          // Деактивируем дублированные промокоды
          for (const promoCode of duplicatesToRemove) {
            await LoyaltyPromoCode.updateOne(
              { _id: promoCode._id },
              {
                $set: {
                  activated: false,
                  activatedBy: null,
                  activatedAt: null
                },
                $unset: { allocationKey: 1 }
              }
            );
          }
          
          allResults.push({
            botId: bot.id,
            duplicatesFound: duplicatesToRemove.length,
            status: 'cleaned'
          });
        }
      } catch (botError) {
        console.error(`❌ [CLEANUP_DUPLICATES_ALL] Ошибка для бота ${bot.id}:`, botError.message);
        allResults.push({
          botId: bot.id,
          status: 'error',
          error: botError.message
        });
      }
    }
    
    const totalDuplicates = allResults.reduce((sum, r) => sum + (r.duplicatesFound || 0), 0);
    
    console.log(`🧹 [CLEANUP_DUPLICATES_ALL] Очистка завершена: деактивировано ${totalDuplicates} дубликатов для ${allResults.length} ботов`);
    
    res.json({
      success: true,
      message: `Очистка дублированных промокодов завершена для всех ботов`,
      statistics: {
        totalBots: bots.length,
        totalDuplicatesDeactivated: totalDuplicates,
        botsProcessed: allResults.filter(r => r.status === 'cleaned').length,
        errors: allResults.filter(r => r.status === 'error').length
      },
      results: allResults
    });
    
  } catch (error) {
    console.error('❌ [CLEANUP_DUPLICATES_ALL] Критическая ошибка:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Подробности в логах сервера'
    });
  }
});

registerLoyaltyJobRoutes(app, loyaltyJobs);
app.get('/api/loyalty-auto-progress/:botId', (req, res) => {
  res.json({ progress: activeProcesses.get(req.params.botId)?.loyaltyProgress || null });
});
app.post('/api/force-give-loyalty-rewards/:botId/:userId', async (req, res) => {
  try {
    const { botId, userId } = req.params;
    const user = await User.findOne({ botId, userId: Number(userId) }).lean();
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    const config = await LoyaltyConfig.findOne({ botId }).lean();
    const result = await loyaltyService.checkUser(botId, user, config);
    res.json({ success: true, result });
  } catch (error) { res.status(502).json({ error: safeError(error) }); }
});
    
// Эндпоинт для массовой проверки всех пользователей и выдачи пропущенных наград
    
// Эндпоинт для принудительной выдачи пропущенных наград конкретному пользователю
// Эндпоинт для принудительной выдачи промокодов всем пользователям за конкретный период
    
// Эндпоинт для принудительной выдачи пропущенных наград конкретному пользователю

// API endpoint для получения статистики ботов

// ВАЖНО: Все операции с User, QuizStats, PromoCode, Loyalty всегда используют botId как фильтр!
// Пример создания пользователя:
// await User.create({ botId, userId, ... });
// Пример поиска пользователей:
// await User.find({ botId });
// Аналогично для QuizStats, PromoCode, Loyalty

// Endpoint /api/bots/:id/full уже реализует правильную агрегацию по botId:
// Возвращает bot, users, quizStats, promoCodes, loyalties — все по botId

// Endpoint для загрузки промокодов лояльности
app.post('/api/loyalty-promocodes/:botId/:period', loyaltyPromoCodeUpload.single('file'), async (req, res) => {
  try {
    const { botId, period } = req.params;
    
    console.log(`[LOYALTY_PROMO] Загрузка промокодов для бота ${botId}, период ${period}`);
    
    // Проверяем валидность периода
    const validPeriods = ['1m', '24h', '7d', '30d', '90d', '180d', '360d'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Неверный период лояльности' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    
    // Проверяем, что файл - CSV
    if (!req.file.originalname.endsWith('.csv')) {
      return res.status(400).json({ error: 'Поддерживаются только CSV файлы' });
    }
    
    // Читаем содержимое файла
    const fileContent = req.file.buffer.toString('utf8');
    console.log(`[LOYALTY_PROMO] Содержимое файла (первые 200 символов):`, fileContent.substring(0, 200));
    
    // Парсим CSV
    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) {
      return res.status(400).json({ error: 'Файл пустой' });
    }
    
    // НЕ УДАЛЯЕМ существующие промокоды - добавляем новые к существующему пулу
    console.log(`[LOYALTY_PROMO] Добавляем новые промокоды к существующему пулу для периода ${period}`);
    
    const promoCodes = [];
    let skippedCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Пропускаем заголовок (если есть) и пустые строки
      if (i === 0 && (line.toLowerCase().includes('code') || line.toLowerCase().includes('промокод'))) {
        console.log(`[LOYALTY_PROMO] Пропускаем заголовок: ${line}`);
        continue;
      }
      
      if (!line) {
        continue;
      }
      
      // Извлекаем только код промокода (первая часть до запятой)
      const code = line.split(',')[0].trim();
      
      if (!code || code.length === 0) {
        console.log(`[LOYALTY_PROMO] Пропускаем пустой код в строке ${i + 1}: "${line}"`);
        skippedCount++;
        continue;
      }
      
      try {
        // Создаем промокод лояльности
        const promoCode = new LoyaltyPromoCode({
          botId,
          period,
          code,
          activated: false
        });
        
        promoCodes.push(promoCode);
        console.log(`[LOYALTY_PROMO] Добавлен код: ${code}`);
      } catch (error) {
        console.error(`[LOYALTY_PROMO] Ошибка обработки строки ${i + 1}: "${line}"`, error);
        skippedCount++;
      }
    }
    
    if (promoCodes.length === 0) {
      return res.status(400).json({ error: 'Не найдено валидных промокодов' });
    }
    
    // Сохраняем все промокоды в базу данных с обработкой дубликатов
    let savedCount = 0;
    let saveSkippedCount = 0;
    const duplicates = [];
    
    for (const promoCode of promoCodes) {
      try {
        // Проверяем, существует ли уже такой промокод
        const existingPromo = await LoyaltyPromoCode.findOne({ 
          botId: promoCode.botId, 
          period: promoCode.period, 
          code: promoCode.code 
        });
        
        if (existingPromo) {
          // Дубликат - пропускаем
          duplicates.push({
            code: promoCode.code,
            period: promoCode.period
          });
          console.log(`🔄 [LOYALTY_PROMO] Пропущен дубликат промокода: ${promoCode.code} (уже существует)`);
          saveSkippedCount++;
        } else {
          // Новый промокод - сохраняем
          await promoCode.save();
          savedCount++;
          console.log(`✅ [LOYALTY_PROMO] Добавлен новый промокод: ${promoCode.code}`);
        }
      } catch (error) {
        console.error(`❌ Ошибка сохранения промокода лояльности ${promoCode.code}:`, error);
        saveSkippedCount++;
      }
    }
    
    console.log(`[LOYALTY_PROMO] Сохранено ${savedCount} промокодов в MongoDB, пропущено ${saveSkippedCount}`);
    
    // АВТОМАТИЧЕСКАЯ ВЫДАЧА ПРОМОКОДОВ ПОЛЬЗОВАТЕЛЯМ (после загрузки)
    console.log(`🎁 [AUTO_DISTRIBUTE] Начинаем автоматическую выдачу промокодов для периода ${period}`);
    
    const distributionResults = await distributePromoCodesToEligibleUsers(botId, period);
    
    res.json({
      success: true,
      message: `Успешно добавлено ${savedCount} новых промокодов для периода ${period}${duplicates.length > 0 ? `, пропущено дубликатов: ${duplicates.length}` : ''}`,
      totalCodes: savedCount,
      skippedCodes: saveSkippedCount,
      duplicates: duplicates,
      duplicatesCount: duplicates.length,
      period: period,
      autoDistribution: distributionResults
    });
    
  } catch (error) {
    console.error('[LOYALTY_PROMO] Ошибка загрузки промокодов лояльности:', error);
    res.status(500).json({ 
      error: 'Не удалось загрузить промокоды лояльности',
      details: error.message 
    });
  }
});

// Endpoint для получения промокодов лояльности для конкретного периода
app.get('/api/loyalty-promocodes/:botId/:period', async (req, res) => {
  try {
    const { botId, period } = req.params;
    
    // Проверяем валидность периода
    const validPeriods = ['1m', '24h', '7d', '30d', '90d', '180d', '360d'];
    if (!validPeriods.includes(period)) {
      return res.status(400).json({ error: 'Неверный период лояльности' });
    }
    
    const promoCodes = await LoyaltyPromoCode.find({ botId, period }).sort({ createdAt: -1 });
    
    const stats = {
      total: promoCodes.length,
      available: promoCodes.filter(p => !p.activated).length,
      used: promoCodes.filter(p => p.activated).length
    };
    
    res.json({
      success: true,
      period: period,
      stats: stats,
      promoCodes: promoCodes.map(p => ({
        code: p.code,
        activated: p.activated,
        activatedBy: p.activatedBy,
        activatedAt: p.activatedAt,
        createdAt: p.createdAt
      }))
    });
    
  } catch (error) {
    console.error('Ошибка получения промокодов лояльности:', error);
    res.status(500).json({ 
      error: 'Не удалось получить промокоды лояльности',
      details: error.message 
    });
  }
});

// Endpoint для настройки канала программы лояльности
app.post('/api/loyalty-channel/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { 
      isRequired, 
      channelId, 
      channelUsername, 
      channelTitle, 
      notSubscribedMessage 
    } = req.body;
    
    console.log(`[LOYALTY_CHANNEL] Настройка канала для бота ${botId}:`, {
      isRequired,
      channelId,
      channelUsername,
      channelTitle
    });
    
    // Находим или создаем конфигурацию лояльности
    let loyaltyConfig = await LoyaltyConfig.findOne({ botId });
    
    if (!loyaltyConfig) {
      loyaltyConfig = new LoyaltyConfig({
        botId,
        isEnabled: false,
        channelSettings: {
          isRequired: false,
          channelId: '',
          channelUsername: '',
          channelTitle: '',
          notSubscribedMessage: 'Для участия в программе лояльности необходимо подписаться на наш канал!'
        }
      });
    }
    
    // Обновляем настройки канала
    if (!loyaltyConfig.channelSettings) {
      loyaltyConfig.channelSettings = {};
    }
    
    loyaltyConfig.channelSettings.isRequired = isRequired || false;
    loyaltyConfig.channelSettings.channelId = channelId || '';
    loyaltyConfig.channelSettings.channelUsername = channelUsername || '';
    loyaltyConfig.channelSettings.channelTitle = channelTitle || '';
    loyaltyConfig.channelSettings.notSubscribedMessage = notSubscribedMessage || 
      'Для участия в программе лояльности необходимо подписаться на наш канал!';
    
    loyaltyConfig.updatedAt = new Date();
    
    await loyaltyConfig.save();
    
    console.log(`[LOYALTY_CHANNEL] Настройки канала сохранены для бота ${botId}`);
    
    res.json({
      success: true,
      message: 'Настройки канала успешно сохранены',
      channelSettings: loyaltyConfig.channelSettings
    });
    
  } catch (error) {
    console.error('[LOYALTY_CHANNEL] Ошибка настройки канала:', error);
    res.status(500).json({ 
      error: 'Не удалось сохранить настройки канала',
      details: error.message 
    });
  }
});

// Endpoint для получения настроек канала программы лояльности
app.get('/api/loyalty-channel/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    
    const loyaltyConfig = await LoyaltyConfig.findOne({ botId });
    
    if (!loyaltyConfig) {
      return res.json({
        success: true,
        channelSettings: {
          isRequired: false,
          channelId: '',
          channelUsername: '',
          channelTitle: '',
          notSubscribedMessage: 'Для участия в программе лояльности необходимо подписаться на наш канал!'
        }
      });
    }
    
    res.json({
      success: true,
      channelSettings: loyaltyConfig.channelSettings || {
        isRequired: false,
        channelId: '',
        channelUsername: '',
        channelTitle: '',
        notSubscribedMessage: 'Для участия в программе лояльности необходимо подписаться на наш канал!'
      }
    });
    
  } catch (error) {
    console.error('Ошибка получения настроек канала:', error);
    res.status(500).json({ 
      error: 'Не удалось получить настройки канала',
      details: error.message 
    });
  }
});

// Обработка завершения сервера
async function shutdownServer(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('Received ' + signal + ', shutting down...');
  await loyaltyJobs.recover();
  await Promise.all([...activeProcesses.keys()].map(botId => stopBot(botId, { deactivate: false })));
  await mongoose.disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdownServer('SIGINT'));
process.on('SIGTERM', () => shutdownServer('SIGTERM'));

// ==================== API ENDPOINTS ДЛЯ СТАТИСТИКИ ПО ИСТОЧНИКАМ ====================

// Получение статистики по источникам
app.get('/api/statistics/sources/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { startDate, endDate, loyaltyOnly } = req.query;
    
    // Парсим даты, если указаны
    const start = startDate ? new Date(startDate) : new Date(0); // Начало эпохи, если не указано
    const end = endDate ? new Date(endDate) : new Date(); // Текущая дата, если не указано
    
    // Получаем всех пользователей бота
    const users = await User.find({ botId }).lean();
    
    // Получаем всех пользователей, участвующих в программе лояльности
    const loyaltyUsers = await Loyalty.find({ botId }).lean();
    const loyaltyUserIds = new Set(loyaltyUsers.map(l => l.userId));
    
    // Группируем по источникам
    const sourceStats = {};
    let totalUsers = 0;
    let totalActiveTime = 0;
    let totalSubscribed = 0;
    let totalPromoCodes = 0;
    let totalQuizzes = 0;
    let totalLoyaltyUsers = 0;
    
    for (const user of users) {
      // Фильтруем по дате регистрации, если указан период
      if (user.firstSourceDate && (user.firstSourceDate < start || user.firstSourceDate > end)) {
        continue;
      }
      
      // Фильтруем по участию в программе лояльности, если указан фильтр
      const isLoyaltyUser = user.loyaltyStartedAt && loyaltyUserIds.has(user.userId);
      if (loyaltyOnly === 'true' && !isLoyaltyUser) {
        continue;
      }
      
      totalUsers++;
      const source = user.firstSource || 'direct';
      
      if (!sourceStats[source]) {
        sourceStats[source] = {
          source: source,
          users: 0,
          activeTime: 0,
          subscribed: 0,
          promoCodes: 0,
          quizzes: 0,
          loyaltyUsers: 0,
          avgActiveTime: 0
        };
      }
      
      sourceStats[source].users++;
      sourceStats[source].activeTime += user.sourceActiveTime || 0;
      totalActiveTime += user.sourceActiveTime || 0;
      
      if (user.isSubscribed) {
        sourceStats[source].subscribed++;
        totalSubscribed++;
      }
      
      if (isLoyaltyUser) {
        sourceStats[source].loyaltyUsers++;
        totalLoyaltyUsers++;
      }
    }
    
    // Получаем статистику по промокодам
    const promoCodes = await LoyaltyPromoCode.find({ 
      botId, 
      activated: true,
      activatedAt: { $gte: start, $lte: end }
    }).lean();
    
    for (const promoCode of promoCodes) {
      const user = users.find(u => u.userId === promoCode.activatedBy);
      if (user) {
        const source = user.firstSource || 'direct';
        if (sourceStats[source]) {
          sourceStats[source].promoCodes++;
          totalPromoCodes++;
        }
      }
    }
    
    // Получаем статистику по квизам
    const quizzes = await QuizStats.find({ 
      botId,
      completedAt: { $gte: start, $lte: end }
    }).lean();
    
    for (const quiz of quizzes) {
      const user = users.find(u => u.userId === quiz.userId);
      if (user) {
        const source = user.firstSource || 'direct';
        if (sourceStats[source]) {
          sourceStats[source].quizzes++;
          totalQuizzes++;
        }
      }
    }
    
    // Вычисляем среднее активное время для каждого источника
    Object.values(sourceStats).forEach(stat => {
      stat.avgActiveTime = stat.users > 0 ? Math.round(stat.activeTime / stat.users / 1000 / 60) : 0; // в минутах
      stat.activeTimeHours = Math.round(stat.activeTime / 1000 / 60 / 60 * 100) / 100; // в часах
    });
    
    // Общая статистика
    const generalStats = {
      totalUsers,
      totalActiveTime: Math.round(totalActiveTime / 1000 / 60 / 60 * 100) / 100, // в часах
      avgActiveTime: totalUsers > 0 ? Math.round(totalActiveTime / totalUsers / 1000 / 60) : 0, // в минутах
      totalPromoCodes,
      totalQuizzes,
      totalLoyaltyUsers
    };
    
    res.json({
      success: true,
      general: generalStats,
      bySource: Object.values(sourceStats).sort((a, b) => b.users - a.users), // Сортируем по количеству пользователей
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Ошибка при получении статистики:', error);
    res.status(500).json({ error: 'Failed to get statistics', details: error.message });
  }
});

// Получение списка пользователей с детальной информацией
app.get('/api/statistics/users/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { startDate, endDate, source, page = 1, limit = 50, search, loyaltyOnly } = req.query;
    
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    
    // Парсим даты
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Получаем всех пользователей, участвующих в программе лояльности
    const loyaltyUsers = await Loyalty.find({ botId }).lean();
    const loyaltyUserIds = new Set(loyaltyUsers.map(l => l.userId));
    
    // Строим фильтр
    const filter = { botId };
    
    if (startDate || endDate) {
      filter.firstSourceDate = {};
      if (startDate) filter.firstSourceDate.$gte = start;
      if (endDate) filter.firstSourceDate.$lte = end;
    }
    
    if (source && source !== 'all') {
      filter.firstSource = source;
    }
    
    if (search) {
      const searchConditions = [
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
      
      // Если поисковый запрос - число, добавляем поиск по userId
      if (!isNaN(search) && search.trim() !== '') {
        searchConditions.push({ userId: parseInt(search) });
      }
      
      if (searchConditions.length > 0) {
        filter.$or = searchConditions;
      }
    }
    
    // Получаем пользователей с пагинацией
    let users = await User.find(filter)
      .sort({ firstSourceDate: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();
    
    // Фильтруем по лояльности, если указан фильтр
    if (loyaltyOnly === 'true') {
      users = users.filter(user => user.loyaltyStartedAt && loyaltyUserIds.has(user.userId));
    }
    
    // Получаем общее количество для пагинации
    let totalUsers = await User.countDocuments(filter);
    if (loyaltyOnly === 'true') {
      const allUsers = await User.find(filter).lean();
      totalUsers = allUsers.filter(user => user.loyaltyStartedAt && loyaltyUserIds.has(user.userId)).length;
    }
    
    // Получаем статистику по промокодам и квизам для каждого пользователя
    const userIds = users.map(u => u.userId);
    
    const promoCodes = await LoyaltyPromoCode.find({
      botId,
      activatedBy: { $in: userIds },
      activated: true
    }).lean();
    
    const quizzes = await QuizStats.find({
      botId,
      userId: { $in: userIds }
    }).lean();
    
    // Группируем промокоды и квизы по пользователям
    const promoCodesByUser = {};
    promoCodes.forEach(pc => {
      if (!promoCodesByUser[pc.activatedBy]) {
        promoCodesByUser[pc.activatedBy] = 0;
      }
      promoCodesByUser[pc.activatedBy]++;
    });
    
    const quizzesByUser = {};
    quizzes.forEach(q => {
      if (!quizzesByUser[q.userId]) {
        quizzesByUser[q.userId] = 0;
      }
      quizzesByUser[q.userId]++;
    });
    
    // Формируем ответ с детальной информацией о каждом пользователе
    const usersWithStats = users.map(user => {
      const activeTimeHours = Math.round((user.sourceActiveTime || 0) / 1000 / 60 / 60 * 100) / 100;
      const activeTimeMinutes = Math.round((user.sourceActiveTime || 0) / 1000 / 60);
      const isLoyaltyUser = user.loyaltyStartedAt && loyaltyUserIds.has(user.userId);
      
      return {
        userId: user.userId,
        username: user.username || 'N/A',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        source: user.firstSource || 'direct',
        sourceDate: user.firstSourceDate ? user.firstSourceDate.toISOString() : null,
        activeTime: user.sourceActiveTime || 0,
        activeTimeHours: activeTimeHours,
        activeTimeMinutes: activeTimeMinutes,
        sessions: user.totalSessions || 0,
        isSubscribed: user.isSubscribed || false,
        promoCodes: promoCodesByUser[user.userId] || 0,
        quizzes: quizzesByUser[user.userId] || 0,
        registeredAt: user.firstSubscribedAt ? user.firstSubscribedAt.toISOString() : null,
        lastActivity: user.lastActivityTime ? user.lastActivityTime.toISOString() : null,
        isLoyaltyUser: isLoyaltyUser
      };
    });
    
    res.json({
      success: true,
      users: usersWithStats,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalUsers,
        pages: Math.ceil(totalUsers / limitNum)
      },
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    });
  } catch (error) {
    console.error('❌ Ошибка при получении списка пользователей:', error);
    res.status(500).json({ error: 'Failed to get users list', details: error.message });
  }
});

// Получение активных пользователей за период (день/неделя/месяц)
app.get('/api/statistics/active-users/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { period = 'day' } = req.query; // day, week, month
    
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(now.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 1);
    }
    
    startDate.setUTCHours(0, 0, 0, 0);
    
    // Получаем статистику по дням
    const stats = await DailyActivityStats.find({
      botId,
      date: { $gte: startDate }
    }).sort({ date: -1 }).lean();
    
    // Также считаем из User по lastActivityTime
    const activeUsersFromUser = await User.countDocuments({
      botId,
      lastActivityTime: { $gte: startDate }
    });
    
    res.json({
      success: true,
      period,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      dailyStats: stats,
      totalActiveUsers: activeUsersFromUser,
      totalDays: stats.length
    });
  } catch (error) {
    console.error('❌ Ошибка при получении активных пользователей:', error);
    res.status(500).json({ error: 'Failed to get active users', details: error.message });
  }
});

// Получение популярных блоков
app.get('/api/statistics/popular-blocks/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { limit = 10 } = req.query;
    
    const blocks = await BlockStats.find({ botId })
      .sort({ enterCount: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json({
      success: true,
      blocks: blocks.map(b => ({
        blockId: b.blockId,
        blockName: b.blockName || b.blockId,
        enterCount: b.enterCount,
        uniqueUsers: b.uniqueUsers,
        lastEnteredAt: b.lastEnteredAt
      }))
    });
  } catch (error) {
    console.error('❌ Ошибка при получении популярных блоков:', error);
    res.status(500).json({ error: 'Failed to get popular blocks', details: error.message });
  }
});

// Получение популярных кнопок
app.get('/api/statistics/popular-buttons/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { limit = 10, blockId } = req.query;
    
    const query = { botId };
    if (blockId) {
      query.blockId = blockId;
    }
    
    const buttons = await ButtonStats.find(query)
      .sort({ clickCount: -1 })
      .limit(parseInt(limit))
      .lean();
    
    res.json({
      success: true,
      buttons: buttons.map(b => ({
        blockId: b.blockId,
        buttonId: b.buttonId,
        buttonText: b.buttonText || b.buttonId,
        clickCount: b.clickCount,
        uniqueUsers: b.uniqueUsers,
        lastClickedAt: b.lastClickedAt
      }))
    });
  } catch (error) {
    console.error('❌ Ошибка при получении популярных кнопок:', error);
    res.status(500).json({ error: 'Failed to get popular buttons', details: error.message });
  }
});

// Получение маршрута конкретного пользователя
app.get('/api/statistics/user-path/:botId/:userId', async (req, res) => {
  try {
    const { botId, userId } = req.params;
    const { limit = 100 } = req.query;
    
    const user = await User.findOne({ botId, userId: parseInt(userId) });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Получаем маршрут пользователя, отсортированный по времени
    const navigationPath = await UserNavigationPath.find({ 
      botId, 
      userId: parseInt(userId) 
    })
      .sort({ timestamp: 1 })
      .limit(parseInt(limit))
      .lean();
    
    // Группируем по сессиям
    const sessions = {};
    navigationPath.forEach(path => {
      if (!sessions[path.sessionId]) {
        sessions[path.sessionId] = {
          sessionId: path.sessionId,
          startTime: path.timestamp,
          endTime: path.timestamp,
          events: []
        };
      }
      sessions[path.sessionId].events.push({
        blockId: path.blockId,
        blockName: path.blockName || path.blockId,
        action: path.action,
        buttonId: path.buttonId,
        buttonText: path.buttonText,
        previousBlockId: path.previousBlockId,
        timestamp: path.timestamp
      });
      if (path.timestamp < sessions[path.sessionId].startTime) {
        sessions[path.sessionId].startTime = path.timestamp;
      }
      if (path.timestamp > sessions[path.sessionId].endTime) {
        sessions[path.sessionId].endTime = path.timestamp;
      }
    });
    
    res.json({
      success: true,
      userId: parseInt(userId),
      username: user.username || 'N/A',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      totalEvents: navigationPath.length,
      sessions: Object.values(sessions).map(session => ({
        ...session,
        duration: new Date(session.endTime) - new Date(session.startTime)
      }))
    });
  } catch (error) {
    console.error('❌ Ошибка при получении маршрута пользователя:', error);
    res.status(500).json({ error: 'Failed to get user path', details: error.message });
  }
});

// Получение ежедневной статистики (команды /start, нажатия кнопок)
app.get('/api/statistics/daily/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { date } = req.query; // YYYY-MM-DD или не указано (сегодня)
    
    let targetDate = new Date();
    if (date) {
      targetDate = new Date(date);
    }
    targetDate.setUTCHours(0, 0, 0, 0);
    
    const stats = await DailyActivityStats.findOne({ botId, date: targetDate }).lean();
    
    if (!stats) {
      return res.json({
        success: true,
        date: targetDate.toISOString(),
        activeUsers: 0,
        startCommandUsers: 0,
        buttonClickUsers: 0,
        totalButtonClicks: 0,
        totalCommands: 0
      });
    }
    
    res.json({
      success: true,
      date: stats.date.toISOString(),
      activeUsers: stats.activeUsers || 0,
      startCommandUsers: stats.startCommandUsers || 0,
      buttonClickUsers: stats.buttonClickUsers || 0,
      totalButtonClicks: stats.totalButtonClicks || 0,
      totalCommands: stats.totalCommands || 0
    });
  } catch (error) {
    console.error('❌ Ошибка при получении ежедневной статистики:', error);
    res.status(500).json({ error: 'Failed to get daily statistics', details: error.message });
  }
});

// Экспорт статистики в Excel
app.post('/api/statistics/export/:botId', async (req, res) => {
  try {
    const ExcelJS = require('exceljs');
    const { botId } = req.params;
    const { startDate, endDate } = req.body;
    
    // Парсим даты
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    
    // Получаем статистику (используем ту же логику, что и в GET endpoint)
    const users = await User.find({ botId }).lean();
    const sourceStats = {};
    let totalUsers = 0;
    let totalActiveTime = 0;
    let totalSubscribed = 0;
    let totalPromoCodes = 0;
    let totalQuizzes = 0;
    
    for (const user of users) {
      if (user.firstSourceDate && (user.firstSourceDate < start || user.firstSourceDate > end)) {
        continue;
      }
      
      totalUsers++;
      const source = user.firstSource || 'direct';
      
      if (!sourceStats[source]) {
        sourceStats[source] = {
          source: source,
          users: 0,
          activeTime: 0,
          subscribed: 0,
          promoCodes: 0,
          quizzes: 0
        };
      }
      
      sourceStats[source].users++;
      sourceStats[source].activeTime += user.sourceActiveTime || 0;
      totalActiveTime += user.sourceActiveTime || 0;
      
      if (user.isSubscribed) {
        sourceStats[source].subscribed++;
        totalSubscribed++;
      }
    }
    
    const promoCodes = await LoyaltyPromoCode.find({ 
      botId, 
      activated: true,
      activatedAt: { $gte: start, $lte: end }
    }).lean();
    
    for (const promoCode of promoCodes) {
      const user = users.find(u => u.userId === promoCode.activatedBy);
      if (user) {
        const source = user.firstSource || 'direct';
        if (sourceStats[source]) {
          sourceStats[source].promoCodes++;
          totalPromoCodes++;
        }
      }
    }
    
    const quizzes = await QuizStats.find({ 
      botId,
      completedAt: { $gte: start, $lte: end }
    }).lean();
    
    for (const quiz of quizzes) {
      const user = users.find(u => u.userId === quiz.userId);
      if (user) {
        const source = user.firstSource || 'direct';
        if (sourceStats[source]) {
          sourceStats[source].quizzes++;
          totalQuizzes++;
        }
      }
    }
    
    // Создаем Excel файл
    const workbook = new ExcelJS.Workbook();
    
    // Лист 1: Общая статистика
    const generalSheet = workbook.addWorksheet('Общая статистика');
    generalSheet.columns = [
      { header: 'Метрика', key: 'metric', width: 30 },
      { header: 'Значение', key: 'value', width: 20 }
    ];
    
    // Функция для форматирования времени из часов в читаемый формат
    const formatTimeFromHours = (hours) => {
      if (!hours || hours === 0) {
        return '00:00';
      }
      const totalMinutes = Math.round(hours * 60);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    generalSheet.addRow({ metric: 'Общее количество пользователей', value: totalUsers });
    generalSheet.addRow({ metric: 'Активных за период', value: totalUsers });
    const totalActiveTimeHours = Math.round(totalActiveTime / 1000 / 60 / 60 * 100) / 100;
    generalSheet.addRow({ metric: 'Общее активное время', value: formatTimeFromHours(totalActiveTimeHours) });
    generalSheet.addRow({ metric: 'Среднее время на пользователя (минуты)', value: totalUsers > 0 ? Math.round(totalActiveTime / totalUsers / 1000 / 60) : 0 });
    generalSheet.addRow({ metric: 'Выдано промокодов', value: totalPromoCodes });
    generalSheet.addRow({ metric: 'Завершено квизов', value: totalQuizzes });
    generalSheet.addRow({ metric: 'Период', value: `${start.toLocaleDateString('ru-RU')} - ${end.toLocaleDateString('ru-RU')}` });
    
    // Лист 2: По источникам
    const sourcesSheet = workbook.addWorksheet('По источникам');
    sourcesSheet.columns = [
      { header: 'Источник', key: 'source', width: 25 },
      { header: 'Пользователей', key: 'users', width: 15 },
      { header: 'Активное время', key: 'activeTime', width: 30 },
      { header: 'Среднее время (минуты)', key: 'avgTime', width: 20 },
      { header: 'Промокоды', key: 'promoCodes', width: 15 },
      { header: 'Квизы', key: 'quizzes', width: 15 }
    ];
    
    const sourceStatsArray = Object.values(sourceStats).sort((a, b) => b.users - a.users);
    for (const stat of sourceStatsArray) {
      const activeTimeHours = Math.round(stat.activeTime / 1000 / 60 / 60 * 100) / 100;
      sourcesSheet.addRow({
        source: stat.source,
        users: stat.users,
        activeTime: formatTimeFromHours(activeTimeHours),
        avgTime: stat.users > 0 ? Math.round(stat.activeTime / stat.users / 1000 / 60) : 0,
        promoCodes: stat.promoCodes,
        quizzes: stat.quizzes
      });
    }
    
    // Лист 3: Детализация по дням
    const dailySheet = workbook.addWorksheet('Детализация по дням');
    dailySheet.columns = [
      { header: 'Дата', key: 'date', width: 15 },
      { header: 'Источник', key: 'source', width: 25 },
      { header: 'Новые пользователи', key: 'newUsers', width: 18 },
      { header: 'Активное время', key: 'activeTime', width: 30 },
      { header: 'Промокоды', key: 'promoCodes', width: 15 },
      { header: 'Квизы', key: 'quizzes', width: 15 }
    ];
    
    // Группируем по дням
    const dailyStats = {};
    for (const user of users) {
      if (!user.firstSourceDate || user.firstSourceDate < start || user.firstSourceDate > end) {
        continue;
      }
      
      const dateKey = user.firstSourceDate.toISOString().split('T')[0];
      const source = user.firstSource || 'direct';
      const key = `${dateKey}_${source}`;
      
      if (!dailyStats[key]) {
        dailyStats[key] = {
          date: dateKey,
          source: source,
          newUsers: 0,
          activeTime: 0,
          promoCodes: 0,
          quizzes: 0
        };
      }
      
      dailyStats[key].newUsers++;
      dailyStats[key].activeTime += user.sourceActiveTime || 0;
    }
    
    // Добавляем промокоды и квизы по дням
    for (const promoCode of promoCodes) {
      const user = users.find(u => u.userId === promoCode.activatedBy);
      if (user && user.firstSourceDate) {
        const dateKey = promoCode.activatedAt.toISOString().split('T')[0];
        const source = user.firstSource || 'direct';
        const key = `${dateKey}_${source}`;
        if (dailyStats[key]) {
          dailyStats[key].promoCodes++;
        }
      }
    }
    
    for (const quiz of quizzes) {
      const user = users.find(u => u.userId === quiz.userId);
      if (user && user.firstSourceDate) {
        const dateKey = quiz.completedAt.toISOString().split('T')[0];
        const source = user.firstSource || 'direct';
        const key = `${dateKey}_${source}`;
        if (dailyStats[key]) {
          dailyStats[key].quizzes++;
        }
      }
    }
    
    const dailyStatsArray = Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
    for (const stat of dailyStatsArray) {
      const activeTimeHours = Math.round(stat.activeTime / 1000 / 60 / 60 * 100) / 100;
      dailySheet.addRow({
        date: new Date(stat.date).toLocaleDateString('ru-RU'),
        source: stat.source,
        newUsers: stat.newUsers,
        activeTime: formatTimeFromHours(activeTimeHours),
        promoCodes: stat.promoCodes,
        quizzes: stat.quizzes
      });
    }
    
    // Лист 4: Топ пользователей
    const topUsersSheet = workbook.addWorksheet('Топ пользователей');
    topUsersSheet.columns = [
      { header: 'User ID', key: 'userId', width: 15 },
      { header: 'Источник', key: 'source', width: 20 },
      { header: 'Активное время (часы)', key: 'activeTime', width: 20 },
      { header: 'Промокоды', key: 'promoCodes', width: 15 },
      { header: 'Квизы', key: 'quizzes', width: 15 },
      { header: 'Дата регистрации', key: 'regDate', width: 20 }
    ];
    
    // Получаем топ пользователей по активному времени
    const topUsers = users
      .filter(u => u.sourceActiveTime > 0)
      .sort((a, b) => (b.sourceActiveTime || 0) - (a.sourceActiveTime || 0))
      .slice(0, 100); // Топ 100
    
    for (const user of topUsers) {
      const userPromoCodes = promoCodes.filter(p => p.activatedBy === user.userId).length;
      const userQuizzes = quizzes.filter(q => q.userId === user.userId).length;
      
      topUsersSheet.addRow({
        userId: user.userId,
        source: user.firstSource || 'direct',
        activeTime: Math.round((user.sourceActiveTime || 0) / 1000 / 60 / 60 * 100) / 100,
        promoCodes: userPromoCodes,
        quizzes: userQuizzes,
        regDate: user.firstSourceDate ? user.firstSourceDate.toLocaleDateString('ru-RU') : 'N/A'
      });
    }
    
    // Генерируем файл
    const buffer = await workbook.xlsx.writeBuffer();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=statistics_${botId}_${new Date().toISOString().split('T')[0]}.xlsx`);
    res.send(buffer);
  } catch (error) {
    console.error('❌ Ошибка при экспорте статистики:', error);
    res.status(500).json({ error: 'Failed to export statistics', details: error.message });
  }
});

// ==================== КОНЕЦ API ENDPOINTS ДЛЯ СТАТИСТИКИ ====================

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
  
  await loyaltyJobs.recover();
  console.log('✅ MongoDB connection confirmed, starting initialization...');
  
  // Загружаем активные боты из MongoDB
  try {
    const activeBots = await Bot.find({ isActive: true });
    console.log(`🤖 Loaded ${activeBots.length} active bots from MongoDB`);
    
    // Start independently: an idle bot's first long poll can take 50 seconds.
    await Promise.all(activeBots.map(async (bot) => {
      try {
        await startBot(bot);
        console.log(`✅ Bot ${bot.id} started successfully`);
      } catch (error) {
        console.error(`❌ Failed to start bot ${bot.id}:`, error);
        // Keep isActive=true: the monitor retries transient startup failures.
      }
    }));
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

// ==================== API ENDPOINTS ДЛЯ РОЗЫГРЫШЕЙ ====================

// Получение списка розыгрышей
app.get('/api/giveaways/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const giveaways = await Giveaway.find({ botId }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, giveaways });
  } catch (error) {
    console.error('❌ Ошибка при получении розыгрышей:', error);
    res.status(500).json({ error: 'Failed to get giveaways', details: error.message });
  }
});

// Создание нового розыгрыша
app.post('/api/giveaways/:botId', async (req, res) => {
  try {
    const { botId } = req.params;
    const { name, prizes, description, selectedChannels, colorPalette } = req.body;
    
    // Конвертируем старый формат (place) в новый (placeStart/placeEnd) для обратной совместимости
    let prizesArray = prizes || [];
    if (prizesArray.length === 0) {
      prizesArray = [{ placeStart: 1, placeEnd: 1, name: 'Приз 1', prizeImage: null, winner: null, winners: [] }];
    } else {
      prizesArray = prizesArray.map(prize => {
        if (prize.place !== undefined) {
          // Старый формат - конвертируем
          return {
            placeStart: prize.place,
            placeEnd: prize.place,
            name: prize.name || `Приз ${prize.place}`,
            prizeImage: prize.prizeImage || null,
            winner: prize.winner || null,
            winners: []
          };
        }
        // Новый формат - нормализуем
        return {
          placeStart: prize.placeStart || 1,
          placeEnd: prize.placeEnd || prize.placeStart || 1,
          name: prize.name || 'Приз',
          prizeImage: prize.prizeImage || null,
          winner: prize.winner || null,
          winners: prize.winners || []
        };
      });
    }
    
    const giveaway = new Giveaway({
      botId,
      name: name || 'Розыгрыш',
      prizes: prizesArray,
      description: description || '',
      selectedChannels: selectedChannels || [],
      colorPalette: colorPalette || {
        backgroundColor: '#1a1a2e',
        winnerColor: '#ffd700',
        winnerTextColor: '#000000',
        participantColor: '#ffffff',
        cardColor: '#667eea'
      },
      status: 'draft'
    });
    
    await giveaway.save();
    res.json({ success: true, giveaway });
  } catch (error) {
    console.error('❌ Ошибка при создании розыгрыша:', error);
    res.status(500).json({ error: 'Failed to create giveaway', details: error.message });
  }
});

// Обновление розыгрыша
app.put('/api/giveaways/:botId/:giveawayId', async (req, res) => {
  try {
    const { botId, giveawayId } = req.params;
    const { name, prizes, description, selectedChannels, colorPalette } = req.body;
    
    const giveaway = await Giveaway.findOne({ _id: giveawayId, botId });
    if (!giveaway) {
      return res.status(404).json({ error: 'Giveaway not found' });
    }
    
    const updateData = {
      updatedAt: new Date()
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (selectedChannels !== undefined) updateData.selectedChannels = selectedChannels;
    if (colorPalette !== undefined) updateData.colorPalette = colorPalette;
    
    // Обновляем призы
    if (prizes !== undefined) {
      // Конвертируем и нормализуем данные призов
      updateData.prizes = prizes.map(prize => {
        // Конвертируем старый формат
        const placeStart = prize.placeStart !== undefined ? prize.placeStart : (prize.place || 1);
        const placeEnd = prize.placeEnd !== undefined ? prize.placeEnd : (prize.place || 1);
        
        const normalizedPrize = {
          placeStart,
          placeEnd,
          name: prize.name || 'Приз',
          prizeImage: prize.prizeImage || null,
          winner: null,
          winners: []
        };
        
        // Нормализуем данные победителей
        if (placeStart === placeEnd) {
          // Одно место - один победитель
          normalizedPrize.winner = prize.winner && prize.winner.userId ? {
            userId: Number(prize.winner.userId),
            username: String(prize.winner.username || ''),
            firstName: String(prize.winner.firstName || ''),
            lastName: String(prize.winner.lastName || ''),
            project: String(prize.winner.project || '')
          } : null;
        } else {
          // Диапазон - массив победителей
          normalizedPrize.winners = (prize.winners || []).map(w => ({
            userId: Number(w.userId),
            username: String(w.username || ''),
            firstName: String(w.firstName || ''),
            lastName: String(w.lastName || ''),
            project: String(w.project || '')
          }));
        }
        
        return normalizedPrize;
      });
    }
    
    const updatedGiveaway = await Giveaway.findOneAndUpdate(
      { _id: giveawayId, botId },
      { $set: updateData },
      { new: true }
    );
    
    res.json({ success: true, giveaway: updatedGiveaway });
  } catch (error) {
    console.error('❌ Ошибка при обновлении розыгрыша:', error);
    res.status(500).json({ error: 'Failed to update giveaway', details: error.message });
  }
});

// Загрузка CSV файла с участниками для розыгрышей
const giveawayUpload = multer({ storage: multer.memoryStorage() });

// Загрузка фонового изображения для розыгрыша
const giveawayImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(__dirname, 'uploads', 'giveaway_backgrounds');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `bg_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// Загрузка изображения приза
const prizeImageUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadsDir = path.join(__dirname, 'uploads', 'prize_images');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, `prize_${uniqueSuffix}${path.extname(file.originalname)}`);
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения (JPEG, PNG, GIF, WebP)'));
    }
  }
});

app.post('/api/giveaways/:botId/:giveawayId/upload', giveawayUpload.single('file'), async (req, res) => {
  try {
    const { botId, giveawayId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const giveaway = await Giveaway.findOne({ _id: giveawayId, botId });
    if (!giveaway) {
      return res.status(404).json({ error: 'Giveaway not found' });
    }
    
    // Парсим CSV файл
    const csvContent = req.file.buffer.toString('utf8');
    const lines = csvContent.split('\n').filter(line => line.trim());
    
    const participants = [];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 3) {
        const userId = parseInt(parts[0]);
        const project = parts[1] || '';
        const weight = parseFloat(parts[2]) || 1;
        
        if (!isNaN(userId)) {
          // Получаем информацию о пользователе из базы
          const user = await User.findOne({ botId, userId }).lean();
          
          participants.push({
            userId,
            username: user?.username || '',
            firstName: user?.firstName || '',
            lastName: user?.lastName || '',
            project,
            weight: Math.max(0, weight) // Вес должен быть >= 0
          });
        }
      }
    }
    
    // Обновляем розыгрыш
    giveaway.participants = participants;
    await giveaway.save();
    
    res.json({ success: true, giveaway, participantsCount: participants.length });
  } catch (error) {
    console.error('❌ Ошибка при загрузке CSV:', error);
    res.status(500).json({ error: 'Failed to upload CSV', details: error.message });
  }
});

// Загрузка фонового изображения для розыгрыша
app.post('/api/giveaways/:botId/:giveawayId/upload-background', giveawayImageUpload.single('backgroundImage'), async (req, res) => {
  try {
    const { botId, giveawayId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const giveaway = await Giveaway.findOne({ _id: giveawayId, botId });
    if (!giveaway) {
      // Удаляем загруженный файл, если розыгрыш не найден
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Giveaway not found' });
    }
    
    // Удаляем старое изображение, если оно было
    if (giveaway.backgroundImage && fs.existsSync(path.join(__dirname, giveaway.backgroundImage))) {
      try {
        fs.unlinkSync(path.join(__dirname, giveaway.backgroundImage));
      } catch (err) {
        console.error('⚠️ Ошибка удаления старого изображения:', err);
      }
    }
    
    // Сохраняем относительный путь к изображению
    const relativePath = path.relative(__dirname, req.file.path);
    // Используем updateOne для сохранения только backgroundImage, чтобы не потерять другие данные
    await Giveaway.updateOne(
      { _id: giveawayId, botId },
      { $set: { backgroundImage: relativePath, updatedAt: new Date() } }
    );
    
    // Получаем обновленный розыгрыш для ответа
    const updatedGiveaway = await Giveaway.findOne({ _id: giveawayId, botId });
    
    res.json({ 
      success: true, 
      backgroundImage: relativePath,
      giveaway: updatedGiveaway
    });
  } catch (error) {
    console.error('❌ Ошибка при загрузке фонового изображения:', error);
    // Удаляем загруженный файл при ошибке
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('⚠️ Ошибка удаления файла при ошибке:', err);
      }
    }
    res.status(500).json({ error: 'Failed to upload background image', details: error.message });
  }
});

// Загрузка изображения приза
app.post('/api/giveaways/:botId/:giveawayId/prize/:prizeIndex/upload-image', prizeImageUpload.single('prizeImage'), async (req, res) => {
  try {
    const { botId, giveawayId, prizeIndex } = req.params;
    const prizeIdx = parseInt(prizeIndex, 10);
    
    console.log('📸 [PRIZE_IMAGE] Запрос на загрузку изображения приза:', {
      botId,
      giveawayId,
      prizeIndex,
      prizeIdx,
      file: req.file ? req.file.originalname : 'no file'
    });
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const giveaway = await Giveaway.findOne({ _id: giveawayId, botId });
    if (!giveaway) {
      // Удаляем загруженный файл, если розыгрыш не найден
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Giveaway not found' });
    }
    
    console.log('📸 [PRIZE_IMAGE] Розыгрыш найден:', {
      prizesCount: giveaway.prizes ? giveaway.prizes.length : 0,
      prizes: giveaway.prizes ? giveaway.prizes.map((p, i) => ({ index: i, name: p.name, prizeImage: p.prizeImage })) : []
    });
    
    // Проверяем валидность индекса
    if (isNaN(prizeIdx) || prizeIdx < 0) {
      console.error('❌ [PRIZE_IMAGE] Невалидный индекс:', prizeIdx);
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Invalid prize index' });
    }
    
    if (!giveaway.prizes || !Array.isArray(giveaway.prizes) || prizeIdx >= giveaway.prizes.length) {
      // Удаляем загруженный файл, если приз не найден
      console.error('❌ [PRIZE_IMAGE] Приз не найден:', {
        prizeIndex: prizeIdx,
        prizesCount: giveaway.prizes ? giveaway.prizes.length : 0,
        prizes: giveaway.prizes ? giveaway.prizes.map((p, i) => ({ index: i, name: p.name })) : []
      });
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: `Prize not found at index ${prizeIdx}. Total prizes: ${giveaway.prizes ? giveaway.prizes.length : 0}` });
    }
    
    // Удаляем старое изображение приза, если оно было
    const oldPrizeImage = giveaway.prizes[prizeIdx].prizeImage;
    if (oldPrizeImage && fs.existsSync(path.join(__dirname, oldPrizeImage))) {
      try {
        fs.unlinkSync(path.join(__dirname, oldPrizeImage));
      } catch (err) {
        console.error('⚠️ Ошибка удаления старого изображения приза:', err);
      }
    }
    
    // Сохраняем относительный путь к изображению
    const relativePath = path.relative(__dirname, req.file.path);
    console.log('📸 [PRIZE_IMAGE] Сохраняем изображение приза:', {
      prizeIndex: prizeIdx,
      relativePath,
      currentPrize: giveaway.prizes[prizeIdx] ? {
        name: giveaway.prizes[prizeIdx].name,
        currentImage: giveaway.prizes[prizeIdx].prizeImage
      } : 'not found',
      allPrizes: giveaway.prizes.map((p, i) => ({ index: i, name: p.name }))
    });
    
    // Обновляем изображение приза напрямую в документе
    if (!giveaway.prizes[prizeIdx]) {
      console.error('❌ [PRIZE_IMAGE] Приз не найден по индексу:', {
        requestedIndex: prizeIdx,
        availablePrizes: giveaway.prizes.map((p, i) => ({ index: i, name: p.name }))
      });
      if (req.file.path) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Prize not found at index ' + prizeIdx });
    }
    
    // Создаем новый массив призов с обновленным изображением
    const updatedPrizes = giveaway.prizes.map((prize, idx) => {
      if (idx === prizeIdx) {
        return {
          ...prize.toObject ? prize.toObject() : prize,
          prizeImage: relativePath
        };
      }
      return prize.toObject ? prize.toObject() : prize;
    });
    
    // Обновляем через updateOne с полным массивом
    await Giveaway.updateOne(
      { _id: giveawayId, botId },
      { 
        $set: { 
          prizes: updatedPrizes,
          updatedAt: new Date() 
        } 
      }
    );
    
    console.log('✅ [PRIZE_IMAGE] Изображение приза сохранено. Проверяем результат...');
    
    // Получаем обновленный розыгрыш для ответа
    const updatedGiveaway = await Giveaway.findOne({ _id: giveawayId, botId }).lean();
    
    console.log('🔍 [PRIZE_IMAGE] Обновленный приз:', updatedGiveaway.prizes[prizeIdx] ? {
      name: updatedGiveaway.prizes[prizeIdx].name,
      prizeImage: updatedGiveaway.prizes[prizeIdx].prizeImage
    } : 'not found');
    
    res.json({ 
      success: true, 
      prizeImage: relativePath,
      giveaway: updatedGiveaway
    });
  } catch (error) {
    console.error('❌ Ошибка при загрузке изображения приза:', error);
    // Удаляем загруженный файл при ошибке
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        console.error('⚠️ Ошибка удаления файла при ошибке:', err);
      }
    }
    res.status(500).json({ error: 'Failed to upload prize image', details: error.message });
  }
});

// Функция для случайного выбора с учетом весов
function weightedRandomSelect(items, count) {
  if (items.length === 0 || count === 0) return [];
  if (count >= items.length) return [...items];
  
  // Вычисляем общий вес
  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  
  const selected = [];
  const available = [...items];
  
  for (let i = 0; i < count && available.length > 0; i++) {
    // Генерируем случайное число от 0 до totalWeight
    let random = Math.random() * totalWeight;
    
    // Находим элемент, соответствующий этому числу
    let currentWeight = 0;
    for (let j = 0; j < available.length; j++) {
      currentWeight += available[j].weight || 1;
      if (random <= currentWeight) {
        selected.push(available[j]);
        // Убираем выбранный элемент и обновляем totalWeight
        totalWeight -= (available[j].weight || 1);
        available.splice(j, 1);
        break;
      }
    }
  }
  
  return selected;
}

// Выбор случайных победителей
app.post('/api/giveaways/:botId/:giveawayId/random-winners', async (req, res) => {
  try {
    const { botId, giveawayId } = req.params;
    const { prizes: requestedPrizes } = req.body;
    
    const giveaway = await Giveaway.findOne({ _id: giveawayId, botId });
    if (!giveaway) {
      return res.status(404).json({ error: 'Giveaway not found' });
    }
    
    if (!giveaway.participants || giveaway.participants.length === 0) {
      return res.status(400).json({ error: 'No participants loaded' });
    }
    
    // Используем призы из запроса или из БД
    const prizesToProcess = requestedPrizes || giveaway.prizes;
    
    // Определяем, для каких призов нужно выбрать победителей и сколько нужно
    let totalWinnersNeeded = 0;
    const prizesNeedingWinners = [];
    
    prizesToProcess.forEach((prize, index) => {
      const placeStart = prize.placeStart || (prize.place || 1);
      const placeEnd = prize.placeEnd || placeStart;
      const placesCount = placeEnd - placeStart + 1;
      
      if (placeStart === placeEnd) {
        // Одно место - нужен один победитель
        if (!prize.winner || !prize.winner.userId) {
          prizesNeedingWinners.push({ index, prize, placesCount: 1, isRange: false });
          totalWinnersNeeded += 1;
        }
      } else {
        // Диапазон - нужно несколько победителей
        const currentWinners = prize.winners || [];
        const needed = placesCount - currentWinners.length;
        if (needed > 0) {
          prizesNeedingWinners.push({ index, prize, placesCount: needed, isRange: true, currentWinners });
          totalWinnersNeeded += needed;
        }
      }
    });
    
    if (totalWinnersNeeded === 0) {
      // Все победители уже выбраны
      return res.json({ success: true, prizes: prizesToProcess });
    }
    
    // Получаем уже выбранных победителей, чтобы исключить их из выборки
    const alreadySelectedUserIds = new Set();
    prizesToProcess.forEach(prize => {
      if (prize.placeStart === prize.placeEnd || (prize.placeStart === undefined && prize.place === prize.place)) {
        // Одно место
        if (prize.winner && prize.winner.userId) {
          alreadySelectedUserIds.add(String(prize.winner.userId));
        }
      } else {
        // Диапазон
        if (prize.winners && Array.isArray(prize.winners)) {
          prize.winners.forEach(w => {
            if (w.userId) alreadySelectedUserIds.add(String(w.userId));
          });
        }
      }
    });
    
    // Фильтруем участников, исключая уже выбранных
    const availableParticipants = giveaway.participants.filter(
      p => !alreadySelectedUserIds.has(String(p.userId))
    );
    
    if (availableParticipants.length < totalWinnersNeeded) {
      return res.status(400).json({ 
        error: `Недостаточно доступных участников. Нужно: ${totalWinnersNeeded}, доступно: ${availableParticipants.length}` 
      });
    }
    
    // Выбираем случайных победителей с учетом весов
    const allWinners = weightedRandomSelect(availableParticipants, totalWinnersNeeded);
    let winnerIndex = 0;
    
    // Обновляем призы
    const updatedPrizes = prizesToProcess.map((prize, index) => {
      const needWinners = prizesNeedingWinners.find(p => p.index === index);
      if (!needWinners) {
        // Победители уже выбраны - оставляем как есть
        return prize;
      }
      
      const placeStart = prize.placeStart || (prize.place || 1);
      const placeEnd = prize.placeEnd || placeStart;
      
      if (placeStart === placeEnd) {
        // Одно место - один победитель
        if (winnerIndex < allWinners.length) {
          return {
            ...prize,
            placeStart,
            placeEnd,
            winner: allWinners[winnerIndex++],
            winners: []
          };
        }
      } else {
        // Диапазон - массив победителей
        const existingWinners = prize.winners || [];
        const newWinners = [];
        for (let i = 0; i < needWinners.placesCount && winnerIndex < allWinners.length; i++) {
          newWinners.push(allWinners[winnerIndex++]);
        }
        return {
          ...prize,
          placeStart,
          placeEnd,
          winner: null,
          winners: [...existingWinners, ...newWinners]
        };
      }
      
      return prize;
    });
    
    // Обновляем розыгрыш
    giveaway.prizes = updatedPrizes;
    await giveaway.save();
    
    res.json({ success: true, prizes: updatedPrizes });
  } catch (error) {
    console.error('❌ Ошибка при выборе победителей:', error);
    res.status(500).json({ error: 'Failed to select winners', details: error.message });
  }
});


// Отправка результатов розыгрыша в каналы
app.post('/api/giveaways/:botId/:giveawayId/publish', async (req, res) => {
  try {
    const { botId, giveawayId } = req.params;
    const { description, selectedChannels } = req.body;
    
    const giveaway = await Giveaway.findOne({ _id: giveawayId, botId });
    if (!giveaway) {
      return res.status(404).json({ error: 'Giveaway not found' });
    }
    
    if (!selectedChannels || selectedChannels.length === 0) {
      return res.status(400).json({ error: 'No channels selected' });
    }
    
    // Проверяем наличие участников
    if (!giveaway.participants || giveaway.participants.length === 0) {
      return res.status(400).json({ error: 'Необходимо загрузить участников перед публикацией' });
    }
    
    // Логируем данные розыгрыша для отладки
    console.log('🔍 [GIVEAWAY] Данные розыгрыша из БД:', JSON.stringify({
      prizes: giveaway.prizes,
      prizesCount: giveaway.prizes?.length
    }, null, 2));
    
    // Проверяем, есть ли невыбранные победители, и выбираем их автоматически
    let totalWinnersNeeded = 0;
    const prizesNeedingWinners = [];
    
    giveaway.prizes.forEach((prize, index) => {
      const placeStart = prize.placeStart || (prize.place || 1);
      const placeEnd = prize.placeEnd || placeStart;
      const placesCount = placeEnd - placeStart + 1;
      
      if (placeStart === placeEnd) {
        // Одно место - нужен один победитель
        if (!prize.winner || !prize.winner.userId) {
          prizesNeedingWinners.push({ index, prize, placesCount: 1, isRange: false });
          totalWinnersNeeded += 1;
        }
      } else {
        // Диапазон - нужно несколько победителей
        const currentWinners = prize.winners || [];
        const needed = placesCount - currentWinners.length;
        if (needed > 0) {
          prizesNeedingWinners.push({ index, prize, placesCount: needed, isRange: true, currentWinners });
          totalWinnersNeeded += needed;
        }
      }
    });
    
    if (totalWinnersNeeded > 0 && giveaway.participants && giveaway.participants.length > 0) {
      console.log('🎲 [GIVEAWAY] Автоматически выбираем победителей для невыбранных призов...');
      
      // Получаем уже выбранных победителей
      const alreadySelectedUserIds = new Set();
      giveaway.prizes.forEach(prize => {
        const placeStart = prize.placeStart || (prize.place || 1);
        const placeEnd = prize.placeEnd || placeStart;
        
        if (placeStart === placeEnd) {
          if (prize.winner && prize.winner.userId) {
            alreadySelectedUserIds.add(String(prize.winner.userId));
          }
        } else {
          if (prize.winners && Array.isArray(prize.winners)) {
            prize.winners.forEach(w => {
              if (w.userId) alreadySelectedUserIds.add(String(w.userId));
            });
          }
        }
      });
      
      // Фильтруем участников, исключая уже выбранных
      const availableParticipants = giveaway.participants.filter(
        p => !alreadySelectedUserIds.has(String(p.userId))
      );
      
      if (availableParticipants.length >= totalWinnersNeeded) {
        // Выбираем случайных победителей с учетом весов
        const allWinners = weightedRandomSelect(availableParticipants, totalWinnersNeeded);
        let winnerIndex = 0;
        
        // Обновляем только призы без победителей
        const updatedPrizesForPublish = giveaway.prizes.map((prize, index) => {
          const needWinners = prizesNeedingWinners.find(p => p.index === index);
          if (!needWinners) {
            return prize;
          }
          
          const placeStart = prize.placeStart || (prize.place || 1);
          const placeEnd = prize.placeEnd || placeStart;
          
          if (placeStart === placeEnd) {
            // Одно место - один победитель
            if (winnerIndex < allWinners.length) {
              return {
                ...prize,
                placeStart,
                placeEnd,
                winner: allWinners[winnerIndex++],
                winners: []
              };
            }
          } else {
            // Диапазон - массив победителей
            const existingWinners = prize.winners || [];
            const newWinners = [];
            for (let i = 0; i < needWinners.placesCount && winnerIndex < allWinners.length; i++) {
              newWinners.push(allWinners[winnerIndex++]);
            }
            return {
              ...prize,
              placeStart,
              placeEnd,
              winner: null,
              winners: [...existingWinners, ...newWinners]
            };
          }
          
          return prize;
        });
        
        // Присваиваем обновленный массив призов
        giveaway.prizes = updatedPrizesForPublish;
        await giveaway.save();
        console.log('✅ [GIVEAWAY] Победители выбраны автоматически');
      }
    }
    
    // Собираем всех победителей (для одного места и для диапазонов)
    const winnersWithPrizes = [];
    
    giveaway.prizes.forEach(prize => {
      const placeStart = prize.placeStart || (prize.place || 1);
      const placeEnd = prize.placeEnd || placeStart;
      
      if (placeStart === placeEnd) {
        // Одно место - один победитель
        if (prize.winner && (prize.winner.userId || prize.winner.username)) {
          winnersWithPrizes.push({
            ...prize.winner,
            prizeName: prize.name,
            place: placeStart,
            placeStart,
            placeEnd
          });
        }
      } else {
        // Диапазон - массив победителей
        if (prize.winners && Array.isArray(prize.winners) && prize.winners.length > 0) {
          prize.winners.forEach((winner, index) => {
            // Проверяем, что winner существует и имеет userId
            if (winner && winner.userId) {
              winnersWithPrizes.push({
                userId: winner.userId,
                username: winner.username || '',
                firstName: winner.firstName || '',
                lastName: winner.lastName || '',
                project: winner.project || '',
                prizeName: prize.name,
                place: placeStart + index,
                placeStart,
                placeEnd
              });
            } else {
              console.warn(`⚠️ [GIVEAWAY] Пропущен победитель без userId в диапазоне ${placeStart}-${placeEnd}, индекс ${index}:`, winner);
            }
          });
        } else {
          console.warn(`⚠️ [GIVEAWAY] Диапазон ${placeStart}-${placeEnd} не имеет победителей или массив пуст`);
        }
      }
    });
    
    console.log('🔍 [GIVEAWAY] Найдено победителей:', winnersWithPrizes.length);
    console.log('🔍 [GIVEAWAY] Победители:', JSON.stringify(winnersWithPrizes, null, 2));
    
    if (winnersWithPrizes.length === 0) {
      return res.status(400).json({ error: 'No winners selected. Please select winners first.' });
    }
    
    const bot = await Bot.findOne({ id: botId });
    if (!bot || !bot.token) {
      return res.status(404).json({ error: 'Bot not found or token missing' });
    }
    
    // Генерируем видео рулетки
    let videoPath = null;
    try {
      const { generateRouletteVideo } = require('./generateRouletteVideo');
      const uploadsDir = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      videoPath = path.join(uploadsDir, `roulette_${giveawayId}_${Date.now()}.mp4`);
      console.log('🎬 Начинаем генерацию видео рулетки...');
      
      // Передаем всех участников для прокрутки и настройки цветов
      const allParticipants = giveaway.participants || [];
      const colorPalette = giveaway.colorPalette || {};
      const backgroundImagePath = giveaway.backgroundImage ? path.join(__dirname, giveaway.backgroundImage) : null;
      const prizesData = giveaway.prizes || [];
      
      // Логируем для отладки
      console.log('📋 [GIVEAWAY] Победители для видео:', winnersWithPrizes.map(w => ({
        userId: w.userId,
        prizeName: w.prizeName,
        place: w.place
      })));
      console.log('📋 [GIVEAWAY] Всего участников:', allParticipants.length);
      console.log('📋 [GIVEAWAY] Фоновое изображение:', backgroundImagePath || 'не указано');
      console.log('📋 [GIVEAWAY] Призы с изображениями:', prizesData.filter(p => p.prizeImage).map(p => ({ name: p.name, image: p.prizeImage })));
      
      await generateRouletteVideo(winnersWithPrizes, videoPath, allParticipants, colorPalette, backgroundImagePath, prizesData);
      console.log('✅ Видео рулетки создано:', videoPath);
    } catch (videoError) {
      console.error('❌ Ошибка генерации видео:', videoError);
      console.error('❌ Детали ошибки:', {
        message: videoError.message,
        stack: videoError.stack,
        signal: videoError.signal || 'N/A'
      });
      
      // Очищаем временные файлы при ошибке
      try {
        if (videoPath && fs.existsSync(videoPath)) {
          fs.unlinkSync(videoPath);
        }
        // Очищаем директорию кадров, если она существует
        const framesDir = path.join(path.dirname(videoPath || ''), 'roulette_frames');
        if (fs.existsSync(framesDir)) {
          fs.rmSync(framesDir, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('⚠️ Ошибка очистки временных файлов:', cleanupError);
      }
      
      // Продолжаем без видео, отправляем только текст
      videoPath = null;
      console.log('⚠️ [GIVEAWAY] Продолжаем публикацию без видео (только текстовое сообщение)');
    }
    
    // Формируем сообщение с результатами
    let message = description || '';
    if (message) message += '\n\n';
    
    message += '🎉 **РЕЗУЛЬТАТЫ РОЗЫГРЫША** 🎉\n\n';
    
    // Сортируем призы по началу диапазона
    const sortedPrizes = [...giveaway.prizes].sort((a, b) => {
      const aStart = a.placeStart || (a.place || 1);
      const bStart = b.placeStart || (b.place || 1);
      return aStart - bStart;
    });
    
    // Собираем все ID победителей для загрузки из БД (одиночные и из диапазонов)
    const winnerUserIds = [];
    sortedPrizes.forEach(prize => {
      const placeStart = prize.placeStart || (prize.place || 1);
      const placeEnd = prize.placeEnd || placeStart;
      
      if (placeStart === placeEnd) {
        // Одно место
        if (prize.winner && prize.winner.userId) {
          winnerUserIds.push(prize.winner.userId);
        }
      } else {
        // Диапазон
        if (prize.winners && Array.isArray(prize.winners)) {
          prize.winners.forEach(w => {
            if (w && w.userId) {
              winnerUserIds.push(w.userId);
            }
          });
        }
      }
    });
    
    const usersFromDb = {};
    if (winnerUserIds.length > 0) {
      const users = await User.find({ botId, userId: { $in: winnerUserIds } }).lean();
      users.forEach(user => {
        usersFromDb[user.userId] = user;
      });
      console.log('🔍 [GIVEAWAY] Загружено пользователей из БД:', users.length);
    }
    
    for (const prize of sortedPrizes) {
      const placeStart = prize.placeStart || (prize.place || 1);
      const placeEnd = prize.placeEnd || placeStart;
      const isRange = placeStart !== placeEnd;
      
      if (isRange) {
        // Диапазон - несколько победителей
        const winners = prize.winners || [];
        if (winners.length > 0) {
          message += `🏆 **${prize.name}** (${placeStart}-${placeEnd} место, ${winners.length} победителей):\n`;
          
          winners.forEach((winner, index) => {
            const currentPlace = placeStart + index;
            const userId = winner.userId;
            
            // Получаем данные из БД, если нужно
            let firstName = (winner.firstName || '').trim();
            let lastName = (winner.lastName || '').trim();
            let username = (winner.username || '').trim();
            
            if (userId && usersFromDb[userId]) {
              const dbUser = usersFromDb[userId];
              if (!firstName && dbUser.firstName) firstName = dbUser.firstName.trim();
              if (!lastName && dbUser.lastName) lastName = dbUser.lastName.trim();
              if (!username && dbUser.username) username = dbUser.username.trim();
            }
            
            const fullName = `${firstName} ${lastName}`.trim();
            
            // Формируем отображаемое имя
            let displayName = '';
            if (fullName) {
              displayName = fullName;
            } else if (username) {
              displayName = `@${username}`;
            } else if (userId) {
              displayName = `ID: ${userId}`;
            } else {
              displayName = 'Победитель не указан';
            }
            
            message += `👤 ${currentPlace} место: ${displayName}`;
            
            // Добавляем username, если есть и не совпадает с именем
            if (username && fullName) {
              message += ` (@${username})`;
            }
            
            // Добавляем проект
            if (winner.project) {
              message += `\n📁 Проект: ${winner.project}`;
            }
            
            message += '\n';
          });
          
          message += '\n';
        } else {
          // Диапазон без победителей
          message += `🏆 **${prize.name}** (${placeStart}-${placeEnd} место):\n`;
          message += `❌ Победители не выбраны\n\n`;
        }
      } else {
        // Одно место - один победитель
        const hasWinner = prize.winner && (
          prize.winner.userId || 
          prize.winner.username || 
          (prize.winner.firstName && prize.winner.firstName.trim()) ||
          (prize.winner.lastName && prize.winner.lastName.trim())
        );
        
        if (hasWinner) {
          message += `🏆 **${prize.name}** (${placeStart} место):\n`;
          
          // Формируем имя победителя
          let firstName = (prize.winner.firstName || '').trim();
          let lastName = (prize.winner.lastName || '').trim();
          let username = (prize.winner.username || '').trim();
          const userId = prize.winner.userId;
          
          // Если данных нет в объекте победителя, пытаемся получить из базы
          if (userId && usersFromDb[userId]) {
            const dbUser = usersFromDb[userId];
            if (!firstName && dbUser.firstName) firstName = dbUser.firstName.trim();
            if (!lastName && dbUser.lastName) lastName = dbUser.lastName.trim();
            if (!username && dbUser.username) username = dbUser.username.trim();
            console.log(`✅ [GIVEAWAY] Данные пользователя ${userId} дополнены из БД`);
          }
          
          const fullName = `${firstName} ${lastName}`.trim();
          
          // Формируем отображаемое имя
          let displayName = '';
          if (fullName) {
            displayName = fullName;
          } else if (username) {
            displayName = `@${username}`;
          } else if (userId) {
            displayName = `ID: ${userId}`;
          } else {
            displayName = 'Победитель не указан';
          }
          
          message += `👤 ${displayName}`;
          
          // Добавляем username, если есть и не совпадает с именем
          if (username && fullName) {
            message += ` (@${username})`;
          }
          
          // Добавляем проект
          if (prize.winner.project) {
            message += `\n📁 Проект: ${prize.winner.project}`;
          }
          
          message += '\n\n';
        } else {
          // Если победитель не выбран, показываем приз без победителя
          message += `🏆 **${prize.name}** (${placeStart} место):\n`;
          message += `❌ Победитель не выбран\n\n`;
        }
      }
    }
    
    // Логируем финальное сообщение для отладки
    console.log('📝 [GIVEAWAY] Сформированное сообщение:', message);
    
    // Отправляем в каждый выбранный канал
    const https = require('https');
    const url = require('url');
    const FormData = require('form-data');
    const results = [];
    
    for (const channelId of selectedChannels) {
      try {
        // Если есть видео, отправляем его с подписью
        if (videoPath && fs.existsSync(videoPath)) {
          const form = new FormData();
          form.append('chat_id', channelId);
          form.append('caption', message);
          form.append('parse_mode', 'Markdown');
          form.append('video', fs.createReadStream(videoPath));
          
          const apiUrl = `https://api.telegram.org/bot${bot.token}/sendVideo`;
          const parsedUrl = url.parse(apiUrl);
          
          await new Promise((resolve, reject) => {
            form.submit({
              host: parsedUrl.hostname,
              port: parsedUrl.port || 443,
              path: parsedUrl.path,
              protocol: parsedUrl.protocol
            }, (err, res) => {
              if (err) {
                results.push({ channelId, success: false, error: err.message });
                reject(err);
                return;
              }
              
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                if (res.statusCode === 200) {
                  const result = JSON.parse(data);
                  if (result.ok) {
                    results.push({ channelId, success: true, withVideo: true });
                    resolve();
                  } else {
                    results.push({ channelId, success: false, error: result.description });
                    reject(new Error(result.description));
                  }
                } else {
                  results.push({ channelId, success: false, error: `HTTP ${res.statusCode}` });
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              });
            });
          });
        } else {
          // Отправляем только текст, если видео не создано
          const apiUrl = `https://api.telegram.org/bot${bot.token}/sendMessage`;
          const postData = JSON.stringify({
            chat_id: channelId,
            text: message,
            parse_mode: 'Markdown'
          });
          
          const parsedUrl = url.parse(apiUrl);
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            }
          };
          
          await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
              let data = '';
              res.on('data', (chunk) => { data += chunk; });
              res.on('end', () => {
                if (res.statusCode === 200) {
                  const result = JSON.parse(data);
                  if (result.ok) {
                    results.push({ channelId, success: true, withVideo: false });
                    resolve();
                  } else {
                    results.push({ channelId, success: false, error: result.description });
                    reject(new Error(result.description));
                  }
                } else {
                  results.push({ channelId, success: false, error: `HTTP ${res.statusCode}` });
                  reject(new Error(`HTTP ${res.statusCode}`));
                }
              });
            });
            req.on('error', (err) => {
              results.push({ channelId, success: false, error: err.message });
              reject(err);
            });
            req.write(postData);
            req.end();
          });
        }
      } catch (error) {
        console.error(`❌ Ошибка отправки в канал ${channelId}:`, error);
        results.push({ channelId, success: false, error: error.message });
      }
    }
    
    const videoWasGenerated = videoPath !== null && fs.existsSync(videoPath);
    
    // Удаляем временное видео после отправки
    if (videoPath && fs.existsSync(videoPath)) {
      try {
        fs.unlinkSync(videoPath);
        console.log('🗑️ Временное видео удалено');
      } catch (deleteError) {
        console.error('⚠️ Ошибка удаления временного видео:', deleteError);
      }
    }
    
    // Обновляем статус розыгрыша
    giveaway.status = 'completed';
    await giveaway.save();
    
    res.json({ 
      success: true, 
      results,
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      videoGenerated: videoWasGenerated
    });
  } catch (error) {
    console.error('❌ Ошибка при отправке результатов:', error);
    res.status(500).json({ error: 'Failed to publish results', details: error.message });
  }
});
