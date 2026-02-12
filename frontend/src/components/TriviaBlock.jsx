import React from 'react';
import config from '../config';

export function normalizeAnswer(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.toLowerCase().trim().replace(/\s+/g, ' ');
}

const TriviaBlock = ({
  block,
  onMessageChange,
  onCorrectVariantsChange,
  onSuccessMessageChange,
  onFailureMessageChange,
  onMediaUpload,
  onMediaRemove,
  onMediaMove,
  onRemoveBlock
}) => {
  const correctVariantsStr = Array.isArray(block.correctAnswerVariants)
    ? block.correctAnswerVariants.join(', ')
    : '';

  const handleCorrectVariantsChange = (e) => {
    const raw = e.target.value || '';
    const variants = raw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    onCorrectVariantsChange(variants);
  };

  return (
    <div className="trivia-block quiz-block">
      <div className="block-header">
        <span className="block-title">🎲 Викторина</span>
        <div className="block-controls">
          <button
            className="block-button delete-button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveBlock();
            }}
            title="Удалить блок"
          >
            🗑️
          </button>
        </div>
      </div>

      <textarea
        value={block.message || ''}
        onChange={(e) => onMessageChange(e.target.value)}
        placeholder="Введите текст викторины..."
        className="quiz-question"
        onClick={(e) => e.stopPropagation()}
      />

      <div className="media-section">
        <div className="media-header">
          <span>📎 Медиафайлы ({block.mediaFiles?.length || 0}):</span>
          <input
            type="file"
            id={`trivia-media-${block.id}`}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
            onChange={(e) => onMediaUpload(e)}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="block-button"
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById(`trivia-media-${block.id}`).click();
            }}
            title="Добавить медиафайл"
          >
            📎
          </button>
        </div>
        {block.mediaFiles && block.mediaFiles.length > 0 && (
          <div className="media-files-list">
            {block.mediaFiles.map((media, index) => (
              <div key={media.filename || index} className="media-item">
                <div className="media-preview">
                  {media.mimetype?.startsWith('image/') ? (
                    <img
                      src={`${config.API_BASE_URL || ''}${media.path}`}
                      alt=""
                      style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
                    />
                  ) : (
                    <div className="file-info">
                      <span>📄 {media.originalname || media.filename}</span>
                    </div>
                  )}
                </div>
                <div className="media-controls">
                  <button
                    type="button"
                    className="block-button"
                    onClick={(e) => { e.stopPropagation(); onMediaRemove(index); }}
                    title="Удалить"
                  >
                    ❌
                  </button>
                  {index > 0 && (
                    <button
                      type="button"
                      className="block-button"
                      onClick={(e) => { e.stopPropagation(); onMediaMove(index, 'up'); }}
                      title="Вверх"
                    >
                      ⬆️
                    </button>
                  )}
                  {index < block.mediaFiles.length - 1 && (
                    <button
                      type="button"
                      className="block-button"
                      onClick={(e) => { e.stopPropagation(); onMediaMove(index, 'down'); }}
                      title="Вниз"
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

      <div className="quiz-answers">
        <h4>Правильный ответ:</h4>
        <input
          type="text"
          value={correctVariantsStr}
          onChange={handleCorrectVariantsChange}
          placeholder="Москва, мск, столица"
          className="trivia-correct-input"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="quiz-messages">
        <div className="quiz-message">
          <label>🏆 Текст при правильном ответе:</label>
          <textarea
            value={block.successMessage || ''}
            onChange={(e) => onSuccessMessageChange(e.target.value)}
            placeholder="Поздравляем! Верно!"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="quiz-message">
          <label>❌ Текст при неправильном ответе:</label>
          <textarea
            value={block.failureMessage || ''}
            onChange={(e) => onFailureMessageChange(e.target.value)}
            placeholder="Попробуйте ещё раз."
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
};

export default TriviaBlock;
