import React, { useState, useEffect } from 'react';
import config from '../config';
import './SourceStatistics.css';

function SourceStatistics({ botId }) {
  const [statistics, setStatistics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (botId) {
      loadStatistics();
    }
  }, [botId, startDate, endDate]);

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

  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} мин.`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} ч. ${mins} мин.`;
  };

  if (!botId) {
    return <div className="source-statistics">Выберите бота для просмотра статистики</div>;
  }

  return (
    <div className="source-statistics">
      <div className="source-statistics-header">
        <h2>📊 Статистика по источникам</h2>
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
    </div>
  );
}

export default SourceStatistics;

