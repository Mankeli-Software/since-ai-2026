import { Button } from '@/components/studio'
import { ownFittingHref, PERSONAS, personaHref } from './personas'

/** Sits on a dark surface (landing hero, studio start). */
export function PersonaRow() {
  return (
    <section aria-labelledby="try-as">
      <h2 id="try-as" className="font-display text-3xl font-bold uppercase tracking-wide">Try it as a golfer</h2>
      <p className="mt-2 max-w-2xl text-ink-300">
        These four golfers are simulated. They are not real customers. Pick one and talk to the fitter as that golfer.
      </p>
      <ul className="mt-6 grid grid-cols-4 gap-4">
        {PERSONAS.map((p) => (
          <li key={p.id} className="flex flex-col border border-border-dark bg-surface-dark-2 p-5 transition-colors hover:border-orange-300">
            <span className="self-start border border-orange-300 px-2 py-0.5 font-display text-xs font-semibold uppercase tracking-wider text-orange-300">
              Simulated golfer
            </span>
            <h3 className="mt-4 font-display text-3xl font-bold uppercase">{p.name}, {p.age}</h3>
            <p className="mt-2 flex-1 text-ink-300">{p.teaser}</p>
            <Button href={personaHref(p)} variant="lightOnDark" size="sm" className="mt-5">
              Try as {p.name}
            </Button>
          </li>
        ))}
      </ul>
      <Button href={ownFittingHref} variant="primary" size="md" className="mt-8">
        Start my own fitting
      </Button>
    </section>
  )
}
