const mongoose = require('mongoose');
const { LoyaltyPromoCode, User, Loyalty } = require('./models');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://157.230.20.252:27017/tg_const_main';

async function fixDuplicatePromoCodes() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Подключено к MongoDB');

    // Находим всех пользователей с дублирующими промокодами
    const duplicates = await LoyaltyPromoCode.aggregate([
      {
        $match: {
          activated: true,
          activatedBy: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: {
            botId: '$botId',
            userId: '$activatedBy',
            period: '$period'
          },
          count: { $sum: 1 },
          promoCodes: { $push: { id: '$_id', code: '$code', activatedAt: '$activatedAt' } }
        }
      },
      {
        $match: {
          count: { $gt: 1 } // Только группы с более чем одним промокодом
        }
      }
    ]);

    console.log(`🔍 Найдено ${duplicates.length} групп с дублирующими промокодами`);

    if (duplicates.length === 0) {
      console.log('✅ Дубликатов не найдено!');
      await mongoose.disconnect();
      return;
    }

    let totalRemoved = 0;
    let totalFixed = 0;

    for (const duplicate of duplicates) {
      const { botId, userId, period } = duplicate._id;
      const promoCodes = duplicate.promoCodes;

      // Сортируем по дате активации (самый ранний оставляем)
      promoCodes.sort((a, b) => {
        const dateA = a.activatedAt ? new Date(a.activatedAt).getTime() : 0;
        const dateB = b.activatedAt ? new Date(b.activatedAt).getTime() : 0;
        return dateA - dateB;
      });

      // Оставляем первый промокод, остальные деактивируем
      const keepPromoCode = promoCodes[0];
      const removePromoCodes = promoCodes.slice(1);

      console.log(`\n📋 Бот ${botId}, Пользователь ${userId}, Период ${period}:`);
      console.log(`   ✅ Оставляем: ${keepPromoCode.code} (активирован: ${keepPromoCode.activatedAt})`);
      
      for (const promo of removePromoCodes) {
        console.log(`   ❌ Деактивируем дубликат: ${promo.code} (активирован: ${promo.activatedAt})`);
        
        // Деактивируем дублирующий промокод
        await LoyaltyPromoCode.updateOne(
          { _id: promo.id },
          {
            $set: {
              activated: false,
              activatedBy: null,
              activatedAt: null
            }
          }
        );
        
        totalRemoved++;
      }

      // Убеждаемся, что в базе данных правильно отмечено, что награда выдана
      await Loyalty.updateOne(
        { botId, userId },
        { $set: { [`rewards.${period}`]: true } }
      );

      await User.updateOne(
        { botId, userId },
        { $set: { [`loyaltyRewards.${period}`]: true } }
      );

      totalFixed++;
    }

    console.log(`\n✅ Обработка завершена:`);
    console.log(`   - Исправлено групп: ${totalFixed}`);
    console.log(`   - Деактивировано дубликатов: ${totalRemoved}`);

    await mongoose.disconnect();
    console.log('✅ Отключено от MongoDB');
  } catch (error) {
    console.error('❌ Ошибка:', error);
    process.exit(1);
  }
}

fixDuplicatePromoCodes();

