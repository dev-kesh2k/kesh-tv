import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import './index.css';
import { installSpatialNav } from './spatial';
import { applyPlatformClasses } from './platform';
import { installTvScale } from './tvScale';

applyPlatformClasses();
installTvScale();
installSpatialNav();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// PWA: guarda o app para abrir rápido e sem internet (só no site publicado, não no modo de desenvolvimento).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
