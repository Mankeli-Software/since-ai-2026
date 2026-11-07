import { useNumberKeys } from '@/components/studio'
import { cn } from '@/lib/utils'
import type { BlockProps } from '../types'

export const type = 'source_picker'

interface Tile {
  id: string
  name: string
  hint: string
  fallback: boolean
}

function CameraIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0B0B0B" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

/** C3a / C4b: where the data comes from. Tiles + dashed fallback; a tap (or number key) sends the id at once. */
export function Component({ block, interactive, answer, busy, respond }: BlockProps<'source_picker'>) {
  const tiles: Tile[] = [
    ...block.options.map((o) => ({ id: o.id, name: o.name, hint: o.hint, fallback: false })),
    ...(block.fallback ? [{ id: block.fallback.id, name: block.fallback.title, hint: block.fallback.body, fallback: true }] : []),
  ]
  const live = interactive && !answer
  const pick = (i: number) => respond(tiles[i].id, tiles[i].name)
  useNumberKeys(tiles.length, pick, live && !busy)

  if (!live) {
    const picked = tiles.find((t) => t.id === answer?.value)
    return (
      <p className="m-0 text-[15px] text-grey-55">
        {block.prompt}{' '}
        <strong className="font-semibold text-midnight">{picked?.name ?? answer?.displayText ?? 'Not answered'}</strong>
      </p>
    )
  }

  const stats = block.preview_stats ?? []
  // C3a (with the preview strip) uses the smaller tile; C4b the larger one.
  const compact = stats.length > 0

  return (
    <div className="flex flex-col gap-[18px]">
      {stats.length > 0 && (
        <div className="flex items-center gap-5 rounded-14 bg-midnight px-[18px] py-3.5 text-washed-white">
          <span className="flex-1 text-[15px] leading-[1.45] text-grey-c8">{block.preview_lead}</span>
          {stats.map((s) => (
            <div key={`${s.value}-${s.label}`} className="flex flex-col gap-0.5">
              <span className="font-display text-[30px] font-extrabold tabular-nums">{s.value}</span>
              <span className="text-[13px] text-grey-8f">{s.label}</span>
            </div>
          ))}
        </div>
      )}
      <div role="group" aria-label={block.prompt} className="grid grid-cols-3 gap-3">
        {tiles.map((t, i) => {
          const photo = t.fallback && t.id.includes('photo')
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={false}
              aria-keyshortcuts={i < 9 ? String(i + 1) : undefined}
              aria-label={photo ? `${t.name}. ${t.hint}` : undefined}
              title={photo ? t.hint : undefined}
              disabled={busy}
              onClick={() => pick(i)}
              className={cn(
                'flex cursor-pointer flex-col items-start justify-between rounded-14 border p-[18px] text-left text-midnight transition-ui disabled:cursor-not-allowed disabled:opacity-50',
                compact ? 'min-h-[110px] gap-4' : 'min-h-[118px] gap-[18px]',
                t.fallback
                  ? 'border-dashed border-grey-c8 bg-washed-white enabled:hover:border-grey-8f'
                  : 'border-grey-d9 bg-white enabled:hover:border-midnight',
              )}
            >
              {photo ? (
                <CameraIcon />
              ) : (
                <span
                  className={cn(
                    'font-display font-extrabold',
                    compact ? 'text-[26px]' : 'text-[28px]',
                    !t.fallback && 'tracking-[0.02em]',
                  )}
                >
                  {t.name}
                </span>
              )}
              <span className="text-[14px] text-grey-55">{photo ? t.name : t.hint}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
