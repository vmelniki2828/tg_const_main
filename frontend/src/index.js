import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import AdminShell from './components/AdminShell';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminShell><App /></AdminShell>
  </React.StrictMode>
);
