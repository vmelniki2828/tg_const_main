import React, { useState, useEffect } from 'react';
import './Giveaways.css';
import config from '../config';

const Giveaways = ({ botId, onClose }) => {
  const [giveaways, setGiveaways] = useState([]);
  const [selectedGiveaway, setSelectedGiveaway] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [channelInput, setChannelInput] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' или 'archive'

  // Состояние для нового/редактируемого розыгрыша
  const [giveawayData, setGiveawayData] = useState({
    name: 'Розыгрыш',
    prizePlaces: 1,
    prizes: [],
    description: '',
    selectedChannels: [],
    colorPalette: {
      backgroundColor: '#1a1a2e',
      winnerColor: '#ffd700',
      winnerTextColor: '#000000',
      participantColor: '#ffffff',
      cardColor: '#667eea'
    }
  });

  useEffect(() => {
    if (botId) {
      fetchGiveaways();
    }
  }, [botId]);

  const fetchGiveaways = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.API_BASE_URL}/api/giveaways/${botId}`);
      if (response.ok) {
        const data = await response.json();
        setGiveaways(data.giveaways || []);
      }
    } catch (error) {
      console.error('Error fetching giveaways:', error);
    } finally {
      setLoading(false);
    }
  };

  // Фильтруем розыгрыши по статусу
  const activeGiveaways = giveaways.filter(g => g.status === 'draft');
  const archivedGiveaways = giveaways.filter(g => g.status === 'completed');
  const displayedGiveaways = activeTab === 'active' ? activeGiveaways : archivedGiveaways;

  const handleAddChannel = () => {
    if (channelInput.trim() && !giveawayData.selectedChannels.includes(channelInput.trim())) {
      setGiveawayData({
        ...giveawayData,
        selectedChannels: [...giveawayData.selectedChannels, channelInput.trim()]
      });
      setChannelInput('');
    }
  };

  const handleRemoveChannel = (channelId) => {
    setGiveawayData({
      ...giveawayData,
      selectedChannels: giveawayData.selectedChannels.filter(id => id !== channelId)
    });
  };

  const handleCreateNew = () => {
    setSelectedGiveaway(null);
    setGiveawayData({
      name: 'Розыгрыш',
      prizePlaces: 1,
      prizes: [],
      description: '',
      selectedChannels: [],
      colorPalette: {
        backgroundColor: '#1a1a2e',
        winnerColor: '#ffd700',
        winnerTextColor: '#000000',
        participantColor: '#ffffff',
        cardColor: '#667eea'
      }
    });
    setFile(null);
  };

  const handleSelectGiveaway = (giveaway) => {
    setSelectedGiveaway(giveaway);
    setGiveawayData({
      name: giveaway.name,
      prizePlaces: giveaway.prizePlaces,
      prizes: giveaway.prizes || [],
      description: giveaway.description || '',
      selectedChannels: giveaway.selectedChannels || [],
      colorPalette: giveaway.colorPalette || {
        backgroundColor: '#1a1a2e',
        winnerColor: '#ffd700',
        winnerTextColor: '#000000',
        participantColor: '#ffffff',
        cardColor: '#667eea'
      }
    });
  };

  const handlePrizePlacesChange = (value) => {
    const places = parseInt(value) || 1;
    const maxPlaces = Math.min(places, 5);
    
    // Обновляем массив призов
    const newPrizes = [];
    for (let i = 1; i <= maxPlaces; i++) {
      const existingPrize = giveawayData.prizes.find(p => p.place === i);
      newPrizes.push({
        place: i,
        name: existingPrize?.name || `Приз ${i}`,
        winner: existingPrize?.winner || null
      });
    }
    
    setGiveawayData({
      ...giveawayData,
      prizePlaces: maxPlaces,
      prizes: newPrizes
    });
  };

  const handlePrizeNameChange = (place, name) => {
    setGiveawayData({
      ...giveawayData,
      prizes: giveawayData.prizes.map(p => 
        p.place === place ? { ...p, name } : p
      )
    });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError('');
      } else {
        setError('Пожалуйста, выберите CSV файл');
        setFile(null);
      }
    }
  };

  const handleUploadCSV = async () => {
    if (!file) {
      setError('Пожалуйста, выберите файл');
      return;
    }

    if (!selectedGiveaway) {
      setError('Сначала создайте или выберите розыгрыш');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}/upload`,
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert('✅ Участники успешно загружены!');
        setFile(null);
        document.getElementById('csv-file-input').value = '';
        fetchGiveaways();
        if (data.giveaway) {
          handleSelectGiveaway(data.giveaway);
        }
      } else {
        setError(data.error || 'Ошибка загрузки файла');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const url = selectedGiveaway
        ? `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`
        : `${config.API_BASE_URL}/api/giveaways/${botId}`;
      
      const method = selectedGiveaway ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(giveawayData),
      });

      if (response.ok) {
        const data = await response.json();
        alert('✅ Розыгрыш сохранен!');
        fetchGiveaways();
        if (data.giveaway) {
          handleSelectGiveaway(data.giveaway);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Ошибка при сохранении');
      }
    } catch (error) {
      setError('Ошибка соединения с сервером');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectWinner = async (place, participant) => {
    // Обновляем локальное состояние
    const updatedPrizes = giveawayData.prizes.map(p => 
      p.place === place ? { ...p, winner: participant } : p
    );
    
    setGiveawayData({
      ...giveawayData,
      prizes: updatedPrizes
    });
    
    // Автоматически сохраняем, если это существующий розыгрыш
    if (selectedGiveaway && selectedGiveaway._id) {
      try {
        console.log('💾 [GIVEAWAY] Автосохранение при выборе победителя:', {
          place,
          participant: {
            userId: participant?.userId,
            username: participant?.username,
            firstName: participant?.firstName,
            lastName: participant?.lastName
          }
        });
        
        const response = await fetch(
          `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...giveawayData,
              prizes: updatedPrizes
            }),
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          // Обновляем данные розыгрыша
          if (data.giveaway) {
            handleSelectGiveaway(data.giveaway);
          }
          console.log('✅ [GIVEAWAY] Победитель сохранен автоматически');
        } else {
          console.error('❌ [GIVEAWAY] Ошибка автосохранения:', await response.json());
        }
      } catch (error) {
        console.error('❌ [GIVEAWAY] Ошибка автосохранения:', error);
      }
    }
  };

  const handleRandomWinners = async () => {
    if (!selectedGiveaway || !selectedGiveaway.participants || selectedGiveaway.participants.length === 0) {
      setError('Сначала загрузите участников');
      return;
    }

    try {
      const response = await fetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}/random-winners`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prizePlaces: giveawayData.prizePlaces
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setGiveawayData({
          ...giveawayData,
          prizes: data.prizes
        });
        alert('✅ Победители выбраны случайным образом!');
      } else {
        setError(data.error || 'Ошибка при выборе победителей');
      }
    } catch (error) {
      setError('Ошибка соединения с сервером');
    }
  };

  const handlePublish = async () => {
    if (!selectedGiveaway) {
      setError('Выберите розыгрыш');
      return;
    }
    
    // Автоматически сохраняем изменения перед публикацией
    try {
      const saveUrl = `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`;
      const saveResponse = await fetch(saveUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(giveawayData),
      });
      
      if (saveResponse.ok) {
        const saveData = await saveResponse.json();
        if (saveData.giveaway) {
          handleSelectGiveaway(saveData.giveaway);
        }
      }
    } catch (saveError) {
      console.error('Ошибка сохранения перед публикацией:', saveError);
    }

    if (giveawayData.selectedChannels.length === 0) {
      setError('Выберите хотя бы один канал для отправки результатов');
      return;
    }

    if (!window.confirm('Отправить результаты розыгрыша в выбранные каналы? Розыгрыш будет перемещен в архив.')) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}/publish`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            description: giveawayData.description,
            selectedChannels: giveawayData.selectedChannels
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert('✅ Результаты отправлены! Розыгрыш перемещен в архив.');
        
        // Обновляем список розыгрышей
        await fetchGiveaways();
        
        // Переключаемся на архив
        setActiveTab('archive');
        
        // Обновляем список и находим завершенный розыгрыш
        const updatedResponse = await fetch(`${config.API_BASE_URL}/api/giveaways/${botId}`);
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json();
          const updatedGiveaways = updatedData.giveaways || [];
          const completedGiveaway = updatedGiveaways.find(g => g._id === selectedGiveaway._id);
          if (completedGiveaway) {
            handleSelectGiveaway(completedGiveaway);
          } else {
            setSelectedGiveaway(null);
          }
        } else {
          setSelectedGiveaway(null);
        }
      } else {
        setError(data.error || 'Ошибка при отправке результатов');
      }
    } catch (error) {
      setError('Ошибка соединения с сервером');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="giveaways-overlay">
        <div className="giveaways-modal">
          <div className="loading">Загрузка розыгрышей...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="giveaways-overlay">
      <div className="giveaways-modal">
        <div className="giveaways-header">
          <h2>🎲 Розыгрыши</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        {/* Вкладки Розыгрыши/Архив */}
        <div className="giveaways-tabs">
          <button
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('active');
              setSelectedGiveaway(null);
            }}
          >
            Розыгрыши
          </button>
          <button
            className={`tab-btn ${activeTab === 'archive' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('archive');
              setSelectedGiveaway(null);
            }}
          >
            Архив
          </button>
        </div>

        {error && (
          <div className="error-message">
            <p>❌ {error}</p>
          </div>
        )}

        <div className="giveaways-content">
          {/* Список розыгрышей - только для архива */}
          {activeTab === 'archive' && (
            <div className="giveaways-list">
              <div className="giveaways-list-header">
                <h3>Архив розыгрышей</h3>
              </div>
              <div className="giveaways-items">
                {displayedGiveaways.map((giveaway) => (
                  <div
                    key={giveaway._id}
                    className={`giveaway-item ${selectedGiveaway?._id === giveaway._id ? 'active' : ''}`}
                    onClick={() => handleSelectGiveaway(giveaway)}
                  >
                    <div className="giveaway-item-name">{giveaway.name}</div>
                    <div className="giveaway-item-info">
                      Участников: {giveaway.participants?.length || 0} | 
                      Призов: {giveaway.prizePlaces} | ✅ Завершен
                    </div>
                  </div>
                ))}
                {displayedGiveaways.length === 0 && (
                  <div className="no-giveaways">Архив пуст</div>
                )}
              </div>
            </div>
          )}

          {/* Редактор розыгрыша */}
          <div className={`giveaway-editor ${activeTab === 'active' ? 'full-width' : ''}`}>
            {activeTab === 'active' ? (
              <>
                {/* На вкладке "Розыгрыши" всегда показываем форму настройки */}
                <div className="editor-section">
                  <h3>Основная информация</h3>
                  <div className="form-group">
                    <label>Название:</label>
                    <input
                      type="text"
                      value={giveawayData.name}
                      onChange={(e) => setGiveawayData({ ...giveawayData, name: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Количество призовых мест (1-5):</label>
                    <input
                      type="number"
                      min="1"
                      max="5"
                      value={giveawayData.prizePlaces}
                      onChange={(e) => handlePrizePlacesChange(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Текст про розыгрыш:</label>
                    <textarea
                      value={giveawayData.description}
                      onChange={(e) => setGiveawayData({ ...giveawayData, description: e.target.value })}
                      placeholder="Опишите розыгрыш..."
                      rows={4}
                      className="form-textarea"
                    />
                  </div>
                </div>

                {/* Загрузка CSV - показываем только если розыгрыш создан */}
                {selectedGiveaway && (
                  <div className="editor-section">
                    <h3>Загрузка участников (CSV)</h3>
                    <div className="upload-section">
                      <p>Формат CSV: userId, project, weight</p>
                      <input
                        id="csv-file-input"
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="file-input"
                      />
                      <button
                        onClick={handleUploadCSV}
                        disabled={!file || uploading}
                        className="upload-btn"
                      >
                        {uploading ? '⏳ Загрузка...' : file ? `📁 Загрузить ${file.name}` : '📁 Выберите файл'}
                      </button>
                    </div>
                    {selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                      <div className="participants-info">
                        Загружено участников: {selectedGiveaway.participants.length}
                      </div>
                    )}
                  </div>
                )}

                {/* Призы - показываем только если розыгрыш создан */}
                {selectedGiveaway && (
                  <div className="editor-section">
                    <h3>Призы</h3>
                    {giveawayData.prizes.map((prize) => (
                      <div key={prize.place} className="prize-item">
                        <div className="prize-header">
                          <label>Приз {prize.place}:</label>
                          <input
                            type="text"
                            value={prize.name}
                            onChange={(e) => handlePrizeNameChange(prize.place, e.target.value)}
                            className="form-input prize-name-input"
                            placeholder={`Приз ${prize.place}`}
                          />
                        </div>
                        {selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                          <div className="prize-winner-select">
                            <label>Победитель:</label>
                            <select
                              value={prize.winner?.userId || ''}
                              onChange={(e) => handleSelectWinner(prize.place, e.target.value)}
                              className="form-select"
                            >
                              <option value="">Выберите победителя...</option>
                              {selectedGiveaway.participants.map((participant) => {
                                // Проверяем, не выбран ли уже этот участник для другого приза
                                const isAlreadyWinner = giveawayData.prizes.some(
                                  p => p.winner && p.winner.userId === participant.userId && p.place !== prize.place
                                );
                                return (
                                  <option
                                    key={participant.userId}
                                    value={participant.userId}
                                    disabled={isAlreadyWinner}
                                  >
                                    {participant.firstName || ''} {participant.lastName || ''} 
                                    (@{participant.username || participant.userId})
                                    {participant.project && ` - ${participant.project}`}
                                    {isAlreadyWinner && ' (уже выбран)'}
                                  </option>
                                );
                              })}
                            </select>
                            {prize.winner && (
                              <div className="selected-winner">
                                Выбран: {prize.winner.firstName || ''} {prize.winner.lastName || ''}
                                {prize.winner.username && ` (@${prize.winner.username})`}
                                {prize.winner.project && ` - ${prize.winner.project}`}
                              </div>
                            )}
                          </div>
                        )}
                        {selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                          <button
                            onClick={() => handleRandomWinner(prize.place)}
                            className="random-winner-btn"
                          >
                            🎲 Случайный выбор
                          </button>
                        )}
                      </div>
                    ))}
                    {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                      <button
                        onClick={handleRandomWinners}
                        className="random-all-btn"
                      >
                        🎲 Выбрать всех победителей случайно
                      </button>
                    )}
                  </div>
                )}

                {/* Настройки цветовой палитры - только для активных розыгрышей */}
                {activeTab === 'active' && (
                  <div className="editor-section">
                    <h3>🎨 Цветовая палитра</h3>
                    <div className="color-palette-grid">
                      <div className="color-input-group">
                        <label>Фон:</label>
                        <input
                          type="color"
                          value={giveawayData.colorPalette.backgroundColor}
                          onChange={(e) => setGiveawayData({
                            ...giveawayData,
                            colorPalette: {
                              ...giveawayData.colorPalette,
                              backgroundColor: e.target.value
                            }
                          })}
                          className="color-input"
                        />
                      </div>
                      <div className="color-input-group">
                        <label>Цвет победителя:</label>
                        <input
                          type="color"
                          value={giveawayData.colorPalette.winnerColor}
                          onChange={(e) => setGiveawayData({
                            ...giveawayData,
                            colorPalette: {
                              ...giveawayData.colorPalette,
                              winnerColor: e.target.value
                            }
                          })}
                          className="color-input"
                        />
                      </div>
                      <div className="color-input-group">
                        <label>Текст победителя:</label>
                        <input
                          type="color"
                          value={giveawayData.colorPalette.winnerTextColor}
                          onChange={(e) => setGiveawayData({
                            ...giveawayData,
                            colorPalette: {
                              ...giveawayData.colorPalette,
                              winnerTextColor: e.target.value
                            }
                          })}
                          className="color-input"
                        />
                      </div>
                      <div className="color-input-group">
                        <label>Текст участников:</label>
                        <input
                          type="color"
                          value={giveawayData.colorPalette.participantColor}
                          onChange={(e) => setGiveawayData({
                            ...giveawayData,
                            colorPalette: {
                              ...giveawayData.colorPalette,
                              participantColor: e.target.value
                            }
                          })}
                          className="color-input"
                        />
                      </div>
                      <div className="color-input-group">
                        <label>Цвет карточки:</label>
                        <input
                          type="color"
                          value={giveawayData.colorPalette.cardColor}
                          onChange={(e) => setGiveawayData({
                            ...giveawayData,
                            colorPalette: {
                              ...giveawayData.colorPalette,
                              cardColor: e.target.value
                            }
                          })}
                          className="color-input"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Выбор каналов - только для активных розыгрышей */}
                {selectedGiveaway && activeTab === 'active' && (
                  <div className="editor-section">
                    <h3>Каналы для отправки результатов</h3>
                    <div className="channels-input-section">
                      <div className="channel-input-group">
                        <input
                          type="text"
                          value={channelInput}
                          onChange={(e) => setChannelInput(e.target.value)}
                          placeholder="Введите ID канала (например: @channel или -1001234567890)"
                          className="form-input"
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleAddChannel();
                            }
                          }}
                        />
                        <button onClick={handleAddChannel} className="add-channel-btn">
                          ➕ Добавить
                        </button>
                      </div>
                      {giveawayData.selectedChannels.length > 0 && (
                        <div className="selected-channels">
                          <h4>Выбранные каналы:</h4>
                          <div className="channels-list">
                            {giveawayData.selectedChannels.map((channelId) => (
                              <div key={channelId} className="channel-tag">
                                {channelId}
                                <button
                                  onClick={() => handleRemoveChannel(channelId)}
                                  className="remove-channel-btn"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Кнопки действий */}
                <div className="giveaway-actions">
                  {!selectedGiveaway ? (
                    <button onClick={handleCreateNew} className="create-giveaway-btn">
                      ➕ Создать розыгрыш
                    </button>
                  ) : (
                    <button
                      onClick={handlePublish}
                      disabled={saving || giveawayData.selectedChannels.length === 0}
                      className="publish-btn"
                    >
                      {saving ? '📢 Отправка...' : '🎲 Провести розыгрыш'}
                    </button>
                  )}
                  <button className="cancel-btn" onClick={onClose}>
                    Отмена
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* В архиве показываем только просмотр, без редактирования */}
                {activeTab === 'archive' && selectedGiveaway ? (
                  <div className="archive-view">
                    <h3>Просмотр завершенного розыгрыша</h3>
                    <div className="editor-section">
                      <p><strong>Название:</strong> {selectedGiveaway.name}</p>
                      <p><strong>Призовых мест:</strong> {selectedGiveaway.prizePlaces}</p>
                      <p><strong>Участников:</strong> {selectedGiveaway.participants?.length || 0}</p>
                      {selectedGiveaway.description && (
                        <p><strong>Описание:</strong> {selectedGiveaway.description}</p>
                      )}
                      <div className="prizes-preview">
                        <h4>Победители:</h4>
                        {selectedGiveaway.prizes && selectedGiveaway.prizes.map((prize) => (
                          <div key={prize.place} className="prize-preview">
                            <strong>{prize.name}</strong> (место {prize.place}):
                            {prize.winner ? (
                              <div>
                                {prize.winner.firstName || ''} {prize.winner.lastName || ''}
                                {prize.winner.username && ` (@${prize.winner.username})`}
                                {prize.winner.project && ` - ${prize.winner.project}`}
                              </div>
                            ) : (
                              <div>Победитель не выбран</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-selection">
                    Выберите розыгрыш из архива для просмотра
                  </div>
                )}
                
                {/* Кнопки действий для архива */}
                <div className="giveaway-actions">
                  <button className="cancel-btn" onClick={onClose}>
                    Закрыть
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Giveaways;
