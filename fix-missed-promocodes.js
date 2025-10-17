#!/usr/bin/env node

/**
 * Скрипт для исправления пропущенных промокодов лояльности
 * Использование: node fix-missed-promocodes.js <botId>
 */

const axios = require('axios');

async function fixMissedPromoCodes(botId) {
  try {
    console.log(`🔧 Начинаем исправление пропущенных промокодов для бота ${botId}`);
    
    const response = await axios.post(`http://localhost:3001/api/fix-missed-loyalty-promocodes/${botId}`);
    
    console.log('✅ Исправление завершено успешно!');
    console.log('📊 Статистика:');
    console.log(`   - Всего пользователей: ${response.data.statistics.totalUsers}`);
    console.log(`   - Исправлено пользователей: ${response.data.statistics.fixedUsers}`);
    console.log(`   - Выдано промокодов: ${response.data.statistics.totalPromoCodesGiven}`);
    
    if (response.data.results.length > 0) {
      console.log('\n📋 Детали исправлений:');
      response.data.results.forEach((result, index) => {
        console.log(`\n${index + 1}. Пользователь ${result.userId} (${result.username || result.firstName || 'без имени'})`);
        console.log(`   - Выдано промокодов: ${result.promoCodesGiven}`);
        
        if (result.results) {
          result.results.forEach(periodResult => {
            if (periodResult.status === 'given') {
              console.log(`   ✅ ${periodResult.period}: ${periodResult.promoCode}`);
            } else if (periodResult.status === 'no_available') {
              console.log(`   ⚠️ ${periodResult.period}: нет доступных промокодов`);
            } else if (periodResult.status === 'already_given') {
              console.log(`   ℹ️ ${periodResult.period}: уже был выдан`);
            } else if (periodResult.status === 'error') {
              console.log(`   ❌ ${periodResult.period}: ошибка - ${periodResult.error}`);
            }
          });
        }
        
        if (result.error) {
          console.log(`   ❌ Ошибка: ${result.error}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка при исправлении промокодов:', error.message);
    if (error.response) {
      console.error('📄 Детали ответа:', error.response.data);
    }
  }
}

// Получаем botId из аргументов командной строки
const botId = process.argv[2];

if (!botId) {
  console.error('❌ Ошибка: Не указан botId');
  console.log('📖 Использование: node fix-missed-promocodes.js <botId>');
  console.log('📖 Пример: node fix-missed-promocodes.js bot123');
  process.exit(1);
}

console.log(`🚀 Запуск исправления пропущенных промокодов для бота: ${botId}`);
fixMissedPromoCodes(botId);
