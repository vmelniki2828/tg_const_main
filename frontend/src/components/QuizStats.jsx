import React, { useState, useEffect } from 'react';
import './QuizStats.css';
import config from '../config';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date'); // date, name, score, success
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setError(null); // Сбрасываем ошибку при новой попытке
      console.log('📊 Загружаем статистику квизов...');
      const response = await fetch(`${config.API_BASE_URL}/api/quiz-stats`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('📊 Получены данные статистики:', data);
      console.log('📊 Ключи квизов:', Object.keys(data));
      
      // Подробная информация о каждом квизе
      Object.keys(data).forEach(quizId => {
        const quizStats = data[quizId];
        console.log(`📊 Квиз ${quizId}:`);
        console.log(`   - Попыток: ${quizStats.totalAttempts}`);
        console.log(`   - Успешных: ${quizStats.successfulCompletions}`);
        console.log(`   - Неудачных: ${quizStats.failedAttempts}`);
        console.log(`   - Попыток пользователей: ${quizStats.userAttempts?.length || 0}`);
      });
      
      setStats(data);
      
      // Загружаем статистику промокодов для всех квизов
      const quizBlocks = blocks.filter(block => block.type === 'quiz');
      const promoCodesData = {};
      
      for (const quiz of quizBlocks) {
        try {
          const promoResponse = await fetch(`${config.API_BASE_URL}/api/quiz-promocodes/${quiz.id}`);
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

  const filterAndSortAttempts = (attempts) => {
    if (!attempts) return [];
    
    let filtered = attempts;
    
    // Фильтрация по поиску
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(attempt => 
        (attempt.userName && attempt.userName.toLowerCase().includes(term)) ||
        (attempt.userLastName && attempt.userLastName.toLowerCase().includes(term)) ||
        (attempt.username && attempt.username.toLowerCase().includes(term)) ||
        attempt.userId.toString().includes(term)
      );
    }
    
    // Сортировка
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => (a.userName || '').localeCompare(b.userName || ''));
        break;
      case 'score':
        filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case 'success':
        filtered.sort((a, b) => b.success - a.success);
        break;
      case 'date':
      default:
        filtered.sort((a, b) => b.timestamp - a.timestamp);
        break;
    }
    
    return filtered;
  };

  const showUserDetails = (attempt) => {
    setSelectedUser(attempt);
  };

  const closeUserDetails = () => {
    setSelectedUser(null);
  };

  const exportStatsToFile = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/export-quiz-stats`, {
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
    <>
      <div className="quiz-stats-overlay">
      <div className="quiz-stats-modal">
        <div className="quiz-stats-header">
          <h2>📊 Статистика квизов</h2>
          <div className="header-controls">
            <button className="export-btn" onClick={exportStatsToFile} title="Сохранить статистику в CSV файл">
              📊 Экспорт в CSV
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
                            <div className="attempts-controls">
                              <div className="search-box">
                                <input
                                  type="text"
                                  placeholder="Поиск по имени, username или ID..."
                                  value={searchTerm}
                                  onChange={(e) => setSearchTerm(e.target.value)}
                                  className="search-input"
                                />
                                <span className="search-icon">🔍</span>
                              </div>
                              <div className="sort-controls">
                                <label>Сортировка:</label>
                                <select 
                                  value={sortBy} 
                                  onChange={(e) => setSortBy(e.target.value)}
                                  className="sort-select"
                                >
                                  <option value="date">По дате (новые)</option>
                                  <option value="name">По имени</option>
                                  <option value="score">По баллам</option>
                                  <option value="success">По успешности</option>
                                </select>
                              </div>
                            </div>
                            {(() => {
                              console.log('📊 Отображаем попытки для квиза:', selectedQuiz.id);
                              console.log('📊 Статистика квиза:', quizStats);
                              console.log('📊 Попытки пользователей:', quizStats.userAttempts);
                              
                              if (!quizStats.userAttempts || quizStats.userAttempts.length === 0) {
                                console.log('📊 Нет попыток для отображения');
                                return <p className="no-attempts">Пока нет попыток прохождения</p>;
                              } else {
                                const filteredAttempts = filterAndSortAttempts(quizStats.userAttempts);
                                console.log(`📊 Отображаем ${filteredAttempts.length} попыток (из ${quizStats.userAttempts.length})`);
                                
                                if (filteredAttempts.length === 0) {
                                  return <p className="no-attempts">По вашему запросу ничего не найдено</p>;
                                }
                                
                                return (
                                  <div className="attempts-list">
                                    <div className="attempts-summary">
                                      <div className="summary-item">
                                        <span className="summary-label">Всего попыток:</span>
                                        <span className="summary-value">{quizStats.userAttempts.length}</span>
                                      </div>
                                      <div className="summary-item">
                                        <span className="summary-label">Уникальных пользователей:</span>
                                        <span className="summary-value">
                                          {new Set(quizStats.userAttempts.map(a => a.userId)).size}
                                        </span>
                                      </div>
                                      <div className="summary-item">
                                        <span className="summary-label">Средний балл:</span>
                                        <span className="summary-value">
                                          {(quizStats.userAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / quizStats.userAttempts.length).toFixed(1)}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    <div className="attempts-table">
                                      <div className="table-header">
                                        <div className="header-cell">👤 Пользователь</div>
                                        <div className="header-cell">📊 Результат</div>
                                        <div className="header-cell">📅 Дата</div>
                                        <div className="header-cell">⏱️ Время</div>
                                        <div className="header-cell">🎁 Промокод</div>
                                      </div>
                                      
                                                                             {filteredAttempts.map((attempt, index) => (
                                         <div 
                                           key={index} 
                                           className={`table-row ${attempt.success ? 'success' : 'failed'}`}
                                           onClick={() => showUserDetails(attempt)}
                                           style={{ cursor: 'pointer' }}
                                         >
                                            <div className="table-cell user-info">
                                              <div className="user-name">
                                                {attempt.userName || `Пользователь ${attempt.userId}`}
                                              </div>
                                              {attempt.userLastName && (
                                                <div className="user-lastname">{attempt.userLastName}</div>
                                              )}
                                              {attempt.username && (
                                                <div className="user-username">@{attempt.username}</div>
                                              )}
                                              <div className="user-id">ID: {attempt.userId}</div>
                                            </div>
                                            
                                            <div className="table-cell result-info">
                                              <div className={`result-status ${attempt.success ? 'success' : 'failed'}`}>
                                                {attempt.success ? '✅ Успешно' : '❌ Неудачно'}
                                              </div>
                                              {attempt.score !== undefined && (
                                                <div className="result-score">
                                                  {attempt.score}/{selectedQuiz.questions?.length || 0} баллов
                                                </div>
                                              )}
                                              {attempt.successRate && (
                                                <div className="result-rate">
                                                  {attempt.successRate.toFixed(1)}% успешность
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className="table-cell date-info">
                                              <div className="attempt-date">
                                                {formatDate(attempt.timestamp)}
                                              </div>
                                            </div>
                                            
                                            <div className="table-cell duration-info">
                                              {attempt.duration ? (
                                                <div className="attempt-duration">
                                                  {Math.round(attempt.duration / 1000)}с
                                                </div>
                                              ) : (
                                                <div className="no-duration">-</div>
                                              )}
                                            </div>
                                            
                                            <div className="table-cell promocode-info">
                                              {attempt.promoCode ? (
                                                <div className="promocode-received">
                                                  🎁 {attempt.promoCode}
                                                </div>
                                              ) : (
                                                <div className="no-promocode">-</div>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                );
                              }
                            })()}
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
      
      {/* Модальное окно с детальной информацией о пользователе */}
      {selectedUser && (
        <div className="user-details-modal">
          <div className="user-details-content">
            <div className="user-details-header">
              <h3>Детальная информация о пользователе</h3>
              <button className="close-btn" onClick={closeUserDetails}>✕</button>
            </div>
            
            <div className="user-details-body">
              <div className="user-info-section">
                <h4>👤 Информация о пользователе</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">ID:</span>
                    <span className="info-value">{selectedUser.userId}</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">Имя:</span>
                    <span className="info-value">{selectedUser.userName || 'Не указано'}</span>
                  </div>
                  {selectedUser.userLastName && (
                    <div className="info-item">
                      <span className="info-label">Фамилия:</span>
                      <span className="info-value">{selectedUser.userLastName}</span>
                    </div>
                  )}
                  {selectedUser.username && (
                    <div className="info-item">
                      <span className="info-label">Username:</span>
                      <span className="info-value">@{selectedUser.username}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="quiz-result-section">
                <h4>📊 Результат квиза</h4>
                <div className="result-grid">
                  <div className="result-item">
                    <span className="result-label">Статус:</span>
                    <span className={`result-value ${selectedUser.success ? 'success' : 'failed'}`}>
                      {selectedUser.success ? '✅ Успешно' : '❌ Неудачно'}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Баллы:</span>
                    <span className="result-value">
                      {selectedUser.score}/{selectedQuiz.questions?.length || 0}
                    </span>
                  </div>
                  {selectedUser.successRate && (
                    <div className="result-item">
                      <span className="result-label">Успешность:</span>
                      <span className="result-value">{selectedUser.successRate.toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="result-item">
                    <span className="result-label">Время прохождения:</span>
                    <span className="result-value">
                      {selectedUser.duration ? `${Math.round(selectedUser.duration / 1000)} секунд` : 'Не указано'}
                    </span>
                  </div>
                  <div className="result-item">
                    <span className="result-label">Дата попытки:</span>
                    <span className="result-value">{formatDate(selectedUser.timestamp)}</span>
                  </div>
                  {selectedUser.promoCode && (
                    <div className="result-item">
                      <span className="result-label">Полученный промокод:</span>
                      <span className="result-value promocode">🎁 {selectedUser.promoCode}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {selectedUser.answers && selectedUser.answers.length > 0 && (
                <div className="answers-section">
                  <h4>📝 Ответы пользователя</h4>
                  <div className="answers-list">
                    {selectedUser.answers.map((answer, index) => (
                      <div key={index} className={`answer-item ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                        <div className="answer-header">
                          <span className="question-number">Вопрос {index + 1}</span>
                          <span className={`answer-status ${answer.isCorrect ? 'correct' : 'incorrect'}`}>
                            {answer.isCorrect ? '✅ Правильно' : '❌ Неправильно'}
                          </span>
                        </div>
                        <div className="answer-text">
                          <strong>Ответ:</strong> {answer.selectedAnswer}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
};

export default QuizStats; 