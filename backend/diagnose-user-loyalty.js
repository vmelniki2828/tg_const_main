#!/usr/bin/env node

/**
 * Скрипт для диагностики конкретного пользователя лояльности
 * Использование: node diagnose-user-loyalty.js <botId> <userId>
 */

const axios = require('axios');

async function diagnoseUserLoyalty(botId, userId) {
  try {
    console.log(`🔍 Диагностика пользователя ${userId} в боте ${botId}`);
    
    // Получаем данные пользователя
    const userResponse = await axios.get(`http://localhost:3001/api/users/${botId}/${userId}`);
    const user = userResponse.data;
    
    console.log('\n📊 ДАННЫЕ ПОЛЬЗОВАТЕЛЯ:');
    console.log(`- ID: ${user.userId}`);
    console.log(`- Username: ${user.username}`);
    console.log(`- First Name: ${user.firstName}`);
    console.log(`- Подписан: ${user.isSubscribed ? 'Да' : 'Нет'}`);
    console.log(`- Первая подписка: ${user.firstSubscribedAt}`);
    console.log(`- Последняя подписка: ${user.lastSubscribedAt}`);
    console.log(`- Время начала лояльности: ${user.loyaltyStartedAt}`);
    console.log(`- Общее время подписки: ${user.totalSubscribedTime} мс`);
    console.log(`- Время на паузе: ${user.pausedTime} мс`);
    
    // Вычисляем эффективное время подписки
    const loyaltyStartTime = new Date(user.loyaltyStartedAt).getTime();
    const now = Date.now();
    const effectiveTime = now - loyaltyStartTime - (user.pausedTime || 0);
    
    console.log('\n⏰ РАСЧЕТ ВРЕМЕНИ ЛОЯЛЬНОСТИ:');
    console.log(`- Время начала лояльности: ${new Date(loyaltyStartTime).toISOString()}`);
    console.log(`- Текущее время: ${new Date(now).toISOString()}`);
    console.log(`- Время на паузе: ${user.pausedTime || 0} мс`);
    console.log(`- Эффективное время: ${effectiveTime} мс`);
    console.log(`- Эффективное время: ${Math.floor(effectiveTime / (1000 * 60))} минут`);
    console.log(`- Эффективное время: ${Math.floor(effectiveTime / (1000 * 60 * 60))} часов`);
    
    // Проверяем периоды лояльности
    const periods = [
      { key: '1m', name: '1 минута', time: 1 * 60 * 1000 },
      { key: '24h', name: '24 часа', time: 24 * 60 * 60 * 1000 },
      { key: '7d', name: '7 дней', time: 7 * 24 * 60 * 60 * 1000 },
      { key: '30d', name: '30 дней', time: 30 * 24 * 60 * 60 * 1000 },
      { key: '90d', name: '90 дней', time: 90 * 24 * 60 * 60 * 1000 },
      { key: '180d', name: '180 дней', time: 180 * 24 * 60 * 60 * 1000 },
      { key: '360d', name: '360 дней', time: 360 * 24 * 60 * 60 * 1000 }
    ];
    
    console.log('\n🎁 ПЕРИОДЫ ЛОЯЛЬНОСТИ:');
    periods.forEach(period => {
      const isPassed = effectiveTime >= period.time;
      const status = isPassed ? '✅ ПРОЙДЕН' : '⏳ Ожидание';
      const timeLeft = isPassed ? 0 : period.time - effectiveTime;
      const timeLeftMinutes = Math.floor(timeLeft / (1000 * 60));
      const timeLeftHours = Math.floor(timeLeft / (1000 * 60 * 60));
      
      console.log(`${period.name}: ${status}`);
      if (!isPassed) {
        console.log(`  - Осталось: ${timeLeftHours}ч ${timeLeftMinutes % 60}м`);
      }
    });
    
    // Получаем запись лояльности
    const loyaltyResponse = await axios.get(`http://localhost:3001/api/loyalty/${botId}/${userId}`);
    const loyalty = loyaltyResponse.data;
    
    console.log('\n🏆 НАГРАДЫ ЛОЯЛЬНОСТИ:');
    periods.forEach(period => {
      const isRewarded = loyalty.rewards[period.key];
      const isPassed = effectiveTime >= period.time;
      const status = isRewarded ? '✅ ПОЛУЧЕНА' : (isPassed ? '❌ НЕ ПОЛУЧЕНА' : '⏳ НЕ ДОСТУПНА');
      console.log(`${period.name}: ${status}`);
    });
    
    // Проверяем промокоды лояльности
    console.log('\n🎫 ПРОМОКОДЫ ЛОЯЛЬНОСТИ:');
    for (const period of periods) {
      try {
        const promoCodesResponse = await axios.get(`http://localhost:3001/api/loyalty-promocodes/${botId}/${period.key}`);
        const promoCodes = promoCodesResponse.data;
        
        const userPromoCodes = promoCodes.promoCodes.filter(p => p.activatedBy == userId);
        console.log(`${period.name}: ${userPromoCodes.length} промокодов получено`);
        
        if (userPromoCodes.length > 0) {
          userPromoCodes.forEach(promo => {
            console.log(`  - ${promo.code} (${promo.activatedAt})`);
          });
        }
      } catch (error) {
        console.log(`${period.name}: Ошибка получения промокодов`);
      }
    }
    
    // Проверяем конфигурацию лояльности
    const configResponse = await axios.get(`http://localhost:3001/api/loyalty-config/${botId}`);
    const config = configResponse.data;
    
    console.log('\n⚙️ КОНФИГУРАЦИЯ ЛОЯЛЬНОСТИ:');
    console.log(`- Программа включена: ${config.isEnabled ? 'Да' : 'Нет'}`);
    
    if (config.isEnabled) {
      periods.forEach(period => {
        const periodConfig = config.messages[period.key];
        console.log(`${period.name}: ${periodConfig?.enabled ? 'Включен' : 'Отключен'}`);
      });
    }
    
    // Рекомендации
    console.log('\n💡 РЕКОМЕНДАЦИИ:');
    
    const passedPeriods = periods.filter(p => effectiveTime >= p.time);
    const unrewardedPeriods = passedPeriods.filter(p => !loyalty.rewards[p.key]);
    
    if (unrewardedPeriods.length > 0) {
      console.log('❌ ПРОБЛЕМЫ:');
      unrewardedPeriods.forEach(period => {
        console.log(`- Период ${period.name} пройден, но награда не получена`);
      });
      
      console.log('\n🔧 РЕШЕНИЕ:');
      console.log('Выполните диагностику и исправление несоответствий:');
      console.log(`curl -X POST http://localhost:3001/api/diagnose-loyalty-mismatch/${botId}`);
    } else {
      console.log('✅ Все доступные награды получены корректно');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при диагностике:', error.message);
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
  console.log('📖 Использование: node diagnose-user-loyalty.js <botId> <userId>');
  console.log('📖 Пример: node diagnose-user-loyalty.js 1757891140598 953796574');
  process.exit(1);
}

console.log(`🚀 Запуск диагностики пользователя ${userId} в боте ${botId}`);
diagnoseUserLoyalty(botId, userId);
