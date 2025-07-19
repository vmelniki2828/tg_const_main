import React, { useState, useRef } from 'react';
import FlowEditor from './FlowEditor';
import BotsList from './BotsList';

function App() {
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const flowEditorRef = useRef();

  // Обработчик выбора бота для редактирования
  const handleSelectBot = (botId) => {
    setSelectedBotId(botId);
  };

  // Обработчик сохранения состояния бота
  const handleSaveBot = async () => {
    if (!selectedBotId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Сохраняем текущее состояние
      const editorState = flowEditorRef.current?.getState();
      console.log('Saving editor state:', editorState);
      
      const response = await fetch(`http://localhost:3001/api/bots/${selectedBotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editorState,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Не удалось сохранить состояние бота: ${errorData.error || response.statusText}`);
      }

      const result = await response.json();
      console.log('Save response:', result);
      alert('Изменения сохранены!');
    } catch (err) {
      console.error('Error saving bot:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Обработчик подключения бота
  const handleConnectBot = async () => {
    if (!selectedBotId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Сначала сохраняем текущее состояние
      const editorState = flowEditorRef.current?.getState();
      console.log('Saving editor state before activation:', editorState);
      
      const saveResponse = await fetch(`http://localhost:3001/api/bots/${selectedBotId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          editorState,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(`Не удалось сохранить состояние бота: ${errorData.error || saveResponse.statusText}`);
      }

      const saveResult = await saveResponse.json();
      console.log('Save response:', saveResult);

      // Затем активируем бота
      console.log('Activating bot...');
      const activateResponse = await fetch(`http://localhost:3001/api/bots/${selectedBotId}/activate`, {
        method: 'POST',
      });

      if (!activateResponse.ok) {
        const errorData = await activateResponse.json();
        throw new Error(`Не удалось подключить бота: ${errorData.error || activateResponse.statusText}`);
      }

      const activateResult = await activateResponse.json();
      console.log('Activate response:', activateResult);
      alert('Бот успешно сохранен и подключен!');
    } catch (err) {
      console.error('Error connecting bot:', err);
      setError(err.message);
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
          <button 
            onClick={handleSaveBot}
            disabled={isLoading}
            className="editor-button"
          >
            {isLoading ? '⏳ Сохранение...' : '💾 Сохранить'}
          </button>
          <button 
            onClick={handleConnectBot}
            disabled={isLoading}
            className="editor-button"
          >
            {isLoading ? '⏳ Подключение...' : '🚀 Сохранить и подключить'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        <FlowEditor ref={flowEditorRef} botId={selectedBotId} />
      </div>
    );
  }

  // Иначе показываем список ботов
  return <BotsList onSelectBot={handleSelectBot} />;
}

export default App;
