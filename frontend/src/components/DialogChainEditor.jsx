import React, { useState } from 'react';
import config from '../config';

const DialogChainEditor = () => {
  const [chains, setChains] = useState([
    {
      id: 1,
      message: '',
      buttons: [{ text: '', nextChainId: null }],
    },
  ]);

  const addChain = () => {
    const newId = Math.max(...chains.map(chain => chain.id)) + 1;
    setChains([
      ...chains,
      {
        id: newId,
        message: '',
        buttons: [{ text: '', nextChainId: null }],
      },
    ]);
  };

  const addButton = (chainId) => {
    setChains(chains.map(chain => {
      if (chain.id === chainId) {
        return {
          ...chain,
          buttons: [...chain.buttons, { text: '', nextChainId: null }],
        };
      }
      return chain;
    }));
  };

  const updateChainMessage = (chainId, message) => {
    setChains(chains.map(chain => {
      if (chain.id === chainId) {
        return { ...chain, message };
      }
      return chain;
    }));
  };

  const updateButton = (chainId, buttonIndex, field, value) => {
    setChains(chains.map(chain => {
      if (chain.id === chainId) {
        const newButtons = [...chain.buttons];
        newButtons[buttonIndex] = {
          ...newButtons[buttonIndex],
          [field]: field === 'nextChainId' ? Number(value) || null : value,
        };
        return { ...chain, buttons: newButtons };
      }
      return chain;
    }));
  };

  const removeChain = (chainId) => {
    setChains(chains.filter(chain => chain.id !== chainId));
  };

  const removeButton = (chainId, buttonIndex) => {
    setChains(chains.map(chain => {
      if (chain.id === chainId) {
        const newButtons = chain.buttons.filter((_, index) => index !== buttonIndex);
        return { ...chain, buttons: newButtons };
      }
      return chain;
    }));
  };

  const updateChainCommand = (chainId, command) => {
    setChains(chains.map(chain => chain.id === chainId ? { ...chain, command } : chain));
  };
  const updateChainDescription = (chainId, description) => {
    setChains(chains.map(chain => chain.id === chainId ? { ...chain, description } : chain));
  };

  const handleSave = async () => {
    try {
      const response = await fetch(`${config.API_BASE_URL}/api/update-dialog-chains`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chains }),
      });

      if (!response.ok) {
        throw new Error('Failed to save dialog chains');
      }

      alert('Цепочки диалогов успешно сохранены!');
    } catch (error) {
      console.error('Error:', error);
      alert('Произошла ошибка при сохранении цепочек диалогов');
    }
  };

  return (
    <div className="dialog-chain-editor">
      <h3>
        <span className="editor-icon">🤖</span>
        Конструктор диалогов
      </h3>
      
      <div className="chains-container">
        {chains.map((chain, chainIndex) => (
          <div key={chain.id} className={`chain-container ${chainIndex < chains.length - 1 ? 'chain-connection' : ''}`}>
            <div className="chain-header">
              <h4>Диалог {chain.id}</h4>
              <button
                onClick={() => removeChain(chain.id)}
                className="remove-button"
              >
                🗑️ Удалить
              </button>
            </div>
            
            <div className="message-input">
              <label>
                <span className="input-icon">💭</span>
                Сообщение бота:
              </label>
              <textarea
                value={chain.message}
                onChange={(e) => updateChainMessage(chain.id, e.target.value)}
                placeholder="Введите сообщение, которое бот отправит пользователю..."
              />
            </div>

            {/* Стилизованный блок для команды и описания (без иконки) */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              background: '#f6f8fa',
              border: '1px solid #d1d5da',
              borderRadius: '8px',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <label style={{ fontWeight: 500, marginBottom: '0.25rem' }}>
                  Слеш-команда
                  <input
                    type="text"
                    value={chain.command || ''}
                    onChange={e => updateChainCommand(chain.id, e.target.value)}
                    placeholder="Например: start"
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      border: '1px solid #bdbdbd',
                      borderRadius: '5px',
                      marginTop: '0.2rem',
                      fontSize: '1rem',
                      background: '#fff'
                    }}
                    maxLength={32}
                  />
                  <span style={{ color: '#888', fontSize: '0.9em' }}>
                    Команда появится в меню Telegram (без /)
                  </span>
                </label>
                <label style={{ fontWeight: 500, marginTop: '0.5rem' }}>
                  Описание команды
                  <input
                    type="text"
                    value={chain.description || ''}
                    onChange={e => updateChainDescription(chain.id, e.target.value)}
                    placeholder="Кратко опишите, что делает команда"
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      border: '1px solid #bdbdbd',
                      borderRadius: '5px',
                      marginTop: '0.2rem',
                      fontSize: '1rem',
                      background: '#fff'
                    }}
                    maxLength={50}
                  />
                  <span style={{ color: '#888', fontSize: '0.9em' }}>
                    Это описание увидит пользователь в меню Telegram
                  </span>
                </label>
              </div>
            </div>

            <div className="buttons-container">
              <h5>
                <span className="input-icon">🎯</span>
                Кнопки для ответа:
              </h5>
              {chain.buttons.map((button, buttonIndex) => (
                <div key={buttonIndex} className="button-editor">
                  <input
                    type="text"
                    value={button.text}
                    onChange={(e) => updateButton(chain.id, buttonIndex, 'text', e.target.value)}
                    placeholder="Текст кнопки"
                  />
                  <select
                    value={button.nextChainId || ''}
                    onChange={(e) => updateButton(chain.id, buttonIndex, 'nextChainId', e.target.value)}
                  >
                    <option value="">Выберите следующий диалог</option>
                    {chains.map(c => (
                      c.id !== chain.id && (
                        <option key={c.id} value={c.id}>
                          Диалог {c.id}
                        </option>
                      )
                    ))}
                  </select>
                  <button
                    onClick={() => removeButton(chain.id, buttonIndex)}
                    className="remove-button"
                  >
                    ❌
                  </button>
                </div>
              ))}
              <button
                onClick={() => addButton(chain.id)}
                className="add-button"
              >
                ➕ Добавить кнопку
              </button>
            </div>
          </div>
        ))}
      </div>
      
      <div className="editor-actions">
        <button onClick={addChain} className="add-button">
          ➕ Добавить новый диалог
        </button>
        <button onClick={handleSave} className="save-button">
          💾 Сохранить все диалоги
        </button>
      </div>
    </div>
  );
};

export default DialogChainEditor; 