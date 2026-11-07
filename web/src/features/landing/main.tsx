import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles/theme.css'
import { ownFittingHref } from '../personas/personas'
import { PersonaRow } from '../personas/PersonaRow'

const cta =
  'inline-block bg-accent px-6 py-3 font-semibold text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main className="mx-auto max-w-6xl px-12 py-16">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide">Takomo Golf</p>
        <h1 className="mt-4 max-w-3xl font-display text-7xl font-bold uppercase leading-none">The fitter in your pocket</h1>
        <p className="mt-6 max-w-2xl text-lg">
          Tell the fitter about your game. Add your own launch monitor data if you have it. Get a Takomo irons spec
          that you can check, with the reasons shown.
        </p>
        <a className={`${cta} mt-8`} href={ownFittingHref}>Start my own fitting</a>
      </header>
      <section className="mt-16 grid grid-cols-3 gap-8" aria-label="How it works">
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">Numbers, not guesses</h2>
          <p className="mt-2">The fit comes from a fixed rule set. Every number traces back to what you told us or measured.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">Close calls shown</h2>
          <p className="mt-2">When two options are nearly equal, we say so and show the trade-offs.</p>
        </div>
        <div>
          <h2 className="font-display text-2xl font-bold uppercase">Custom is final</h2>
          <p className="mt-2">Stock sets have a 30-day return. Custom sets do not. We tell you before you decide.</p>
        </div>
      </section>
      <div className="mt-16"><PersonaRow /></div>
    </main>
  </StrictMode>,
)
