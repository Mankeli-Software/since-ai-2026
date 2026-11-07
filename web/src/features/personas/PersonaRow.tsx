import { ownFittingHref, PERSONAS, personaHref } from './personas'

const link =
  'inline-block px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

export function PersonaRow() {
  return (
    <section aria-labelledby="try-as">
      <h2 id="try-as" className="font-display text-3xl font-bold uppercase">Try it as a golfer</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        These four golfers are simulated. They are not real customers. Pick one and talk to the fitter as that golfer.
      </p>
      <ul className="mt-6 grid grid-cols-4 gap-4">
        {PERSONAS.map((p) => (
          <li key={p.id} className="flex flex-col border border-border bg-white p-4">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Simulated golfer</span>
            <h3 className="mt-1 font-display text-2xl font-bold">{p.name}, {p.age}</h3>
            <p className="mt-2 flex-1">{p.teaser}</p>
            <a className={`${link} mt-4 bg-primary text-primary-foreground`} href={personaHref(p)}>
              Try as {p.name}
            </a>
          </li>
        ))}
      </ul>
      <a className={`${link} mt-6 bg-accent text-accent-foreground`} href={ownFittingHref}>
        Start my own fitting
      </a>
    </section>
  )
}
