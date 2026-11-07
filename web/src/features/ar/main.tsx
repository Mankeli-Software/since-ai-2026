import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/theme.css'
import { arHead, headLabel } from './heads'

const slug = arHead(new URLSearchParams(location.search).get('head'))
const base = `/assets/clubs/ar/${slug}`
const inFrame = window.self !== window.top

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="flex min-h-screen flex-col gap-4 bg-background p-4">
      <h1 className="font-display text-3xl font-semibold uppercase">{headLabel(slug)}</h1>
      {inFrame ? (
        <a href={location.href} target="_top" className="font-display text-lg font-semibold uppercase text-orange-ink underline">
          Open in AR (new page)
        </a>
      ) : (
        <model-viewer
          src={`${base}.glb`}
          ios-src={`${base}.usdz`}
          alt={`${headLabel(slug)} 3D model`}
          ar
          ar-modes="webxr scene-viewer quick-look"
          camera-controls
          shadow-intensity="1"
          style={{ width: '100%', height: '70vh', background: 'var(--color-card)', borderRadius: 8 }}
        >
          <button
            slot="ar-button"
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-ink-900 px-5 py-3 font-display text-sm font-semibold uppercase tracking-[0.1em] text-washed-white"
          >
            View in your space
          </button>
        </model-viewer>
      )}
      <p className="text-sm text-ink-500">AR works on a phone. Synthetic preview model, not a scan.</p>
    </main>
  </StrictMode>,
)
