import React, { useState, useEffect } from 'react';
import './LoyaltyProgram.css';
import config from '../config';

const LoyaltyProgram = ({ botId, onClose }) => {
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    isEnabled: false,
    messages: {
      '1m': { enabled: false, message: '', promoCode: '' },
      '24h': { enabled: false, message: '', promoCode: '' },
      '7d': { enabled: false, message: '', promoCode: '' },
      '30d': { enabled: false, message: '', promoCode: '' },
      '90d': { enabled: false, message: '', promoCode: '' },
      '180d': { enabled: false, message: '', promoCode: '' },
      '360d': { enabled: false, message: '', promoCode: '' }
    }
  });
  const [availablePromoCodes, setAvailablePromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLoyaltyConfig();
    fetchAvailablePromoCodes();
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
    }
  };

  const fetchAvailablePromoCodes = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/available-promocodes/${botId}`);
      if (response.ok) {
        const promoCodes = await response.json();
        setAvailablePromoCodes(promoCodes);
      }
    } catch (error) {
      console.error('Error fetching promocodes:', error);
    } finally {
      setLoading(false);
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

                      <div className="promocode-field">
                        <label>Промокод для подарка:</label>
                        <select
                          value={config.promoCode}
                          onChange={(e) => handleMessageChange(period, 'promoCode', e.target.value)}
                        >
                          <option value="">Выберите промокод</option>
                          {availablePromoCodes.map(promo => (
                            <option key={promo.code} value={promo.code}>
                              {promo.code} {promo.activated ? '(использован)' : '(доступен)'}
                            </option>
                          ))}
                        </select>
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
      </div>
    </div>
  );
};

export default LoyaltyProgram;
