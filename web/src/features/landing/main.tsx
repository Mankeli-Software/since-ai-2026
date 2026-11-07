import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/theme.css'

// Placeholder: WEB-APP (#37) builds the real landing page and the "Try as" picker.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="mx-auto max-w-2xl p-12">
      <h1 className="font-display text-5xl font-bold uppercase">The fitter in your pocket</h1>
      <p className="mt-4">Placeholder landing page.</p>
      <a className="mt-8 inline-block bg-tiger-orange px-6 py-3 font-semibold" href="/studio.html?demo=DEMO-01">
        Open the studio
      </a>
    </main>
  </StrictMode>,
)
