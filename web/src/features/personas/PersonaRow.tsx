import { Button } from '@/components/studio'
import { ownFittingHref, PERSONAS, personaHref } from './personas'

/** Sits on a dark surface (landing hero, studio start). */
export function PersonaRow() {
  return (
    <section aria-labelledby="try-as">
      <h2 id="try-as" className="font-display text-3xl font-bold uppercase tracking-wide">Try a simulated golfer</h2>
      <p className="mt-2 max-w-2xl text-on-page-2">
        Four simulated golfers, zero marketing fluff. No real customer data harmed. Pick a profile to see how the fitter handles ego, weird strikes, and close calls.
      </p>
      <ul className="mt-6 grid grid-cols-4 gap-4">
        {PERSONAS.map((p) => (
          <li key={p.id} className="flex flex-col border border-page-line bg-panel p-5 transition-colors hover:border-orange-on-page">
            <span className="self-start border border-orange-on-page px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-wider text-orange-on-page">
              Simulated golfer
            </span>
            <h3 className="mt-4 font-display text-3xl font-bold uppercase">{p.name}, {p.age}</h3>
            <p className="mt-2 flex-1 text-on-page-2">{p.teaser}</p>
            <Button href={personaHref(p)} variant="outline" size="sm" className="mt-5">
              Try as {p.name}
            </Button>
          </li>
        ))}
      </ul>
      <Button href={ownFittingHref} variant="primary" size="md" className="mt-8">
        Start my fitting
      </Button>
    </section>
  )
}
