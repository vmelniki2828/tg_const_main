#!/usr/bin/env node

/**
 * Скрипт для массовой проверки всех пользователей и выдачи пропущенных наград
 * Использование: node force-give-loyalty-rewards-all.js <botId>
 */

const axios = require('axios');

async function forceGiveLoyaltyRewardsAll(botId) {
  try {
    console.log(`🎁 Массовая проверка и выдача наград для всех пользователей бота ${botId}`);
    
    const response = await axios.post(`http://localhost:3001/api/force-give-loyalty-rewards-all/${botId}`);
    
    console.log('✅ Массовая проверка завершена успешно!');
    console.log('📊 Общая статистика:');
    console.log(`   - Всего пользователей: ${response.data.summary.totalUsers}`);
    console.log(`   - Обработано: ${response.data.summary.processedUsers}`);
    console.log(`   - Получили награды: ${response.data.summary.usersWithRewards}`);
    console.log(`   - Всего выдано наград: ${response.data.summary.totalRewardsGiven}`);
    console.log(`   - Ошибок: ${response.data.summary.totalErrors}`);
    
    // Показываем детали по пользователям с наградами
    const usersWithRewards = response.data.statistics.userDetails.filter(user => user.status === 'rewards_given');
    
    if (usersWithRewards.length > 0) {
      console.log('\n🎁 Пользователи, получившие награды:');
      usersWithRewards.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.firstName} (@${user.username}) - ID: ${user.userId}`);
        console.log(`   - Время участия: ${user.effectiveTimeMinutes} минут`);
        console.log(`   - Пройденные периоды: ${user.passedPeriods.join(', ')}`);
        console.log(`   - Получено наград: ${user.rewardsGiven.length}`);
        
        user.rewardsGiven.forEach(reward => {
          if (reward.promoCode) {
            console.log(`     • ${reward.periodName}: ${reward.promoCode}`);
          } else {
            console.log(`     • ${reward.periodName}: нет промокода`);
          }
        });
      });
    }
    
    // Показываем пользователей без наград
    const usersWithoutRewards = response.data.statistics.userDetails.filter(user => 
      user.status === 'no_rewards_needed' || user.status === 'skipped'
    );
    
    if (usersWithoutRewards.length > 0) {
      console.log('\nℹ️ Пользователи без наград:');
      usersWithoutRewards.forEach((user, index) => {
        const reason = user.status === 'skipped' ? 
          (user.reason === 'loyalty_not_started' ? 'не участвует в лояльности' : user.reason) :
          'все награды уже выданы';
        console.log(`${index + 1}. ${user.firstName} (@${user.username}) - ${reason}`);
      });
    }
    
    // Показываем ошибки
    const usersWithErrors = response.data.statistics.userDetails.filter(user => user.status === 'error');
    
    if (usersWithErrors.length > 0) {
      console.log('\n❌ Пользователи с ошибками:');
      usersWithErrors.forEach((user, index) => {
        console.log(`${index + 1}. ${user.firstName} (@${user.username}) - ${user.reason}`);
      });
    }
    
    // Статистика по периодам
    const periodStats = {};
    response.data.statistics.userDetails.forEach(user => {
      user.rewardsGiven.forEach(reward => {
        if (!periodStats[reward.period]) {
          periodStats[reward.period] = { count: 0, name: reward.periodName };
        }
        periodStats[reward.period].count++;
      });
    });
    
    if (Object.keys(periodStats).length > 0) {
      console.log('\n📊 Статистика по периодам:');
      Object.entries(periodStats).forEach(([period, stats]) => {
        console.log(`   - ${stats.name} (${period}): ${stats.count} наград`);
      });
    }
    
  } catch (error) {
    console.error('❌ Ошибка при массовой проверке:', error.message);
    if (error.response) {
      console.error('📄 Детали ответа:', error.response.data);
    }
  }
}

// Получаем botId из аргументов командной строки
const botId = process.argv[2];

if (!botId) {
  console.error('❌ Ошибка: Не указан botId');
  console.log('📖 Использование: node force-give-loyalty-rewards-all.js <botId>');
  console.log('📖 Пример: node force-give-loyalty-rewards-all.js 1757891140598');
  process.exit(1);
}

console.log(`🚀 Запуск массовой проверки наград для бота: ${botId}`);
forceGiveLoyaltyRewardsAll(botId);
