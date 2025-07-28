import React, { useState, useEffect } from 'react';
import './QuizStats.css';

const QuizStats = ({ blocks, onClose }) => {
  const [stats, setStats] = useState({});
  const [promoCodesStats, setPromoCodesStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    promoCodesList: false, // false = развернуто, true = свернуто
    userAttempts: false
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setError(null); // Сбрасываем ошибку при новой попытке
      const response = await fetch('http://localhost:3001/api/quiz-stats');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setStats(data);
      
      // Загружаем статистику промокодов для всех квизов
      const quizBlocks = blocks.filter(block => block.type === 'quiz');
      const promoCodesData = {};
      
      for (const quiz of quizBlocks) {
        try {
          const promoResponse = await fetch(`http://localhost:3001/api/quiz-promocodes/${quiz.id}`);
          if (promoResponse.ok) {
            const promoData = await promoResponse.json();
            promoCodesData[quiz.id] = promoData;
          }
        } catch (error) {
          console.error(`Ошибка загрузки промокодов для квиза ${quiz.id}:`, error);
          promoCodesData[quiz.id] = {
            hasPromoCodes: false,
            totalPromoCodes: 0,
            availablePromoCodes: 0,
            usedPromoCodes: 0,
            promoCodesList: []
          };
        }
      }
      
      setPromoCodesStats(promoCodesData);
    } catch (error) {
      console.error('Ошибка при загрузке статистики:', error);
      setError(error.message);
      setStats({}); // Устанавливаем пустой объект при ошибке
    } finally {
      setLoading(false);
    }
  };

  const getQuizBlocks = () => {
    return blocks.filter(block => block.type === 'quiz');
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString('ru-RU');
  };

  const getQuizStats = (quizId) => {
    return stats[quizId] || {
      totalAttempts: 0,
      successfulCompletions: 0,
      failedAttempts: 0,
      averageScore: 0,
      userAttempts: []
    };
  };

  const calculateSuccessRate = (quizStats) => {
    if (quizStats.totalAttempts === 0) return 0;
    return ((quizStats.successfulCompletions / quizStats.totalAttempts) * 100).toFixed(1);
  };

  const toggleSection = (sectionName) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const exportStatsToFile = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/export-quiz-stats', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stats,
          promoCodesStats,
          blocks: getQuizBlocks()
        })
      });

      if (!response.ok) {
        throw new Error('Ошибка при экспорте статистики');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-stats-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Ошибка при экспорте:', error);
      alert('Ошибка при сохранении файла: ' + error.message);
    }
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

  const quizBlocks = getQuizBlocks();

  return (
    <div className="quiz-stats-overlay">
      <div className="quiz-stats-modal">
        <div className="quiz-stats-header">
          <h2>📊 Статистика квизов</h2>
          <div className="header-controls">
            <button className="export-btn" onClick={exportStatsToFile} title="Сохранить статистику в файл">
              💾 Экспорт
            </button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {error ? (
          <div className="error-message">
            <p>❌ Ошибка загрузки статистики: {error}</p>
            <p>Убедитесь, что сервер запущен на порту 3001</p>
            <button onClick={fetchStats} className="retry-btn">
              🔄 Попробовать снова
            </button>
          </div>
        ) : quizBlocks.length === 0 ? (
          <div className="no-quizzes">
            <p>Квизы не найдены. Создайте квиз для просмотра статистики.</p>
          </div>
        ) : (
          <div className="quiz-stats-content">
            {!selectedQuiz ? (
              // Список всех квизов
              <div className="quizzes-list">
                <h3>Выберите квиз для просмотра статистики:</h3>
                {quizBlocks.map(quiz => {
                  const quizStats = getQuizStats(quiz.id);
                  const successRate = calculateSuccessRate(quizStats);
                  
                  return (
                    <div 
                      key={quiz.id} 
                      className="quiz-item"
                      onClick={() => setSelectedQuiz(quiz)}
                    >
                      <div className="quiz-info">
                        <h4>{quiz.message || `Квиз ${quiz.id}`}</h4>
                        <p>Вопросов: {quiz.questions?.length || 0}</p>
                      </div>
                      <div className="quiz-stats-summary">
                        <div className="stat-item">
                          <span className="stat-label">Попыток:</span>
                          <span className="stat-value">{quizStats.totalAttempts}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Успешно:</span>
                          <span className="stat-value success">{quizStats.successfulCompletions}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Успешность:</span>
                          <span className="stat-value">{successRate}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Детальная статистика выбранного квиза
              <div className="quiz-detail-stats">
                <div className="quiz-detail-header">
                  <button className="back-btn" onClick={() => setSelectedQuiz(null)}>
                    ← Назад к списку
                  </button>
                  <h3>{selectedQuiz.message || `Квиз ${selectedQuiz.id}`}</h3>
                </div>

                {(() => {
                  const quizStats = getQuizStats(selectedQuiz.id);
                  const successRate = calculateSuccessRate(quizStats);

                  return (
                    <div className="quiz-detail-content">
                      <div className="stats-overview">
                        <div className="stat-card">
                          <div className="stat-number">{quizStats.totalAttempts}</div>
                          <div className="stat-label">Всего попыток</div>
                        </div>
                        <div className="stat-card success">
                          <div className="stat-number">{quizStats.successfulCompletions}</div>
                          <div className="stat-label">Успешных</div>
                        </div>
                        <div className="stat-card failed">
                          <div className="stat-number">{quizStats.failedAttempts}</div>
                          <div className="stat-label">Неудачных</div>
                        </div>
                        <div className="stat-card">
                          <div className="stat-number">{successRate}%</div>
                          <div className="stat-label">Успешность</div>
                        </div>
                      </div>

                      {/* Статистика промокодов */}
                      {(() => {
                        const promoStats = promoCodesStats[selectedQuiz.id];
                        return (
                          <div className="promo-codes-stats">
                            <h4>🎁 Статистика промокодов:</h4>
                            {promoStats && promoStats.hasPromoCodes ? (
                              <div className="promo-stats-overview">
                                <div className="promo-stat-card">
                                  <div className="stat-number">{promoStats.totalPromoCodes}</div>
                                  <div className="stat-label">Всего промокодов</div>
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
                            ) : (
                              <p className="no-promocodes">Промокоды не загружены для этого квиза</p>
                            )}
                          </div>
                        );
                      })()}

                      {/* Список всех промокодов */}
                      {(() => {
                        const promoStats = promoCodesStats[selectedQuiz.id];
                        return (
                          <div className="promo-codes-list">
                            <div className="section-header" onClick={() => toggleSection('promoCodesList')}>
                              <h4>📋 Список промокодов:</h4>
                              <button className="collapse-btn">
                                {collapsedSections.promoCodesList ? '▼' : '▲'}
                              </button>
                            </div>
                            {!collapsedSections.promoCodesList && (
                              <>
                                {promoStats && promoStats.hasPromoCodes && promoStats.promoCodesList.length > 0 ? (
                                  <div className="promocodes-grid">
                                    {promoStats.promoCodesList.map((promoCode, index) => (
                                      <div key={index} className={`promocode-item ${promoCode.activated ? 'used' : 'available'}`}>
                                        <div className="promocode-code">
                                          <strong>{promoCode.code}</strong>
                                        </div>
                                        <div className="promocode-status">
                                          {promoCode.activated ? (
                                            <span className="status-used">
                                              ✅ Выдан пользователю: {promoCode.activatedBy || 'Неизвестно'}
                                            </span>
                                          ) : (
                                            <span className="status-available">
                                              ⏳ Доступен
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="no-promocodes">Нет промокодов для отображения</p>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })()}

                      <div className="user-attempts">
                        <div className="section-header" onClick={() => toggleSection('userAttempts')}>
                          <h4>Попытки пользователей:</h4>
                          <button className="collapse-btn">
                            {collapsedSections.userAttempts ? '▼' : '▲'}
                          </button>
                        </div>
                        {!collapsedSections.userAttempts && (
                          <>
                            {quizStats.userAttempts.length === 0 ? (
                              <p className="no-attempts">Пока нет попыток прохождения</p>
                            ) : (
                              <div className="attempts-list">
                                {quizStats.userAttempts.map((attempt, index) => (
                                  <div key={index} className={`attempt-item ${attempt.success ? 'success' : 'failed'}`}>
                                    <div className="attempt-header">
                                      <span className="user-name">
                                        {attempt.userName || `Пользователь ${attempt.userId}`}
                                      </span>
                                      <span className={`attempt-status ${attempt.success ? 'success' : 'failed'}`}>
                                        {attempt.success ? '✅ Успешно' : '❌ Неудачно'}
                                      </span>
                                    </div>
                                    <div className="attempt-details">
                                      <span className="attempt-date">
                                        {formatDate(attempt.timestamp)}
                                      </span>
                                      {attempt.score !== undefined && (
                                        <span className="attempt-score">
                                          Баллов: {attempt.score}/{selectedQuiz.questions?.length || 0}
                                        </span>
                                      )}
                                      {attempt.duration && (
                                        <span className="attempt-duration">
                                          Время: {Math.round(attempt.duration / 1000)}с
                                        </span>
                                      )}
                                      {attempt.promoCode && (
                                        <span className="attempt-promocode">
                                          🎁 Промокод: {attempt.promoCode}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </>
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

export default QuizStats; 