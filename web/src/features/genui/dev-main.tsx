import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/theme.css'

// Placeholder: the gen-UI block and stage preset gallery (WEB-APP) goes here.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="p-8">
      <h1 className="font-display text-3xl font-bold uppercase">Dev gallery</h1>
      <p>Placeholder: gen-UI blocks and stage presets.</p>
    </main>
  </StrictMode>,
)
