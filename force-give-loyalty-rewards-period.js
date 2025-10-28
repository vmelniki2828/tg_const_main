#!/usr/bin/env node

/**
 * Скрипт для принудительной выдачи промокодов за конкретный период
 * Использование: node force-give-loyalty-rewards-period.js <botId> <period>
 * Периоды: 1m, 24h, 7d, 30d, 90d, 180d, 360d
 */

const axios = require('axios');

async function forceGiveLoyaltyRewardsPeriod(botId, period) {
  try {
    console.log(`🎁 Принудительная выдача промокодов за период ${period} для бота ${botId}`);
    console.log(`📊 Запрос: http://localhost:3001/api/force-give-loyalty-rewards-period/${botId}/${period}`);
    
    const response = await axios.post(`http://localhost:3001/api/force-give-loyalty-rewards-period/${botId}/${period}`);
    
    console.log('✅ Выдача завершена успешно!');
    console.log('📊 Результаты:');
    console.log(`   - Обработано пользователей: ${response.data.summary.processedUsers}`);
    console.log(`   - Получили промокоды: ${response.data.summary.usersWithRewards}`);
    console.log(`   - Всего выдано: ${response.data.summary.totalRewardsGiven}`);
    console.log(`   - Ошибок: ${response.data.summary.totalErrors}`);
    
    if (response.data.summary.usersWithRewards > 0) {
      console.log('\n✅ Промокоды успешно выданы!');
    } else {
      console.log('\n⚠️ Нет пользователей для выдачи или закончились промокоды');
    }
    
  } catch (error) {
    console.error('❌ Ошибка:', error.response?.data || error.message);
    if (error.response?.data?.error) {
      console.error('   Ошибка:', error.response.data.error);
    }
  }
}

// Получаем аргументы из командной строки
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('❌ Укажите botId и period');
  console.error('   Пример: node force-give-loyalty-rewards-period.js 1757891140598 24h');
  process.exit(1);
}

const botId = args[0];
const period = args[1];

// Валидируем период
const validPeriods = ['1m', '24h', '7d', '30d', '90d', '180d', '360d'];
if (!validPeriods.includes(period)) {
  console.error('❌ Некорректный период. Доступные: 1m, 24h, 7d, 30d, 90d, 180d, 360d');
  process.exit(1);
}

forceGiveLoyaltyRewardsPeriod(botId, period);

