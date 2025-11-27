const {
  DailyActivityStats,
  DailyUserActivity,
  BlockStats,
  ButtonStats,
  UserPathStats
} = require('./models');

/**
 * Получить начало дня в UTC для даты
 */
function getStartOfDay(date = new Date()) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Регистрация активного пользователя за день
 */
async function trackActiveUser(botId, userId) {
  try {
    const date = getStartOfDay();
    
    // Регистрируем активность пользователя за день
    await DailyUserActivity.findOneAndUpdate(
      { botId, date, userId },
      {
        $set: { lastActivityAt: new Date() }
      },
      { upsert: true }
    );
    
    // Обновляем счетчик активных пользователей (асинхронно, не блокируем)
    setImmediate(async () => {
      try {
        const activeCount = await DailyUserActivity.countDocuments({ botId, date });
        await DailyActivityStats.findOneAndUpdate(
          { botId, date },
          {
            $set: { 
              activeUsers: activeCount,
              updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
          },
          { upsert: true }
        );
      } catch (error) {
        console.error(`[STATS] Ошибка при обновлении счетчика активных пользователей:`, error);
      }
    });
  } catch (error) {
    console.error(`[STATS] Ошибка при отслеживании активного пользователя:`, error);
  }
}

/**
 * Регистрация команды /start
 */
async function trackStartCommand(botId, userId) {
  try {
    const date = getStartOfDay();
    
    // Регистрируем команду /start для пользователя
    const userActivity = await DailyUserActivity.findOneAndUpdate(
      { botId, date, userId },
      {
        $set: { 
          hasStarted: true,
          lastActivityAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
    
    // Обновляем ежедневную статистику
    await DailyActivityStats.findOneAndUpdate(
      { botId, date },
      {
        $inc: { totalCommands: 1 },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    
    // Обновляем счетчик пользователей нажавших /start (асинхронно)
    setImmediate(async () => {
      try {
        const startCount = await DailyUserActivity.countDocuments({ botId, date, hasStarted: true });
        await DailyActivityStats.updateOne(
          { botId, date },
          { $set: { startCommandUsers: startCount } }
        );
      } catch (error) {
        console.error(`[STATS] Ошибка при обновлении счетчика /start:`, error);
      }
    });
  } catch (error) {
    console.error(`[STATS] Ошибка при отслеживании команды /start:`, error);
  }
}

/**
 * Регистрация нажатия кнопки
 */
async function trackButtonClick(botId, userId, blockId, buttonId, buttonText = '') {
  try {
    const date = getStartOfDay();
    
    // Регистрируем нажатие кнопки для пользователя
    await DailyUserActivity.findOneAndUpdate(
      { botId, date, userId },
      {
        $set: { 
          hasClickedButton: true,
          lastActivityAt: new Date()
        }
      },
      { upsert: true }
    );
    
    // Обновляем ежедневную статистику
    await DailyActivityStats.findOneAndUpdate(
      { botId, date },
      {
        $inc: { totalButtonClicks: 1 },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    
    // Обновляем счетчик пользователей нажавших кнопку за день (асинхронно)
    setImmediate(async () => {
      try {
        const buttonClickCount = await DailyUserActivity.countDocuments({ botId, date, hasClickedButton: true });
        await DailyActivityStats.updateOne(
          { botId, date },
          { $set: { buttonClickUsers: buttonClickCount } }
        );
      } catch (error) {
        console.error(`[STATS] Ошибка при обновлении счетчика нажатий кнопок:`, error);
      }
    });
    
    // Обновляем статистику по кнопкам
    await ButtonStats.findOneAndUpdate(
      { botId, blockId, buttonId },
      {
        $inc: { clickCount: 1 },
        $set: { 
          buttonText: buttonText || '',
          lastClickedAt: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[STATS] Ошибка при отслеживании нажатия кнопки:`, error);
  }
}

/**
 * Регистрация входа в блок
 */
async function trackBlockEnter(botId, userId, blockId, blockName = '') {
  try {
    await BlockStats.findOneAndUpdate(
      { botId, blockId },
      {
        $inc: { enterCount: 1 },
        $set: { 
          blockName: blockName || '',
          lastEnteredAt: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[STATS] Ошибка при отслеживании входа в блок:`, error);
  }
}

/**
 * Регистрация перехода между блоками
 */
async function trackBlockTransition(botId, userId, fromBlockId, toBlockId) {
  try {
    if (!fromBlockId || fromBlockId === toBlockId) {
      return; // Не отслеживаем переходы из/в тот же блок
    }
    
    await UserPathStats.findOneAndUpdate(
      { botId, fromBlockId, toBlockId },
      {
        $inc: { transitionCount: 1 },
        $set: { 
          lastTransitionAt: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
  } catch (error) {
    console.error(`[STATS] Ошибка при отслеживании перехода между блоками:`, error);
  }
}

module.exports = {
  trackActiveUser,
  trackStartCommand,
  trackButtonClick,
  trackBlockEnter,
  trackBlockTransition,
  getStartOfDay
};

