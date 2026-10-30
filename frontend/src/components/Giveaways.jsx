import { apiFetch } from '../api';
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
  const [prizeImageFiles, setPrizeImageFiles] = useState({}); // { prizeIndex: File }
  const [uploadingPrizeImages, setUploadingPrizeImages] = useState({}); // { prizeIndex: boolean }
  const [channelInput, setChannelInput] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' или 'archive'

  // Состояние для нового/редактируемого розыгрыша
  const [giveawayData, setGiveawayData] = useState({
    name: 'Розыгрыш',
    prizes: [{ placeStart: 1, placeEnd: 1, name: 'Приз 1', prizeImage: null, winner: null, winners: [] }],
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
      const response = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}`);
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
    // Конвертируем старый формат (place) в новый (placeStart/placeEnd) для обратной совместимости
    const convertedPrizes = (giveaway.prizes || []).map(prize => {
      if (prize.place !== undefined) {
        // Старый формат - конвертируем
        return {
          placeStart: prize.place,
          placeEnd: prize.place,
          name: prize.name || `Приз ${prize.place}`,
          prizeImage: prize.prizeImage || null,
          winner: prize.winner || null,
          winners: []
        };
      }
      // Новый формат
      return {
        placeStart: prize.placeStart || 1,
        placeEnd: prize.placeEnd || 1,
        name: prize.name || 'Приз',
        prizeImage: prize.prizeImage || null,
        winner: prize.winner || null,
        winners: prize.winners || []
      };
    });
    
    setGiveawayData({
      name: giveaway.name,
      prizes: convertedPrizes.length > 0 ? convertedPrizes : [{ placeStart: 1, placeEnd: 1, name: 'Приз 1', prizeImage: null, winner: null, winners: [] }],
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

  const handleAddPrize = async () => {
    // Находим максимальное место из существующих призов
    const maxPlace = giveawayData.prizes.reduce((max, prize) => {
      return Math.max(max, prize.placeEnd || 0);
    }, 0);
    
    const newPrize = {
      placeStart: maxPlace + 1,
      placeEnd: maxPlace + 1,
      name: `Приз ${giveawayData.prizes.length + 1}`,
      prizeImage: null,
      winner: null,
      winners: []
    };
    
    const updatedPrizes = [...giveawayData.prizes, newPrize];
    
    setGiveawayData({
      ...giveawayData,
      prizes: updatedPrizes
    });
    
    // Автоматически сохраняем на сервер, если розыгрыш уже создан
    if (selectedGiveaway && selectedGiveaway._id) {
      try {
        const response = await apiFetch(
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
        } else {
          console.error('❌ Ошибка сохранения при добавлении приза');
        }
      } catch (error) {
        console.error('❌ Ошибка сохранения при добавлении приза:', error);
      }
    }
  };

  const handleRemovePrize = async (index) => {
    const newPrizes = giveawayData.prizes.filter((_, i) => i !== index);
    
    setGiveawayData({
      ...giveawayData,
      prizes: newPrizes
    });
    
    // Автоматически сохраняем на сервер, если розыгрыш уже создан
    if (selectedGiveaway && selectedGiveaway._id) {
      try {
        const response = await apiFetch(
          `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ...giveawayData,
              prizes: newPrizes
            }),
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.giveaway) {
            handleSelectGiveaway(data.giveaway);
          }
        } else {
          console.error('❌ Ошибка сохранения при удалении приза');
        }
      } catch (error) {
        console.error('❌ Ошибка сохранения при удалении приза:', error);
      }
    }
  };

  const handlePrizeRangeChange = async (index, field, value) => {
    const numValue = parseInt(value) || 1;
    const updatedPrizes = [...giveawayData.prizes];
    updatedPrizes[index] = {
      ...updatedPrizes[index],
      [field]: numValue
    };
    
    // Убеждаемся, что placeEnd >= placeStart
    if (field === 'placeStart' && updatedPrizes[index].placeEnd < numValue) {
      updatedPrizes[index].placeEnd = numValue;
    }
    if (field === 'placeEnd' && updatedPrizes[index].placeStart > numValue) {
      updatedPrizes[index].placeStart = numValue;
    }
    
    setGiveawayData({
      ...giveawayData,
      prizes: updatedPrizes
    });
    
    // Автоматически сохраняем на сервер, если розыгрыш уже создан
    if (selectedGiveaway && selectedGiveaway._id) {
      try {
        const response = await apiFetch(
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
        console.error('❌ Ошибка сохранения при изменении диапазона приза:', error);
      }
    }
  };

  const handlePrizeNameChange = async (index, name) => {
    const updatedPrizes = giveawayData.prizes.map((p, i) => 
      i === index ? { ...p, name } : p
    );
    
    setGiveawayData({
      ...giveawayData,
      prizes: updatedPrizes
    });
    
    // Автоматически сохраняем на сервер, если розыгрыш уже создан
    if (selectedGiveaway && selectedGiveaway._id) {
      try {
        const response = await apiFetch(
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
        console.error('❌ Ошибка сохранения при изменении названия приза:', error);
      }
    }
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

  const handlePrizeImageChange = (prizeIndex, e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(selectedFile.type)) {
        setPrizeImageFiles({
          ...prizeImageFiles,
          [prizeIndex]: selectedFile
        });
        setError('');
      } else {
        setError('Пожалуйста, выберите изображение (JPEG, PNG, GIF, WebP)');
      }
    }
  };

  const handleUploadPrizeImage = async (prizeIndex) => {
    const imageFile = prizeImageFiles[prizeIndex];
    if (!imageFile) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    if (!selectedGiveaway) {
      setError('Сначала создайте розыгрыш');
      return;
    }

    console.log('📸 [FRONTEND] Загрузка изображения приза:', {
      prizeIndex,
      prizeName: giveawayData.prizes[prizeIndex]?.name,
      totalPrizes: giveawayData.prizes.length,
      selectedGiveawayPrizes: selectedGiveaway.prizes?.length
    });

    setUploadingPrizeImages({
      ...uploadingPrizeImages,
      [prizeIndex]: true
    });
    setError('');

    const formData = new FormData();
    formData.append('prizeImage', imageFile);

    try {
      const response = await apiFetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}/prize/${prizeIndex}/upload-image`,
        {
          method: 'POST',
          body: formData
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert('✅ Изображение приза успешно загружено!');
        setPrizeImageFiles({
          ...prizeImageFiles,
          [prizeIndex]: null
        });
        const inputId = `prize-image-input-${prizeIndex}`;
        const input = document.getElementById(inputId);
        if (input) input.value = '';
        
        // Обновляем selectedGiveaway с полными данными из ответа
        if (data.giveaway) {
          console.log('✅ [FRONTEND] Обновляем данные розыгрыша после загрузки изображения:', {
            prizeIndex,
            prizeImage: data.giveaway.prizes[prizeIndex]?.prizeImage,
            totalPrizes: data.giveaway.prizes.length
          });
          handleSelectGiveaway(data.giveaway);
        }
        
        fetchGiveaways();
      } else {
        console.error('❌ [FRONTEND] Ошибка загрузки изображения:', data);
        setError(data.error || 'Ошибка загрузки изображения');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
      console.error('Upload prize image error:', err);
    } finally {
      setUploadingPrizeImages({
        ...uploadingPrizeImages,
        [prizeIndex]: false
      });
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
      const response = await apiFetch(
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
        
        // Получаем полные данные розыгрыша из БД, чтобы сохранить участников
        const fullGiveawayResponse = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`);
        if (fullGiveawayResponse.ok) {
          const fullData = await fullGiveawayResponse.json();
          if (fullData.giveaway) {
            handleSelectGiveaway(fullData.giveaway);
          }
        } else {
          // Fallback на данные из ответа загрузки
          if (data.giveaway) {
            handleSelectGiveaway(data.giveaway);
          }
        }
        
        fetchGiveaways();
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
        const createResponse = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}`, {
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

      const response = await apiFetch(
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

      const response = await apiFetch(url, {
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

  const handleSelectWinner = async (prizeIndex, participant) => {
    // Обновляем локальное состояние
    const updatedPrizes = giveawayData.prizes.map((p, i) => {
      if (i === prizeIndex) {
        const prize = { ...p };
        if (prize.placeStart === prize.placeEnd) {
          // Одно место - один победитель
          prize.winner = participant;
          prize.winners = [];
        } else {
          // Диапазон - добавляем победителя в массив
          if (!prize.winners) {
            prize.winners = [];
          }
          if (participant) {
            // Проверяем, не выбран ли уже этот участник
            const isAlreadySelected = prize.winners.some(w => w.userId === participant.userId);
            if (!isAlreadySelected) {
              prize.winners = [...prize.winners, participant];
            }
          }
        }
        return prize;
      }
      return p;
    });
    
    setGiveawayData({
      ...giveawayData,
      prizes: updatedPrizes
    });
    
    // Автоматически сохраняем, если это существующий розыгрыш
    if (selectedGiveaway && selectedGiveaway._id) {
      try {
        const response = await apiFetch(
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
        console.error('❌ [GIVEAWAY] Ошибка автосохранения:', error);
      }
    }
  };

  const handleRandomWinner = async (prizeIndex) => {
    if (!selectedGiveaway) {
      setError('Сначала загрузите участников');
      return;
    }
    
    if (!selectedGiveaway.participants || selectedGiveaway.participants.length === 0) {
      setError('Сначала загрузите участников');
      return;
    }

    const prize = giveawayData.prizes[prizeIndex];
    if (!prize) return;

    // Для диапазона мест - не обрабатываем вручную
    if (prize.placeStart !== prize.placeEnd) {
      setError('Для диапазона мест используйте автоматический выбор при публикации');
      return;
    }

    // Получаем доступных участников (исключаем уже выбранных для других призов)
    const availableParticipants = selectedGiveaway.participants.filter(participant => {
      const isAlreadyWinner = giveawayData.prizes.some((p, i) => {
        if (i === prizeIndex) return false;
        if (p.placeStart === p.placeEnd && p.winner && p.winner.userId === participant.userId) return true;
        if (p.placeStart !== p.placeEnd && p.winners && p.winners.some(w => w.userId === participant.userId)) return true;
        return false;
      });
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
    const updatedPrizes = giveawayData.prizes.map((p, i) => 
      i === prizeIndex 
        ? { 
            ...p, 
            winner: {
              userId: selectedParticipant.userId,
              project: selectedParticipant.project,
              username: selectedParticipant.username,
              firstName: selectedParticipant.firstName,
              lastName: selectedParticipant.lastName
            },
            winners: []
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
        const response = await apiFetch(
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
      const response = await apiFetch(
        `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}/random-winners`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prizes: giveawayData.prizes
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setGiveawayData({
          ...giveawayData,
          prizes: data.prizes
        });
        // Обновляем selectedGiveaway
        const updatedResponse = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`);
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
        const createResponse = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}`, {
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
        const saveResponse = await apiFetch(
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
      const currentGiveawayResponse = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}`);
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
      // Проверяем победителей для диапазонов тоже
      const hasUnselectedWinners = currentPrizes.some(prize => {
        const placeStart = prize.placeStart || (prize.place || 1);
        const placeEnd = prize.placeEnd || placeStart;
        if (placeStart === placeEnd) {
          return !prize.winner || !prize.winner.userId;
        } else {
          const placesCount = placeEnd - placeStart + 1;
          const currentWinners = prize.winners || [];
          return currentWinners.length < placesCount;
        }
      });
      // Проверяем участников из разных источников
      const hasParticipants = (currentGiveaway?.participants && currentGiveaway.participants.length > 0) ||
                              (selectedGiveaway?.participants && selectedGiveaway.participants.length > 0);
      
      // Если есть невыбранные победители и есть участники, выбираем их автоматически
      if (hasUnselectedWinners && hasParticipants) {
        try {
          console.log('🎲 [GIVEAWAY] Автоматически выбираем победителей для невыбранных призов...');
          
          const randomResponse = await apiFetch(
            `${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}/random-winners`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                prizes: currentPrizes
              })
            }
          );

          if (randomResponse.ok) {
            const randomData = await randomResponse.json();
            console.log('✅ [GIVEAWAY] Победители выбраны автоматически:', randomData.prizes);
            
            // Ждем обновления данных из БД
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Получаем актуальные данные после выбора победителей
            const updatedResponse = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${giveawayId}`);
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
      const response = await apiFetch(
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
        const updatedResponse = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}`);
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
          prizes: [{ placeStart: 1, placeEnd: 1, name: 'Приз 1', winner: null, winners: [] }],
          description: '',
          selectedChannels: [],
          backgroundImage: null,
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
                      Призов: {giveaway.prizes?.length || 0} | ✅ Завершен
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
                  {giveawayData.prizes.map((prize, index) => {
                    const isRange = prize.placeStart !== prize.placeEnd;
                    const placesCount = prize.placeEnd - prize.placeStart + 1;
                    return (
                      <div key={index} className="prize-item" style={{ marginBottom: '20px', padding: '15px', border: '1px solid #e0e0e0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <div className="form-group" style={{ marginBottom: '10px' }}>
                              <label>Название приза:</label>
                              <input
                                type="text"
                                value={prize.name}
                                onChange={(e) => handlePrizeNameChange(index, e.target.value)}
                                className="form-input"
                                placeholder="Название приза"
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label>С места:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={prize.placeStart}
                                  onChange={(e) => handlePrizeRangeChange(index, 'placeStart', e.target.value)}
                                  className="form-input"
                                />
                              </div>
                              <div className="form-group" style={{ flex: 1 }}>
                                <label>По место:</label>
                                <input
                                  type="number"
                                  min={prize.placeStart}
                                  max="100"
                                  value={prize.placeEnd}
                                  onChange={(e) => handlePrizeRangeChange(index, 'placeEnd', e.target.value)}
                                  className="form-input"
                                />
                              </div>
                            </div>
                            {isRange && (
                              <div style={{ marginBottom: '10px', padding: '10px', background: '#f0f0f0', borderRadius: '6px' }}>
                                <strong>Диапазон:</strong> {prize.placeStart} - {prize.placeEnd} место ({placesCount} победителей)
                              </div>
                            )}
                            {!isRange && (
                              <div style={{ marginBottom: '10px', padding: '10px', background: '#f0f0f0', borderRadius: '6px' }}>
                                <strong>Место:</strong> {prize.placeStart}
                              </div>
                            )}
                            
                            {/* Загрузка изображения приза */}
                            <div style={{ marginTop: '15px', marginBottom: '10px' }}>
                              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>🖼️ Изображение приза:</label>
                              <input
                                id={`prize-image-input-${index}`}
                                type="file"
                                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                                onChange={(e) => handlePrizeImageChange(index, e)}
                                className="file-input"
                                style={{ marginBottom: '8px' }}
                              />
                              <button
                                onClick={() => handleUploadPrizeImage(index)}
                                disabled={!prizeImageFiles[index] || uploadingPrizeImages[index]}
                                className="upload-btn"
                                style={{ padding: '6px 12px', fontSize: '13px' }}
                              >
                                {uploadingPrizeImages[index] ? '⏳ Загрузка...' : prizeImageFiles[index] ? `📁 Загрузить ${prizeImageFiles[index].name}` : '📁 Выберите изображение'}
                              </button>
                              {prize.prizeImage && (
                                <div style={{ marginTop: '10px' }}>
                                  <p style={{ fontSize: '12px', color: '#4caf50', marginBottom: '5px' }}>✅ Изображение загружено</p>
                                  <img 
                                    src={`${config.API_BASE_URL}/${prize.prizeImage}`} 
                                    alt="Изображение приза" 
                                    style={{ maxWidth: '150px', maxHeight: '150px', borderRadius: '6px', border: '2px solid #e0e0e0' }}
                                  />
                                  <button
                                    onClick={async () => {
                                      // Удаляем изображение приза
                                      const updatedPrizes = giveawayData.prizes.map((p, i) => {
                                        if (i === index) {
                                          return { ...p, prizeImage: null };
                                        }
                                        return p;
                                      });
                                      setGiveawayData({ ...giveawayData, prizes: updatedPrizes });
                                      
                                      // Сохраняем на сервере
                                      if (selectedGiveaway && selectedGiveaway._id) {
                                        const response = await apiFetch(
                                          `${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`,
                                          {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ ...giveawayData, prizes: updatedPrizes })
                                          }
                                        );
                                        if (response.ok) {
                                          const data = await response.json();
                                          if (data.giveaway) handleSelectGiveaway(data.giveaway);
                                        }
                                      }
                                    }}
                                    className="cancel-btn"
                                    style={{ marginLeft: '10px', padding: '4px 8px', fontSize: '11px' }}
                                  >
                                    ✕ Удалить
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemovePrize(index)}
                            className="cancel-btn"
                            style={{ marginLeft: '10px', padding: '5px 10px', fontSize: '12px' }}
                          >
                            ✕ Удалить
                          </button>
                        </div>
                        {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                          <>
                            {!isRange ? (
                              // Для одного места - выбор одного победителя
                              <div className="prize-winner-select">
                                <label>Победитель:</label>
                                <select
                                  value={prize.winner?.userId || ''}
                                  onChange={(e) => {
                                    const userId = e.target.value;
                                    if (!userId) {
                                      handleSelectWinner(index, null);
                                      return;
                                    }
                                    const participant = selectedGiveaway.participants.find(
                                      p => String(p.userId) === userId
                                    );
                                    if (participant) {
                                      handleSelectWinner(index, participant);
                                    }
                                  }}
                                  className="form-select"
                                >
                                  <option value="">Выберите победителя...</option>
                                  {selectedGiveaway.participants.map((participant) => {
                                    // Проверяем, не выбран ли уже этот участник для другого приза
                                    const isAlreadyWinner = giveawayData.prizes.some((p, i) => {
                                      if (i === index) return false;
                                      if (p.placeStart === p.placeEnd && p.winner && p.winner.userId === participant.userId) return true;
                                      if (p.placeStart !== p.placeEnd && p.winners && p.winners.some(w => w.userId === participant.userId)) return true;
                                      return false;
                                    });
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
                                <button
                                  onClick={() => handleRandomWinner(index)}
                                  className="random-winner-btn"
                                  style={{ marginTop: '10px' }}
                                >
                                  🎲 Случайный выбор
                                </button>
                              </div>
                            ) : (
                              // Для диапазона - возможность выбора победителей
                              <div>
                                <label>Победители ({placesCount} мест):</label>
                                {prize.winners && prize.winners.length > 0 && (
                                  <div style={{ marginTop: '10px', padding: '10px', background: '#e8f5e9', borderRadius: '6px' }}>
                                    <strong>Выбрано: {prize.winners.length} из {placesCount}</strong>
                                    <div style={{ marginTop: '5px', fontSize: '12px' }}>
                                      {prize.winners.map((winner, wIndex) => (
                                        <div key={wIndex} style={{ marginTop: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                          <span>
                                            {prize.placeStart + wIndex} место: {winner.firstName || ''} {winner.lastName || ''}
                                            {winner.username && ` (@${winner.username})`}
                                            {winner.project && ` - ${winner.project}`}
                                          </span>
                                          <button
                                            onClick={() => {
                                              const updatedPrizes = giveawayData.prizes.map((p, i) => {
                                                if (i === index) {
                                                  return {
                                                    ...p,
                                                    winners: p.winners.filter((_, idx) => idx !== wIndex)
                                                  };
                                                }
                                                return p;
                                              });
                                              setGiveawayData({ ...giveawayData, prizes: updatedPrizes });
                                              // Автосохранение
                                              if (selectedGiveaway && selectedGiveaway._id) {
                                                apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`, {
                                                  method: 'PUT',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ ...giveawayData, prizes: updatedPrizes })
                                                }).then(r => r.json()).then(d => {
                                                  if (d.giveaway) handleSelectGiveaway(d.giveaway);
                                                });
                                              }
                                            }}
                                            style={{ padding: '2px 8px', fontSize: '11px', marginLeft: '10px' }}
                                            className="cancel-btn"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(!prize.winners || prize.winners.length < placesCount) && (
                                  <div style={{ marginTop: '10px' }}>
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        const userId = e.target.value;
                                        if (!userId) return;
                                        const participant = selectedGiveaway.participants.find(
                                          p => String(p.userId) === userId
                                        );
                                        if (participant) {
                                          handleSelectWinner(index, participant);
                                        }
                                        e.target.value = '';
                                      }}
                                      className="form-select"
                                      style={{ marginTop: '5px' }}
                                    >
                                      <option value="">Добавить победителя...</option>
                                      {selectedGiveaway.participants.map((participant) => {
                                        // Проверяем, не выбран ли уже этот участник
                                        const isAlreadyWinner = giveawayData.prizes.some((p, i) => {
                                          if (i === index) {
                                            return p.winners && p.winners.some(w => w.userId === participant.userId);
                                          }
                                          if (p.placeStart === p.placeEnd && p.winner && p.winner.userId === participant.userId) return true;
                                          if (p.placeStart !== p.placeEnd && p.winners && p.winners.some(w => w.userId === participant.userId)) return true;
                                          return false;
                                        });
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
                                  </div>
                                )}
                                {prize.winners && prize.winners.length < placesCount && (
                                  <button
                                    onClick={async () => {
                                      // Автоматически выбираем недостающих победителей для диапазона
                                      const needed = placesCount - (prize.winners?.length || 0);
                                      if (needed > 0 && selectedGiveaway && selectedGiveaway.participants) {
                                        // Получаем доступных участников
                                        const availableParticipants = selectedGiveaway.participants.filter(p => {
                                          const isAlreadyWinner = giveawayData.prizes.some((prizeItem, i) => {
                                            if (i === index) {
                                              return prizeItem.winners && prizeItem.winners.some(w => w.userId === p.userId);
                                            }
                                            if (prizeItem.placeStart === prizeItem.placeEnd && prizeItem.winner && prizeItem.winner.userId === p.userId) return true;
                                            if (prizeItem.placeStart !== prizeItem.placeEnd && prizeItem.winners && prizeItem.winners.some(w => w.userId === p.userId)) return true;
                                            return false;
                                          });
                                          return !isAlreadyWinner;
                                        });
                                        
                                        if (availableParticipants.length >= needed) {
                                          // Выбираем случайных с учетом веса
                                          const totalWeight = availableParticipants.reduce((sum, p) => sum + (p.weight || 1), 0);
                                          const selected = [];
                                          const available = [...availableParticipants];
                                          
                                          for (let i = 0; i < needed && available.length > 0; i++) {
                                            let random = Math.random() * totalWeight;
                                            let currentWeight = 0;
                                            for (let j = 0; j < available.length; j++) {
                                              currentWeight += available[j].weight || 1;
                                              if (random <= currentWeight) {
                                                selected.push(available[j]);
                                                available.splice(j, 1);
                                                break;
                                              }
                                            }
                                          }
                                          
                                          const updatedPrizes = giveawayData.prizes.map((p, i) => {
                                            if (i === index) {
                                              return {
                                                ...p,
                                                winners: [...(p.winners || []), ...selected]
                                              };
                                            }
                                            return p;
                                          });
                                          
                                          setGiveawayData({ ...giveawayData, prizes: updatedPrizes });
                                          
                                          // Автосохранение
                                          if (selectedGiveaway && selectedGiveaway._id) {
                                            const response = await apiFetch(`${config.API_BASE_URL}/api/giveaways/${botId}/${selectedGiveaway._id}`, {
                                              method: 'PUT',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ ...giveawayData, prizes: updatedPrizes })
                                            });
                                            if (response.ok) {
                                              const data = await response.json();
                                              if (data.giveaway) handleSelectGiveaway(data.giveaway);
                                            }
                                          }
                                        }
                                      }
                                    }}
                                    className="random-winner-btn"
                                    style={{ marginTop: '10px' }}
                                  >
                                    🎲 Выбрать оставшихся случайно
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  {selectedGiveaway && selectedGiveaway.participants && selectedGiveaway.participants.length > 0 && (
                    <button
                      onClick={handleRandomWinners}
                      className="random-all-btn"
                      style={{ marginTop: '10px' }}
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
                        {selectedGiveaway.prizes && selectedGiveaway.prizes.map((prize, index) => {
                          const placeStart = prize.placeStart || (prize.place || 1);
                          const placeEnd = prize.placeEnd || placeStart;
                          const isRange = placeStart !== placeEnd;
                          
                          return (
                            <div key={index} className="prize-preview">
                              <strong>{prize.name}</strong> 
                              {isRange ? (
                                <span> (места {placeStart}-{placeEnd}):</span>
                              ) : (
                                <span> (место {placeStart}):</span>
                              )}
                              {isRange ? (
                                // Диапазон - показываем массив победителей
                                prize.winners && prize.winners.length > 0 ? (
                                  <div style={{ marginTop: '10px' }}>
                                    {prize.winners.map((winner, wIndex) => (
                                      <div key={wIndex} style={{ marginTop: '5px', paddingLeft: '15px' }}>
                                        {prize.placeStart + wIndex} место: ID: {winner.userId}
                                        {winner.firstName || winner.lastName ? (
                                          <span> | {winner.firstName || ''} {winner.lastName || ''}</span>
                                        ) : null}
                                        {winner.username && ` | @${winner.username}`}
                                        {winner.project && ` | ${winner.project}`}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div>Победители не выбраны</div>
                                )
                              ) : (
                                // Одно место - один победитель
                                prize.winner ? (
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
                                )
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
