import './storage-polyfill.js';
import React from 'react';
import ReactDOM from 'react-dom/client';
import {
  supabase,
  signInWithGoogle,
  signOut,
  getSession,
  getProfile,
  loadUserData,
  saveUserData,
  loadGlobalSkills,
  saveGlobalSkills,
  loadGlobalPlayers,
  saveGlobalPlayer,
  deleteGlobalPlayer,
} from './supabase.js';

/* Inject supabase functions into global scope for deck-manager.jsx */
window._SUPABASE = {
  supabase,
  signInWithGoogle,
  signOut,
  getSession,
  getProfile,
  loadUserData,
  saveUserData,
  loadGlobalSkills,
  saveGlobalSkills,
  loadGlobalPlayers,
  saveGlobalPlayer,
  deleteGlobalPlayer,
};

import App from './deck-manager.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(App)
);
