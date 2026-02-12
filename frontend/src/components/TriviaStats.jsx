import React, { useState, useEffect } from 'react';
import './QuizStats.css';
import config from '../config';

const TriviaStats = ({ blocks, onClose }) => {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTrivia, setSelectedTrivia] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setError(null);
      const response = await fetch(`${config.API_BASE_URL}/api/trivia-stats`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setStats(data);
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
