import React, { useState, useEffect } from 'react';
import SystemStats from './SystemStats';
import config from '../config';

function BotsList({ onSelectBot }) {
  const [bots, setBots] = useState([]);
  const [newBotName, setNewBotName] = useState('');
  const [newBotToken, setNewBotToken] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSystemStats, setShowSystemStats] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingBot, setEditingBot] = useState(null);
  const [editBotName, setEditBotName] = useState('');
  const [editBotToken, setEditBotToken] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Загрузка списка ботов
  useEffect(() => {
    loadBots();
  }, []);

  const loadBots = async () => {
    try {
      setIsLoading(true);
      console.log('🔧 Загружаем ботов с URL:', `${config.API_BASE_URL}/api/bots`);
      const response = await fetch(`${config.API_BASE_URL}/api/bots`);
      console.log('🔧 Ответ сервера:', response.status, response.statusText);
      if (!response.ok) {
        throw new Error('Не удалось загрузить список ботов');
      }
      const data = await response.json();
      console.log('🔧 Полученные данные:', data);
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

  const handleOpenSettings = (bot) => {
    setEditingBot(bot);
    setEditBotName(bot.name || '');
    setEditBotToken(bot.token || '');
    setShowSettingsModal(true);
    setError(null);
  };

  const handleCloseSettings = () => {
    setShowSettingsModal(false);
    setEditingBot(null);
    setEditBotName('');
    setEditBotToken('');
    setError(null);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!editBotName.trim() || !editBotToken.trim()) {
      setError('Введите название и токен бота');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      
      const response = await fetch(`${config.API_BASE_URL}/api/bots/${editingBot.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editBotName.trim(),
          token: editBotToken.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Не удалось обновить настройки бота');
      }

      // Обновляем список ботов
      await loadBots();
      handleCloseSettings();
    } catch (err) {
      console.error('Error saving bot settings:', err);
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="loading">Загрузка...</div>;
  }

  return (
    <div className="bots-page">
      <div className="page-header">
        <h1>Мои боты</h1>
        <button 
          onClick={() => setShowSystemStats(true)}
          className="system-stats-button"
        >
          🖥️ Статистика системы
        </button>
      </div>
      
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
            <div className="bot-status">
              Статус: {bot.isRunning ? '🟢 Запущен' : '🔴 Остановлен'}
            </div>
            <div className="bot-controls">
              <button
                onClick={() => onSelectBot(bot.id)}
                className="edit-button"
              >
                ✏️ Редактировать
              </button>
              <button
                onClick={() => handleOpenSettings(bot)}
                className="settings-button"
              >
                ⚙️ Настройки
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
      
      {showSystemStats && (
        <SystemStats 
          onClose={() => setShowSystemStats(false)}
        />
      )}

      {showSettingsModal && editingBot && (
        <div className="modal-overlay" onClick={handleCloseSettings}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚙️ Настройки бота</h2>
              <button onClick={handleCloseSettings} className="close-button">×</button>
            </div>
            
            {error && (
              <div className="error-message">
                ❌ {error}
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="create-bot-form">
              <div className="form-group">
                <label>Название бота:</label>
                <input
                  type="text"
                  value={editBotName}
                  onChange={(e) => setEditBotName(e.target.value)}
                  placeholder="Введите название бота"
                  required
                  disabled={isSaving}
                />
              </div>
              <div className="form-group">
                <label>Токен бота:</label>
                <input
                  type="text"
                  value={editBotToken}
                  onChange={(e) => setEditBotToken(e.target.value)}
                  placeholder="Введите токен бота"
                  required
                  disabled={isSaving}
                />
              </div>
              <div className="form-actions">
                <button 
                  type="button" 
                  onClick={handleCloseSettings}
                  disabled={isSaving}
                  className="cancel-button"
                >
                  Отмена
                </button>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="save-button"
                >
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default BotsList; 