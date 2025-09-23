// Скрипт для очистки дублирующихся промокодов
const mongoose = require('mongoose');

// Подключаемся к MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://157.230.20.252:27017/tg_const_main';
mongoose.connect(MONGO_URI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Импортируем модели
const { PromoCode } = require('./models');

async function cleanupDuplicatePromoCodes() {
  try {
    console.log('🧹 Начинаем очистку дублирующихся промокодов...\n');
    
    // Находим все промокоды
    const allPromoCodes = await PromoCode.find({});
    console.log(`📊 Найдено ${allPromoCodes.length} промокодов в базе данных`);
    
    // Группируем по коду
    const codeGroups = {};
    allPromoCodes.forEach(promo => {
      if (!codeGroups[promo.code]) {
        codeGroups[promo.code] = [];
      }
      codeGroups[promo.code].push(promo);
    });
    
    // Находим дубликаты
    const duplicates = Object.entries(codeGroups).filter(([code, promos]) => promos.length > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ Дублирующихся промокодов не найдено');
      return;
    }
    
    console.log(`🔍 Найдено ${duplicates.length} дублирующихся промокодов:`);
    
    let totalRemoved = 0;
    
    for (const [code, promos] of duplicates) {
      console.log(`\n📝 Промокод "${code}": ${promos.length} копий`);
      
      // Сортируем по дате создания (оставляем самый старый)
      promos.sort((a, b) => {
        const dateA = a._id.getTimestamp();
        const dateB = b._id.getTimestamp();
        return dateA - dateB;
      });
      
      // Удаляем все кроме первого (самого старого)
      const toRemove = promos.slice(1);
      const idsToRemove = toRemove.map(p => p._id);
      
      if (idsToRemove.length > 0) {
        await PromoCode.deleteMany({ _id: { $in: idsToRemove } });
        console.log(`🗑️ Удалено ${idsToRemove.length} дубликатов`);
        totalRemoved += idsToRemove.length;
      }
    }
    
    console.log(`\n✅ Очистка завершена! Удалено ${totalRemoved} дублирующихся промокодов`);
    
  } catch (error) {
    console.error('❌ Ошибка при очистке:', error);
  } finally {
    mongoose.disconnect();
    process.exit(0);
  }
}

cleanupDuplicatePromoCodes();
