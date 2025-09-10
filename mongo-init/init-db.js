// Инициализация базы данных tg_const_main
db = db.getSiblingDB('tg_const_main');

// Создаем пользователя для приложения
db.createUser({
  user: 'app_user',
  pwd: 'app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'tg_const_main'
    }
  ]
});

// Создаем коллекции с индексами
db.createCollection('bots');
db.createCollection('users');
db.createCollection('quizstats');
db.createCollection('promocodes');
db.createCollection('loyalties');
db.createCollection('loyaltyconfigs');
db.createCollection('loyaltypromocodes');

// Создаем индексы для оптимизации
db.bots.createIndex({ "id": 1 }, { unique: true });
db.bots.createIndex({ "isActive": 1 });

db.users.createIndex({ "botId": 1, "userId": 1 }, { unique: true });
db.users.createIndex({ "botId": 1 });
db.users.createIndex({ "isSubscribed": 1 });

db.quizstats.createIndex({ "botId": 1, "userId": 1, "blockId": 1 }, { unique: true });
db.quizstats.createIndex({ "botId": 1 });
db.quizstats.createIndex({ "completedAt": 1 });

db.promocodes.createIndex({ "botId": 1, "quizId": 1 });
db.promocodes.createIndex({ "botId": 1, "activated": 1 });
db.promocodes.createIndex({ "code": 1 }, { unique: true });

db.loyalties.createIndex({ "botId": 1, "userId": 1 }, { unique: true });
db.loyalties.createIndex({ "botId": 1 });

db.loyaltyconfigs.createIndex({ "botId": 1 }, { unique: true });

db.loyaltypromocodes.createIndex({ "botId": 1, "period": 1 });
db.loyaltypromocodes.createIndex({ "botId": 1, "activated": 1 });
db.loyaltypromocodes.createIndex({ "code": 1 }, { unique: true });

print('✅ База данных tg_const_main инициализирована успешно!');
print('✅ Пользователь app_user создан');
print('✅ Коллекции и индексы созданы');
