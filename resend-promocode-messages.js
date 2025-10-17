#!/usr/bin/env node

/**
 * Скрипт для повторной отправки сообщений с промокодами лояльности
 * Использование: node resend-promocode-messages.js <botId>
 */

const axios = require('axios');

async function resendPromocodeMessages(botId) {
  try {
    console.log(`📨 Начинаем повторную отправку сообщений с промокодами для бота ${botId}`);
    
    const response = await axios.post(`http://localhost:3001/api/resend-loyalty-promocode-messages/${botId}`);
    
    console.log('✅ Повторная отправка завершена успешно!');
    console.log('📊 Статистика:');
    console.log(`   - Всего промокодов: ${response.data.statistics.totalPromoCodes}`);
    console.log(`   - Отправлено сообщений: ${response.data.statistics.messagesSent}`);
    console.log(`   - Ошибок: ${response.data.statistics.errors}`);
    
    if (response.data.results.length > 0) {
      console.log('\n📋 Детали отправки:');
      response.data.results.forEach((result, index) => {
        console.log(`\n${index + 1}. Пользователь ${result.userId} (${result.userName})`);
        console.log(`   - Промокодов: ${result.promoCodesCount}`);
        console.log(`   - Статус: ${result.status === 'sent' ? '✅ Отправлено' : '❌ Ошибка'}`);
        
        if (result.status === 'sent' && result.promoCodes) {
          console.log(`   - Промокоды:`);
          result.promoCodes.forEach(promoCode => {
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
            console.log(`     • ${periodLabel}: ${promoCode.code}`);
          });
        }
        
        if (result.status === 'error') {
          console.log(`   - Ошибка: ${result.error}`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка при повторной отправке сообщений:', error.message);
    if (error.response) {
      console.error('📄 Детали ответа:', error.response.data);
    }
  }
}

// Получаем botId из аргументов командной строки
const botId = process.argv[2];

if (!botId) {
  console.error('❌ Ошибка: Не указан botId');
  console.log('📖 Использование: node resend-promocode-messages.js <botId>');
  console.log('📖 Пример: node resend-promocode-messages.js 1757891140598');
  process.exit(1);
}

console.log(`🚀 Запуск повторной отправки сообщений для бота: ${botId}`);
resendPromocodeMessages(botId);
