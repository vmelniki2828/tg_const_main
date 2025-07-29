import React, { useState } from 'react';
import config from '../config';

const QuizBlock = ({
  block,
  onMessageChange,
  onButtonAdd,
  onButtonRemove,
  onButtonUpdate,
  onButtonCorrectToggle,
  onMediaUpload,
  onMediaRemove,
  onMediaMove,
  onStartConnection,
  onRemoveBlock,
  onAddQuestion,
  onRemoveQuestion,
  onUpdateCurrentQuestion,
  onUpdateFinalMessage,
  onUpdateFinalFailureMessage,
  isConnecting
}) => {
  const [showPromoUploader, setShowPromoUploader] = useState(false);
  const [promoUploadMessage, setPromoUploadMessage] = useState('');
  const [promoUploadError, setPromoUploadError] = useState('');

  if (!block.questions || !block.questions.length) {
    return null;
  }

  const currentQuestion = block.questions[block.currentQuestionIndex];

  const handlePromoCodeUpload = async (file) => {
    const formData = new FormData();
    formData.append('promocodes', file);
    formData.append('quizId', block.id);

    try {
      // Сначала удаляем старые промокоды
      try {
        const deleteResponse = await fetch(`${config.API_BASE_URL}/api/quiz-promocodes/${block.id}`, {
          method: 'DELETE'
        });
        
        if (deleteResponse.ok) {
          console.log(`🗑️ Старые промокоды для квиза ${block.id} удалены`);
        }
      } catch (deleteError) {
        console.warn('Не удалось удалить старые промокоды:', deleteError);
      }

      // Затем загружаем новые промокоды
      const response = await fetch(`${config.API_BASE_URL}/api/upload-promocodes`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setPromoUploadMessage(`✅ ${data.message}`);
        setPromoUploadError('');
        setTimeout(() => setPromoUploadMessage(''), 3000);
      } else {
        setPromoUploadError(`❌ ${data.error || 'Ошибка загрузки файла'}`);
        setPromoUploadMessage('');
      }
    } catch (err) {
      setPromoUploadError('❌ Ошибка соединения с сервером');
      setPromoUploadMessage('');
      console.error('Promo code upload error:', err);
    }
  };

  return (
    <div className="quiz-block">
      <div className="block-header">
        <span className="block-title">🎯 Квиз (Вопрос {block.currentQuestionIndex + 1} из {block.questions.length})</span>
        <div className="block-controls">
          <button
            className="block-button"
            onClick={(e) => {
              e.stopPropagation();
              onAddQuestion();
            }}
            title="Добавить вопрос"
          >
            📝
          </button>
          {block.questions.length > 1 && (
            <button
              className="block-button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveQuestion(block.currentQuestionIndex);
              }}
              title="Удалить текущий вопрос"
            >
              ✖️
            </button>
          )}
          <button
            className="block-button"
            onClick={(e) => {
              e.stopPropagation();
              onButtonAdd(block.id);
            }}
            title="Добавить вариант ответа"
          >
            ➕
          </button>
          <button
            className="block-button delete-button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveBlock();
            }}
            title="Удалить квиз"
          >
            🗑️
          </button>
        </div>
      </div>

      <div className="quiz-navigation">
        <button
          className="nav-button"
          onClick={(e) => {
            e.stopPropagation();
            const newIndex = block.currentQuestionIndex > 0 ? block.currentQuestionIndex - 1 : block.questions.length - 1;
            onUpdateCurrentQuestion(newIndex);
          }}
          title="Предыдущий вопрос"
        >
          ⬅️
        </button>
        <textarea
          value={currentQuestion.message}
          onChange={(e) => onMessageChange(e.target.value)}
          placeholder="Введите вопрос..."
          className="quiz-question"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="nav-button"
          onClick={(e) => {
            e.stopPropagation();
            const newIndex = block.currentQuestionIndex < block.questions.length - 1 ? block.currentQuestionIndex + 1 : 0;
            onUpdateCurrentQuestion(newIndex);
          }}
          title="Следующий вопрос"
        >
          ➡️
        </button>
      </div>

      {/* Варианты ответов */}
      <div className="quiz-answers">
        <h4>Варианты ответов:</h4>
        <div className="block-buttons">
          {currentQuestion.buttons.map(button => (
            <div key={button.id} className="button-item quiz-button-item">
              <input
                type="text"
                value={button.text}
                onChange={(e) => onButtonUpdate(button.id, e.target.value)}
                placeholder="Вариант ответа"
                title={button.text}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="button-controls">
                <button
                  className={`block-button correct-toggle ${button.isCorrect ? 'correct' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onButtonCorrectToggle(button.id);
                  }}
                  title={button.isCorrect ? "Правильный ответ" : "Отметить как правильный"}
                >
                  {button.isCorrect ? '✅' : '⭕'}
                </button>
                <button
                  className={`block-button ${isConnecting && button.id === block.connectingButtonId ? 'connecting' : ''}`}
                  onClick={(e) => onStartConnection(button.id, e)}
                  title="Создать связь"
                >
                  🔗
                </button>
                <button
                  className="block-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onButtonRemove(button.id);
                  }}
                  title="Удалить вариант"
                >
                  ❌
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Финальные сообщения квиза */}
      <div className="quiz-messages">
        <div className="quiz-message">
          <label>🏆 Финальное сообщение при успешном завершении квиза:</label>
          <textarea
            value={block.finalSuccessMessage || ''}
            onChange={(e) => onUpdateFinalMessage(e.target.value)}
            placeholder="🎉 Поздравляем! Вы успешно прошли квиз!"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="quiz-message">
          <label>❌ Финальное сообщение при неудачном завершении квиза:</label>
          <textarea
            value={block.finalFailureMessage || ''}
            onChange={(e) => onUpdateFinalFailureMessage(e.target.value)}
            placeholder="❌ К сожалению, вы не прошли квиз. Нужно ответить правильно на все вопросы."
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* Секция медиафайлов */}
      <div className="media-section">
        <div className="media-header">
          <span>📎 Медиафайлы ({currentQuestion.mediaFiles ? currentQuestion.mediaFiles.length : 0}):</span>
          {console.log('QuizBlock render - currentQuestion:', currentQuestion)}
          {console.log('QuizBlock render - mediaFiles:', currentQuestion.mediaFiles)}
          <input
            type="file"
            id={`media-${block.id}`}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            onChange={(e) => onMediaUpload(e)}
            style={{ display: 'none' }}
          />
          <button
            className="block-button"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById(`media-${block.id}`).click();
            }}
            title="Добавить медиафайл"
          >
            📎
          </button>
        </div>
        {currentQuestion.mediaFiles && currentQuestion.mediaFiles.length > 0 && (
          <div className="media-files-list">
            {currentQuestion.mediaFiles.map((media, index) => (
              <div key={media.filename} className="media-item">
                <div className="media-preview">
                  {media.mimetype.startsWith('image/') ? (
                    <img 
                      src={`${config.API_BASE_URL}${media.path}`} 
                      alt="Preview" 
                      style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="file-info">
                      <span>📄 {media.originalname}</span>
                      <span style={{ fontSize: '0.8em', color: '#666' }}>
                        ({(media.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  )}
                </div>
                <div className="media-controls">
                  <button
                    className="block-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMediaRemove(index);
                    }}
                    title="Удалить медиафайл"
                  >
                    ❌
                  </button>
                  {index > 0 && (
                    <button
                      className="block-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMediaMove(index, 'up');
                      }}
                      title="Переместить вверх"
                    >
                      ⬆️
                    </button>
                  )}
                  {index < currentQuestion.mediaFiles.length - 1 && (
                    <button
                      className="block-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMediaMove(index, 'down');
                      }}
                      title="Переместить вниз"
                    >
                      ⬇️
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Секция промокодов */}
      <div className="promo-section">
        <div className="promo-header">
          <span>🎁 Промокоды для награждения:</span>
          <input
            type="file"
            id={`promo-${block.id}`}
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) {
                handlePromoCodeUpload(file);
                e.target.value = ''; // Очищаем input
              }
            }}
            style={{ display: 'none' }}
          />
          <button
            className="block-button"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById(`promo-${block.id}`).click();
            }}
            title="Загрузить файл с промокодами"
          >
            🎁
          </button>
        </div>
        
        {promoUploadMessage && (
          <div className="promo-success-message">
            {promoUploadMessage}
          </div>
        )}
        
        {promoUploadError && (
          <div className="promo-error-message">
            {promoUploadError}
          </div>
        )}

        <div className="promo-info">
          <p>📋 Формат файла: CSV с колонками <code>Code, User, Activated</code></p>
          <p>💡 Промокоды будут выдаваться при 100% успешном прохождении квиза</p>
        </div>
      </div>
    </div>
  );
};

export default QuizBlock; 