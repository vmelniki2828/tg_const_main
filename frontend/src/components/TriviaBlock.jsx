import React from 'react';
import config from '../config';

/**
 * Нормализация строки для сравнения ответов: нижний регистр, trim, схлопывание пробелов.
 */
export function normalizeAnswer(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

const TriviaBlock = ({
  block,
  onMessageChange,
  onCorrectAnswerChange,
  onCorrectVariantsChange,
  onSuccessMessageChange,
  onFailureMessageChange,
  onMediaUpload,
  onMediaRemove,
  onMediaMove,
  onStartConnection,
  onRemoveBlock,
  isConnecting
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

      <label className="quiz-question">
        Текст блока (вопрос или задание)
      </label>
      <textarea
        value={block.message || ''}
        onChange={(e) => onMessageChange(e.target.value)}
        placeholder="Введите текст викторины..."
        className="quiz-message textarea trivia-input"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Медиафайлы */}
      <div className="media-section trivia-section">
        <div className="media-header">
          <span>📎 Медиафайлы ({block.mediaFiles?.length || 0})</span>
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

      <label className="quiz-question">
        Правильный ответ
      </label>
      <input
        type="text"
        className="trivia-input"
        value={block.correctAnswer || ''}
        onChange={(e) => onCorrectAnswerChange(e.target.value)}
        placeholder="Например: Москва"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="quiz-message hint trivia-hint">
        Учитываются разные формулировки и пробелы (регистр и лишние пробелы игнорируются).
      </p>

      <label className="quiz-question">
        Другие варианты правильного ответа (через запятую)
      </label>
      <input
        type="text"
        className="trivia-input"
        value={correctVariantsStr}
        onChange={handleCorrectVariantsChange}
        placeholder="Москва, мск, столица"
        onClick={(e) => e.stopPropagation()}
      />

      <label className="quiz-message">
        🏆 Текст при правильном ответе
      </label>
      <textarea
        value={block.successMessage || ''}
        onChange={(e) => onSuccessMessageChange(e.target.value)}
        placeholder="Поздравляем! Верно!"
        className="quiz-message textarea trivia-input"
        onClick={(e) => e.stopPropagation()}
      />

      <label className="quiz-message">
        ❌ Текст при неправильном ответе
      </label>
      <textarea
        value={block.failureMessage || ''}
        onChange={(e) => onFailureMessageChange(e.target.value)}
        placeholder="Попробуйте ещё раз."
        className="quiz-message textarea trivia-input"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Точка соединения «При правильном ответе» */}
      <div className="quiz-navigation" style={{ marginTop: '0.5rem' }}>
        <button
          type="button"
          className="nav-button"
          onClick={(e) => {
            e.stopPropagation();
            onStartConnection('trivia_success', e);
          }}
          title="При правильном ответе перейти к этому блоку"
        >
          ✅ При правильном ответе →
        </button>
      </div>
    </div>
  );
};

export default TriviaBlock;
