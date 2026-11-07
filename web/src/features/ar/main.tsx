import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/theme.css'

// Placeholder: model-viewer AR page (#20), `?head=201-mkii`.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="p-8">AR placeholder</main>
  </StrictMode>,
)
