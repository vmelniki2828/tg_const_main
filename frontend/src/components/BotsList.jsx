import React, { useState, useEffect } from 'react';
import config from '../config';

function BotsList({ onSelectBot }) {
  const [bots, setBots] = useState([]);
  const [newBotName, setNewBotName] = useState('');
  const [newBotToken, setNewBotToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Загрузка списка ботов
  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/bots`);
      if (!response.ok) {
        throw new Error('Не удалось загрузить список ботов');
      }
      const data = await response.json();
      setBots(data.bots);
    } catch (err) {
      console.error('Error loading bots:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBot = async (e) => {
    e.preventDefault();
    if (!newBotName.trim() || !newBotToken.trim()) {
      setError('Введите имя и токен бота');
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/bots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newBotName,
          token: newBotToken,
          editorState: {
            blocks: [
              {
                id: 'start',
                type: 'start',
                position: { x: 2500, y: 2500 },
                message: 'Начало диалога',
                buttons: [],
              }
            ],
            connections: [],
            pan: { x: 0, y: 0 },
            scale: 1
          }
        }),
      });

      if (!response.ok) {
        throw new Error('Не удалось создать бота');
      }

      const newBot = await response.json();
      setBots([...bots, newBot]);
      setNewBotName('');
      setNewBotToken('');
      
      // Переходим к редактированию нового бота
      onSelectBot(newBot.id);
    } catch (err) {
      console.error('Error creating bot:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBot = async (botId) => {
    if (!window.confirm('Вы уверены, что хотите удалить этого бота?')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/bots/${botId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Не удалось удалить бота');
      }

      setBots(bots.filter(b => b.id !== botId));
    } catch (err) {
      console.error('Error deleting bot:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="bots-page">
      <h1>Мои боты</h1>
      
      <form className="create-bot-form" onSubmit={handleCreateBot}>
        <h2>Создать нового бота</h2>
        <div className="form-group">
          <label>Название бота:</label>
          <input
            type="text"
            value={newBotName}
            onChange={(e) => setNewBotName(e.target.value)}
            placeholder="Введите название бота"
            required
          />
        </div>
        <div className="form-group">
          <label>Токен бота:</label>
          <input
            type="text"
            value={newBotToken}
            onChange={(e) => setNewBotToken(e.target.value)}
            placeholder="Введите токен бота"
            required
          />
        </div>
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Создание...' : 'Создать бота'}
        </button>
      </form>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <div className="bots-grid">
        {bots.map(bot => (
          <div key={bot.id} className="bot-card">
            <h3>{bot.name}</h3>
            <div className="bot-controls">
              <button
                onClick={() => onSelectBot(bot.id)}
                className="edit-button"
              >
                ✏️ Редактировать
              </button>
              <button
                onClick={() => handleDeleteBot(bot.id)}
                className="delete-button"
              >
                🗑️ Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BotsList; 