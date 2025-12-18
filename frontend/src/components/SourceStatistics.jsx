import React, { useState, useEffect } from 'react';
import config from '../config';
import './SourceStatistics.css';

function SourceStatistics({ botId }) {
  const [statistics, setStatistics] = useState(null);
  const [users, setUsers] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('sources'); // 'sources', 'users', 'activity', 'popular', 'paths'
  const [usersPage, setUsersPage] = useState(1);
  const [usersSource, setUsersSource] = useState('all');
  const [usersSearch, setUsersSearch] = useState('');
  const [activeUsersData, setActiveUsersData] = useState(null);
  const [popularBlocks, setPopularBlocks] = useState(null);
  const [popularButtons, setPopularButtons] = useState(null);
  const [userPath, setUserPath] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userPathSearch, setUserPathSearch] = useState('');
  const [dailyStats, setDailyStats] = useState(null);
  const [activePeriod, setActivePeriod] = useState('day'); // day, week, month
  const [loyaltyOnly, setLoyaltyOnly] = useState(false);

  useEffect(() => {
    if (botId) {
      if (activeTab === 'sources') {
        loadStatistics();
      } else if (activeTab === 'users') {
        loadUsers();
      } else if (activeTab === 'activity') {
        loadActiveUsers();
        loadDailyStats();
      } else if (activeTab === 'popular') {
        loadPopularBlocks();
        loadPopularButtons();
      }
      // Для вкладки 'paths' загрузка происходит только при поиске пользователя
    }
  }, [botId, startDate, endDate, activeTab, usersPage, usersSource, usersSearch, activePeriod, loyaltyOnly]);

  const loadStatistics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let url = `${config.API_BASE_URL}/api/statistics/sources/${botId}`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (loyaltyOnly) params.append('loyaltyOnly', 'true');
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Не удалось загрузить статистику');
      }
      const data = await response.json();
      setStatistics(data);
    } catch (err) {
      console.error('Error loading statistics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch(`${config.API_BASE_URL}/api/statistics/export/${botId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startDate: startDate || null,
          endDate: endDate || null,
        }),
      });

      if (!response.ok) {
        throw new Error('Не удалось экспортировать статистику');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statistics_${botId}_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting statistics:', err);
      alert('Ошибка при экспорте: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      setError(null);
      
      let url = `${config.API_BASE_URL}/api/statistics/users/${botId}`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (usersSource && usersSource !== 'all') params.append('source', usersSource);
      if (usersSearch) params.append('search', usersSearch);
      if (loyaltyOnly) params.append('loyaltyOnly', 'true');
      params.append('page', usersPage);
      params.append('limit', '50');
      
      if (params.toString()) {
        url += '?' + params.toString();
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Не удалось загрузить список пользователей');
      }
      const data = await response.json();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users:', err);
      setError(err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} мин.`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} ч. ${mins} мин.`;
  };

  const formatTimeFromHours = (hours) => {
    if (!hours || hours === 0) {
      return '00:00';
    }
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const loadActiveUsers = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/statistics/active-users/${botId}?period=${activePeriod}`);
      if (!response.ok) throw new Error('Не удалось загрузить активных пользователей');
      const data = await response.json();
      setActiveUsersData(data);
    } catch (err) {
      console.error('Error loading active users:', err);
      setError(err.message);
    }
  };

  const loadDailyStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await fetch(`${config.API_BASE_URL}/api/statistics/daily/${botId}?date=${today}`);
      if (!response.ok) throw new Error('Не удалось загрузить ежедневную статистику');
      const data = await response.json();
      setDailyStats(data);
    } catch (err) {
      console.error('Error loading daily stats:', err);
    }
  };

  const loadPopularBlocks = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/statistics/popular-blocks/${botId}?limit=20`);
      if (!response.ok) throw new Error('Не удалось загрузить популярные блоки');
      const data = await response.json();
      setPopularBlocks(data);
    } catch (err) {
      console.error('Error loading popular blocks:', err);
      setError(err.message);
    }
  };

  const loadPopularButtons = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/statistics/popular-buttons/${botId}?limit=20`);
      if (!response.ok) throw new Error('Не удалось загрузить популярные кнопки');
      const data = await response.json();
      setPopularButtons(data);
    } catch (err) {
      console.error('Error loading popular buttons:', err);
      setError(err.message);
    }
  };

  const loadUserPath = async (userId) => {
    if (!userId) {
      setUserPath(null);
      return;
    }
    try {
      setIsLoadingUsers(true);
      const response = await fetch(`${config.API_BASE_URL}/api/statistics/user-path/${botId}/${userId}?limit=200`);
      if (!response.ok) throw new Error('Не удалось загрузить маршрут пользователя');
      const data = await response.json();
      setUserPath(data);
    } catch (err) {
      console.error('Error loading user path:', err);
      setError(err.message);
      setUserPath(null);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleUserPathSearch = () => {
    if (userPathSearch.trim()) {
      setSelectedUserId(userPathSearch.trim());
      loadUserPath(userPathSearch.trim());
    }
  };

  if (!botId) {
    return <div className="source-statistics">Выберите бота для просмотра статистики</div>;
  }

  return (
    <div className="source-statistics">
      <div className="source-statistics-header">
        <h2>📊 Статистика по источникам</h2>
        <div className="tabs">
          <button
            className={activeTab === 'sources' ? 'tab-active' : 'tab'}
            onClick={() => setActiveTab('sources')}
          >
            📈 По источникам
          </button>
          <button
            className={activeTab === 'users' ? 'tab-active' : 'tab'}
            onClick={() => setActiveTab('users')}
          >
            👥 Список пользователей
          </button>
          <button
            className={activeTab === 'activity' ? 'tab-active' : 'tab'}
            onClick={() => setActiveTab('activity')}
          >
            📊 Активность
          </button>
          <button
            className={activeTab === 'popular' ? 'tab-active' : 'tab'}
            onClick={() => setActiveTab('popular')}
          >
            🔥 Популярное
          </button>
          <button
            className={activeTab === 'paths' ? 'tab-active' : 'tab'}
            onClick={() => setActiveTab('paths')}
          >
            🛤️ Пути
          </button>
        </div>
        <div className="source-statistics-filters">
          <div className="filter-group">
            <label>С:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>По:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>
              <input
                type="checkbox"
                checked={loyaltyOnly}
                onChange={(e) => setLoyaltyOnly(e.target.checked)}
                style={{ marginRight: '5px' }}
              />
              Только участники программы лояльности
            </label>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="export-button"
          >
            {isExporting ? 'Экспорт...' : '📥 Экспорт в Excel'}
          </button>
        </div>
      </div>

      {error && <div className="error-message">❌ {error}</div>}

      {activeTab === 'sources' ? (
        <>
          {isLoading ? (
            <div className="loading">Загрузка статистики...</div>
          ) : statistics ? (
            <>
              {/* Общая статистика */}
              <div className="general-stats">
                <h3>📈 Общая статистика</h3>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Всего пользователей</div>
                    <div className="stat-value">{statistics.general.totalUsers}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Участников программы лояльности</div>
                    <div className="stat-value">{statistics.general.totalLoyaltyUsers || 0}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Активное время</div>
                    <div className="stat-value">{formatTimeFromHours(statistics.general.totalActiveTime)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Среднее время на пользователя</div>
                    <div className="stat-value">{formatTime(statistics.general.avgActiveTime)}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Выдано промокодов</div>
                    <div className="stat-value">{statistics.general.totalPromoCodes}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Завершено квизов</div>
                    <div className="stat-value">{statistics.general.totalQuizzes}</div>
                  </div>
                </div>
              </div>

              {/* Статистика по источникам */}
              <div className="source-stats">
                <h3>🔍 Статистика по источникам</h3>
                <div className="table-container">
                  <table className="sources-table">
                    <thead>
                      <tr>
                        <th>Источник</th>
                        <th>Пользователей</th>
                        <th>Участников лояльности</th>
                        <th>Активное время</th>
                        <th>Среднее время</th>
                        <th>Промокоды</th>
                        <th>Квизы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.bySource.map((source, index) => (
                        <tr key={index}>
                          <td className="source-name">{source.source}</td>
                          <td>{source.users}</td>
                          <td>{source.loyaltyUsers || 0}</td>
                          <td>{formatTimeFromHours(source.activeTimeHours)}</td>
                          <td>{formatTime(source.avgActiveTime)}</td>
                          <td>{source.promoCodes}</td>
                          <td>{source.quizzes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Период */}
              {statistics.period && (
                <div className="period-info">
                  <p>
                    Период: {new Date(statistics.period.start).toLocaleDateString('ru-RU')} -{' '}
                    {new Date(statistics.period.end).toLocaleDateString('ru-RU')}
                  </p>
                </div>
              )}
            </>
          ) : null}
        </>
      ) : activeTab === 'users' ? (
        <>
          {/* Фильтры для списка пользователей */}
          <div className="users-filters">
            <div className="filter-group">
              <label>Поиск:</label>
              <input
                type="text"
                placeholder="ID, username, имя..."
                value={usersSearch}
                onChange={(e) => {
                  setUsersSearch(e.target.value);
                  setUsersPage(1);
                }}
                className="search-input"
              />
            </div>
            <div className="filter-group">
              <label>Источник:</label>
              <select
                value={usersSource}
                onChange={(e) => {
                  setUsersSource(e.target.value);
                  setUsersPage(1);
                }}
                className="source-select"
              >
                <option value="all">Все</option>
                {statistics?.bySource?.map((source, index) => (
                  <option key={index} value={source.source}>
                    {source.source}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>
                <input
                  type="checkbox"
                  checked={loyaltyOnly}
                  onChange={(e) => {
                    setLoyaltyOnly(e.target.checked);
                    setUsersPage(1);
                  }}
                  style={{ marginRight: '5px' }}
                />
                Только участники программы лояльности
              </label>
            </div>
          </div>

          {isLoadingUsers ? (
            <div className="loading">Загрузка пользователей...</div>
          ) : users ? (
            <>
              <div className="users-table-container">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User ID</th>
                      <th>Username</th>
                      <th>Имя</th>
                      <th>Источник</th>
                      <th>Лояльность</th>
                      <th>Активное время</th>
                      <th>Сессии</th>
                      <th>Промокоды</th>
                      <th>Квизы</th>
                      <th>Подписка</th>
                      <th>Регистрация</th>
                      <th>Последняя активность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.users.map((user, index) => (
                      <tr key={index}>
                        <td>{user.userId}</td>
                        <td>@{user.username || 'N/A'}</td>
                        <td>{user.firstName || ''} {user.lastName || ''}</td>
                        <td className="source-name">{user.source}</td>
                        <td>{user.isLoyaltyUser ? '🎁 Да' : '❌ Нет'}</td>
                        <td>{formatTimeFromHours(user.activeTimeHours)}</td>
                        <td>{user.sessions}</td>
                        <td>{user.promoCodes}</td>
                        <td>{user.quizzes}</td>
                        <td>{user.isSubscribed ? '🟢' : '🔴'}</td>
                        <td>{formatDate(user.registeredAt)}</td>
                        <td>{formatDate(user.lastActivity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Пагинация */}
              {users.pagination && users.pagination.pages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setUsersPage(prev => Math.max(1, prev - 1))}
                    disabled={usersPage === 1}
                    className="page-button"
                  >
                    ← Назад
                  </button>
                  <span className="page-info">
                    Страница {users.pagination.page} из {users.pagination.pages} 
                    (Всего: {users.pagination.total})
                  </span>
                  <button
                    onClick={() => setUsersPage(prev => Math.min(users.pagination.pages, prev + 1))}
                    disabled={usersPage === users.pagination.pages}
                    className="page-button"
                  >
                    Вперед →
                  </button>
                </div>
              )}
            </>
          ) : null}
        </>
      ) : activeTab === 'activity' ? (
        <>
          <div className="activity-stats">
            <h3>📊 Активность пользователей</h3>
            <div className="filter-group" style={{ marginBottom: '20px' }}>
              <label>Период:</label>
              <select value={activePeriod} onChange={(e) => setActivePeriod(e.target.value)}>
                <option value="day">День</option>
                <option value="week">Неделя</option>
                <option value="month">Месяц</option>
              </select>
            </div>
            
            {activeUsersData && (
              <div className="stats-grid" style={{ marginBottom: '30px' }}>
                <div className="stat-card">
                  <div className="stat-label">Активных пользователей</div>
                  <div className="stat-value">{activeUsersData.totalActiveUsers}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Дней в периоде</div>
                  <div className="stat-value">{activeUsersData.totalDays}</div>
                </div>
              </div>
            )}
            
            {dailyStats && (
              <div className="daily-stats-section">
                <h4>📅 Статистика за сегодня</h4>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Активных пользователей</div>
                    <div className="stat-value">{dailyStats.activeUsers}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Нажали /start</div>
                    <div className="stat-value">{dailyStats.startCommandUsers}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Нажали кнопку</div>
                    <div className="stat-value">{dailyStats.buttonClickUsers}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Всего нажатий кнопок</div>
                    <div className="stat-value">{dailyStats.totalButtonClicks}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Всего команд</div>
                    <div className="stat-value">{dailyStats.totalCommands}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'popular' ? (
        <>
          <div className="popular-stats">
            <h3>🔥 Популярные блоки и кнопки</h3>
            
            {popularBlocks && (
              <div className="popular-section" style={{ marginBottom: '30px' }}>
                <h4>📦 Популярные блоки</h4>
                <div className="table-container">
                  <table className="sources-table">
                    <thead>
                      <tr>
                        <th>Блок</th>
                        <th>Название</th>
                        <th>Входов</th>
                        <th>Уникальных пользователей</th>
                        <th>Последний вход</th>
                      </tr>
                    </thead>
                    <tbody>
                      {popularBlocks.blocks.map((block, index) => (
                        <tr key={index}>
                          <td>{block.blockId}</td>
                          <td>{block.blockName}</td>
                          <td>{block.enterCount}</td>
                          <td>{block.uniqueUsers}</td>
                          <td>{block.lastEnteredAt ? formatDate(block.lastEnteredAt) : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {popularButtons && (
              <div className="popular-section">
                <h4>🔘 Популярные кнопки</h4>
                <div className="table-container">
                  <table className="sources-table">
                    <thead>
                      <tr>
                        <th>Блок</th>
                        <th>Кнопка</th>
                        <th>Нажатий</th>
                        <th>Уникальных пользователей</th>
                        <th>Последнее нажатие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {popularButtons.buttons.map((button, index) => (
                        <tr key={index}>
                          <td>{button.blockId}</td>
                          <td>{button.buttonText}</td>
                          <td>{button.clickCount}</td>
                          <td>{button.uniqueUsers}</td>
                          <td>{button.lastClickedAt ? formatDate(button.lastClickedAt) : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'paths' ? (
        <>
          <div className="paths-stats">
            <h3>🛤️ Маршрут пользователя</h3>
            <p style={{ marginBottom: '20px', color: '#666' }}>
              Выберите пользователя для просмотра его маршрута по боту
            </p>
            
            <div className="user-path-search" style={{ marginBottom: '20px' }}>
              <div className="filter-group" style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label>User ID:</label>
                  <input
                    type="text"
                    placeholder="Введите User ID"
                    value={userPathSearch}
                    onChange={(e) => setUserPathSearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUserPathSearch()}
                    className="search-input"
                  />
                </div>
                <button
                  onClick={handleUserPathSearch}
                  className="export-button"
                  style={{ padding: '8px 20px' }}
                >
                  Поиск
                </button>
              </div>
            </div>

            {isLoadingUsers ? (
              <div className="loading">Загрузка маршрута...</div>
            ) : userPath ? (
              <>
                <div className="user-path-info" style={{ marginBottom: '20px', padding: '15px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <h4>Информация о пользователе</h4>
                  <p><strong>User ID:</strong> {userPath.userId}</p>
                  <p><strong>Username:</strong> @{userPath.username}</p>
                  <p><strong>Имя:</strong> {userPath.firstName} {userPath.lastName}</p>
                  <p><strong>Всего событий:</strong> {userPath.totalEvents}</p>
                  <p><strong>Сессий:</strong> {userPath.sessions.length}</p>
                </div>

                {userPath.sessions.map((session, sessionIndex) => (
                  <div key={sessionIndex} className="session-path" style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px' }}>
                    <h4>Сессия {sessionIndex + 1}</h4>
                    <p style={{ color: '#666', fontSize: '14px' }}>
                      Начало: {formatDate(session.startTime)} | 
                      Конец: {formatDate(session.endTime)} | 
                      Длительность: {Math.round(session.duration / 1000 / 60)} мин.
                    </p>
                    <div className="path-visualization" style={{ marginTop: '15px' }}>
                      {session.events.map((event, eventIndex) => (
                        <div 
                          key={eventIndex} 
                          style={{ 
                            marginBottom: '10px', 
                            padding: '10px', 
                            background: event.action === 'enter' ? '#e8f5e9' : '#fff3e0',
                            borderRadius: '4px',
                            borderLeft: `4px solid ${event.action === 'enter' ? '#4caf50' : '#ff9800'}`
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong>{event.action === 'enter' ? '→ Вход' : '← Выход'}</strong> в блок: <strong>{event.blockName}</strong>
                              {event.previousBlockId && (
                                <span style={{ color: '#666' }}> (из {event.previousBlockId})</span>
                              )}
                            </div>
                            <span style={{ color: '#666', fontSize: '12px' }}>{formatDate(event.timestamp)}</span>
                          </div>
                          {event.buttonText && (
                            <div style={{ marginTop: '5px', fontSize: '14px', color: '#666' }}>
                              Кнопка: {event.buttonText}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : selectedUserId ? (
              <div className="error-message">Маршрут не найден для пользователя {selectedUserId}</div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default SourceStatistics;

