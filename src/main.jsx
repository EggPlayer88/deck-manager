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
  saveGlobalPlayers,
  deleteGlobalPlayer,
  uploadPlayerPhoto,
  listPlayerPhotos,
  deletePlayerPhoto,
  listAllPhotos,
  getTeamLogoUrl,
  uploadTeamLogo,
} from './supabase.js';

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
  saveGlobalPlayers,
  deleteGlobalPlayer,
  uploadPlayerPhoto,
  listPlayerPhotos,
  deletePlayerPhoto,
  listAllPhotos,
  getTeamLogoUrl,
  uploadTeamLogo,
};

import('./deck-manager.jsx').then(function(module) {
  var App = module.default;
  ReactDOM.createRoot(document.getElementById('root')).render(
    React.createElement(App)
  );
});
