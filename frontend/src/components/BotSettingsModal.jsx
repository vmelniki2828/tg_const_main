import React, { useState, useEffect } from 'react';
import config from '../config';

function BotSettingsModal({ bot, onClose, onUpdate }) {
  const [name, setName] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (bot) {
      setName(bot.name || '');
      setToken(bot.token || '');
    }
  }, [bot]);

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || !token.trim()) {
      setError('Введите название и токен бота');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Получаем текущий editorState бота, чтобы не потерять его при обновлении
      const botResponse = await fetch(`${config.API_BASE_URL}/api/bots/${bot.id}`);
      if (!botResponse.ok) {
        throw new Error('Не удалось загрузить данные бота');
      }
      const currentBot = await botResponse.json();
      const editorState = currentBot?.editorState || bot.editorState;

      // Обновляем бота через API
      const response = await fetch(`${config.API_BASE_URL}/api/bots/${bot.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          token: token.trim(),
          editorState: editorState
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось обновить бота');
      }

      // Вызываем callback для обновления списка ботов
      if (onUpdate) {
        onUpdate();
      }

      onClose();
    } catch (err) {
      console.error('Error updating bot:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!bot) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bot-settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⚙️ Настройки бота</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <form onSubmit={handleSave} className="bot-settings-form">
          <div className="form-group">
            <label htmlFor="bot-name">Название бота:</label>
            <input
              id="bot-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название бота"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="bot-token">Токен бота:</label>
            <input
              id="bot-token"
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Введите токен бота"
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={onClose}
              className="cancel-button"
              disabled={isLoading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="save-button"
              disabled={isLoading}
            >
              {isLoading ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BotSettingsModal;

