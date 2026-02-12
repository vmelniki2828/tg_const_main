import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import QuizBlock from './QuizBlock';
import TriviaBlock from './TriviaBlock';
import config from '../config';

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
  const [quizDropdownOpen, setQuizDropdownOpen] = useState(false);
  
  const editorRef = useRef(null);

  // Загрузка состояния при монтировании или смене бота
  useEffect(() => {
    const loadBotState = async () => {
      if (!botId) return;
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`${config.API_BASE_URL}/api/bots/${botId}`);
        if (!response.ok) {
          throw new Error('Не удалось загрузить состояние бота');
        }
        const data = await response.json();
        if (data.editorState) {
          setBlocks(data.editorState.blocks || []);
          setConnections(data.editorState.connections || []);
          setPan(data.editorState.pan || { x: 0, y: 0 });
          setScale(data.editorState.scale || 1);
        } else {
          setBlocks([]);
          setConnections([]);
          setPan({ x: 0, y: 0 });
          setScale(1);
        }
      } catch (err) {
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
      // Получаем размеры видимой области редактора
      const editorRect = editorRef.current.getBoundingClientRect();
      const centerX = (editorRect.width / 2 - pan.x) / scale;
      const centerY = (editorRect.height / 2 - pan.y) / scale;

      // Добавляем небольшой случайный отступ, чтобы блоки не накладывались
      const offset = blocks.length * 20;
      
      const newBlock = {
        id: Date.now(),
        type: 'message',
        position: {
          x: centerX + offset,
          y: centerY + offset
        },
        message: '',
        buttons: [],
        mediaFiles: null
      };
      setBlocks([...blocks, newBlock]);
    },
    createQuizBlock: () => {
      // Получаем размеры видимой области редактора
      const editorRect = editorRef.current.getBoundingClientRect();
      const centerX = (editorRect.width / 2 - pan.x) / scale;
      const centerY = (editorRect.height / 2 - pan.y) / scale;

      // Добавляем небольшой случайный отступ, чтобы блоки не накладывались
      const offset = blocks.length * 20;

      const firstQuestion = {
        id: Date.now(),
        message: 'Вопрос 1',
        buttons: [
          { id: Date.now(), text: 'Вариант 1', isCorrect: true },
          { id: Date.now() + 1, text: 'Вариант 2', isCorrect: false },
          { id: Date.now() + 2, text: 'Вариант 3', isCorrect: false }
        ],
        successMessage: 'Правильно!',
        failureMessage: 'Неправильно. Попробуйте еще раз.',
        mediaFiles: []
      };

      const newQuizBlock = {
        id: Date.now(),
        type: 'quiz',
        position: {
          x: centerX + offset,
          y: centerY + offset
        },
        message: firstQuestion.message, // Синхронизируем с первым вопросом
        buttons: firstQuestion.buttons, // Синхронизируем кнопки с первым вопросом
        questions: [firstQuestion],
        currentQuestionIndex: 0,
        finalSuccessMessage: 'Поздравляем! Вы успешно прошли квиз!',
        returnToStartOnComplete: true,
        mediaFiles: null
      };
      setBlocks([...blocks, newQuizBlock]);
    },
    createTriviaBlock
  }));

  function createTriviaBlock() {
    const editorRect = editorRef.current?.getBoundingClientRect();
    if (!editorRect) return;
    const centerX = (editorRect.width / 2 - pan.x) / scale;
    const centerY = (editorRect.height / 2 - pan.y) / scale;
    const offset = blocks.length * 20;
    const newTriviaBlock = {
      id: Date.now(),
      type: 'trivia',
      position: { x: centerX + offset, y: centerY + offset },
      message: '',
      mediaFiles: [],
      correctAnswer: '',
      correctAnswerVariants: [],
      successMessage: 'Поздравляем! Верно!',
      failureMessage: 'Попробуйте ещё раз.',
      buttons: []
    };
    setBlocks([...blocks, newTriviaBlock]);
  }

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
        if (block.type === 'quiz') {
          const updatedQuestions = [...block.questions];
          const currentQuestion = updatedQuestions[block.currentQuestionIndex];
          const buttonNumber = currentQuestion.buttons.length + 1;
          const newButton = {
            id: Date.now(),
            text: `Вариант ${buttonNumber}`,
            isCorrect: currentQuestion.buttons.length === 0 // Первый вариант правильный по умолчанию
          };
          const updatedButtons = [...currentQuestion.buttons, newButton];
          currentQuestion.buttons = updatedButtons;
          return { 
            ...block, 
            questions: updatedQuestions,
            buttons: updatedButtons // Синхронизируем с основным блоком
          };
        } else {
          const buttonNumber = block.buttons.length + 1;
          const updatedButtons = [...block.buttons, { 
            id: Date.now(), 
            text: `Кнопка ${buttonNumber}`,
            url: '' // Добавляем поле для URL
          }];
          return {
            ...block,
            buttons: updatedButtons
          };
        }
      }
      return block;
    }));
  };

  // Обновление текста сообщения
  const updateMessage = (blockId, message) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        if (block.type === 'quiz') {
          const updatedQuestions = [...block.questions];
          const currentQuestion = updatedQuestions[block.currentQuestionIndex];
          currentQuestion.message = message;
          // Синхронизируем основное сообщение, кнопки и медиафайлы с текущим вопросом
          return { 
            ...block, 
            message: message, // Обновляем основное сообщение
            buttons: currentQuestion.buttons, // Синхронизируем кнопки
            mediaFiles: currentQuestion.mediaFiles, // Синхронизируем медиафайлы
            questions: updatedQuestions 
          };
        } else {
          return { ...block, message };
        }
      }
      return block;
    }));
  };

  // Обновление текста кнопки
  const updateButton = (blockId, buttonId, text) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        if (block.type === 'quiz') {
          const updatedQuestions = [...block.questions];
          const currentQuestion = updatedQuestions[block.currentQuestionIndex];
          const updatedButtons = currentQuestion.buttons.map(btn => 
            btn.id === buttonId ? { ...btn, text } : btn
          );
          currentQuestion.buttons = updatedButtons;
          return { 
            ...block, 
            questions: updatedQuestions,
            buttons: updatedButtons // Синхронизируем с основным блоком
          };
        } else {
          const updatedButtons = block.buttons.map(btn => 
            btn.id === buttonId ? { ...btn, text } : btn
          );
          return {
            ...block,
            buttons: updatedButtons
          };
        }
      }
      return block;
    }));
  };

  // Обновление URL кнопки
  const updateButtonUrl = (blockId, buttonId, url) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        if (block.type === 'quiz') {
          const updatedQuestions = [...block.questions];
          const currentQuestion = updatedQuestions[block.currentQuestionIndex];
          const updatedButtons = currentQuestion.buttons.map(btn => 
            btn.id === buttonId ? { ...btn, url } : btn
          );
          currentQuestion.buttons = updatedButtons;
          return { 
            ...block, 
            questions: updatedQuestions,
            buttons: updatedButtons // Синхронизируем с основным блоком
          };
        } else {
          const updatedButtons = block.buttons.map(btn => 
            btn.id === buttonId ? { ...btn, url } : btn
          );
          return {
            ...block,
            buttons: updatedButtons
          };
        }
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
      // Проверяем, есть ли у целевого блока кнопки
      const targetBlock = blocks.find(b => b.id === toBlockId);
      if (targetBlock && (!targetBlock.buttons || targetBlock.buttons.length === 0)) {
        const confirmConnection = window.confirm(
          `⚠️ Внимание! Блок "${targetBlock.message || toBlockId}" не имеет кнопок.\n\n` +
          `Пользователи не смогут перейти дальше из этого блока.\n\n` +
          `Продолжить создание соединения?`
        );
        
        if (!confirmConnection) {
          setConnectingFrom(null);
          setIsConnecting(false);
          return;
        }
      }
      
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
  const removeBlock = async (blockId) => {
    if (blockId === 'start') return;
    
    // Если удаляем квиз, удаляем его промокоды
    const blockToRemove = blocks.find(block => block.id === blockId);
    if (blockToRemove && blockToRemove.type === 'quiz') {
      try {
        const response = await fetch(`${config.API_BASE_URL}/api/quiz-promocodes/${blockId}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          console.log(`🗑️ Промокоды для квиза ${blockId} удалены`);
        } else {
          console.warn(`⚠️ Не удалось удалить промокоды для квиза ${blockId}`);
        }
      } catch (error) {
        console.error('Ошибка при удалении промокодов:', error);
      }
    }
    
    setBlocks(blocks.filter(block => block.id !== blockId));
    setConnections(connections.filter(conn => 
      conn.from.blockId !== blockId && conn.to !== blockId
    ));
  };

  // Удаление кнопки и её связей
  const removeButton = (blockId, buttonId) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        if (block.type === 'quiz') {
          const updatedQuestions = [...block.questions];
          const currentQuestion = updatedQuestions[block.currentQuestionIndex];
          const updatedButtons = currentQuestion.buttons.filter(btn => btn.id !== buttonId);
          
          // Если удалили правильный ответ, делаем первый оставшийся вариант правильным
          if (updatedButtons.length > 0 && !updatedButtons.some(btn => btn.isCorrect)) {
            updatedButtons[0].isCorrect = true;
          }
          
          currentQuestion.buttons = updatedButtons;
          return { 
            ...block, 
            questions: updatedQuestions,
            buttons: updatedButtons // Синхронизируем с основным блоком
          };
        } else {
          const updatedButtons = block.buttons.filter(btn => btn.id !== buttonId);
          return {
            ...block,
            buttons: updatedButtons
          };
        }
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

      const response = await fetch(`${config.API_BASE_URL}/api/upload-media`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки файла');
      }

      const result = await response.json();
      
      setBlocks(blocks.map(block => {
        if (block.id === blockId) {
          if (block.type === 'quiz') {
            // Для квизов добавляем медиафайл к текущему вопросу
            const updatedQuestions = [...block.questions];
            const currentQuestion = updatedQuestions[block.currentQuestionIndex];
            const currentMediaFiles = currentQuestion.mediaFiles || [];
            currentQuestion.mediaFiles = [...currentMediaFiles, result.file];
            
            console.log('Adding media to quiz question:', {
              questionIndex: block.currentQuestionIndex,
              mediaFiles: currentQuestion.mediaFiles
            });
            
            return {
              ...block,
              questions: updatedQuestions,
              mediaFiles: currentQuestion.mediaFiles // Синхронизируем с основным блоком
            };
          }
          if (block.type === 'trivia') {
            const currentMediaFiles = block.mediaFiles || [];
            return { ...block, mediaFiles: [...currentMediaFiles, result.file] };
          }
          // Для обычных блоков добавляем к основному блоку
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
        if (block.type === 'quiz') {
          // Для квизов удаляем медиафайл из текущего вопроса
          const updatedQuestions = [...block.questions];
          const currentQuestion = updatedQuestions[block.currentQuestionIndex];
          const updatedMediaFiles = [...(currentQuestion.mediaFiles || [])];
          updatedMediaFiles.splice(index, 1);
          currentQuestion.mediaFiles = updatedMediaFiles.length > 0 ? updatedMediaFiles : [];
          
          return {
            ...block,
            questions: updatedQuestions,
            mediaFiles: currentQuestion.mediaFiles // Синхронизируем с основным блоком
          };
        }
        if (block.type === 'trivia') {
          const updatedMediaFiles = [...(block.mediaFiles || [])];
          updatedMediaFiles.splice(index, 1);
          return { ...block, mediaFiles: updatedMediaFiles.length > 0 ? updatedMediaFiles : [] };
        }
        // Для обычных блоков удаляем из основного блока
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
        if (block.type === 'quiz') {
          // Для квизов перемещаем медиафайл в текущем вопросе
          const updatedQuestions = [...block.questions];
          const currentQuestion = updatedQuestions[block.currentQuestionIndex];
          const updatedMediaFiles = [...(currentQuestion.mediaFiles || [])];
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          
          // Меняем местами элементы
          [updatedMediaFiles[index], updatedMediaFiles[newIndex]] = 
          [updatedMediaFiles[newIndex], updatedMediaFiles[index]];
          
          currentQuestion.mediaFiles = updatedMediaFiles;
          
          return {
            ...block,
            questions: updatedQuestions,
            mediaFiles: currentQuestion.mediaFiles // Синхронизируем с основным блоком
          };
        }
        if (block.type === 'trivia') {
          const updatedMediaFiles = [...(block.mediaFiles || [])];
          const newIndex = direction === 'up' ? index - 1 : index + 1;
          if (newIndex < 0 || newIndex >= updatedMediaFiles.length) return block;
          [updatedMediaFiles[index], updatedMediaFiles[newIndex]] =
            [updatedMediaFiles[newIndex], updatedMediaFiles[index]];
          return { ...block, mediaFiles: updatedMediaFiles };
        }
        // Для обычных блоков перемещаем в основном блоке
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

  // Добавляем функцию для обновления правильности ответа
  const updateButtonCorrect = (blockId, buttonId) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const updatedQuestions = [...block.questions];
        const currentQuestion = updatedQuestions[block.currentQuestionIndex];
        const updatedButtons = currentQuestion.buttons.map(btn => ({
          ...btn,
          isCorrect: btn.id === buttonId
        }));
        currentQuestion.buttons = updatedButtons;
        return { 
          ...block, 
          questions: updatedQuestions,
          buttons: updatedButtons // Синхронизируем с основным блоком
        };
      }
      return block;
    }));
  };

  // Добавляем функции для обновления сообщений квиза
  const updateQuizSuccessMessage = (blockId, message) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const updatedQuestions = [...block.questions];
        const currentQuestion = updatedQuestions[block.currentQuestionIndex];
        currentQuestion.successMessage = message;
        return { ...block, questions: updatedQuestions };
      }
      return block;
    }));
  };

  const updateQuizFailureMessage = (blockId, message) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const updatedQuestions = [...block.questions];
        const currentQuestion = updatedQuestions[block.currentQuestionIndex];
        currentQuestion.failureMessage = message;
        return { ...block, questions: updatedQuestions };
      }
      return block;
    }));
  };

  const updateTriviaField = (blockId, field, value) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId && block.type === 'trivia') {
        return { ...block, [field]: value };
      }
      return block;
    }));
  };

  const addQuestion = (blockId) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const newQuestion = {
          id: Date.now(),
          message: 'Новый вопрос',
          buttons: [
            { id: Date.now(), text: 'Вариант 1', isCorrect: true },
            { id: Date.now() + 1, text: 'Вариант 2', isCorrect: false }
          ],
          successMessage: 'Правильно!',
          failureMessage: 'Неправильно. Попробуйте еще раз.',
          mediaFiles: []
        };
        const newIndex = block.questions.length;
        return {
          ...block,
          questions: [...block.questions, newQuestion],
          currentQuestionIndex: newIndex,
          message: newQuestion.message, // Синхронизируем основное сообщение
          buttons: newQuestion.buttons, // Синхронизируем кнопки
          mediaFiles: newQuestion.mediaFiles // Синхронизируем медиафайлы
        };
      }
      return block;
    }));
  };

  const removeQuestion = (blockId, questionIndex) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId && block.questions.length > 1) {
        const updatedQuestions = block.questions.filter((_, index) => index !== questionIndex);
        const newIndex = questionIndex >= updatedQuestions.length ? updatedQuestions.length - 1 : questionIndex;
        const currentQuestion = updatedQuestions[newIndex];
        return {
          ...block,
          questions: updatedQuestions,
          currentQuestionIndex: newIndex,
          message: currentQuestion.message, // Синхронизируем основное сообщение
          buttons: currentQuestion.buttons, // Синхронизируем кнопки
          mediaFiles: currentQuestion.mediaFiles // Синхронизируем медиафайлы
        };
      }
      return block;
    }));
  };

  const updateCurrentQuestionIndex = (blockId, newIndex) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        const currentQuestion = block.questions[newIndex];
        // Обновляем индекс и синхронизируем основное сообщение, кнопки и медиафайлы
        return { 
          ...block, 
          currentQuestionIndex: newIndex,
          message: currentQuestion.message, // Синхронизируем сообщение с новым вопросом
          buttons: currentQuestion.buttons, // Синхронизируем кнопки с новым вопросом
          mediaFiles: currentQuestion.mediaFiles // Синхронизируем медиафайлы с новым вопросом
        };
      }
      return block;
    }));
  };

  const updateFinalMessage = (blockId, message) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        return { ...block, finalSuccessMessage: message };
      }
      return block;
    }));
  };

  const updateFinalFailureMessage = (blockId, message) => {
    setBlocks(blocks.map(block => {
      if (block.id === blockId) {
        return { ...block, finalFailureMessage: message };
      }
      return block;
    }));
  };

  // Добавить функции updateBlockCommand и updateBlockDescription
  function updateBlockCommand(blockId, command) {
    setBlocks(blocks => blocks.map(b => b.id === blockId ? { ...b, command } : b));
  }
  function updateBlockDescription(blockId, description) {
    setBlocks(blocks => blocks.map(b => b.id === blockId ? { ...b, description } : b));
  }

  // Вспомогательная функция для проверки наличия связи для кнопки
  function hasConnection(blockId, buttonId, connections) {
    return connections.some(conn => String(conn.from.blockId) === String(blockId) && String(conn.from.buttonId) === String(buttonId));
  }

  return (
    <div className="flow-editor">
      <div className="editor-controls">
        <button 
          className="editor-button"
          onClick={() => createBlock('message')}
        >
          💬 Создать сообщение
        </button>
        <div className="editor-dropdown-wrap" style={{ position: 'relative' }}>
          <button 
            className="editor-button"
            onClick={() => setQuizDropdownOpen(!quizDropdownOpen)}
            onBlur={() => setTimeout(() => setQuizDropdownOpen(false), 150)}
          >
            🎯 Создать квиз ▾
          </button>
          {quizDropdownOpen && (
            <div
              className="editor-dropdown"
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
                className="editor-button"
                style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
                onClick={() => { createBlock('quiz'); setQuizDropdownOpen(false); }}
              >
                🎯 Создать квиз
              </button>
              <button
                type="button"
                className="editor-button"
                style={{ display: 'block', width: '100%', textAlign: 'left', borderRadius: 0 }}
                onClick={() => { createTriviaBlock(); setQuizDropdownOpen(false); }}
              >
                🎲 Создать Викторину
              </button>
            </div>
          )}
        </div>
      </div>

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

              // Для викторины — одна точка выхода "trivia_success"; для остальных — кнопка
              let fromX, fromY;
              if (fromBlock.type === 'trivia' && connection.from.buttonId === 'trivia_success') {
                fromX = (fromBlock.position.x + 320) * scale;
                fromY = (fromBlock.position.y + 320) * scale; // под блоком викторины
              } else {
                const button = fromBlock.buttons?.find(b => b.id === connection.from.buttonId);
                if (!button) return null;
                const buttonIndex = fromBlock.buttons.findIndex(b => b.id === button.id);
                const buttonY = fromBlock.position.y + 180 + buttonIndex * 40;
                fromX = (fromBlock.position.x + 320) * scale;
                fromY = buttonY * scale;
              }

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
            {connectingFrom && (() => {
              const fromB = blocks.find(b => b.id === connectingFrom.blockId);
              if (!fromB) return null;
              const isTrivia = fromB.type === 'trivia' && connectingFrom.buttonId === 'trivia_success';
              const fromY = (fromB.position.y + (isTrivia ? 320 : 50)) * scale;
              const fromX = (fromB.position.x + 320) * scale;
              return (
                <path
                  d={`M ${fromX} ${fromY} C ${fromX + 100} ${fromY}, ${mousePosition.x * scale - 100} ${mousePosition.y * scale}, ${mousePosition.x * scale} ${mousePosition.y * scale}`}
                  className="connection-path connection-preview"
                  style={{ opacity: 0.5 }}
                />
              );
            })()}
          </svg>

          {/* Отрисовка блоков */}
          {blocks.map(block => {
            if (block.type === 'quiz') {
              return (
                <div
                  key={block.id}
                  className={`dialog-block quiz ${isConnecting ? 'connecting' : ''}`}
                  style={{
                    left: block.position.x,
                    top: block.position.y,
                    transform: `scale(${1})`
                  }}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, block.id)}
                  onClick={() => isConnecting && finishConnection(block.id)}
                >
                  <QuizBlock
                    block={block}
                    botId={botId}
                    onMessageChange={(message) => updateMessage(block.id, message)}
                    onButtonAdd={() => addButton(block.id)}
                    onButtonRemove={(buttonId) => removeButton(block.id, buttonId)}
                    onButtonUpdate={(buttonId, text) => updateButton(block.id, buttonId, text)}
                    onButtonCorrectToggle={(buttonId) => updateButtonCorrect(block.id, buttonId)}
                    onSuccessMessageChange={(message) => updateQuizSuccessMessage(block.id, message)}
                    onFailureMessageChange={(message) => updateQuizFailureMessage(block.id, message)}
                    onMediaUpload={(e) => handleMediaUpload(block.id, e)}
                    onMediaRemove={(index) => removeMediaFile(block.id, index)}
                    onMediaMove={(index, direction) => moveMediaFile(block.id, index, direction)}
                    onStartConnection={(buttonId, e) => startConnection(block.id, buttonId, e)}
                    onRemoveBlock={() => removeBlock(block.id)}
                    onAddQuestion={() => addQuestion(block.id)}
                    onRemoveQuestion={(questionIndex) => removeQuestion(block.id, questionIndex)}
                    onUpdateCurrentQuestion={(newIndex) => updateCurrentQuestionIndex(block.id, newIndex)}
                    onUpdateFinalMessage={(message) => updateFinalMessage(block.id, message)}
                    onUpdateFinalFailureMessage={(message) => updateFinalFailureMessage(block.id, message)}
                    isConnecting={isConnecting}
                  />
                </div>
              );
            }

            if (block.type === 'trivia') {
              return (
                <div
                  key={block.id}
                  className={`dialog-block trivia ${isConnecting ? 'connecting' : ''}`}
                  style={{
                    left: block.position.x,
                    top: block.position.y,
                    transform: `scale(${1})`
                  }}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, block.id)}
                  onClick={() => isConnecting && finishConnection(block.id)}
                >
                  <TriviaBlock
                    block={block}
                    onMessageChange={(message) => updateMessage(block.id, message)}
                    onCorrectAnswerChange={(value) => updateTriviaField(block.id, 'correctAnswer', value)}
                    onCorrectVariantsChange={(variants) => updateTriviaField(block.id, 'correctAnswerVariants', variants)}
                    onSuccessMessageChange={(value) => updateTriviaField(block.id, 'successMessage', value)}
                    onFailureMessageChange={(value) => updateTriviaField(block.id, 'failureMessage', value)}
                    onMediaUpload={(e) => handleMediaUpload(block.id, e)}
                    onMediaRemove={(index) => removeMediaFile(block.id, index)}
                    onMediaMove={(index, direction) => moveMediaFile(block.id, index, direction)}
                    onStartConnection={(buttonId, e) => startConnection(block.id, buttonId, e)}
                    onRemoveBlock={() => removeBlock(block.id)}
                    isConnecting={isConnecting}
                  />
                </div>
              );
            }

            // Отрисовка обычных блоков остается без изменений
            return (
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
                        value={block.command || ''}
                        onChange={e => updateBlockCommand(block.id, e.target.value)}
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
                        onClick={e => e.stopPropagation()}
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
                        value={block.description || ''}
                        onChange={e => updateBlockDescription(block.id, e.target.value)}
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
                        onClick={e => e.stopPropagation()}
                        maxLength={50}
                      />
                      <span style={{ color: '#888', fontSize: '0.9em' }}>
                        Это описание увидит пользователь в меню Telegram
                      </span>
                    </label>
                  </div>
                </div>

                {/* Блок с ID и кнопкой копирования */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: '#f0f0f0',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  padding: '0.5rem 0.75rem',
                  marginBottom: '0.75rem',
                  fontSize: '0.85em'
                }}>
                  <span style={{ 
                    fontFamily: 'monospace',
                    color: '#555',
                    fontWeight: '500'
                  }}>
                    ID: {block.id}
                  </span>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      const idToCopy = String(block.id);
                      try {
                        await navigator.clipboard.writeText(idToCopy);
                        const btn = e.target;
                        const originalText = btn.textContent;
                        btn.textContent = '✓ Скопировано';
                        btn.style.background = '#4caf50';
                        setTimeout(() => {
                          btn.textContent = originalText;
                          btn.style.background = '';
                        }, 2000);
                      } catch (err) {
                        // Fallback для старых браузеров
                        const textArea = document.createElement('textarea');
                        textArea.value = idToCopy;
                        textArea.style.position = 'fixed';
                        textArea.style.left = '-999999px';
                        document.body.appendChild(textArea);
                        textArea.select();
                        try {
                          document.execCommand('copy');
                          const btn = e.target;
                          const originalText = btn.textContent;
                          btn.textContent = '✓ Скопировано';
                          btn.style.background = '#4caf50';
                          setTimeout(() => {
                            btn.textContent = originalText;
                            btn.style.background = '';
                          }, 2000);
                        } catch (fallbackErr) {
                          console.error('Ошибка копирования:', fallbackErr);
                          alert('Не удалось скопировать ID. ID: ' + idToCopy);
                        }
                        document.body.removeChild(textArea);
                      }
                    }}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#2196f3',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.85em',
                      transition: 'background 0.2s'
                    }}
                    title="Копировать ID"
                  >
                    📋 Копировать
                  </button>
                </div>

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
                                src={`${config.API_BASE_URL}${media.path}`} 
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
                  {/* Предупреждение для блоков без кнопок */}
                  {block.id !== 'start' && (!block.buttons || block.buttons.length === 0) && (
                    <div className="no-buttons-warning" style={{ 
                      background: '#ffebee', 
                      border: '2px solid #f44336', 
                      borderRadius: '6px', 
                      padding: '8px', 
                      margin: '4px 0',
                      color: '#c62828',
                      fontSize: '12px',
                      textAlign: 'center'
                    }}>
                      ⚠️ Блок без кнопок!<br/>
                      Пользователи не смогут перейти дальше
                    </div>
                  )}
                  
                  {block.buttons.map(button => {
                    const noConnection = block.id === 'start' && !hasConnection(block.id, button.id, connections);
                    return (
                      <div key={button.id} className="button-item" style={noConnection ? { border: '2px solid red', borderRadius: 6 } : {}}>
                        <div className="button-item-row">
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
                        </div>
                        <input
                          type="url"
                          value={button.url || ''}
                          onChange={(e) => updateButtonUrl(block.id, button.id, e.target.value)}
                          placeholder="Ссылка (необязательно)"
                          title={button.url || 'Добавить ссылку'}
                          onClick={(e) => e.stopPropagation()}
                          className={button.url ? 'has-url' : ''}
                        />
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
                        {noConnection && (
                          <div style={{ color: 'red', fontSize: 12, marginTop: 4 }}>
                            Нет связи: кнопка не ведёт никуда!
                          </div>
                        )}
                      </div>
                    );
                  })}
                  
                  {/* Информация о кнопке "Назад" */}
                  {block.id !== 'start' && (
                    <div className="back-button-info">
                      <span className="info-text">
                        ⬅️ Кнопка "Назад" будет автоматически добавлена в Telegram
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default FlowEditor; 