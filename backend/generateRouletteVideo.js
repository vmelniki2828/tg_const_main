const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

/**
 * Генерирует видео рулетки с выпадением победителей
 * @param {Array} winners - Массив победителей с информацией о призах
 * @param {String} outputPath - Путь для сохранения видео
 * @returns {Promise<String>} Путь к созданному видео файлу
 */
async function generateRouletteVideo(winners, outputPath) {
  const width = 1080;
  const height = 1920; // Вертикальное видео для Telegram
  const fps = 30;
  const frameDuration = 1 / fps;
  
  // Параметры анимации
  const spinDuration = 3.5; // Длительность прокрутки рулетки для каждого победителя (секунды)
  const revealDuration = 2.5; // Длительность показа каждого победителя (секунды)
  const totalFrames = Math.ceil((spinDuration + revealDuration) * winners.length * fps);
  
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
    
    // Фон
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Заголовок
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('🎰 РОЗЫГРЫШ 🎰', width / 2, 150);
    
    // Определяем, какой победитель сейчас показывается
    const segmentDuration = spinDuration + revealDuration;
    const currentSegment = Math.floor(time / segmentDuration);
    const localTime = time % segmentDuration;
    
    if (currentSegment < winners.length) {
      const currentWinner = winners[currentSegment];
      
      if (localTime < spinDuration) {
        // Фаза горизонтальной прокрутки рулетки для текущего победителя
        drawHorizontalRoulette(ctx, width, height, localTime, spinDuration, winners, currentWinner);
      } else {
        // Фаза показа победителя
        const revealTime = localTime - spinDuration;
        drawWinnerReveal(ctx, width, height, currentWinner, revealTime, revealDuration);
      }
    } else {
      // Показываем последнего победителя в конце
      const lastWinner = winners[winners.length - 1];
      drawWinnerReveal(ctx, width, height, lastWinner, Math.min(1, (time - (winners.length - 1) * segmentDuration) / revealDuration), revealDuration);
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
    
    ffmpeg()
      .input(path.join(framesDir, 'frame_%06d.png'))
      .inputFPS(fps)
      .outputOptions([
        '-c:v libx264',
        '-pix_fmt yuv420p',
        '-preset medium',
        '-crf 23',
        '-r ' + fps
      ])
      .output(tempVideoPath)
      .on('end', () => {
        // Переименовываем временный файл
        if (fs.existsSync(tempVideoPath)) {
          fs.renameSync(tempVideoPath, outputPath);
        }
        
        // Удаляем временные кадры
        frameFiles.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
          }
        });
        
        // Удаляем директорию кадров
        if (fs.existsSync(framesDir)) {
          fs.rmSync(framesDir, { recursive: true, force: true });
        }
        
        console.log(`✅ Видео рулетки создано: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Ошибка создания видео:', err);
        reject(err);
      })
      .run();
  });
}

/**
 * Рисует горизонтальную прокручивающуюся рулетку
 */
function drawHorizontalRoulette(ctx, width, height, time, duration, allWinners, targetWinner) {
  const centerX = width / 2;
  const centerY = height / 2;
  const slotHeight = 200; // Высота одного слота
  const slotWidth = width * 0.8; // Ширина слота
  const visibleSlots = 3; // Количество видимых слотов
  
  // Ускорение и замедление прокрутки
  const progress = time / duration;
  const easeOut = 1 - Math.pow(1 - progress, 3); // Кубическое замедление
  
  // Создаем список всех участников для прокрутки (повторяем несколько раз для эффекта)
  const allParticipantsList = [];
  const repeatCount = 25; // Количество повторений списка
  for (let i = 0; i < repeatCount; i++) {
    allParticipantsList.push(...allWinners);
  }
  
  // Находим позицию целевого победителя в списке
  const targetPosition = allParticipantsList.findIndex(p => 
    p.userId === targetWinner.userId && 
    p.prizeName === targetWinner.prizeName
  );
  
  // Вычисляем смещение так, чтобы в конце остановиться на целевом победителе
  const totalDistance = allParticipantsList.length * slotHeight;
  const targetOffset = targetPosition * slotHeight;
  // Прокручиваем большую часть списка + смещение до целевого победителя
  const scrollOffset = easeOut * (totalDistance * 0.6 + targetOffset);
  
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
      const isTargetWinner = participant && targetWinner && 
                           participant.userId === targetWinner.userId &&
                           participant.prizeName === targetWinner.prizeName &&
                           Math.abs(i - Math.floor(visibleSlots / 2)) < 0.5;
      
      // Цвет фона слота
      if (isTargetWinner && progress > 0.9) {
        // Подсвечиваем победителя в конце
        ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
      } else if (i === Math.floor(visibleSlots / 2)) {
        // Центральный слот (где остановится)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      }
      
      ctx.fillRect(0, slotY, slotWidth, slotHeight);
      
      // Рамка слота
      ctx.strokeStyle = isTargetWinner && progress > 0.9 ? '#ffd700' : '#ffffff';
      ctx.lineWidth = isTargetWinner && progress > 0.9 ? 4 : 2;
      ctx.strokeRect(0, slotY, slotWidth, slotHeight);
      
      if (participant) {
        // Имя участника
        const firstName = (participant.firstName || '').trim();
        const lastName = (participant.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim() || 
                        (participant.username ? `@${participant.username}` : `ID: ${participant.userId}`);
        
        ctx.fillStyle = isTargetWinner && progress > 0.9 ? '#ffd700' : '#ffffff';
        ctx.font = isTargetWinner && progress > 0.9 ? 'bold 50px Arial' : 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(fullName, slotWidth / 2, slotY + slotHeight / 2 + 15);
        
        // Username или проект
        if (participant.username && fullName !== `@${participant.username}`) {
          ctx.font = '30px Arial';
          ctx.fillStyle = '#cccccc';
          ctx.fillText(`@${participant.username}`, slotWidth / 2, slotY + slotHeight / 2 + 50);
        } else if (participant.project) {
          ctx.font = '30px Arial';
          ctx.fillStyle = '#cccccc';
          ctx.fillText(`📁 ${participant.project}`, slotWidth / 2, slotY + slotHeight / 2 + 50);
        }
      }
    }
  }
  
  ctx.restore();
  
  // Указатели сверху и снизу (стрелки)
  const pointerY = rouletteY;
  const pointerY2 = rouletteY + visibleSlots * slotHeight;
  
  // Верхний указатель
  ctx.beginPath();
  ctx.moveTo(centerX, pointerY - 15);
  ctx.lineTo(centerX - 30, pointerY + 15);
  ctx.lineTo(centerX + 30, pointerY + 15);
  ctx.closePath();
  ctx.fillStyle = '#ffd700';
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
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Текст "Прокручивается..."
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  if (progress < 0.95) {
    ctx.fillText('🎰 Прокручивается...', centerX, height - 200);
  } else {
    ctx.fillText('🎉 Остановка!', centerX, height - 200);
  }
}

/**
 * Рисует выпадение победителя
 */
function drawWinnerReveal(ctx, width, height, winner, time, duration) {
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
  cardGradient.addColorStop(0, '#667eea');
  cardGradient.addColorStop(1, '#764ba2');
  
  ctx.fillStyle = cardGradient;
  // Рисуем скругленный прямоугольник вручную
  drawRoundedRect(ctx, -cardWidth/2, -cardHeight/2, cardWidth, cardHeight, 30);
  ctx.fill();
  
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 5;
  ctx.stroke();
  
  // Эмодзи приза
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 80px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🏆', 0, -cardHeight/2 + 120);
  
  // Название приза
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 50px Arial';
  ctx.fillText(winner.prizeName || 'Победитель', 0, -cardHeight/2 + 200);
  
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
  
  // Проект
  if (winner.project) {
    ctx.font = '35px Arial';
    ctx.fillStyle = '#b0b0b0';
    ctx.fillText(`📁 ${winner.project}`, 0, 120);
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

module.exports = { generateRouletteVideo };
