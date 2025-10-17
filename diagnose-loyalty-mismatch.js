#!/usr/bin/env node

/**
 * Скрипт для диагностики и исправления несоответствий между наградами и промокодами лояльности
 * Использование: node diagnose-loyalty-mismatch.js <botId>
 */

const axios = require('axios');

async function diagnoseLoyaltyMismatch(botId) {
  try {
    console.log(`🔍 Начинаем диагностику несоответствий для бота ${botId}`);
    
    const response = await axios.post(`http://localhost:3001/api/diagnose-loyalty-mismatch/${botId}`);
    
    console.log('✅ Диагностика завершена успешно!');
    console.log('📊 Статистика:');
    console.log(`   - Всего записей лояльности: ${response.data.statistics.totalLoyaltyRecords}`);
    console.log(`   - Найдено несоответствий: ${response.data.statistics.mismatchesFound}`);
    console.log(`   - Выполнено исправлений: ${response.data.statistics.fixesApplied}`);
    
    if (response.data.mismatches.length > 0) {
      console.log('\n🔍 Найденные несоответствия:');
      response.data.mismatches.forEach((mismatch, index) => {
        console.log(`\n${index + 1}. Пользователь ${mismatch.userId}`);
        console.log(`   - Период: ${mismatch.period}`);
        console.log(`   - Проблема: ${mismatch.issue}`);
        console.log(`   - Описание: ${mismatch.description}`);
      });
    }
    
    if (response.data.fixes.length > 0) {
      console.log('\n✅ Выполненные исправления:');
      response.data.fixes.forEach((fix, index) => {
        console.log(`\n${index + 1}. Пользователь ${fix.userId}`);
        console.log(`   - Период: ${fix.period}`);
        console.log(`   - Действие: ${fix.action}`);
        console.log(`   - Промокод: ${fix.promoCode}`);
        console.log(`   - Описание: ${fix.description}`);
      });
    }
    
    if (response.data.mismatches.length === 0 && response.data.fixes.length === 0) {
      console.log('\n🎉 Отлично! Несоответствий не найдено!');
    }
    
  } catch (error) {
    console.error('❌ Ошибка при диагностике несоответствий:', error.message);
    if (error.response) {
      console.error('📄 Детали ответа:', error.response.data);
    }
  }
}

// Получаем botId из аргументов командной строки
const botId = process.argv[2];

if (!botId) {
  console.error('❌ Ошибка: Не указан botId');
  console.log('📖 Использование: node diagnose-loyalty-mismatch.js <botId>');
  console.log('📖 Пример: node diagnose-loyalty-mismatch.js 1757891140598');
  process.exit(1);
}

console.log(`🚀 Запуск диагностики несоответствий для бота: ${botId}`);
diagnoseLoyaltyMismatch(botId);
