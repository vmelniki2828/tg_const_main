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
  const [backgroundImageFile, setBackgroundImageFile] = useState(null);
  const [uploadingBackground, setUploadingBackground] = useState(false);
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
    // Конвертируем старую структуру призов в новую (для обратной совместимости)
    const convertedPrizes = (giveaway.prizes || []).map(prize => {
      // Если это старая структура (с place и winner)
      if (prize.place && !prize.placeFrom) {
        return {
          placeFrom: prize.place,
          placeTo: prize.place,
          name: prize.name || `Приз ${prize.place}`,
          winners: prize.winner ? [prize.winner] : []
        };
      }
      // Если уже новая структура
      return {
        placeFrom: prize.placeFrom || 1,
        placeTo: prize.placeTo || 1,
        name: prize.name || 'Приз',
        winners: prize.winners || []
      };
    });
    
    // Если призов нет, создаем один по умолчанию
    if (convertedPrizes.length === 0) {
      convertedPrizes.push({
        placeFrom: 1,
        placeTo: 1,
        name: 'Приз 1',
        winners: []
      });
    }
    
    setGiveawayData({
      name: giveaway.name,
      prizePlaces: giveaway.prizePlaces || 1,
      prizes: convertedPrizes,
      description: giveaway.description || '',
      selectedChannels: giveaway.selectedChannels || [],
      backgroundImage: giveaway.backgroundImage || null,
      colorPalette: giveaway.colorPalette || {
        backgroundColor: '#1a1a2e',
        winnerColor: '#ffd700',
        winnerTextColor: '#000000',
        participantColor: '#ffffff',
        cardColor: '#667eea'
      }
    });
    setBackgroundImageFile(null);
  };

  const handlePrizePlacesChange = (value) => {
    const places = parseInt(value) || 1;
    const maxPlaces = Math.min(places, 100);
    
    // Если призов еще нет, создаем один по умолчанию
    if (giveawayData.prizes.length === 0) {
      setGiveawayData({
        ...giveawayData,
        prizePlaces: maxPlaces,
        prizes: [{
          placeFrom: 1,
          placeTo: 1,
          name: 'Приз 1',
          winners: []
        }]
      });
    } else {
      setGiveawayData({
        ...giveawayData,
        prizePlaces: maxPlaces
      });
    }
  };

  const handleAddPrize = () => {
    const newPrize = {
      placeFrom: 1,
      placeTo: 1,
      name: `Приз ${giveawayData.prizes.length + 1}`,
      winners: []
    };
    setGiveawayData({
      ...giveawayData,
      prizes: [...giveawayData.prizes, newPrize]
    });
  };

  const handleRemovePrize = (index) => {
    const newPrizes = giveawayData.prizes.filter((_, i) => i !== index);
    setGiveawayData({
      ...giveawayData,
      prizes: newPrizes
    });
  };

  const handlePrizeRangeChange = (index, field, value) => {
    const newPrizes = [...giveawayData.prizes];
    const numValue = parseInt(value) || 1;
    
    if (field === 'placeFrom') {
      newPrizes[index].placeFrom = Math.max(1, Math.min(numValue, newPrizes[index].placeTo || giveawayData.prizePlaces));
    } else if (field === 'placeTo') {
      newPrizes[index].placeTo = Math.max(newPrizes[index].placeFrom || 1, Math.min(numValue, giveawayData.prizePlaces));
    }
    
    setGiveawayData({
      ...giveawayData,
      prizes: newPrizes
    });
  };

  // Функция больше не нужна, используется inline в JSX

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

  const handleBackgroundImageChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(selectedFile.type)) {
        setBackgroundImageFile(selectedFile);
        setError('');
      } else {
        setError('Пожалуйста, выберите изображение (JPEG, PNG, GIF, WebP)');
        setBackgroundImageFile(null);
      }
    }
  };

  const handleUploadBackgroundImage = async () => {
    if (!backgroundImageFile) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    if (!selectedGiveaway) {
      setError('Сначала создайте розыгрыш');
      return;
    }

    setUploadingBackground(true);
    setError('');

    const formData = new FormData();
    formData.append('backgroundImage', backgroundImageFile);

    try {
      const response = await fetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}/upload-background`,
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert('✅ Фоновое изображение успешно загружено!');
        setBackgroundImageFile(null);
        document.getElementById('background-image-input').value = '';
        fetchGiveaways();
        if (data.giveaway) {
          handleSelectGiveaway(data.giveaway);
        }
      } else {
        setError(data.error || 'Ошибка загрузки изображения');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      console.error('Upload background error:', err);
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleUploadCSV = async () => {
    if (!file) {
      setError('Пожалуйста, выберите файл');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let giveawayId = selectedGiveaway?._id;
      
      // Если розыгрыш еще не создан, создаем его
      if (!giveawayId) {
        const createResponse = await fetch(`${config.API_BASE_URL}/api/giveaways/${botId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(giveawayData),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          setError(errorData.error || 'Ошибка при создании розыгрыша');
          setUploading(false);
          return;
        }

        const createData = await createResponse.json();
        if (createData.giveaway) {
          giveawayId = createData.giveaway._id;
          handleSelectGiveaway(createData.giveaway);
        } else {
          setError('Не удалось создать розыгрыш');
          setUploading(false);
          return;
        }
      }

      // Загружаем CSV файл
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}/upload`,
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

  // Функции handleSelectWinner и handleRandomWinner больше не нужны,
  // логика встроена в JSX для работы с новой структурой призов

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
        // Конвертируем ответ в новую структуру
        const convertedPrizes = (data.prizes || []).map(prize => {
          if (prize.place && !prize.placeFrom) {
            return {
              placeFrom: prize.place,
              placeTo: prize.place,
              name: prize.name || `Приз ${prize.place}`,
              winners: prize.winner ? [prize.winner] : []
            };
          }
          return {
            placeFrom: prize.placeFrom || 1,
            placeTo: prize.placeTo || 1,
            name: prize.name || 'Приз',
            winners: prize.winners || []
          };
        });
        
        setGiveawayData({
          ...giveawayData,
          prizes: convertedPrizes
        });
        
        // Обновляем selectedGiveaway
        await fetchGiveaways();
        const updatedResponse = await fetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`);
        if (updatedResponse.ok) {
          const updatedData = await updatedResponse.json();
          if (updatedData.giveaway) {
            handleSelectGiveaway(updatedData.giveaway);
          }
        }
        
        alert('✅ Победители выбраны случайным образом!');
      } else {
        setError(data.error || 'Ошибка при выборе победителей');
      }
    } catch (error) {
      setError('Ошибка соединения с сервером');
    }
  };

  const handlePublish = async () => {
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
      let giveawayId = selectedGiveaway?._id;
      
      // Если розыгрыш еще не создан, создаем его
      if (!giveawayId) {
        const createResponse = await fetch(`${config.API_BASE_URL}/api/giveaways/${botId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(giveawayData),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          setError(errorData.error || 'Ошибка при создании розыгрыша');
          setSaving(false);
          return;
        }

        const createData = await createResponse.json();
        if (createData.giveaway) {
          giveawayId = createData.giveaway._id;
          handleSelectGiveaway(createData.giveaway);
        } else {
          setError('Не удалось создать розыгрыш');
          setSaving(false);
          return;
        }
      } else {
        // Если розыгрыш уже существует, обновляем его перед публикацией
        const saveResponse = await fetch(
          `${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(giveawayData),
          }
        );
        
        if (saveResponse.ok) {
          const saveData = await saveResponse.json();
          if (saveData.giveaway) {
            handleSelectGiveaway(saveData.giveaway);
          }
        }
      }

      // Получаем актуальные данные розыгрыша перед проверкой победителей
      const currentGiveawayResponse = await fetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}`);
      let currentGiveaway = null;
      if (currentGiveawayResponse.ok) {
        const currentData = await currentGiveawayResponse.json();
        currentGiveaway = currentData.giveaway;
        if (currentGiveaway) {
          handleSelectGiveaway(currentGiveaway);
        }
      }

      // Проверяем, есть ли невыбранные победители (новая структура с диапазонами)
      const currentPrizes = currentGiveaway?.prizes || giveawayData.prizes;
      const hasUnselectedWinners = currentPrizes.some(prize => {
        const placeFrom = prize.placeFrom || prize.place || 1;
        const placeTo = prize.placeTo || prize.place || 1;
        const placesCount = placeTo - placeFrom + 1;
        const winners = prize.winners || (prize.winner ? [prize.winner] : []);
        return winners.length < placesCount;
      });
      const hasParticipants = currentGiveaway?.participants && currentGiveaway.participants.length > 0;
      
      // Если есть невыбранные победители и есть участники, выбираем их автоматически
      if (hasUnselectedWinners && hasParticipants) {
        try {
          console.log('🎲 [GIVEAWAY] Автоматически выбираем победителей для невыбранных призов...');
          
          const randomResponse = await fetch(
            `${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}/random-winners`,
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

          if (randomResponse.ok) {
            const randomData = await randomResponse.json();
            console.log('✅ [GIVEAWAY] Победители выбраны автоматически:', randomData.prizes);
            
            // Ждем обновления данных из БД
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Получаем актуальные данные после выбора победителей
            const updatedResponse = await fetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}`);
            if (updatedResponse.ok) {
              const updatedData = await updatedResponse.json();
              if (updatedData.giveaway) {
                currentGiveaway = updatedData.giveaway;
                handleSelectGiveaway(updatedData.giveaway);
                // Обновляем prizes в giveawayData из актуальных данных
                setGiveawayData({
                  ...giveawayData,
                  prizes: updatedData.giveaway.prizes
                });
                console.log('✅ [GIVEAWAY] Данные обновлены после автоматического выбора:', updatedData.giveaway.prizes);
              }
            }
          } else {
            const errorData = await randomResponse.json();
            console.error('❌ [GIVEAWAY] Ошибка при автоматическом выборе победителей:', errorData);
            setError(errorData.error || 'Ошибка при автоматическом выборе победителей');
            setSaving(false);
            return;
          }
        } catch (error) {
          console.error('❌ [GIVEAWAY] Ошибка при автоматическом выборе победителей:', error);
          setError('Ошибка при автоматическом выборе победителей');
          setSaving(false);
          return;
        }
      } else if (hasUnselectedWinners && !hasParticipants) {
        setError('Необходимо загрузить участников перед публикацией');
        setSaving(false);
        return;
      }

      // Публикуем розыгрыш
      const response = await fetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}/publish`,
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
          const completedGiveaway = updatedGiveaways.find(g => g._id === giveawayId);
          if (completedGiveaway) {
            handleSelectGiveaway(completedGiveaway);
          } else {
            setSelectedGiveaway(null);
          }
        } else {
          setSelectedGiveaway(null);
        }
        
        // Сбрасываем форму для нового розыгрыша
        setGiveawayData({
          name: 'Розыгрыш',
          prizePlaces: 1,
          prizes: [{ placeFrom: 1, placeTo: 1, name: 'Приз 1', winners: [] }],
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
        setChannelInput('');
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
                    <label>Общее количество призовых мест (1-100):</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={giveawayData.prizePlaces}
                      onChange={(e) => handlePrizePlacesChange(e.target.value)}
                      className="form-input"
                    />
                    <small style={{ color: '#666', fontSize: '12px' }}>
                      Укажите максимальное место, которое будет разыграно
                    </small>
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

                {/* Загрузка CSV */}
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
                    {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                      <div className="participants-info">
                        Загружено участников: {selectedGiveaway.participants.length}
                      </div>
                    )}
                  </div>

                {/* Призы */}
                <div className="editor-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3>Призы</h3>
                    <button onClick={handleAddPrize} className="create-btn" style={{ padding: '8px 16px', fontSize: '14px' }}>
                      ➕ Добавить приз
                    </button>
                  </div>
                    {giveawayData.prizes.map((prize, prizeIndex) => {
                      const placesCount = (prize.placeTo || prize.placeFrom || 1) - (prize.placeFrom || 1) + 1;
                      return (
                      <div key={prizeIndex} className="prize-item" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <div className="prize-header" style={{ marginBottom: '10px' }}>
                              <label>Название приза:</label>
                              <input
                                type="text"
                                value={prize.name || ''}
                                onChange={(e) => {
                                  const newPrizes = [...giveawayData.prizes];
                                  newPrizes[prizeIndex].name = e.target.value;
                                  setGiveawayData({ ...giveawayData, prizes: newPrizes });
                                }}
                                className="form-input prize-name-input"
                                placeholder="Название приза"
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
                              <div style={{ flex: 1 }}>
                                <label>Места с:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max={giveawayData.prizePlaces}
                                  value={prize.placeFrom || 1}
                                  onChange={(e) => handlePrizeRangeChange(prizeIndex, 'placeFrom', e.target.value)}
                                  className="form-input"
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <label>по:</label>
                                <input
                                  type="number"
                                  min={prize.placeFrom || 1}
                                  max={giveawayData.prizePlaces}
                                  value={prize.placeTo || 1}
                                  onChange={(e) => handlePrizeRangeChange(prizeIndex, 'placeTo', e.target.value)}
                                  className="form-input"
                                />
                              </div>
                              <div style={{ paddingTop: '20px' }}>
                                <span style={{ color: '#666', fontSize: '14px' }}>
                                  ({placesCount} {placesCount === 1 ? 'место' : placesCount < 5 ? 'места' : 'мест'})
                                </span>
                              </div>
                            </div>
                          </div>
                          {giveawayData.prizes.length > 1 && (
                            <button
                              onClick={() => handleRemovePrize(prizeIndex)}
                              style={{ 
                                background: '#d32f2f', 
                                color: 'white', 
                                border: 'none', 
                                borderRadius: '4px', 
                                padding: '8px 12px',
                                cursor: 'pointer',
                                marginLeft: '10px'
                              }}
                            >
                              ✕ Удалить
                            </button>
                          )}
                        </div>
                        {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                          <div>
                            <label>Победители ({placesCount} {placesCount === 1 ? 'нужен' : 'нужно'}):</label>
                            <div style={{ marginTop: '10px' }}>
                              {(prize.winners || []).map((winner, winnerIndex) => (
                                <div key={winnerIndex} style={{ 
                                  display: 'flex', 
                                  alignItems: 'center', 
                                  gap: '10px', 
                                  marginBottom: '8px',
                                  padding: '8px',
                                  background: '#f5f5f5',
                                  borderRadius: '4px'
                                }}>
                                  <span style={{ flex: 1 }}>
                                    {winner.firstName || ''} {winner.lastName || ''}
                                    {winner.username && ` (@${winner.username})`}
                                    {winner.project && ` - ${winner.project}`}
                                    {winner.userId && ` [ID: ${winner.userId}]`}
                                  </span>
                                  <button
                                    onClick={() => {
                                      const newPrizes = [...giveawayData.prizes];
                                      newPrizes[prizeIndex].winners = newPrizes[prizeIndex].winners.filter((_, i) => i !== winnerIndex);
                                      setGiveawayData({ ...giveawayData, prizes: newPrizes });
                                    }}
                                    style={{ 
                                      background: '#d32f2f', 
                                      color: 'white', 
                                      border: 'none', 
                                      borderRadius: '4px', 
                                      padding: '4px 8px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))}
                              {(prize.winners || []).length < placesCount && (
                                <select
                                  onChange={(e) => {
                                    const userId = e.target.value;
                                    if (!userId) return;
                                    const participant = selectedGiveaway.participants.find(
                                      p => String(p.userId) === userId
                                    );
                                    if (participant) {
                                      const newPrizes = [...giveawayData.prizes];
                                      if (!newPrizes[prizeIndex].winners) {
                                        newPrizes[prizeIndex].winners = [];
                                      }
                                      // Проверяем, не выбран ли уже этот участник
                                      const isAlreadyWinner = newPrizes.some((p, pIdx) => 
                                        p.winners && p.winners.some(w => w.userId === participant.userId)
                                      );
                                      if (!isAlreadyWinner) {
                                        newPrizes[prizeIndex].winners.push({
                                          userId: participant.userId,
                                          username: participant.username || '',
                                          firstName: participant.firstName || '',
                                          lastName: participant.lastName || '',
                                          project: participant.project || ''
                                        });
                                        setGiveawayData({ ...giveawayData, prizes: newPrizes });
                                      } else {
                                        alert('Этот участник уже выбран для другого приза');
                                      }
                                    }
                                    e.target.value = '';
                                  }}
                                  className="form-select"
                                  style={{ marginTop: '5px' }}
                                >
                                  <option value="">Добавить победителя...</option>
                                  {selectedGiveaway.participants.map((participant) => {
                                    const isAlreadyWinner = giveawayData.prizes.some(p => 
                                      p.winners && p.winners.some(w => w.userId === participant.userId)
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
                              )}
                            </div>
                            <button
                              onClick={() => {
                                // Автоматически выбираем нужное количество победителей для этого приза
                                const needed = placesCount - (prize.winners || []).length;
                                if (needed > 0) {
                                  const availableParticipants = selectedGiveaway.participants.filter(p => {
                                    const isAlreadyWinner = giveawayData.prizes.some(prizeItem => 
                                      prizeItem.winners && prizeItem.winners.some(w => w.userId === p.userId)
                                    );
                                    return !isAlreadyWinner;
                                  });
                                  
                                  if (availableParticipants.length >= needed) {
                                    // Простой случайный выбор (можно улучшить с учетом весов)
                                    const shuffled = [...availableParticipants].sort(() => Math.random() - 0.5);
                                    const selected = shuffled.slice(0, needed);
                                    
                                    const newPrizes = [...giveawayData.prizes];
                                    if (!newPrizes[prizeIndex].winners) {
                                      newPrizes[prizeIndex].winners = [];
                                    }
                                    selected.forEach(p => {
                                      newPrizes[prizeIndex].winners.push({
                                        userId: p.userId,
                                        username: p.username || '',
                                        firstName: p.firstName || '',
                                        lastName: p.lastName || '',
                                        project: p.project || ''
                                      });
                                    });
                                    setGiveawayData({ ...giveawayData, prizes: newPrizes });
                                  } else {
                                    alert(`Недостаточно доступных участников. Нужно: ${needed}, доступно: ${availableParticipants.length}`);
                                  }
                                }
                              }}
                              className="random-winner-btn"
                              style={{ marginTop: '10px' }}
                            >
                              🎲 Выбрать случайно ({placesCount - (prize.winners || []).length} осталось)
                            </button>
                          </div>
                        )}
                      </div>
                    )})}
                    {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                      <button
                        onClick={handleRandomWinners}
                        className="random-all-btn"
                      >
                        🎲 Выбрать всех победителей случайно
                      </button>
                    )}
                  </div>

                {/* Загрузка фонового изображения */}
                {selectedGiveaway && (
                  <div className="editor-section">
                    <h3>🖼️ Фоновое изображение</h3>
                    <div className="upload-section">
                      <p>Загрузите изображение для фона видео (JPEG, PNG, GIF, WebP, до 10MB)</p>
                      <input
                        id="background-image-input"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                        onChange={handleBackgroundImageChange}
                        className="file-input"
                      />
                      <button
                        onClick={handleUploadBackgroundImage}
                        disabled={!backgroundImageFile || uploadingBackground}
                        className="upload-btn"
                      >
                        {uploadingBackground ? '⏳ Загрузка...' : backgroundImageFile ? `📁 Загрузить ${backgroundImageFile.name}` : '📁 Выберите изображение'}
                      </button>
                      {selectedGiveaway.backgroundImage && (
                        <div className="background-image-preview">
                          <p>✅ Фоновое изображение загружено</p>
                          <img 
                            src={`${config.API_BASE_URL}/${selectedGiveaway.backgroundImage}`} 
                            alt="Фоновое изображение" 
                            style={{ maxWidth: '200px', maxHeight: '200px', marginTop: '10px', borderRadius: '8px' }}
                          />
                        </div>
                      )}
                    </div>
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
                  <button
                    onClick={handlePublish}
                    disabled={saving || giveawayData.selectedChannels.length === 0}
                    className="publish-btn"
                  >
                    {saving ? '📢 Отправка...' : '🎲 Провести розыгрыш'}
                  </button>
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
                        {selectedGiveaway.prizes && selectedGiveaway.prizes.map((prize, prizeIndex) => {
                          const placeFrom = prize.placeFrom || prize.place || 1;
                          const placeTo = prize.placeTo || prize.place || 1;
                          const placeRange = placeFrom === placeTo ? `${placeFrom} место` : `места ${placeFrom}-${placeTo}`;
                          const winners = prize.winners || (prize.winner ? [prize.winner] : []);
                          
                          return (
                            <div key={prizeIndex} className="prize-preview" style={{ marginBottom: '15px' }}>
                              <strong>{prize.name}</strong> ({placeRange}):
                              {winners.length > 0 ? (
                                <div style={{ marginTop: '8px' }}>
                                  {winners.map((winner, winnerIndex) => (
                                    <div key={winnerIndex} style={{ 
                                      marginBottom: '8px', 
                                      padding: '8px', 
                                      background: '#f5f5f5', 
                                      borderRadius: '4px' 
                                    }}>
                                      <div>
                                        <strong>ID:</strong> {winner.userId}
                                        {winner.firstName || winner.lastName ? (
                                          <span> | {winner.firstName || ''} {winner.lastName || ''}</span>
                                        ) : null}
                                        {winner.username && ` | @${winner.username}`}
                                        {winner.project && ` | ${winner.project}`}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div>Победители не выбраны</div>
                              )}
                            </div>
                          );
                        })}
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
