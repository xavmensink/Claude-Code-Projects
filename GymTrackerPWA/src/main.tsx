import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Reload once when an updated service worker takes control so the running
// app swaps to the new version instead of staying on stale cached code.
if ('serviceWorker' in navigator) {
  let reloaded = false
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return
    reloaded = true
    location.reload()
  })

  // iOS resumes PWAs from memory rather than relaunching, so also check for
  // updates whenever the app returns to the foreground.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      navigator.serviceWorker.getRegistration().then(reg => reg?.update()).catch(() => {})
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
