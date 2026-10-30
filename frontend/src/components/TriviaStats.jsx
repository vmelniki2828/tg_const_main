import { apiFetch } from '../api';
import React, { useState, useEffect } from 'react';
import './QuizStats.css';
import config from '../config';

const TriviaStats = ({ blocks, botId, onClose }) => {
  const [stats, setStats] = useState({});
  const [promoCodesStats, setPromoCodesStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrivia, setSelectedTrivia] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [promoCodesListCollapsed, setPromoCodesListCollapsed] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setError(null);
      const response = await apiFetch(`${config.API_BASE_URL}/api/trivia-stats`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setStats(data);

      const triviaBlocks = (blocks || []).filter(b => b.type === 'trivia');
      const promoCodesData = {};
      for (const trivia of triviaBlocks) {
        try {
          if (!botId) {
            promoCodesData[trivia.id] = { hasPromoCodes: false, totalPromoCodes: 0, availablePromoCodes: 0, usedPromoCodes: 0, promoCodesList: [] };
            continue;
          }
          const promoResponse = await apiFetch(`${config.API_BASE_URL}/api/quiz-promocodes/${trivia.id}?botId=${botId}`);
          if (promoResponse.ok) {
            promoCodesData[trivia.id] = await promoResponse.json();
          } else {
            promoCodesData[trivia.id] = { hasPromoCodes: false, totalPromoCodes: 0, availablePromoCodes: 0, usedPromoCodes: 0, promoCodesList: [] };
          }
        } catch (e) {
          promoCodesData[trivia.id] = { hasPromoCodes: false, totalPromoCodes: 0, availablePromoCodes: 0, usedPromoCodes: 0, promoCodesList: [] };
        }
      }
      setPromoCodesStats(promoCodesData);
    } catch (err) {
      console.error('Ошибка загрузки статистики викторин:', err);
      setError(err.message);
      setStats({});
    } finally {
      setLoading(false);
    }
  };

  const getTriviaBlocks = () => blocks.filter(b => b.type === 'trivia');

  const formatDate = (timestamp) => new Date(timestamp).toLocaleString('ru-RU');

  const getTriviaStat = (blockId) => stats[blockId] || {
    totalAttempts: 0,
    successfulCompletions: 0,
    failedAttempts: 0,
    userAttempts: []
  };

  const calculateSuccessRate = (s) => {
    if (s.totalAttempts === 0) return 0;
    return ((s.successfulCompletions / s.totalAttempts) * 100).toFixed(1);
  };

  const exportStatsToFile = async () => {
    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/export-trivia-stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stats, blocks: getTriviaBlocks() })
      });
      if (!response.ok) throw new Error('Ошибка при экспорте');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trivia-stats-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Ошибка при экспорте:', err);
      alert('Ошибка при сохранении файла: ' + err.message);
    }
  };

  const filterAndSortAttempts = (attempts) => {
    if (!attempts) return [];
    let filtered = attempts;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(a =>
        (a.userName && a.userName.toLowerCase().includes(term)) ||
        (a.username && a.username.toLowerCase().includes(term)) ||
        String(a.userId).includes(term) ||
        (a.userAnswer && a.userAnswer.toLowerCase().includes(term))
      );
    }
    switch (sortBy) {
      case 'name':
        filtered = [...filtered].sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
        break;
      case 'success':
        filtered = [...filtered].sort((a, b) => (b.success ? 1 : 0) - (a.success ? 1 : 0));
        break;
      case 'date':
      default:
        filtered = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        break;
    }
    return filtered;
  };

  if (loading) {
    return (
      <div className="quiz-stats-overlay">
        <div className="quiz-stats-modal">
          <div className="loading">Загрузка статистики...</div>
        </div>
      </div>
    );
  }

  const triviaBlocks = getTriviaBlocks();

  return (
    <div className="quiz-stats-overlay">
      <div className="quiz-stats-modal">
        <div className="quiz-stats-header">
          <h2>🎲 Статистика викторин</h2>
          <div className="header-controls">
            <button className="export-btn" onClick={exportStatsToFile} title="Сохранить статистику в CSV">
              📊 Экспорт в CSV
            </button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {error ? (
          <div className="error-message">
            <p>❌ Ошибка загрузки: {error}</p>
            <button onClick={() => { setError(null); fetchStats(); }} className="retry-btn">🔄 Повторить</button>
          </div>
        ) : triviaBlocks.length === 0 ? (
          <div className="no-quizzes">
            <p>Викторины не найдены. Создайте викторину для просмотра статистики.</p>
          </div>
        ) : (
          <div className="quiz-stats-content">
            {!selectedTrivia ? (
              <div className="quizzes-list">
                <h3>Выберите викторину:</h3>
                {triviaBlocks.map(trivia => {
                  const s = getTriviaStat(trivia.id);
                  const rate = calculateSuccessRate(s);
                  return (
                    <div
                      key={trivia.id}
                      className="quiz-item"
                      onClick={() => setSelectedTrivia(trivia)}
                    >
                      <div className="quiz-info">
                        <h4>{trivia.message || `Викторина ${trivia.id}`}</h4>
                      </div>
                      <div className="quiz-stats-summary">
                        <div className="stat-item">
                          <span className="stat-label">Попыток:</span>
                          <span className="stat-value">{s.totalAttempts}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Успешно:</span>
                          <span className="stat-value success">{s.successfulCompletions}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Успешность:</span>
                          <span className="stat-value">{rate}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="quiz-detail-stats">
                <div className="quiz-detail-header">
                  <button className="back-btn" onClick={() => setSelectedTrivia(null)}>← Назад к списку</button>
                  <h3>{selectedTrivia.message || `Викторина ${selectedTrivia.id}`}</h3>
                </div>
                {(() => {
                  const s = getTriviaStat(selectedTrivia.id);
                  const rate = calculateSuccessRate(s);
                  const attempts = filterAndSortAttempts(s.userAttempts);
                  return (
                    <div className="quiz-detail-content">
                      <div className="stats-overview">
                        <div className="stat-card">
                          <div className="stat-number">{s.totalAttempts}</div>
                          <div className="stat-label">Всего попыток</div>
                        </div>
                        <div className="stat-card success">
                          <div className="stat-number">{s.successfulCompletions}</div>
                          <div className="stat-label">Успешных</div>
                        </div>
                        <div className="stat-card failed">
                          <div className="stat-number">{s.failedAttempts}</div>
                          <div className="stat-label">Неудачных</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-number">{rate}%</div>
                          <div className="stat-label">Успешность</div>
                        </div>
                      </div>

                      <div className="promo-codes-stats">
                        <h4>🎁 Статистика промокодов (ваучеров):</h4>
                        {(() => {
                          const promoStats = promoCodesStats[selectedTrivia.id];
                          if (!promoStats || !promoStats.hasPromoCodes) {
                            return <p className="no-promocodes">Промокоды не загружены для этой викторины. Выберите бота и откройте статистику снова.</p>;
                          }
                          return (
                            <div className="promo-stats-overview">
                              <div className="promo-stat-card">
                                <div className="stat-number">{promoStats.totalPromoCodes}</div>
                                <div className="stat-label">Всего</div>
                              </div>
                              <div className="promo-stat-card available">
                                <div className="stat-number">{promoStats.availablePromoCodes}</div>
                                <div className="stat-label">Доступно</div>
                              </div>
                              <div className="promo-stat-card used">
                                <div className="stat-number">{promoStats.usedPromoCodes}</div>
                                <div className="stat-label">Выдано</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      <div className="promo-codes-list">
                        <div className="section-header" onClick={() => setPromoCodesListCollapsed(!promoCodesListCollapsed)}>
                          <h4>📋 Список промокодов:</h4>
                          <button type="button" className="collapse-btn">{promoCodesListCollapsed ? '▼' : '▲'}</button>
                        </div>
                        {!promoCodesListCollapsed && (() => {
                          const promoStats = promoCodesStats[selectedTrivia.id];
                          if (!promoStats || !promoStats.hasPromoCodes || !promoStats.promoCodesList?.length) {
                            return <p className="no-promocodes">Нет промокодов для отображения</p>;
                          }
                          return (
                            <div className="promocodes-grid">
                              {promoStats.promoCodesList.map((promoCode, index) => (
                                <div key={index} className={`promocode-item ${promoCode.activated ? 'used' : 'available'}`}>
                                  <div className="promocode-code"><strong>{promoCode.code}</strong></div>
                                  <div className="promocode-status">
                                    {promoCode.activated ? (
                                      <span className="status-used">✅ Выдан: {promoCode.activatedBy ?? '—'}</span>
                                    ) : (
                                      <span className="status-available">⏳ Доступен</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>

                      <div className="user-attempts">
                        <h4>Попытки пользователей:</h4>
                        <div className="attempts-controls">
                          <div className="search-box">
                            <input
                              type="text"
                              placeholder="Поиск по имени, ID или ответу..."
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="search-input"
                            />
                            <span className="search-icon">🔍</span>
                          </div>
                          <div className="sort-controls">
                            <label>Сортировка:</label>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="sort-select">
                              <option value="date">По дате (новые)</option>
                              <option value="name">По имени</option>
                              <option value="success">По успешности</option>
                            </select>
                          </div>
                        </div>
                        {!s.userAttempts || s.userAttempts.length === 0 ? (
                          <p className="no-attempts">Пока нет попыток</p>
                        ) : attempts.length === 0 ? (
                          <p className="no-attempts">По запросу ничего не найдено</p>
                        ) : (
                          <div className="attempts-list">
                            <div className="attempts-table attempts-table--trivia">
                              <div className="table-header">
                                <div className="header-cell header-cell--left">👤 Пользователь</div>
                                <div className="header-cell header-cell--left">💬 Ответ</div>
                                <div className="header-cell header-cell--center">✅ Результат</div>
                                <div className="header-cell header-cell--left">🎁 Ваучер</div>
                                <div className="header-cell header-cell--right">📅 Дата</div>
                              </div>
                              {attempts.map((a, i) => (
                                <div key={i} className={`table-row ${a.success ? 'success' : 'failed'}`}>
                                  <div className="table-cell table-cell--left">
                                    {a.userName || a.userLastName ? [a.userName, a.userLastName].filter(Boolean).join(' ') : `ID: ${a.userId}`}
                                    {a.username && <span className="username"> @{a.username}</span>}
                                  </div>
                                  <div className="table-cell table-cell--left">{a.userAnswer || '—'}</div>
                                  <div className="table-cell table-cell--center">{a.success ? '✅ Верно' : '❌ Неверно'}</div>
                                  <div className="table-cell table-cell--left">{a.promoCode || '—'}</div>
                                  <div className="table-cell table-cell--right">{formatDate(a.timestamp)}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TriviaStats;
