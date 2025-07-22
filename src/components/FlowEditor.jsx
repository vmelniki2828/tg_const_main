import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const FlowEditor = forwardRef(({ botId }, ref) => {
  // Состояния для редактора
  const [blocks, setBlocks] = useState([
    {
      id: 'start',
      type: 'start',
      position: { x: 2500, y: 2500 },
      message: 'Начало диалога',
      buttons: [],
    }
  ]);
  const [connections, setConnections] = useState([]);
  const [draggedBlock, setDraggedBlock] = useState(null);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const editorRef = useRef(null);

  // Загрузка состояния при монтировании или смене бота
  useEffect(() => {
    const loadBotState = async () => {
      if (!botId) return;

      try {
        setIsLoading(true);
        setError(null);
        console.log('Loading bot state for ID:', botId);
        
        const response = await fetch(`http://localhost:3001/api/bots/${botId}`);
        if (!response.ok) {
          throw new Error('Не удалось загрузить состояние бота');
        }
        const data = await response.json();
        console.log('Loaded bot data:', data);
        
        if (data.editorState) {
          if (data.editorState.blocks) {
            console.log('Setting blocks:', data.editorState.blocks);
            setBlocks(data.editorState.blocks);
          }
          if (data.editorState.connections) {
            console.log('Setting connections:', data.editorState.connections);
            setConnections(data.editorState.connections);
          }
          if (data.editorState.pan) {
            console.log('Setting pan:', data.editorState.pan);
            setPan(data.editorState.pan);
          }
          if (data.editorState.scale) {
            console.log('Setting scale:', data.editorState.scale);
            setScale(data.editorState.scale);
          }
        }
      } catch (err) {
        console.error('Error loading bot state:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadBotState();
  }, [botId]);

  // Экспортируем методы через ref
  useImperativeHandle(ref, () => ({
    getFlowData: () => ({
      blocks,
      connections
    }),
    getState: () => {
      const state = {
        blocks,
        connections,
        pan,
        scale
      };
      console.log('getState() called, returning:', state);
      return state;
    },
    createBlock: () => {
      const newBlock = {
        id: Date.now(),
        type: 'message',
        position: {
          x: 2500 + (-pan.x / scale),
          y: 2500 + (-pan.y / scale)
        },
        message: '',
        buttons: [],
        mediaFiles: null
      };
      setBlocks([...blocks, newBlock]);
    }
  }));

  // Обработка колесика мыши для масштабирования
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(prevScale => Math.min(Math.max(0.5, prevScale * delta), 2));
    }
  };

  // Начало перетаскивания холста
  const handleCanvasMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      setIsDraggingCanvas(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // Перетаскивание холста
  const handleCanvasMouseMove = (e) => {
    if (isDraggingCanvas) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      setPan(prevPan => ({
        x: prevPan.x + dx,
        y: prevPan.y + dy
      }));
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  // Завершение перетаскивания холста
  const handleCanvasMouseUp = () => {
    setIsDraggingCanvas(false);
  };

  // Добавляем обработчики событий
  useEffect(() => {
    const editor = editorRef.current;
    if (editor) {
      editor.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (editor) {
        editor.removeEventListener('wheel', handleWheel);
      }
    };
  }, []);

  // Обработка движения мыши для отрисовки создаваемой связи
  const handleMouseMove = (e) => {
    if (connectingFrom) {
      const rect = editorRef.current.getBoundingClientRect();
      setMousePosition({
        x: (e.clientX - rect.left - pan.x) / scale,
        y: (e.clientY - rect.top - pan.y) / scale
      });
    }
  };

  // Создание нового блока
  const createBlock = (type, position) => {
    const newBlock = {
      id: Date.now(),
      type,
      position: {
        x: 2500 + (-pan.x / scale),
        y: 2500 + (-pan.y / scale)
      },
      message: '',
      buttons: [],
      mediaFiles: null
    };
    setBlocks([...blocks, newBlock]);
  };

  // Добавление кнопки к блоку
  const addButton = (blockId) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const buttonNumber = block.buttons.length + 1;
        return {
          ...block,
          buttons: [...block.buttons, { 
            id: Date.now(), 
            text: `Кнопка ${buttonNumber}` 
          }]
        };
      }
      return block;
    }));
  };

  // Обновление текста сообщения
  const updateMessage = (blockId, message) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        return { ...block, message };
      }
      return block;
    }));
  };

  // Обновление текста кнопки
  const updateButton = (blockId, buttonId, text) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          buttons: block.buttons.map(btn => 
            btn.id === buttonId ? { ...btn, text } : btn
          )
        };
      }
      return block;
    }));
  };

  // Начало создания соединения
  const startConnection = (blockId, buttonId, e) => {
    e.stopPropagation();
    setConnectingFrom({ blockId, buttonId });
    setIsConnecting(true);
  };

  // Завершение создания соединения
  const finishConnection = (toBlockId) => {
    if (!isConnecting) return;
    
    // Запрещаем соединения к стартовому блоку
    if (toBlockId === 'start') {
      setConnectingFrom(null);
      setIsConnecting(false);
      return;
    }

    if (connectingFrom && connectingFrom.blockId !== toBlockId) {
      // Удаляем старое соединение для этой кнопки, если оно существует
      const filteredConnections = connections.filter(
        conn => !(conn.from.blockId === connectingFrom.blockId && 
                 conn.from.buttonId === connectingFrom.buttonId)
      );
      
      const newConnection = {
        id: Date.now(),
        from: connectingFrom,
        to: toBlockId
      };
      setConnections([...filteredConnections, newConnection]);
    }
    setConnectingFrom(null);
    setIsConnecting(false);
  };

  // Отмена создания соединения
  const cancelConnection = () => {
    setConnectingFrom(null);
    setIsConnecting(false);
  };

  // Удаление блока и всех его связей
  const removeBlock = (blockId) => {
    if (blockId === 'start') return;
    setBlocks(blocks.filter(block => block.id !== blockId));
    setConnections(connections.filter(conn => 
      conn.from.blockId !== blockId && conn.to !== blockId
    ));
  };

  // Удаление кнопки и её связей
  const removeButton = (blockId, buttonId) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          buttons: block.buttons.filter(btn => btn.id !== buttonId)
        };
      }
      return block;
    }));
    setConnections(connections.filter(conn => 
      !(conn.from.blockId === blockId && conn.from.buttonId === buttonId)
    ));
  };

  // Загрузка медиафайла
  const handleMediaUpload = async (blockId, event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append('media', file);

      const response = await fetch('http://localhost:3001/api/upload-media', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла');
      }

      const result = await response.json();
      
      setBlocks(blocks.map(block => {
        if (block.id === blockId) {
          const currentMediaFiles = block.mediaFiles || [];
          return {
            ...block,
            mediaFiles: [...currentMediaFiles, result.file]
          };
        }
        return block;
      }));

      // Очищаем input
      event.target.value = '';
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Ошибка загрузки файла: ' + error.message);
    }
  };

  // Удаление медиафайла
  const removeMediaFile = (blockId, index) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const updatedMediaFiles = [...(block.mediaFiles || [])];
        updatedMediaFiles.splice(index, 1);
        return {
          ...block,
          mediaFiles: updatedMediaFiles.length > 0 ? updatedMediaFiles : null
        };
      }
      return block;
    }));
  };

  // Перемещение медиафайла
  const moveMediaFile = (blockId, index, direction) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const updatedMediaFiles = [...(block.mediaFiles || [])];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        
        // Меняем местами элементы
        [updatedMediaFiles[index], updatedMediaFiles[newIndex]] = 
        [updatedMediaFiles[newIndex], updatedMediaFiles[index]];
        
        return {
          ...block,
          mediaFiles: updatedMediaFiles
        };
      }
      return block;
    }));
  };

  // Обработка перетаскивания
  const handleDragStart = (e, blockId) => {
    setDraggedBlock(blockId);
    const block = blocks.find(b => b.id === blockId);
    const rect = e.target.getBoundingClientRect();
    const offsetX = (e.clientX - rect.left) / scale;
    const offsetY = (e.clientY - rect.top) / scale;
    e.dataTransfer.setData('text/plain', JSON.stringify({ offsetX, offsetY }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (draggedBlock) {
      const { offsetX, offsetY } = JSON.parse(e.dataTransfer.getData('text/plain'));
      const editorRect = editorRef.current.getBoundingClientRect();
      const x = (e.clientX - editorRect.left - pan.x) / scale - offsetX;
      const y = (e.clientY - editorRect.top - pan.y) / scale - offsetY;

      setBlocks(blocks.map(block => {
        if (block.id === draggedBlock) {
          return { ...block, position: { x, y } };
        }
        return block;
      }));
      setDraggedBlock(null);
    }
  };

  return (
    <div className="flow-editor">
      <button 
        className="add-block-button"
        onClick={() => createBlock('message')}
      >
        ➕ Создать блок
      </button>

      <div 
        className="editor-canvas"
        ref={editorRef}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={(e) => {
          handleCanvasMouseMove(e);
          handleMouseMove(e);
        }}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={() => {
          handleCanvasMouseUp();
          cancelConnection();
        }}
        onClick={cancelConnection}
      >
        <div 
          className="editor-content"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0'
          }}
        >
          {/* Отрисовка соединений */}
          <svg className="connections-layer" style={{ transform: `scale(${1/scale})`, transformOrigin: '0 0' }}>
            {connections.map(connection => {
              const fromBlock = blocks.find(b => b.id === connection.from.blockId);
              const toBlock = blocks.find(b => b.id === connection.to);
              if (!fromBlock || !toBlock) return null;

              // Находим кнопку, от которой идет соединение
              const button = fromBlock.buttons.find(b => b.id === connection.from.buttonId);
              if (!button) return null;

              // Вычисляем позицию начала линии (от кнопки)
              const buttonIndex = fromBlock.buttons.findIndex(b => b.id === button.id);
              const buttonY = fromBlock.position.y + 180 + buttonIndex * 40;

              const fromX = (fromBlock.position.x + 320) * scale;
              const fromY = buttonY * scale;
              const toX = toBlock.position.x * scale;
              const toY = (toBlock.position.y + 50) * scale;

              return (
                <g key={connection.id}>
                  <path
                    d={`M ${fromX} ${fromY} C ${fromX + 100} ${fromY}, ${toX - 100} ${toY}, ${toX} ${toY}`}
                    className="connection-path"
                  />
                  <circle cx={toX} cy={toY} r="4" className="connection-end" />
                </g>
              );
            })}
            {connectingFrom && (
              <path
                d={`M ${(blocks.find(b => b.id === connectingFrom.blockId).position.x + 320) * scale} 
                   ${(blocks.find(b => b.id === connectingFrom.blockId).position.y + 50) * scale} 
                   C ${(blocks.find(b => b.id === connectingFrom.blockId).position.x + 420) * scale} 
                   ${(blocks.find(b => b.id === connectingFrom.blockId).position.y + 50) * scale},
                   ${mousePosition.x * scale - 100} ${mousePosition.y * scale},
                   ${mousePosition.x * scale} ${mousePosition.y * scale}`}
                className="connection-path connection-preview"
                style={{ opacity: 0.5 }}
              />
            )}
          </svg>

          {/* Отрисовка блоков */}
          {blocks.map(block => (
            <div
              key={block.id}
              className={`dialog-block ${block.id === 'start' ? 'start' : ''} ${isConnecting ? 'connecting' : ''}`}
              style={{
                left: block.position.x,
                top: block.position.y,
                transform: `scale(${1})`
              }}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, block.id)}
              onClick={() => isConnecting && finishConnection(block.id)}
            >
              <div className="block-header">
                <span className="block-title">
                  {block.id === 'start' ? '🚀 Начало' : '💬 Сообщение'}
                </span>
                <div className="block-controls">
                  <button
                    className="block-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      addButton(block.id);
                    }}
                  >
                    ➕
                  </button>
                  {block.id !== 'start' && (
                    <button
                      className="block-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeBlock(block.id);
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>

              <textarea
                value={block.message}
                onChange={(e) => updateMessage(block.id, e.target.value)}
                placeholder="Введите сообщение..."
                style={{ width: '100%', minHeight: '80px', marginBottom: '1rem' }}
                onClick={(e) => e.stopPropagation()}
              />

              {/* Секция медиафайлов */}
              <div className="media-section" style={{ marginBottom: '1rem' }}>
                <div className="media-header">
                  <span>📎 Медиафайлы ({block.mediaFiles ? block.mediaFiles.length : 0}):</span>
                  <input
                    type="file"
                    id={`media-${block.id}`}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
                    onChange={(e) => handleMediaUpload(block.id, e)}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="block-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      document.getElementById(`media-${block.id}`).click();
                    }}
                    title="Добавить медиафайл"
                  >
                    📎
                  </button>
                </div>
                {block.mediaFiles && block.mediaFiles.length > 0 && (
                  <div className="media-files-list">
                    {block.mediaFiles.map((media, index) => (
                      <div key={media.filename} className="media-item">
                        <div className="media-preview">
                          {media.mimetype.startsWith('image/') ? (
                            <img 
                              src={`http://localhost:3001${media.path}`} 
                              alt="Preview" 
                              style={{ maxWidth: '100%', maxHeight: '80px', objectFit: 'contain' }}
                            />
                          ) : (
                            <div className="file-info">
                              <span>📄 {media.originalname}</span>
                              <span style={{ fontSize: '0.8em', color: '#666' }}>
                                ({(media.size / 1024).toFixed(1)} KB)
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="media-controls">
                          <button
                            className="block-button"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMediaFile(block.id, index);
                            }}
                            title="Удалить медиафайл"
                          >
                            ❌
                          </button>
                          {index > 0 && (
                            <button
                              className="block-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveMediaFile(block.id, index, 'up');
                              }}
                              title="Переместить вверх"
                            >
                              ⬆️
                            </button>
                          )}
                          {index < block.mediaFiles.length - 1 && (
                            <button
                              className="block-button"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveMediaFile(block.id, index, 'down');
                              }}
                              title="Переместить вниз"
                            >
                              ⬇️
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="block-buttons">
                {block.buttons.map(button => (
                  <div key={button.id} className="button-item">
                    <input
                      type="text"
                      value={button.text}
                      onChange={(e) => updateButton(block.id, button.id, e.target.value)}
                      placeholder="Текст кнопки"
                      title={button.text}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      className={`block-button ${connectingFrom?.buttonId === button.id ? 'connecting' : ''}`}
                      onClick={(e) => startConnection(block.id, button.id, e)}
                      title="Создать связь"
                    >
                      🔗
                    </button>
                    <button
                      className="block-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeButton(block.id, button.id);
                      }}
                      title="Удалить кнопку"
                    >
                      ❌
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default FlowEditor; 