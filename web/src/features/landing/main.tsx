import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/theme.css'
import { ownFittingHref } from '../personas/personas'
import { PersonaRow } from '../personas/PersonaRow'

const cta =
  'inline-block bg-accent px-6 py-3 font-display text-lg font-semibold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-orange-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="min-h-screen bg-surface-dark bg-[radial-gradient(ellipse_at_80%_0%,var(--color-surface-dark-3),transparent_50%)] text-washed-white">
      <main className="mx-auto max-w-6xl px-12 py-16">
        <header className="pb-4">
          <p className="font-display text-lg font-bold uppercase tracking-[0.3em]">Takomo Golf</p>
          <h1 className="mt-8 max-w-4xl font-display text-8xl font-bold uppercase leading-[0.9]">The fitter in your pocket</h1>
          <p className="mt-3 font-display text-xl font-medium uppercase tracking-[0.2em] text-orange-300">Honestly better golf</p>
          <p className="mt-6 max-w-2xl text-lg text-ink-300">
            Tell the fitter about your game. Add your own launch monitor data if you have it. Get a Takomo irons spec
            that you can check, with the reasons shown.
          </p>
          <a className={`${cta} mt-8`} href={ownFittingHref}>Start my own fitting</a>
        </header>
        <section className="mt-16 grid grid-cols-3 gap-8 border-t border-border-dark pt-10" aria-label="How it works">
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Numbers, not guesses</h2>
            <p className="mt-2 text-ink-300">The fit comes from a fixed rule set. Every number traces back to what you told us or measured.</p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Close calls shown</h2>
            <p className="mt-2 text-ink-300">When two options are nearly equal, we say so and show the trade-offs.</p>
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide">Custom is final</h2>
            <p className="mt-2 text-ink-300">Stock sets have a 30-day return. Custom sets do not. We tell you before you decide.</p>
          </div>
        </section>
        <div className="mt-16 border-t border-border-dark pt-10"><PersonaRow /></div>
      </main>
    </div>,
  </StrictMode>,
)
