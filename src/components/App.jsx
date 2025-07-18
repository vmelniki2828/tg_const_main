import React, { useState, useRef } from 'react';
import FlowEditor from './FlowEditor';

function App() {
  const [botToken, setBotToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const flowEditorRef = useRef();

  const handleTokenSubmit = async () => {
    if (!botToken.trim()) {
      setError('Пожалуйста, введите токен бота');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Получаем текущую схему из FlowEditor
      const { blocks, connections } = flowEditorRef.current.getFlowData();

      // Проверяем наличие блоков
      if (!blocks || blocks.length === 0) {
        throw new Error('Добавьте хотя бы один блок в схему диалога');
      }

      // Проверяем наличие сообщений в блоках
      const emptyBlocks = blocks.filter(b => !b.message || b.message.trim() === '');
      if (emptyBlocks.length > 0) {
        throw new Error(`Следующие блоки не содержат сообщений: ${emptyBlocks.map(b => b.id).join(', ')}`);
      }

      // Сначала сохраняем схему
      const saveResponse = await fetch('http://localhost:3001/api/update-dialog-chains', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blocks,
          connections,
          startBlockId: 'start'
        }),
      });

      const saveData = await saveResponse.json();
      if (!saveResponse.ok) {
        throw new Error(saveData.error || 'Не удалось сохранить схему диалога');
      }

      // Затем настраиваем бота
      const botResponse = await fetch('http://localhost:3001/api/setup-bot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          botToken,
          welcomeMessage: 'Добро пожаловать!' 
        }),
      });
      
      const botData = await botResponse.json();
      if (!botResponse.ok) {
        throw new Error(botData.error || 'Не удалось настроить бота');
      }
      
      alert('Бот успешно настроен и схема сохранена!');
    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Произошла неизвестная ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="top-bar">
        <div className="token-input">
          <input
            type="text"
            value={botToken}
            onChange={(e) => {
              setBotToken(e.target.value);
              setError(null);
            }}
            placeholder="Введите токен бота"
            disabled={isLoading}
          />
          <button 
            onClick={handleTokenSubmit}
            disabled={isLoading}
          >
            {isLoading ? 'Применение...' : 'Применить'}
          </button>
        </div>
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}
      </div>
      <FlowEditor ref={flowEditorRef} />
    </div>
  );
}

export default App;
