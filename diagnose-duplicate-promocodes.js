#!/usr/bin/env node

/**
 * Скрипт для диагностики дублированных промокодов лояльности
 * Использование: node diagnose-duplicate-promocodes.js <botId>
 */

const axios = require('axios');

async function diagnoseDuplicatePromoCodes(botId) {
  try {
    console.log(`🔍 Диагностика дублированных промокодов для бота ${botId}`);
    
    const response = await axios.get(`http://localhost:3001/api/diagnose-duplicate-promocodes/${botId}`);
    
    console.log('✅ Диагностика завершена успешно!');
    console.log('📊 Статистика:');
    console.log(`   - Всего активированных промокодов: ${response.data.statistics.totalActivatedPromoCodes}`);
    console.log(`   - Случаев дублирования: ${response.data.statistics.duplicateCases}`);
    console.log(`   - Затронутых пользователей: ${response.data.statistics.affectedUsers}`);
    
    if (response.data.duplicates.length > 0) {
      console.log('\n🔍 Найденные дубликаты:');
      response.data.duplicates.forEach((duplicate, index) => {
        console.log(`\n${index + 1}. Пользователь ${duplicate.userId} (${duplicate.userInfo.firstName} @${duplicate.userInfo.username})`);
        console.log(`   - Период: ${duplicate.period}`);
        console.log(`   - Всего промокодов: ${duplicate.totalPromoCodes}`);
        console.log(`   - Оставить: ${duplicate.keepPromoCode}`);
        console.log(`   - Удалить: ${duplicate.removePromoCodes.join(', ')}`);
        
        console.log(`   - Промокоды:`);
        duplicate.promoCodes.forEach((promoCode, promoIndex) => {
          const status = promoIndex === 0 ? '✅ ОСТАВИТЬ' : '❌ УДАЛИТЬ';
          console.log(`     ${promoIndex + 1}. ${promoCode.code} (${new Date(promoCode.activatedAt).toLocaleString('ru-RU')}) - ${status}`);
        });
      });
      
      console.log('\n🧹 Для очистки дубликатов выполните:');
      console.log(`curl -X POST http://localhost:3001/api/cleanup-duplicate-promocodes/${botId}`);
      console.log(`или используйте скрипт: node cleanup-duplicate-promocodes.js ${botId}`);
      
    } else {
      console.log('\n🎉 Отлично! Дублированных промокодов не найдено!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при диагностике дублированных промокодов:', error.message);
    if (error.response) {
      console.error('📄 Детали ответа:', error.response.data);
    }
  }
}

// Получаем botId из аргументов командной строки
const botId = process.argv[2];

if (!botId) {
  console.error('❌ Ошибка: Не указан botId');
  console.log('📖 Использование: node diagnose-duplicate-promocodes.js <botId>');
  console.log('📖 Пример: node diagnose-duplicate-promocodes.js 1757891140598');
  process.exit(1);
}

console.log(`🚀 Запуск диагностики дублированных промокодов для бота: ${botId}`);
diagnoseDuplicatePromoCodes(botId);
