import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initTheme } from '@/lib/theme'
import '@/styles/theme.css'
import { Studio } from './Studio'

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Studio />
  </StrictMode>,
)
