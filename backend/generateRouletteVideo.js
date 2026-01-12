const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

/**
 * Генерирует видео рулетки с выпадением победителей
 * @param {Array} winners - Массив победителей с информацией о призах
 * @param {String} outputPath - Путь для сохранения видео
 * @param {Array} allParticipants - Все участники для прокрутки
 * @param {Object} colorPalette - Настройки цветовой палитры
 * @returns {Promise<String>} Путь к созданному видео файлу
 */
async function generateRouletteVideo(winners, outputPath, allParticipants = null, colorPalette = {}) {
  const width = 1080;
  const height = 1920; // Вертикальное видео для Telegram
  const fps = 30;
  const frameDuration = 1 / fps;
  
  // Параметры анимации
  const spinDuration = 3.5; // Длительность прокрутки рулетки для каждого победителя (секунды)
  const pauseDuration = 1.5; // Пауза после прокрутки, чтобы увидеть выпавший ID (секунды)
  const revealDuration = 2.5; // Длительность показа каждого победителя (секунды)
  const totalFrames = Math.ceil((spinDuration + pauseDuration + revealDuration) * winners.length * fps);
  
  // Создаем директорию для временных кадров
  const framesDir = path.join(path.dirname(outputPath), 'roulette_frames');
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true });
  }
  
  // Генерируем кадры
  const frameFiles = [];
  
  for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
    const time = frameIndex * frameDuration;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Фон с настройками цветов
    const bgColor = colorPalette.backgroundColor || '#1a1a2e';
    // Создаем градиент на основе основного цвета (немного темнее внизу)
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, bgColor);
    // Немного затемняем цвет для нижней части
    const darkerColor = darkenColor(bgColor, 0.1);
    gradient.addColorStop(1, darkerColor);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Заголовок убран по запросу пользователя
    
    // Определяем, какой победитель сейчас показывается
    const segmentDuration = spinDuration + pauseDuration + revealDuration;
    const currentSegment = Math.floor(time / segmentDuration);
    const localTime = time % segmentDuration;
    
    if (currentSegment < winners.length) {
      const currentWinner = winners[currentSegment];
      
      // Логируем для отладки
      if (frameIndex % 30 === 0) { // Каждую секунду
        console.log(`🎬 [VIDEO] Кадр ${frameIndex}: сегмент ${currentSegment}, победитель userId=${currentWinner.userId}, prizeName=${currentWinner.prizeName}`);
      }
      
      if (localTime < spinDuration) {
        // Фаза горизонтальной прокрутки рулетки для текущего победителя
        drawHorizontalRoulette(ctx, width, height, localTime, spinDuration, allParticipants || winners, currentWinner, colorPalette);
      } else if (localTime < spinDuration + pauseDuration) {
        // Фаза паузы - показываем рулетку с выделенным победителем
        drawHorizontalRoulette(ctx, width, height, spinDuration, spinDuration, allParticipants || winners, currentWinner, colorPalette, true);
      } else {
        // Фаза показа победителя
        const revealTime = localTime - spinDuration - pauseDuration;
        drawWinnerReveal(ctx, width, height, currentWinner, revealTime, revealDuration, colorPalette);
      }
    } else {
      // Показываем последнего победителя в конце
      const lastWinner = winners[winners.length - 1];
      drawWinnerReveal(ctx, width, height, lastWinner, Math.min(1, (time - (winners.length - 1) * segmentDuration) / revealDuration), revealDuration, colorPalette);
    }
    
    // Сохраняем кадр
    const framePath = path.join(framesDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(framePath, buffer);
    frameFiles.push(framePath);
  }
  
  // Собираем видео из кадров с помощью ffmpeg
  return new Promise((resolve, reject) => {
    const tempVideoPath = outputPath.replace('.mp4', '_temp.mp4');
    
    const ffmpegProcess = ffmpeg()
      .input(path.join(framesDir, 'frame_%06d.png'))
      .inputFPS(fps)
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset fast', // Изменено с medium на fast для меньшего использования памяти
        '-crf 23',
        '-r ' + fps,
        '-threads 2' // Ограничиваем количество потоков для экономии памяти
      ])
      .output(tempVideoPath)
      .on('start', (commandLine) => {
        console.log('🎬 [FFMPEG] Команда:', commandLine);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`🎬 [FFMPEG] Прогресс: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        // Переименовываем временный файл
        if (fs.existsSync(tempVideoPath)) {
          fs.renameSync(tempVideoPath, outputPath);
        }
        
        // Удаляем временные кадры
        frameFiles.forEach(file => {
          if (fs.existsSync(file)) {
            try {
              fs.unlinkSync(file);
            } catch (err) {
              console.error('⚠️ Ошибка удаления кадра:', err);
            }
          }
        });
        
        // Удаляем директорию кадров
        if (fs.existsSync(framesDir)) {
          try {
            fs.rmSync(framesDir, { recursive: true, force: true });
          } catch (err) {
            console.error('⚠️ Ошибка удаления директории кадров:', err);
          }
        }
        
        console.log(`✅ Видео рулетки создано: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Ошибка создания видео:', err);
        console.error('❌ Детали ошибки ffmpeg:', {
          message: err.message,
          signal: err.signal,
          code: err.code
        });
        
        // Очищаем временные файлы при ошибке
        try {
          if (fs.existsSync(tempVideoPath)) {
            fs.unlinkSync(tempVideoPath);
          }
          frameFiles.forEach(file => {
            if (fs.existsSync(file)) {
              try {
                fs.unlinkSync(file);
              } catch (e) {}
            }
          });
          if (fs.existsSync(framesDir)) {
            fs.rmSync(framesDir, { recursive: true, force: true });
          }
        } catch (cleanupErr) {
          console.error('⚠️ Ошибка очистки при ошибке ffmpeg:', cleanupErr);
        }
        
        reject(err);
      });
    
    // Добавляем таймаут для процесса (5 минут)
    const timeout = setTimeout(() => {
      try {
        if (ffmpegProcess.ffmpegProc && !ffmpegProcess.ffmpegProc.killed) {
          console.error('⏱️ [FFMPEG] Таймаут генерации видео, завершаем процесс');
          ffmpegProcess.ffmpegProc.kill('SIGTERM');
        }
      } catch (err) {
        console.error('⚠️ Ошибка при завершении процесса по таймауту:', err);
      }
      reject(new Error('Таймаут генерации видео (превышено 5 минут)'));
    }, 5 * 60 * 1000);
    
    ffmpegProcess.on('end', () => clearTimeout(timeout));
    ffmpegProcess.on('error', () => clearTimeout(timeout));
    
    ffmpegProcess.run();
  });
}

/**
 * Рисует горизонтальную прокручивающуюся рулетку
 */
function drawHorizontalRoulette(ctx, width, height, time, duration, allParticipants, targetWinner, colorPalette = {}, isPaused = false) {
  const centerX = width / 2;
  const centerY = height / 2;
  const slotHeight = 200; // Высота одного слота
  const slotWidth = width * 0.8; // Ширина слота
  const visibleSlots = 3; // Количество видимых слотов
  
  // Ускорение и замедление прокрутки
  // Если пауза, используем максимальный progress (1.0)
  const progress = isPaused ? 1.0 : (time / duration);
  const easeOut = 1 - Math.pow(1 - progress, 3); // Кубическое замедление
  
  // Используем всех участников для прокрутки (не только победителей)
  const participantsForSpin = allParticipants && allParticipants.length > 0 ? allParticipants : [targetWinner];
  
  // Логируем для отладки
  console.log(`🎯 [ROULETTE] Целевой победитель: userId=${targetWinner.userId}, prizeName=${targetWinner.prizeName}`);
  console.log(`🎯 [ROULETTE] Всего участников для прокрутки: ${participantsForSpin.length}`);
  
  // Создаем список всех участников для прокрутки (повторяем несколько раз для эффекта)
  const allParticipantsList = [];
  const repeatCount = 25; // Количество повторений списка
  for (let i = 0; i < repeatCount; i++) {
    allParticipantsList.push(...participantsForSpin);
  }
  
  // Находим позицию целевого победителя в списке
  // Сравниваем только по userId, так как prizeName может быть только у победителей
  let targetPosition = -1;
  
  // Ищем первое вхождение целевого победителя в исходном списке
  const originalIndex = participantsForSpin.findIndex(p => p.userId === targetWinner.userId);
  
  if (originalIndex !== -1) {
    // Вычисляем позицию в повторенном списке (примерно в середине для эффекта)
    const middleRepeat = Math.floor(repeatCount / 2);
    targetPosition = middleRepeat * participantsForSpin.length + originalIndex;
    console.log(`✅ [ROULETTE] Найден целевой победитель на позиции ${targetPosition} (оригинальный индекс: ${originalIndex})`);
  } else {
    // Если не нашли, используем позицию в середине списка
    targetPosition = Math.floor(allParticipantsList.length / 2);
    console.log(`⚠️ [ROULETTE] Целевой победитель не найден в списке участников, используем среднюю позицию: ${targetPosition}`);
  }
  
  // Вычисляем смещение так, чтобы в конце остановиться на целевом победителе
  const centerSlotIndex = Math.floor(visibleSlots / 2); // Индекс центрального слота (обычно 1 для 3 слотов)
  
  // В конце прокрутки (progress = 1) центральный слот должен показывать целевого победителя
  // startIndex + centerSlotIndex должен быть равен targetPosition
  // Отсюда: startIndex = targetPosition - centerSlotIndex
  const finalStartIndex = targetPosition - centerSlotIndex;
  const finalScrollOffset = finalStartIndex * slotHeight;
  
  // Начальная прокрутка для эффекта (прокручиваем немного вперед)
  const initialScrollOffset = allParticipantsList.length * slotHeight * 0.2; // 20% списка
  
  // Применяем easing: от начальной позиции к финальной
  const scrollOffset = initialScrollOffset + easeOut * (finalScrollOffset - initialScrollOffset);
  
  // Проверяем, что в конце прокрутки правильный участник в центре
  if (progress > 0.99) {
    const finalStartIdx = Math.floor(scrollOffset / slotHeight);
    const centerParticipant = allParticipantsList[(finalStartIdx + centerSlotIndex) % allParticipantsList.length];
    const isCorrect = centerParticipant && centerParticipant.userId === targetWinner.userId;
    console.log(`✅ [ROULETTE] Финальная проверка: centerParticipant.userId=${centerParticipant?.userId}, target=${targetWinner.userId}, правильный=${isCorrect ? '✅' : '❌'}`);
  }
  
  // Рисуем рамку для рулетки
  const rouletteY = centerY - (visibleSlots * slotHeight) / 2;
  const rouletteX = centerX - slotWidth / 2;
  
  // Фон для рулетки
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(rouletteX - 20, rouletteY - 20, slotWidth + 40, visibleSlots * slotHeight + 40);
  
  // Рисуем слоты
  ctx.save();
  ctx.translate(rouletteX, rouletteY);
  // Создаем область отсечения
  ctx.beginPath();
  ctx.rect(0, 0, slotWidth, visibleSlots * slotHeight);
  ctx.clip();
  
  const startIndex = Math.floor(scrollOffset / slotHeight);
  
  for (let i = -1; i <= visibleSlots + 1; i++) {
    const slotIndex = startIndex + i;
    const slotY = i * slotHeight - (scrollOffset % slotHeight);
    
    if (slotY > -slotHeight && slotY < visibleSlots * slotHeight + slotHeight) {
      const participant = allParticipantsList[slotIndex % allParticipantsList.length];
      
      // Определяем, является ли это целевым победителем
      // Сравниваем только по userId, так как prizeName может отсутствовать у участников
      const centerSlot = Math.floor(visibleSlots / 2);
      const isInCenter = i === centerSlot;
      const isTargetWinner = participant && targetWinner && 
                           participant.userId === targetWinner.userId &&
                           isInCenter &&
                           (progress >= 0.85 || isPaused); // В конце прокрутки или во время паузы
      
      // Логируем для отладки в последних кадрах (только один раз)
      if (progress > 0.95 && isInCenter && participant && Math.abs(progress - 0.95) < 0.01) {
        const matches = participant.userId === targetWinner.userId;
        console.log(`🎯 [ROULETTE] Финальный центральный слот: userId=${participant.userId}, target=${targetWinner.userId}, совпадение=${matches ? '✅' : '❌'}`);
        if (!matches) {
          console.error(`❌ [ROULETTE] ОШИБКА: В центре не тот победитель! Ожидался ${targetWinner.userId}, получен ${participant.userId}`);
        }
      }
      
      // Цвета из палитры
      const winnerColor = colorPalette.winnerColor || '#ffd700';
      const winnerTextColor = colorPalette.winnerTextColor || '#000000';
      const participantColor = colorPalette.participantColor || '#ffffff';
      
      // Цвет фона слота - усиленное выделение для победителя
      if (isTargetWinner) {
        // Яркое выделение победителя
        ctx.fillStyle = winnerColor; // Полная непрозрачность для яркого выделения
      } else if (isInCenter && !isPaused) {
        // Центральный слот во время прокрутки
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      } else {
        // Обычные слоты
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      }
      
      ctx.fillRect(0, slotY, slotWidth, slotHeight);
      
      // Рамка слота - более яркая для победителя
      if (isTargetWinner) {
        ctx.strokeStyle = winnerColor;
        ctx.lineWidth = 6; // Более толстая рамка
        // Добавляем эффект свечения
        ctx.shadowColor = winnerColor;
        ctx.shadowBlur = 20;
      } else {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 0;
      }
      ctx.strokeRect(0, slotY, slotWidth, slotHeight);
      ctx.shadowBlur = 0; // Сбрасываем тень
      
      if (participant) {
        // Имя участника
        const firstName = (participant.firstName || '').trim();
        const lastName = (participant.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim() || 
                        (participant.username ? `@${participant.username}` : `ID: ${participant.userId}`);
        
        // Усиленное выделение текста победителя
        if (isTargetWinner) {
          ctx.fillStyle = winnerTextColor;
          ctx.font = 'bold 55px Arial'; // Более крупный шрифт
          // Добавляем тень для лучшей читаемости
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 5;
        } else {
          ctx.fillStyle = participantColor;
          ctx.font = 'bold 40px Arial';
          ctx.shadowBlur = 0;
        }
        ctx.textAlign = 'center';
        ctx.fillText(fullName, slotWidth / 2, slotY + slotHeight / 2 + 15);
        
        // Username или проект (без эмодзи)
        if (participant.username && fullName !== `@${participant.username}`) {
          ctx.font = '30px Arial';
          ctx.fillStyle = '#cccccc';
          ctx.fillText(`@${participant.username}`, slotWidth / 2, slotY + slotHeight / 2 + 50);
        } else if (participant.project) {
          ctx.font = '30px Arial';
          ctx.fillStyle = '#cccccc';
          ctx.fillText(participant.project, slotWidth / 2, slotY + slotHeight / 2 + 50);
        }
      }
    }
  }
  
  ctx.restore();
  
  // Указатели сверху и снизу (стрелки)
  const pointerY = rouletteY;
  const pointerY2 = rouletteY + visibleSlots * slotHeight;
  
  // Цвет указателей из палитры (используем цвет победителя)
  const pointerColor = colorPalette.winnerColor || '#ffd700';
  
  // Верхний указатель
  ctx.beginPath();
  ctx.moveTo(centerX, pointerY - 15);
  ctx.lineTo(centerX - 30, pointerY + 15);
  ctx.lineTo(centerX + 30, pointerY + 15);
  ctx.closePath();
  ctx.fillStyle = pointerColor;
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Нижний указатель
  ctx.beginPath();
  ctx.moveTo(centerX, pointerY2 + 15);
  ctx.lineTo(centerX - 30, pointerY2 - 15);
  ctx.lineTo(centerX + 30, pointerY2 - 15);
  ctx.closePath();
  ctx.fillStyle = pointerColor;
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Тексты внизу убраны по запросу пользователя
}

/**
 * Рисует выпадение победителя
 */
function drawWinnerReveal(ctx, width, height, winner, time, duration, colorPalette = {}) {
  const centerX = width / 2;
  const centerY = height / 2;
  
  // Анимация появления
  const fadeIn = Math.min(1, time / 0.5);
  const scale = 0.8 + (fadeIn * 0.2);
  
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);
  ctx.globalAlpha = fadeIn;
  
  // Фон для карточки победителя
  const cardWidth = width * 0.8;
  const cardHeight = height * 0.5;
  
  const cardGradient = ctx.createLinearGradient(-cardWidth/2, -cardHeight/2, cardWidth/2, cardHeight/2);
  const cardColor = colorPalette.cardColor || '#667eea';
  cardGradient.addColorStop(0, cardColor);
  // Немного затемняем для градиента
  const cardDarker = darkenColor(cardColor, 0.2);
  cardGradient.addColorStop(1, cardDarker);
  
  ctx.fillStyle = cardGradient;
  // Рисуем скругленный прямоугольник вручную
  drawRoundedRect(ctx, -cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 30);
  ctx.fill();
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.stroke();
  
  // Название приза (без эмодзи)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(winner.prizeName || 'Победитель', 0, -cardHeight/2 + 150);
  
  // Имя победителя
  const winnerName = `${winner.firstName || ''} ${winner.lastName || ''}`.trim() || `ID: ${winner.userId}`;
  ctx.font = 'bold 60px Arial';
  ctx.fillText(winnerName, 0, 0);
  
  // Username
  if (winner.username) {
    ctx.font = '40px Arial';
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText(`@${winner.username}`, 0, 60);
  }
  
  // Проект (без эмодзи)
  if (winner.project) {
    ctx.font = '35px Arial';
    ctx.fillStyle = '#b0b0b0';
    ctx.fillText(winner.project, 0, 120);
  }
  
  ctx.restore();
  
  // Конфетти эффект
  if (time > 0.3) {
    drawConfetti(ctx, width, height, time - 0.3);
  }
}

/**
 * Рисует эффект конфетти
 */
function drawConfetti(ctx, width, height, time) {
  const confettiCount = 50;
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8', '#00b894'];
  
  for (let i = 0; i < confettiCount; i++) {
    const seed = i * 0.1;
    const x = (width * 0.2) + (width * 0.6 * ((seed * 7) % 1));
    const y = (height * 0.1) + (height * 0.8 * ((time * 2 + seed) % 1));
    const size = 10 + (seed * 5) % 10;
    const rotation = (time * 5 + seed) * Math.PI;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.fillStyle = colors[Math.floor(seed * colors.length) % colors.length];
    ctx.fillRect(-size/2, -size/2, size, size);
    ctx.restore();
  }
}

/**
 * Рисует скругленный прямоугольник
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * Затемняет цвет на указанный процент
 */
function darkenColor(color, percent) {
  const num = parseInt(color.replace('#', ''), 16);
  const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
  const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
  const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

module.exports = { generateRouletteVideo };
