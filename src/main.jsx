import './storage-polyfill.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './deck-manager.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(App)
);
