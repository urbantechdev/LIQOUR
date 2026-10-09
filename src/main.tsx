import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  const isBrowserExtensionNoise = (val: unknown): boolean => {
    const message =
      typeof val === 'string'
        ? val
        : (val as {message?: string; stack?: string})?.message ||
          (val as {stack?: string})?.stack ||
          String(val || '');
    return (
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist') ||
      message.includes('chrome.runtime.sendMessage') ||
      message.includes('sendMessage timed out') ||
      message.includes('Extension context invalidated') ||
      message.includes('message port closed') ||
      message.includes('chrome-extension://') ||
      message.includes('WebSocket closed without opened') ||
      message.includes('failed to connect to websocket') ||
      message.includes('SendBeforeConnectError') ||
      message.includes('send was called before connect') ||
      message.includes('vite-pwa-plugin:dev-ready')
    );
  };

  window.addEventListener(
    'unhandledrejection',
    (event) => {
      if (isBrowserExtensionNoise(event?.reason)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener(
    'error',
    (event) => {
      if (
        isBrowserExtensionNoise(event?.message) ||
        isBrowserExtensionNoise(event?.error) ||
        isBrowserExtensionNoise(event?.filename)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  // Purge stale service worker precaches when version changes so latest auth whitelist is active immediately
  try {
    const CACHE_VER_KEY = 'vaairo_sw_cache_version';
    const CURRENT_CACHE_VER = 'v2026-10-07-superadmin-v4';
    if (window.localStorage && window.localStorage.getItem(CACHE_VER_KEY) !== CURRENT_CACHE_VER) {
      window.localStorage.setItem(CACHE_VER_KEY, CURRENT_CACHE_VER);
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((k) => {
            if (k.includes('workbox') || k.includes('precache')) {
              caches.delete(k).catch(() => {});
            }
          });
        }).catch(() => {});
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach((reg) => reg.update().catch(() => {}));
        }).catch(() => {});
      }
    }
  } catch {
    // Ignore storage errors
  }

  // Register PWA Service Worker with auto-update
  try {
    registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        if (registration) {
          registration.update().catch(() => {});
        }
      },
      onRegisterError() {
        // Ignore service worker registration warnings in restricted preview contexts
      },
    });
  } catch {
    // Ignore synchronous registration errors
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
