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
  const [activeTab, setActiveTab] = useState('sources'); // 'sources' или 'users'
  const [usersPage, setUsersPage] = useState(1);
  const [usersSource, setUsersSource] = useState('all');
  const [usersSearch, setUsersSearch] = useState('');

  useEffect(() => {
    if (botId) {
      if (activeTab === 'sources') {
        loadStatistics();
      } else {
        loadUsers();
      }
    }
  }, [botId, startDate, endDate, activeTab, usersPage, usersSource, usersSearch]);

  const loadStatistics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let url = `${config.API_BASE_URL}/api/statistics/sources/${botId}`;
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
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
                <div className="stat-label">Активное время</div>
                <div className="stat-value">{statistics.general.totalActiveTime.toFixed(2)} ч.</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Среднее время на пользователя</div>
                <div className="stat-value">{formatTime(statistics.general.avgActiveTime)}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Конверсия в подписку</div>
                <div className="stat-value">{statistics.general.subscriptionRate.toFixed(2)}%</div>
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
                    <th>Активное время</th>
                    <th>Среднее время</th>
                    <th>Конверсия</th>
                    <th>Промокоды</th>
                    <th>Квизы</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.bySource.map((source, index) => (
                    <tr key={index}>
                      <td className="source-name">{source.source}</td>
                      <td>{source.users}</td>
                      <td>{source.activeTimeHours.toFixed(2)} ч.</td>
                      <td>{formatTime(source.avgActiveTime)}</td>
                      <td>{source.conversionRate.toFixed(2)}%</td>
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
      ) : (
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
                        <td>{user.activeTimeHours.toFixed(2)} ч.</td>
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
      )}
    </div>
  );
}

export default SourceStatistics;

