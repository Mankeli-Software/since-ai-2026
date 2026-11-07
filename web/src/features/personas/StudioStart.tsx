import { PersonaRow } from './PersonaRow'

export function StudioStart() {
  return (
    <div className="min-h-screen bg-page text-on-page">
      <main className="mx-auto max-w-6xl px-12 py-16">
        <p className="font-display text-lg font-bold uppercase tracking-[0.3em]">Takomo</p>
        <h1 className="mt-6 font-display text-6xl font-bold uppercase leading-none">Who's on the tee?</h1>
        <p className="mb-12 mt-4 max-w-2xl text-lg text-on-page-2">Start with your own bag, or test-drive the studio with a simulated golfer first.</p>
        <PersonaRow />
      </main>
    </div>
  )
}
