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
  const spinDuration = 3; // Длительность вращения рулетки (секунды)
  const revealDuration = 2; // Длительность показа каждого победителя (секунды)
  const totalFrames = Math.ceil((spinDuration + revealDuration * winners.length) * fps);
  
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
    ctx.fillText('🎲 РОЗЫГРЫШ 🎲', width / 2, 150);
    
    if (time < spinDuration) {
      // Фаза вращения рулетки
      drawSpinningRoulette(ctx, width, height, time, spinDuration, winners);
    } else {
      // Фаза показа победителей
      const revealTime = time - spinDuration;
      const winnerIndex = Math.floor(revealTime / revealDuration);
      
      if (winnerIndex < winners.length) {
        const localTime = revealTime - (winnerIndex * revealDuration);
        drawWinnerReveal(ctx, width, height, winners[winnerIndex], localTime, revealDuration);
      } else {
        // Показываем последнего победителя в конце
        const lastWinner = winners[winners.length - 1];
        drawWinnerReveal(ctx, width, height, lastWinner, Math.min(1, (revealTime - (winners.length - 1) * revealDuration) / revealDuration), revealDuration);
      }
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
 * Рисует вращающуюся рулетку
 */
function drawSpinningRoulette(ctx, width, height, time, duration, winners) {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.35;
  
  // Ускорение и замедление вращения
  const progress = time / duration;
  const easeOut = 1 - Math.pow(1 - progress, 3); // Кубическое замедление
  const rotation = easeOut * Math.PI * 8; // 4 полных оборота
  
  // Рисуем рулетку
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(rotation);
  
  // Сектора рулетки
  const sectorCount = Math.max(winners.length, 8);
  const sectorAngle = (Math.PI * 2) / sectorCount;
  
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a29bfe', '#fd79a8', '#00b894'];
  
  for (let i = 0; i < sectorCount; i++) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, i * sectorAngle, (i + 1) * sectorAngle);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.stroke();
    
    // Текст в секторе
    ctx.save();
    ctx.rotate(i * sectorAngle + sectorAngle / 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`🎁`, radius * 0.6, 10);
    ctx.restore();
  }
  
  // Центральный круг
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#1a1a2e';
  ctx.lineWidth = 5;
  ctx.stroke();
  
  ctx.restore();
  
  // Указатель
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - radius - 30);
  ctx.lineTo(centerX - 20, centerY - radius - 10);
  ctx.lineTo(centerX + 20, centerY - radius - 10);
  ctx.closePath();
  ctx.fillStyle = '#ffd700';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  // Текст "Вращается..."
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('🎡 Вращается...', centerX, height - 200);
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
