import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import config from '../config';

function SystemStats({ onClose }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiFetch(`${config.API_BASE_URL}/api/system-stats`);
      if (!response.ok) {
        throw new Error('Не удалось загрузить статистику системы');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading system stats:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !stats) {
    return (
      <div className="modal-overlay">
        <div className="modal-content">
          <div className="loading">Загрузка статистики...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content system-stats-modal">
        <div className="modal-header">
          <h2>📊 Статистика системы</h2>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}
        
        {stats && (
          <div className="stats-content">
            <div className="stats-section">
              <h3>🤖 Боты</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Всего ботов:</span>
                  <span className="stat-value">{stats.bots.total}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Активных:</span>
                  <span className="stat-value">{stats.bots.active}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Запущенных:</span>
                  <span className="stat-value">{stats.bots.running}</span>
                </div>
              </div>
            </div>
            
            <div className="stats-section">
              <h3>👥 Пользователи</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Всего пользователей:</span>
                  <span className="stat-value">{stats.users.total}</span>
                </div>
              </div>
            </div>
            
            <div className="stats-section">
              <h3>🎯 Квизы</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Всего квизов:</span>
                  <span className="stat-value">{stats.quizzes.total}</span>
                </div>
              </div>
            </div>
            
            <div className="stats-footer">
              <small>Последнее обновление: {new Date(stats.timestamp).toLocaleString('ru-RU')}</small>
              <button onClick={loadStats} className="refresh-button" disabled={isLoading}>
                {isLoading ? '⏳ Обновление...' : '🔄 Обновить'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SystemStats;