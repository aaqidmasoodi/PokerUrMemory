import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { PortraitOverlay } from './components/PortraitOverlay'
import './index.css'

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {/* sw optional */});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <PortraitOverlay />
  </StrictMode>,
)
