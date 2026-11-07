import forge from '../../../../fixtures/forge_topics.json'
import videos from '../../../../fixtures/product_videos.json'
import { Button } from '@/components/ui/button'
import { btnCls, cardCls, eyebrowCls } from '../genui/ui'

const topics = forge as Record<string, { title: string; blurb: string }>
const vids = videos as Record<string, { youtube_id: string; start_s?: number; title: string }>

export function DriverTeaserView() {
  return (
    <section className="flex flex-col gap-1.5 rounded-lg bg-surface-dark px-5 py-4 text-washed-white">
      <span className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">Coming next</span>
      <h3 className="font-display text-3xl uppercase leading-none">Driver fitting is coming next</h3>
      <p className="text-sm text-ink-300">Scoring irons first. Takomo Ignis driver fittings follow soon.</p>
    </section>
  )
}

export function ForgeCtaView({ topic }: { topic: string }) {
  const t = topics[topic]
  if (!t) return null
  return (
    <section className={`${cardCls} gap-2`}>
      <span className={eyebrowCls}>Takomo Forge</span>
      <h3 className="font-display text-2xl uppercase leading-tight">{t.title}</h3>
      <p className="text-sm text-ink-700">{t.blurb}</p>
      <Button variant="outline" className={`mt-1 self-start ${btnCls}`}>Read equipment breakdown →</Button>
    </section>
  )
}

export function ProductVideoView({ head }: { head: string }) {
  const v = vids[head]
  if (!v) return null
  return (
    <iframe
      className="aspect-video w-full rounded-lg border border-border bg-surface-dark"
      title={v.title}
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube_id)}?start=${Math.max(0, Math.floor(v.start_s ?? 0))}`}
      allow="encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  )
}
