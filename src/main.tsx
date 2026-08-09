import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './app/App'
import { LifeLabProvider } from './app/LifeLabContext'
import './styles/global.css'
import './styles/tokens.css'
import './styles/color-palette.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <LifeLabProvider>
        <App />
      </LifeLabProvider>
    </BrowserRouter>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js')
  })
}
