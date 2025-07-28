import React, { useState } from 'react';
import config from '../config';

const TelegramForm = () => {
  const [botToken, setBotToken] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/setup-bot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ botToken, welcomeMessage }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to setup bot');
      }
      
      alert('Бот успешно настроен!');
    } catch (error) {
      console.error('Error:', error);
      alert('Произошла ошибка при настройке бота');
    }
  };

  return (
    <div className="telegram-form">
      <h2>Настройка Telegram бота</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="botToken">Токен бота:</label>
          <input
            type="text"
            id="botToken"
            value={botToken}
            onChange={(e) => setBotToken(e.target.value)}
            placeholder="Введите токен бота"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="welcomeMessage">Приветственное сообщение:</label>
          <textarea
            id="welcomeMessage"
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Введите приветственное сообщение"
            required
          />
        </div>
        <button type="submit">Сохранить</button>
      </form>
    </div>
  );
};

export default TelegramForm; 