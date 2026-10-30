import { apiFetch } from '../api';
import React, { useState, useEffect, useRef } from 'react';
import LoyaltyCheckProgress from './LoyaltyCheckProgress';
import './LoyaltyProgram.css';
import config from '../config';

const LoyaltyProgram = ({ botId, onClose }) => {
  const [loyaltyConfig, setLoyaltyConfig] = useState({
    isEnabled: false,
    channelSettings: {
      isRequired: false,
      channelId: '',
      channelUsername: '',
      channelTitle: '',
      notSubscribedMessage: 'Для участия в программе лояльности необходимо подписаться на наш канал!'
    },
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
  const [forceChecking, setForceChecking] = useState(false);
  const [checkJob, setCheckJob] = useState(null);
  const [automaticProgress, setAutomaticProgress] = useState(null);
  const requestVersion = useRef(0);
  const startingCheck = useRef(false);

  useEffect(() => {
    let active = true;
    let timer;
    requestVersion.current++;
    setCheckJob(null);
    setAutomaticProgress(null);
    setForceChecking(false);
    const poll = async () => {
      const version = requestVersion.current;
      try {
        const response = await apiFetch(`${config.API_BASE_URL}/api/loyalty-check/${botId}`);
        if (!response.ok) throw new Error('Не удалось получить прогресс проверки. Повторяем подключение.');
        const data = await response.json();
        if (active && version === requestVersion.current) {
          setCheckJob(data.job);
          setForceChecking(startingCheck.current || data.job?.status === 'running');
        }
        const autoResponse = await apiFetch(`${config.API_BASE_URL}/api/loyalty-auto-progress/${botId}`);
        if (autoResponse.ok) {
          const autoData = await autoResponse.json();
          if (active) setAutomaticProgress(autoData.progress);
        }
      } catch (error) {
        if (active) setError(error.message);
      } finally {
        if (active) timer = setTimeout(poll, 2000);
      }
    };
    poll();
    return () => { active = false; clearTimeout(timer); };
  }, [botId]);

  useEffect(() => {
    fetchLoyaltyConfig();
    fetchChannelSettings();
  }, [botId]);

  const fetchLoyaltyConfig = async () => {
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/loyalty-config/${botId}`);
      if (response.ok) {
        const config = await response.json();
        setLoyaltyConfig(prev => ({
          ...prev,
          ...config,
          channelSettings: config.channelSettings || prev.channelSettings
        }));
      }
    } catch (error) {
      console.error('Error fetching loyalty config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChannelSettings = async () => {
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/loyalty-channel/${botId}`);
      if (response.ok) {
        const data = await response.json();
        setLoyaltyConfig(prev => ({
          ...prev,
          channelSettings: data.channelSettings || prev.channelSettings
        }));
      }
    } catch (error) {
      console.error('Error fetching channel settings:', error);
    }
  };

  const fetchLoyaltyPromoCodes = async (period) => {
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/loyalty-promocodes/${botId}/${period}`);
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
      // Сохраняем основную конфигурацию лояльности
      const loyaltyResponse = await apiFetch(`${config.API_BASE_URL}/api/loyalty-config/${botId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loyaltyConfig),
      });

      // Сохраняем настройки канала
      const channelResponse = await apiFetch(`${config.API_BASE_URL}/api/loyalty-channel/${botId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loyaltyConfig.channelSettings),
      });

      if (loyaltyResponse.ok && channelResponse.ok) {
        alert('✅ Настройки программы лояльности сохранены!');
      } else {
        const errorData = await loyaltyResponse.json();
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

  const handleChannelSettingChange = (field, value) => {
    setLoyaltyConfig(prev => ({
      ...prev,
      channelSettings: {
        ...prev.channelSettings,
        [field]: value
      }
    }));
  };

  const handleUploadPromoCodes = async (period, file) => {
    const formData = new FormData();
    formData.append('promocodes', file);
    
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/loyalty-promocodes/${botId}/${period}`, {
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
      const response = await apiFetch(`${config.API_BASE_URL}/api/loyalty-promocodes/${botId}/${period}`, {
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

  const handleExportStats = async () => {
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/export-loyalty-stats/${botId}`);
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `loyalty-stats-${botId}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        alert('✅ Статистика программы лояльности скачана!');
      } else {
        const errorData = await response.json();
        alert('Ошибка: ' + errorData.error);
      }
    } catch (error) {
      alert('Ошибка скачивания: ' + error.message);
    }
  };

  const handleForceCheck = async () => {
    if (!window.confirm('Запустить принудительную проверку программы лояльности для всех пользователей? Это может занять некоторое время.')) {
      return;
    }
    
    setForceChecking(true);
    startingCheck.current = true;
    const version = ++requestVersion.current;
    setError(null);
    
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/force-give-loyalty-rewards-all/${botId}`, {
        method: 'POST'
      });
      if (version !== requestVersion.current) return;
      
      if (response.ok) {
        const result = await response.json();
        setCheckJob(result.job);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Не удалось начать проверку');
        setForceChecking(false);
      }
    } catch (error) {
      setError('Ошибка проверки: ' + error.message);
      setForceChecking(false);
    } finally {
      startingCheck.current = false;
    }
  };

  const handleCancelCheck = async () => {
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/loyalty-check/${botId}/cancel`, { method: 'POST' });
      if (!response.ok) throw new Error('Не удалось остановить проверку');
      setCheckJob((await response.json()).job);
    } catch (error) { setError(error.message); }
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
            <div className="channel-settings">
              <h3>🔒 Настройки проверки подписки на канал</h3>
              
              <div className="channel-toggle">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={loyaltyConfig.channelSettings.isRequired}
                    onChange={(e) => handleChannelSettingChange('isRequired', e.target.checked)}
                  />
                  <span className="toggle-text">Требовать подписку на канал</span>
                </label>
              </div>

              {loyaltyConfig.channelSettings.isRequired && (
                <div className="channel-config">
                  <div className="form-group">
                    <label>ID канала или @username:</label>
                    <input
                      type="text"
                      value={loyaltyConfig.channelSettings.channelId}
                      onChange={(e) => handleChannelSettingChange('channelId', e.target.value)}
                      placeholder="@my_channel или -1001234567890"
                      className="form-input"
                    />
                    <small className="form-hint">
                      Укажите ID канала (например: @my_channel) или числовой ID (например: -1001234567890)
                    </small>
                  </div>

                  <div className="form-group">
                    <label>Название канала (для отображения):</label>
                    <input
                      type="text"
                      value={loyaltyConfig.channelSettings.channelTitle}
                      onChange={(e) => handleChannelSettingChange('channelTitle', e.target.value)}
                      placeholder="Мой канал"
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label>Сообщение для неподписанных пользователей:</label>
                    <textarea
                      value={loyaltyConfig.channelSettings.notSubscribedMessage}
                      onChange={(e) => handleChannelSettingChange('notSubscribedMessage', e.target.value)}
                      placeholder="Для участия в программе лояльности необходимо подписаться на наш канал!"
                      rows={3}
                      className="form-textarea"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {loyaltyConfig.isEnabled && (
            <div className="loyalty-periods">
              <h3>Настройка автосообщений по периодам подписки:</h3>
              
              <div className="periods-grid">
                {Object.entries(loyaltyConfig.messages).map(([period, config]) => (
                  <div key={period} className="period-card">
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
                            <button
                              type="button"
                              className="manage-promocodes-btn"
                              onClick={() => {
                                setSelectedPeriod(period);
                                fetchLoyaltyPromoCodes(period);
                              }}
                            >
                              🎁 Управление
                            </button>
                          </div>
                          
                          {loyaltyPromoCodes[period] && (
                            <div className="promocode-stats">
                              <div className="stats-row">
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
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="loyalty-info">
            <h4>ℹ️ Как работает программа лояльности:</h4>
            <ul>
              <li>Бот автоматически отслеживает время подписки каждого пользователя</li>
              <li>При достижении указанных периодов назначается ваучер; отдельные уведомления отключены</li>
              <li>Если настроен промокод, он автоматически выдается пользователю</li>
              <li>Пользователи, подписанные до запуска бота, считаются подписанными 24 часа</li>
            </ul>
          </div>

          <LoyaltyCheckProgress job={checkJob} automatic={automaticProgress} onCancel={handleCancelCheck} />
          <div className="loyalty-actions">
            <button 
              className="force-check-btn" 
              onClick={handleForceCheck}
              disabled={forceChecking}
              title="Принудительно проверить всех пользователей и выдать не выданные промокоды"
            >
              {forceChecking ? '⏳ Проверка...' : '🔍 Принудительная проверка лояльности'}
            </button>
            <button 
              className="export-btn" 
              onClick={handleExportStats}
            >
              📊 Скачать статистику CSV
            </button>
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
  const [showPromoCodes, setShowPromoCodes] = useState(false);

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
      <div className="loyalty-modal promocode-manager-modal">
        <div className="loyalty-header">
          <h2>🎁 Промокоды для {periodLabel}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="loyalty-content">
          <div className="promocode-upload">
            <h3>📤 Загрузить промокоды</h3>
            <p>Загрузите CSV файл с промокодами (один промокод на строку)</p>
            <div className="upload-section">
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
                {file ? `📁 Загрузить ${file.name}` : '📁 Выберите файл'}
              </button>
            </div>
          </div>

          {promoCodes && (
            <div className="promocode-stats">
              <h3>📊 Статистика промокодов</h3>
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
              
              <div className="promocode-list-section">
                <div className="promocode-list-header">
                  <h4>📋 Список промокодов</h4>
                  <button 
                    className="toggle-list-btn"
                    onClick={() => setShowPromoCodes(!showPromoCodes)}
                  >
                    {showPromoCodes ? '🔼 Скрыть' : '🔽 Показать'}
                  </button>
                </div>
                
                {showPromoCodes && promoCodes.promoCodes && (
                  <div className="promocode-list">
                    {promoCodes.promoCodes.map((promo, index) => (
                      <div key={index} className={`promocode-item ${promo.activated ? 'used' : 'available'}`}>
                        <span className="promocode-code">{promo.code}</span>
                        <span className="promocode-status">
                          {promo.activated ? '✅ Использован' : '🆕 Доступен'}
                        </span>
                        {promo.activated && (
                          <span className="promocode-user">
                            Пользователь: {promo.activatedBy}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="promocode-actions">
            <button 
              onClick={onDelete}
              className="delete-btn"
            >
              🗑️ Удалить все промокоды
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
