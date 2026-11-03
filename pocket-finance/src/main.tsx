import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/rubik/hebrew-400.css'
import '@fontsource/rubik/hebrew-500.css'
import '@fontsource/rubik/hebrew-700.css'
import '@fontsource/rubik/latin-400.css'
import '@fontsource/rubik/latin-500.css'
import '@fontsource/rubik/latin-700.css'
import 'katex/dist/katex.min.css'
import './styles.css'
import App from './App'
import { StoreProvider } from './lib/store'

// Service Worker: שומר מראש את כל הקבצים, כך שהאפליקציה עובדת אופליין מהפתיחה הראשונה
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
