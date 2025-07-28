import React, { useState } from 'react';
import './PromoCodeUploader.css';
import config from '../config';

const PromoCodeUploader = ({ onClose }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Проверяем, что это CSV файл
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError('');
        setMessage('');
      } else {
        setError('Пожалуйста, выберите CSV файл');
        setFile(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Пожалуйста, выберите файл');
      return;
    }

    setIsUploading(true);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('promocodes', file);

    try {
      const response = await fetch(`${config.API_BASE_URL}/api/upload-promocodes`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ ${data.message}`);
        setFile(null);
        // Очищаем input
        document.getElementById('file-input').value = '';
      } else {
        setError(`❌ ${data.error || 'Ошибка загрузки файла'}`);
      }
    } catch (err) {
      setError('❌ Ошибка соединения с сервером');
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="promo-uploader-overlay">
      <div className="promo-uploader-modal">
        <div className="promo-uploader-header">
          <h2>🎁 Загрузка промокодов</h2>
          <button onClick={onClose} className="close-btn">
            ✕
          </button>
        </div>

        <div className="promo-uploader-content">
          <div className="upload-instructions">
            <h3>Инструкции:</h3>
            <ul>
              <li>Файл должен быть в формате CSV</li>
              <li>Структура файла: <code>Code, User, Activated</code></li>
              <li>Первый столбец - код промокода</li>
              <li>Второй столбец - пользователь (может быть пустым)</li>
              <li>Третий столбец - статус активации (0 - не активирован, 1 - активирован)</li>
            </ul>
          </div>

          <div className="file-upload-section">
            <input
              id="file-input"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="file-input"
            />
            <label htmlFor="file-input" className="file-input-label">
              {file ? `📁 ${file.name}` : '📁 Выберите CSV файл'}
            </label>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {message && (
            <div className="success-message">
              {message}
            </div>
          )}

          <div className="upload-actions">
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="upload-btn"
            >
              {isUploading ? '⏳ Загрузка...' : '🚀 Загрузить промокоды'}
            </button>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="cancel-btn"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromoCodeUploader; 