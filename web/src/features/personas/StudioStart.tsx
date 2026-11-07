import { PersonaRow } from './PersonaRow'

export function StudioStart() {
  return (
    <main className="mx-auto max-w-6xl p-12">
      <h1 className="font-display text-5xl font-bold uppercase">Who is getting fitted?</h1>
      <p className="mb-10 mt-3 max-w-2xl">Start your own fitting, or try a simulated golfer first.</p>
      <PersonaRow />
    </main>
  )
}
