import forge from '../../../../fixtures/forge_topics.json'
import videos from '../../../../fixtures/product_videos.json'
import { Button } from '@/components/ui/button'

const topics = forge as Record<string, { title: string; blurb: string }>
const vids = videos as Record<string, { youtube_id: string; start_s: number; title: string }>

export function DriverTeaserView() {
  return (
    <section className="rounded-lg border border-border bg-muted p-4">
      <h3 className="font-display text-2xl uppercase">Driver fitting is next</h3>
      <p className="text-sm text-muted-foreground">Irons first. Drivers follow.</p>
    </section>
  )
}

export function ForgeCtaView({ topic }: { topic: string }) {
  const t = topics[topic]
  if (!t) return null
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4">
      <h3 className="font-semibold">{t.title}</h3>
      <p className="text-sm">{t.blurb}</p>
      <Button variant="secondary" className="self-start">Go deeper in Forge</Button>
    </section>
  )
}

export function ProductVideoView({ head }: { head: string }) {
  const v = vids[head]
  if (!v) return null
  return (
    <iframe
      className="aspect-video w-full rounded-lg border border-border"
      title={v.title}
      src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube_id)}?start=${Math.max(0, Math.floor(v.start_s))}`}
      allow="encrypted-media; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
    />
  )
}
