#!/usr/bin/env node

/**
 * Скрипт для принудительной выдачи пропущенных наград пользователю
 * Использование: node force-give-loyalty-rewards.js <botId> <userId>
 */

const axios = require('axios');

async function forceGiveLoyaltyRewards(botId, userId) {
  try {
    console.log(`🎁 Принудительная выдача наград пользователю ${userId} в боте ${botId}`);
    
    const response = await axios.post(`http://localhost:3001/api/force-give-loyalty-rewards/${botId}/${userId}`);
    
    console.log('✅ Принудительная выдача завершена успешно!');
    console.log('📊 Статистика:');
    console.log(`   - Пользователь: ${response.data.user.firstName} (@${response.data.user.username})`);
    console.log(`   - ID пользователя: ${response.data.user.userId}`);
    console.log(`   - Время начала лояльности: ${new Date(response.data.user.loyaltyStartedAt).toLocaleString('ru-RU')}`);
    console.log(`   - Эффективное время: ${response.data.user.effectiveTimeMinutes} минут`);
    console.log(`   - Всего пройденных периодов: ${response.data.statistics.totalPassedPeriods}`);
    console.log(`   - Выдано наград: ${response.data.statistics.rewardsGiven}`);
    console.log(`   - Ошибок: ${response.data.statistics.errors}`);
    
    if (response.data.rewardsGiven.length > 0) {
      console.log('\n🎁 Выданные награды:');
      response.data.rewardsGiven.forEach((reward, index) => {
        console.log(`\n${index + 1}. ${reward.periodName} (${reward.period})`);
        console.log(`   - Действие: ${reward.action}`);
        if (reward.promoCode) {
          console.log(`   - Промокод: ${reward.promoCode}`);
        } else {
          console.log(`   - Промокод: не доступен`);
        }
      });
    }
    
    if (response.data.errors.length > 0) {
      console.log('\n❌ Ошибки:');
      response.data.errors.forEach((error, index) => {
        console.log(`\n${index + 1}. ${error.periodName} (${error.period})`);
        console.log(`   - Ошибка: ${error.error}`);
      });
    }
    
    if (response.data.rewardsGiven.length === 0 && response.data.errors.length === 0) {
      console.log('\n🎉 Все награды уже выданы!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при принудительной выдаче наград:', error.message);
    if (error.response) {
      console.error('📄 Детали ответа:', error.response.data);
    }
  }
}

// Получаем параметры из аргументов командной строки
const botId = process.argv[2];
const userId = process.argv[3];

if (!botId || !userId) {
  console.error('❌ Ошибка: Не указаны botId и userId');
  console.log('📖 Использование: node force-give-loyalty-rewards.js <botId> <userId>');
  console.log('📖 Пример: node force-give-loyalty-rewards.js 1757891140598 953796574');
  process.exit(1);
}

console.log(`🚀 Запуск принудительной выдачи наград:`);
console.log(`   - Бот: ${botId}`);
console.log(`   - Пользователь: ${userId}`);
forceGiveLoyaltyRewards(botId, userId);
