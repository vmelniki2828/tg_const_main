const fs = require('fs');
const path = require('path');

// Базовая папка для промокодов квизов
const PROMOCODES_DIR = path.join(__dirname, 'promocodes');

// Функция для получения пути к файлу промокодов конкретного квиза
function getQuizPromoCodesPath(quizId) {
  return path.join(PROMOCODES_DIR, `quiz_${quizId}.csv`);
}

// Функция для загрузки промокодов в конкретный квиз
function loadPromoCodesFromFile(filePath, quizId) {
  try {
    // Проверяем, что файл читается и валиден
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('Нет промокодов');
    
    // Копируем файл в папку промокодов с именем квиза
    const quizPromoCodesPath = getQuizPromoCodesPath(quizId);
    fs.copyFileSync(filePath, quizPromoCodesPath);
    
    console.log(`✅ Промокоды загружены для квиза ${quizId}: ${lines.length - 1} кодов`);
    return true;
  } catch (error) {
    console.error(`❌ Ошибка загрузки промокодов для квиза ${quizId}:`, error.message);
    return false;
  }
}

// Функция для получения и активации промокода конкретного квиза
function getRandomPromoCode(quizId) {
  const filePath = getQuizPromoCodesPath(quizId);
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️ Файл промокодов для квиза ${quizId} не найден`);
    return null;
  }
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1);
    const promoCodes = dataLines
      .map(line => {
        const [code, user, activated] = line.split(',').map(field => field.trim());
        return { code, user, activated: activated === '1' || activated === 'true' };
      })
      .filter(item => item.code && !item.activated);

    if (promoCodes.length === 0) {
      console.log(`⚠️ Нет доступных промокодов для квиза ${quizId}`);
      return null;
    }

    const randomIndex = Math.floor(Math.random() * promoCodes.length);
    const promoCode = promoCodes[randomIndex];

    // Обновить файл, пометив промокод как активированный
    const updatedLines = lines.map(line => {
      if (line.startsWith(promoCode.code + ',')) {
        const parts = line.split(',');
        parts[2] = '1';
        return parts.join(',');
      }
      return line;
    });
    fs.writeFileSync(filePath, updatedLines.join('\n'));

    console.log(`🎁 Выдан промокод ${promoCode.code} для квиза ${quizId}`);
    return promoCode.code;
  } catch (error) {
    console.error(`Ошибка при выдаче промокода для квиза ${quizId}:`, error);
    return null;
  }
}

// Функция для проверки наличия промокодов у квиза
function hasPromoCodes(quizId) {
  const filePath = getQuizPromoCodesPath(quizId);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1);
    const availablePromoCodes = dataLines
      .map(line => {
        const [code, user, activated] = line.split(',').map(field => field.trim());
        return { code, user, activated: activated === '1' || activated === 'true' };
      })
      .filter(item => item.code && !item.activated);
    
    return availablePromoCodes.length > 0;
  } catch (error) {
    return false;
  }
}

// Функция для получения количества доступных промокодов
function getAvailablePromoCodesCount(quizId) {
  const filePath = getQuizPromoCodesPath(quizId);
  if (!fs.existsSync(filePath)) {
    return 0;
  }
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const dataLines = lines.slice(1);
    const availablePromoCodes = dataLines
      .map(line => {
        const [code, user, activated] = line.split(',').map(field => field.trim());
        return { code, user, activated: activated === '1' || activated === 'true' };
      })
      .filter(item => item.code && !item.activated);
    
    return availablePromoCodes.length;
  } catch (error) {
    return 0;
  }
}

// Функция для ручного обновления статуса промокода (если нужно)
function updatePromoCodeFile(code, activated, quizId) {
  const filePath = getQuizPromoCodesPath(quizId);
  if (!filePath || !fs.existsSync(filePath)) return;
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const lines = fileContent.split('\n');
    const updatedLines = lines.map(line => {
      if (line.startsWith(code + ',')) {
        const parts = line.split(',');
        parts[2] = activated ? '1' : '0';
        return parts.join(',');
      }
      return line;
    });
    fs.writeFileSync(filePath, updatedLines.join('\n'));
    console.log(`📝 Обновлен статус промокода ${code} для квиза ${quizId}`);
  } catch (error) {
    console.error(`❌ Ошибка обновления файла промокодов для квиза ${quizId}:`, error.message);
  }
}

module.exports = {
  loadPromoCodesFromFile,
  getRandomPromoCode,
  updatePromoCodeFile,
  hasPromoCodes,
  getAvailablePromoCodesCount
}; 