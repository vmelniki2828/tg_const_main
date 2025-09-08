import React, { useState, useEffect } from 'react';
import './LoyaltyProgram.css';
import config from '../config';

const LoyaltyProgram = ({ botId, onClose }) => {
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    isEnabled: false,
    messages: {
      '1m': { enabled: false, message: '' },
      '24h': { enabled: false, message: '' },
      '7d': { enabled: false, message: '' },
      '30d': { enabled: false, message: '' },
      '90d': { enabled: false, message: '' },
      '180d': { enabled: false, message: '' },
      '360d': { enabled: false, message: '' }
    }
  });
  const [loyaltyPromoCodes, setLoyaltyPromoCodes] = useState({});
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLoyaltyConfig();
  }, [botId]);

  const fetchLoyaltyConfig = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/loyalty-config/${botId}`);
      if (response.ok) {
        const config = await response.json();
        setLoyaltyConfig(config);
      }
    } catch (error) {
      console.error('Error fetching loyalty config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLoyaltyPromoCodes = async (period) => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/loyalty-promocodes/${botId}/${period}`);
      if (response.ok) {
        const data = await response.json();
        setLoyaltyPromoCodes(prev => ({
          ...prev,
          [period]: data
        }));
      }
    } catch (error) {
      console.error('Error fetching loyalty promocodes:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/loyalty-config/${botId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loyaltyConfig),
      });

      if (response.ok) {
        alert('✅ Настройки программы лояльности сохранены!');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при сохранении');
      }
    } catch (error) {
      setError('Ошибка соединения с сервером');
    } finally {
      setSaving(false);
    }
  };

  const handleMessageChange = (period, field, value) => {
    setLoyaltyConfig(prev => ({
      ...prev,
      messages: {
        ...prev.messages,
        [period]: {
          ...prev.messages[period],
          [field]: value
        }
      }
    }));
  };

  const handleUploadPromoCodes = async (period, file) => {
    const formData = new FormData();
    formData.append('promocodes', file);
    
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/loyalty-promocodes/${botId}/${period}`, {
        method: 'POST',
        body: formData
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchLoyaltyPromoCodes(period);
      } else {
        const errorData = await response.json();
        alert('Ошибка: ' + errorData.error);
      }
    } catch (error) {
      alert('Ошибка загрузки: ' + error.message);
    }
  };

  const handleDeletePromoCodes = async (period) => {
    if (!window.confirm(`Удалить все промокоды для периода ${getPeriodLabel(period)}?`)) {
      return;
    }
    
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/loyalty-promocodes/${botId}/${period}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(result.message);
        fetchLoyaltyPromoCodes(period);
      } else {
        const errorData = await response.json();
        alert('Ошибка: ' + errorData.error);
      }
    } catch (error) {
      alert('Ошибка удаления: ' + error.message);
    }
  };

  const getPeriodLabel = (period) => {
    const labels = {
      '1m': '1 минута',
      '24h': '24 часа',
      '7d': '7 дней',
      '30d': '30 дней',
      '90d': '90 дней',
      '180d': '180 дней',
      '360d': '360 дней'
    };
    return labels[period] || period;
  };

  if (loading) {
    return (
      <div className="loyalty-overlay">
        <div className="loyalty-modal">
          <div className="loading">Загрузка программы лояльности...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="loyalty-overlay">
      <div className="loyalty-modal">
        <div className="loyalty-header">
          <h2>🎁 Программа лояльности</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
          </div>
        )}

        <div className="loyalty-content">
          <div className="loyalty-toggle">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={loyaltyConfig.isEnabled}
                onChange={(e) => setLoyaltyConfig(prev => ({ ...prev, isEnabled: e.target.checked }))}
              />
              <span className="toggle-text">Включить программу лояльности</span>
            </label>
          </div>

          {loyaltyConfig.isEnabled && (
            <div className="loyalty-periods">
              <h3>Настройка автосообщений по периодам подписки:</h3>
              
              {Object.entries(loyaltyConfig.messages).map(([period, config]) => (
                <div key={period} className="period-config">
                  <div className="period-header">
                    <label className="period-toggle">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => handleMessageChange(period, 'enabled', e.target.checked)}
                      />
                      <span className="period-label">{getPeriodLabel(period)}</span>
                    </label>
                  </div>

                  {config.enabled && (
                    <div className="period-settings">
                      <div className="message-field">
                        <label>Сообщение поздравления:</label>
                        <textarea
                          value={config.message}
                          onChange={(e) => handleMessageChange(period, 'message', e.target.value)}
                          placeholder={`Поздравляем! Вы с нами уже ${getPeriodLabel(period)}! 🎉`}
                          rows={3}
                        />
                      </div>

                      <div className="promocode-section">
                        <div className="promocode-header">
                          <label>Промокоды для подарка:</label>
                          <div className="promocode-actions">
                            <button
                              type="button"
                              className="manage-promocodes-btn"
                              onClick={() => {
                                setSelectedPeriod(period);
                                fetchLoyaltyPromoCodes(period);
                              }}
                            >
                              Управление промокодами
                            </button>
                          </div>
                        </div>
                        
                        {loyaltyPromoCodes[period] && (
                          <div className="promocode-stats">
                            <div className="stat-item">
                              <span className="stat-label">Всего:</span>
                              <span className="stat-value">{loyaltyPromoCodes[period].stats.total}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Доступно:</span>
                              <span className="stat-value available">{loyaltyPromoCodes[period].stats.available}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Использовано:</span>
                              <span className="stat-value used">{loyaltyPromoCodes[period].stats.used}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="loyalty-info">
            <h4>ℹ️ Как работает программа лояльности:</h4>
            <ul>
              <li>Бот автоматически отслеживает время подписки каждого пользователя</li>
              <li>При достижении указанных периодов отправляется поздравление</li>
              <li>Если настроен промокод, он автоматически выдается пользователю</li>
              <li>Пользователи, подписанные до запуска бота, считаются подписанными 24 часа</li>
            </ul>
          </div>

          <div className="loyalty-actions">
            <button 
              className="save-btn" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? '💾 Сохранение...' : '💾 Сохранить настройки'}
            </button>
            <button className="cancel-btn" onClick={onClose}>
              Отмена
            </button>
          </div>
        </div>
        
        {selectedPeriod && (
          <LoyaltyPromoCodeManager
            botId={botId}
            period={selectedPeriod}
            periodLabel={getPeriodLabel(selectedPeriod)}
            onClose={() => setSelectedPeriod(null)}
            onUpload={(file) => handleUploadPromoCodes(selectedPeriod, file)}
            onDelete={() => handleDeletePromoCodes(selectedPeriod)}
            promoCodes={loyaltyPromoCodes[selectedPeriod]}
          />
        )}
      </div>
    </div>
  );
};

// Компонент для управления промокодами
const LoyaltyPromoCodeManager = ({ botId, period, periodLabel, onClose, onUpload, onDelete, promoCodes }) => {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (file) {
      onUpload(file);
      setFile(null);
    }
  };

  return (
    <div className="loyalty-overlay">
      <div className="loyalty-modal">
        <div className="loyalty-header">
          <h2>🎁 Промокоды для {periodLabel}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="loyalty-content">
          <div className="promocode-upload">
            <h3>Загрузить промокоды</h3>
            <p>Загрузите CSV файл с промокодами (один промокод на строку)</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="file-input"
            />
            <button 
              onClick={handleUpload}
              disabled={!file}
              className="upload-btn"
            >
              Загрузить
            </button>
          </div>

          {promoCodes && (
            <div className="promocode-stats">
              <h3>Статистика промокодов</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">{promoCodes.stats.total}</div>
                  <div className="stat-label">Всего</div>
                </div>
                <div className="stat-card available">
                  <div className="stat-number">{promoCodes.stats.available}</div>
                  <div className="stat-label">Доступно</div>
                </div>
                <div className="stat-card used">
                  <div className="stat-number">{promoCodes.stats.used}</div>
                  <div className="stat-label">Использовано</div>
                </div>
              </div>
            </div>
          )}

          <div className="promocode-actions">
            <button 
              onClick={onDelete}
              className="delete-btn"
            >
              Удалить все промокоды
            </button>
            <button 
              onClick={onClose}
              className="cancel-btn"
            >
              Закрыть
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyProgram;
