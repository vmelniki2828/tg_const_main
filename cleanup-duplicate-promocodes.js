#!/usr/bin/env node

/**
 * Скрипт для очистки дублированных промокодов лояльности
 * Использование: node cleanup-duplicate-promocodes.js <botId>
 */

const axios = require('axios');

async function cleanupDuplicatePromoCodes(botId) {
  try {
    console.log(`🧹 Очистка дублированных промокодов для бота ${botId}`);
    
    const response = await axios.post(`http://localhost:3001/api/cleanup-duplicate-promocodes/${botId}`);
    
    console.log('✅ Очистка завершена успешно!');
    console.log('📊 Статистика:');
    console.log(`   - Найдено дубликатов: ${response.data.statistics.totalDuplicatesFound}`);
    console.log(`   - Успешно удалено: ${response.data.statistics.successfullyRemoved}`);
    console.log(`   - Ошибок: ${response.data.statistics.errors}`);
    
    if (response.data.cleanupResults.length > 0) {
      console.log('\n🧹 Результаты очистки:');
      response.data.cleanupResults.forEach((result, index) => {
        const status = result.status === 'removed' ? '✅ Удален' : '❌ Ошибка';
        console.log(`${index + 1}. Пользователь ${result.userId}, период ${result.period}`);
        console.log(`   - Промокод: ${result.removedPromoCode}`);
        console.log(`   - Статус: ${status}`);
        if (result.error) {
          console.log(`   - Ошибка: ${result.error}`);
        }
      });
    }
    
    if (response.data.statistics.successfullyRemoved > 0) {
      console.log('\n🎉 Дублированные промокоды успешно удалены!');
      console.log('💡 Теперь каждый пользователь имеет только один промокод за каждый период.');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при очистке дублированных промокодов:', error.message);
    if (error.response) {
      console.error('📄 Детали ответа:', error.response.data);
    }
  }
}

// Получаем botId из аргументов командной строки
const botId = process.argv[2];

if (!botId) {
  console.error('❌ Ошибка: Не указан botId');
  console.log('📖 Использование: node cleanup-duplicate-promocodes.js <botId>');
  console.log('📖 Пример: node cleanup-duplicate-promocodes.js 1757891140598');
  process.exit(1);
}

console.log(`🚀 Запуск очистки дублированных промокодов для бота: ${botId}`);
cleanupDuplicatePromoCodes(botId);
