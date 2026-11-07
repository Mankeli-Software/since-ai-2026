import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { initTheme } from '@/lib/theme'
import '@/styles/theme.css'
import type { UIBlock } from '@/api/client'
import { Gallery } from '@/components/studio/Gallery'
import { hasFlag } from '@/lib/flags'
import ResultsShell from '../result/ResultsShell'
import { GenUiBlock } from './GenUiBlock'
import { registry } from './registry'

// All fixtures/ui/*.json, one block each (plan §6.4). @fixtures is set in vite.config.ts.
const files = import.meta.glob<UIBlock>('@fixtures/ui/*.json', { eager: true, import: 'default' })
const fixtures = Object.values(files)
const fixtureTypes = new Set(fixtures.map((f) => f.type))

const problems = [
  ...fixtures.filter((f) => !registry.has(f.type)).map((f) => `Fixture "${f.type}" has no block file`),
  ...[...registry.keys()].filter((t) => !fixtureTypes.has(t as UIBlock['type'])).map((t) => `Block "${t}" has no fixture`),
]

function App() {
  const [log, setLog] = useState<{ type: string; value: unknown; text: string }[]>([])
  return (
    <main className="mx-auto grid max-w-6xl gap-6 p-8 lg:grid-cols-[1fr_20rem]">
      <section className="flex flex-col gap-4">
        <h1 className="font-display text-3xl font-bold uppercase">Dev gallery</h1>
        {problems.length > 0 && (
          <ul className="rounded-md border border-destructive p-3 text-sm text-destructive">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {fixtures.map((block) => (
          <article key={block.type} className="rounded-lg border border-border bg-background p-4">
            <h2 className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.14em] text-ink-500">{block.type}</h2>
            <GenUiBlock
              id={`dev-${block.type}`}
              block={block}
              interactive
              busy={false}
              respond={(value, text) => setLog((l) => [{ type: block.type, value, text }, ...l])}
            />
          </article>
        ))}
      </section>
      <aside className="sticky top-8 h-fit rounded-lg border border-border bg-background p-4">
        <h2 className="mb-2 font-semibold">respond() log</h2>
        {log.length === 0 && <p className="text-sm text-muted-foreground">Interact with a block.</p>}
        {log.map((e, i) => (
          <div key={i} className="mb-3 text-xs">
            <p className="font-mono font-bold">{e.type}: {e.text}</p>
            <pre className="overflow-x-auto bg-muted p-2">{JSON.stringify(e.value, null, 1)}</pre>
          </div>
        ))}
      </aside>
    </main>
  )
}

initTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>{hasFlag('primitives') ? <Gallery /> : hasFlag('results') ? <ResultsShell fixture /> : <App />}</StrictMode>,
)
