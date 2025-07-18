import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

const FlowEditor = forwardRef((props, ref) => {
  const [blocks, setBlocks] = useState([
    {
      id: 'start',
      type: 'start',
      position: { x: 2500, y: 2500 }, // Центр рабочей области
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
  
  const editorRef = useRef(null);

  // Экспортируем методы через ref
  useImperativeHandle(ref, () => ({
    getFlowData: () => ({
      blocks,
      connections
    })
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
    if (e.button === 1 || (e.button === 0 && e.altKey)) { // Средняя кнопка мыши или Alt + левая кнопка
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
    };
    setBlocks([...blocks, newBlock]);
  };

  // Добавление кнопки к блоку
  const addButton = (blockId) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        return {
          ...block,
          buttons: [...block.buttons, { id: Date.now(), text: 'Новая кнопка' }]
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
    if (blockId === 'start') return; // Запрещаем удаление стартового блока
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

  // Обработка перетаскивания
  const handleDragStart = (e, blockId) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    
    setDraggedBlock(blockId);
    const rect = e.target.getBoundingClientRect();
    
    // Сохраняем начальные координаты
    e.dataTransfer.setData('text/plain', JSON.stringify({
      initialX: block.position.x,
      initialY: block.position.y,
      startX: e.clientX,
      startY: e.clientY,
      startPanX: pan.x,
      startPanY: pan.y
    }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!draggedBlock) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain'));
      
      // Вычисляем смещение с учетом изменения pan и scale
      const dx = (e.clientX - data.startX) / scale;
      const dy = (e.clientY - data.startY) / scale;
      const panDx = (pan.x - data.startPanX) / scale;
      const panDy = (pan.y - data.startPanY) / scale;

      setBlocks(blocks.map(block => {
        if (block.id === draggedBlock) {
          return {
            ...block,
            position: {
              x: data.initialX + dx - panDx,
              y: data.initialY + dy - panDy
            }
          };
        }
        return block;
      }));
    } catch (err) {
      console.error('Error during drop:', err);
    }
    
    setDraggedBlock(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
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