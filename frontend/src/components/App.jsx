import { apiFetch } from '../api';
import React, { useState, useRef, useEffect } from 'react';
import FlowEditor from './FlowEditor';
import BotsList from './BotsList';
import QuizStats from './QuizStats';
import TriviaStats from './TriviaStats';
import LoyaltyProgram from './LoyaltyProgram';
import SourceStatistics from './SourceStatistics';
import Giveaways from './Giveaways';
import config from '../config';

function App() {
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [botStatus, setBotStatus] = useState(null);
  const [showStats, setShowStats] = useState(false);
  const [showTriviaStats, setShowTriviaStats] = useState(false);
  const [showLoyalty, setShowLoyalty] = useState(false);
  const [showSourceStats, setShowSourceStats] = useState(false);
  const [showGiveaways, setShowGiveaways] = useState(false);
  const [quizDropdownOpen, setQuizDropdownOpen] = useState(false);
  const [statsDropdownOpen, setStatsDropdownOpen] = useState(false);
  const flowEditorRef = useRef();

  // Функция для получения статуса бота
  const fetchBotStatus = async () => {
    if (!selectedBotId) return;

    try {
      const response = await apiFetch(`${config.API_BASE_URL}/api/bots/${selectedBotId}/status`);
      if (!response.ok) {
        throw new Error('Failed to fetch bot status');
      }
      const data = await response.json();
      setBotStatus(data.isRunning);
    } catch (err) {
      console.error('Error fetching bot status:', err);
    }
  };

  // Получаем статус бота при выборе
  useEffect(() => {
    if (!selectedBotId) return;
    fetchBotStatus();
  }, [selectedBotId]);

  // Обработчик выбора бота для редактирования
  const handleSelectBot = (botId) => {
    setSelectedBotId(botId);
  };

  // Обработчик подключения бота
  const handleConnectBot = async () => {
    if (!selectedBotId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Сохраняем текущее состояние
      const flowData = flowEditorRef.current?.getFlowData();
      const editorState = {
        blocks: flowData.blocks,
        connections: flowData.connections,
        pan: flowData.pan,
        scale: flowData.scale
      };
      console.log('Saving editor state before activation:', editorState);
      
      const saveResponse = await apiFetch(`${config.API_BASE_URL}/api/bots/${selectedBotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editorState,
          // Можно добавить name и token, если нужно
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(`Не удалось сохранить состояние бота: ${errorData.error || saveResponse.statusText}`);
      }

      // Затем активируем бота
      console.log('Activating bot...');
      const activateResponse = await apiFetch(`${config.API_BASE_URL}/api/bots/${selectedBotId}/activate`, {
        method: 'POST',
      });

      if (!activateResponse.ok) {
        const errorData = await activateResponse.json();
        throw new Error(`Не удалось подключить бота: ${errorData.error || activateResponse.statusText}`);
      }

      // Немедленно обновляем статус на "Запущен"
      setBotStatus(true);
      alert('Бот успешно запущен!');
    } catch (err) {
      console.error('Error connecting bot:', err);
      setError(err.message);
      // В случае ошибки обновляем статус с сервера
      fetchBotStatus();
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик остановки бота
  const handleStopBot = async () => {
    if (!selectedBotId) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await apiFetch(`${config.API_BASE_URL}/api/bots/${selectedBotId}/deactivate`, {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Не удалось остановить бота: ${errorData.error || response.statusText}`);
      }

      // Немедленно обновляем статус на "Остановлен"
      setBotStatus(false);
      alert('Бот успешно остановлен!');
    } catch (err) {
      console.error('Error stopping bot:', err);
      setError(err.message);
      // В случае ошибки обновляем статус с сервера
      fetchBotStatus();
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик возврата к списку
  const handleBackToList = () => {
    if (isLoading) return;
    setSelectedBotId(null);
  };

  // Если выбран бот, показываем редактор
  if (selectedBotId) {
    return (
      <div className="app-container">
        <div className="editor-controls">
          <button onClick={handleBackToList} className="editor-button">
            ← Вернуться к списку
          </button>
          <button 
            onClick={() => flowEditorRef.current?.createBlock()}
            className="editor-button"
          >
            ➕ Создать блок
          </button>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setQuizDropdownOpen(!quizDropdownOpen)}
              onBlur={() => setTimeout(() => setQuizDropdownOpen(false), 150)}
              className="editor-button quiz-button"
            >
              🎯 Создать квиз ▾
            </button>
            {quizDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  minWidth: '180px'
                }}
              >
                <button
                  type="button"
                  className="editor-button quiz-button"
                  style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
                  onClick={() => { flowEditorRef.current?.createQuizBlock(); setQuizDropdownOpen(false); }}
                >
                  🎯 Создать квиз
                </button>
                <button
                  type="button"
                  className="editor-button"
                  style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
                  onClick={() => { flowEditorRef.current?.createTriviaBlock(); setQuizDropdownOpen(false); }}
                >
                  🎲 Создать Викторину
                </button>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setStatsDropdownOpen(!statsDropdownOpen)}
              onBlur={() => setTimeout(() => setStatsDropdownOpen(false), 150)}
              className="editor-button stats-button"
            >
              📊 Статистика квизов ▾
            </button>
            {statsDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: '#fff',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 100,
                  minWidth: '200px'
                }}
              >
                <button
                  type="button"
                  className="editor-button stats-button"
                  style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
                  onClick={() => { setShowStats(true); setStatsDropdownOpen(false); }}
                >
                  📊 Статистика квизов
                </button>
                <button
                  type="button"
                  className="editor-button"
                  style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
                  onClick={() => { setShowTriviaStats(true); setStatsDropdownOpen(false); }}
                >
                  🎲 Статистика викторин
                </button>
              </div>
            )}
          </div>
          <button 
            onClick={() => setShowLoyalty(true)}
            className="editor-button loyalty-button"
          >
            🎁 Программа лояльности
          </button>
          <button 
            onClick={() => setShowSourceStats(true)}
            className="editor-button source-stats-button"
          >
            📈 Статистика по источникам
          </button>
          <button 
            onClick={() => setShowGiveaways(true)}
            className="editor-button giveaways-button"
          >
            🎲 Розыгрыши
          </button>
          <div className="bot-status">
            Статус бота: {botStatus ? '🟢 Запущен' : '🔴 Остановлен'}
          </div>
          {!botStatus ? (
            <button 
              onClick={handleConnectBot}
              disabled={isLoading}
              className="editor-button start-button"
            >
              {isLoading ? '⏳ Подключение...' : '🚀 Запустить'}
            </button>
          ) : (
            <button 
              onClick={handleStopBot}
              disabled={isLoading}
              className="editor-button stop-button"
            >
              {isLoading ? '⏳ Остановка...' : '🛑 Остановить'}
            </button>
          )}
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <FlowEditor ref={flowEditorRef} botId={selectedBotId} />
        
        {showStats && (
          <QuizStats 
            blocks={flowEditorRef.current?.getState()?.blocks || []}
            botId={selectedBotId}
            onClose={() => setShowStats(false)}
          />
        )}
        
        {showTriviaStats && (
          <TriviaStats
            blocks={flowEditorRef.current?.getState()?.blocks || []}
            botId={selectedBotId}
            onClose={() => setShowTriviaStats(false)}
          />
        )}
        
        {showLoyalty && (
          <LoyaltyProgram 
            botId={selectedBotId}
            onClose={() => setShowLoyalty(false)}
          />
        )}
        
        {showSourceStats && (
          <div className="modal-overlay" onClick={() => setShowSourceStats(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Статистика по источникам</h2>
                <button className="close-button" onClick={() => setShowSourceStats(false)}>×</button>
              </div>
              <SourceStatistics botId={selectedBotId} />
            </div>
          </div>
        )}
        
        {showGiveaways && (
          <Giveaways 
            botId={selectedBotId}
            onClose={() => setShowGiveaways(false)}
          />
        )}
      </div>
    );
  }

  // Иначе показываем список ботов
  return <BotsList onSelectBot={handleSelectBot} />;
}

export default App;
