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
    },
    backgroundImage: null
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
      },
      backgroundImage: giveaway.backgroundImage || null
    });
    setBackgroundImageFile(null);
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
    formData.append('image', backgroundImageFile);

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
        const input = document.getElementById('background-image-input');
        if (input) input.value = '';
        fetchGiveaways();
        if (data.giveaway) {
          handleSelectGiveaway(data.giveaway);
        }
      } else {
        setError(data.error || 'Ошибка загрузки изображения');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      console.error('Upload error:', err);
    } finally {
      setUploadingBackground(false);
    }
  };

  const handleDeleteBackgroundImage = async () => {
    if (!selectedGiveaway) {
      return;
    }

    if (!window.confirm('Удалить фоновое изображение?')) {
      return;
    }

    setUploadingBackground(true);
    setError('');

    try {
      const response = await fetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}/background-image`,
        {
          method: 'DELETE'
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert('✅ Фоновое изображение удалено!');
        fetchGiveaways();
        if (data.giveaway) {
          handleSelectGiveaway(data.giveaway);
        }
      } else {
        setError(data.error || 'Ошибка удаления изображения');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      console.error('Delete error:', err);
    } finally {
      setUploadingBackground(false);
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

  const handleRandomWinner = async (place) => {
    if (!selectedGiveaway) {
      setError('Сначала загрузите участников');
      return;
    }
    
    if (!selectedGiveaway.participants || selectedGiveaway.participants.length === 0) {
      setError('Сначала загрузите участников');
      return;
    }

    // Получаем доступных участников (исключаем уже выбранных для других призов)
    const availableParticipants = selectedGiveaway.participants.filter(participant => {
      const isAlreadyWinner = giveawayData.prizes.some(
        p => p.winner && p.winner.userId === participant.userId && p.place !== place
      );
      return !isAlreadyWinner;
    });

    if (availableParticipants.length === 0) {
      setError('Нет доступных участников для этого приза');
      return;
    }

    // Выбираем случайного участника с учетом веса
    const totalWeight = availableParticipants.reduce((sum, p) => sum + (p.weight || 1), 0);
    let random = Math.random() * totalWeight;
    let selectedParticipant = null;

    for (const participant of availableParticipants) {
      random -= (participant.weight || 1);
      if (random <= 0) {
        selectedParticipant = participant;
        break;
      }
    }

    if (!selectedParticipant) {
      selectedParticipant = availableParticipants[0];
    }

    // Обновляем приз с выбранным победителем
    const updatedPrizes = giveawayData.prizes.map(p => 
      p.place === place 
        ? { 
            ...p, 
            winner: {
              userId: selectedParticipant.userId,
              project: selectedParticipant.project,
              username: selectedParticipant.username,
              firstName: selectedParticipant.firstName,
              lastName: selectedParticipant.lastName
            }
          }
        : p
    );

    setGiveawayData({
      ...giveawayData,
      prizes: updatedPrizes
    });

    // Автосохранение (если розыгрыш уже создан)
    if (selectedGiveaway && selectedGiveaway._id) {
      try {
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
          if (data.giveaway) {
            handleSelectGiveaway(data.giveaway);
          }
        }
      } catch (error) {
        console.error('Ошибка автосохранения:', error);
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

      // Проверяем, есть ли невыбранные победители
      const currentPrizes = currentGiveaway?.prizes || giveawayData.prizes;
      const hasUnselectedWinners = currentPrizes.some(prize => !prize.winner);
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
          prizes: [{ place: 1, name: 'Приз 1', winner: null }],
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
                        {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                          <div className="prize-winner-select">
                            <label>Победитель:</label>
                            <select
                              value={prize.winner?.userId || ''}
                              onChange={(e) => {
                                const userId = e.target.value;
                                if (!userId) {
                                  handleSelectWinner(prize.place, null);
                                  return;
                                }
                                const participant = selectedGiveaway.participants.find(
                                  p => String(p.userId) === userId
                                );
                                if (participant) {
                                  handleSelectWinner(prize.place, participant);
                                }
                              }}
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
                        {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
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

                {/* Загрузка фонового изображения */}
                {activeTab === 'active' && (
                  <div className="editor-section">
                    <h3>🖼️ Фоновое изображение для видео</h3>
                    <div className="upload-section">
                      <p>Загрузите изображение, которое будет использоваться как фон в видео рулетки</p>
                      <input
                        id="background-image-input"
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        onChange={(e) => {
                          const selectedFile = e.target.files[0];
                          if (selectedFile) {
                            if (selectedFile.type.startsWith('image/')) {
                              setBackgroundImageFile(selectedFile);
                              setError('');
                            } else {
                              setError('Пожалуйста, выберите изображение');
                            }
                          }
                        }}
                        className="file-input"
                      />
                      <button
                        onClick={handleUploadBackgroundImage}
                        disabled={!backgroundImageFile || uploadingBackground || !selectedGiveaway}
                        className="upload-btn"
                      >
                        {uploadingBackground ? '⏳ Загрузка...' : backgroundImageFile ? `📁 Загрузить ${backgroundImageFile.name}` : '📁 Выберите изображение'}
                      </button>
                      {selectedGiveaway && selectedGiveaway.backgroundImage && (
                        <div className="background-image-preview">
                          <p>Текущее изображение:</p>
                          <img 
                            src={`${config.API_BASE_URL}${selectedGiveaway.backgroundImage.replace(/^.*\/uploads/, '/uploads')}`} 
                            alt="Фоновое изображение"
                            style={{ maxWidth: '300px', maxHeight: '200px', marginTop: '10px', borderRadius: '8px' }}
                          />
                          <button
                            onClick={handleDeleteBackgroundImage}
                            disabled={uploadingBackground || !selectedGiveaway}
                            className="delete-background-btn"
                            style={{ marginTop: '10px' }}
                          >
                            🗑️ Удалить изображение
                          </button>
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
                        {selectedGiveaway.prizes && selectedGiveaway.prizes.map((prize) => (
                          <div key={prize.place} className="prize-preview">
                            <strong>{prize.name}</strong> (место {prize.place}):
                            {prize.winner ? (
                              <div>
                                ID: {prize.winner.userId}
                                {prize.winner.firstName || prize.winner.lastName ? (
                                  <span> | {prize.winner.firstName || ''} {prize.winner.lastName || ''}</span>
                                ) : null}
                                {prize.winner.username && ` | @${prize.winner.username}`}
                                {prize.winner.project && ` | ${prize.winner.project}`}
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
