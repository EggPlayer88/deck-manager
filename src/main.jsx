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

/* window._SUPABASE를 먼저 설정한 뒤 deck-manager를 동적으로 import
   → ES 모듈 호이스팅으로 인해 정적 import시 supabase가 null로 인식되는 문제 해결 */
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

import('./deck-manager.jsx').then(function(module) {
  var App = module.default;
  ReactDOM.createRoot(document.getElementById('root')).render(
    React.createElement(App)
  );
});
