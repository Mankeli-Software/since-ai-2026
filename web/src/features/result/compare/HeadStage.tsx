import { ClubModel } from '@/features/stage3d/ClubModel'
import { headName } from '../specLabel'

/**
 * R3 stage panel: the selected head in 3D over a faint copy of the other one (opacity .16, offset), on the
 * orange-glow panel. Both sway on the same clock, so the faint head moves with the selected one.
 */
export function HeadStage({ selected, other }: { selected: string; other: string | null }) {
  return (
    <figure className="relative m-0 flex min-h-[240px] items-center justify-center overflow-hidden rounded-16 border border-grey-26 bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgba(255,110,1,.18),#121212_70%)]">
      {other && <ClubModel slug={other} className="absolute inset-0 aspect-auto -translate-x-3.5 -translate-y-1.5 opacity-[.16]" />}
      <ClubModel
        slug={selected}
        alt={headName(selected)}
        className="absolute inset-0 aspect-auto drop-shadow-[0_30px_40px_rgba(0,0,0,.7)]"
      />
      {other && (
        <figcaption className="absolute right-3 bottom-2.5 left-3 text-[12px] text-grey-8f">
          Faint head is the {headName(other)} for comparison
        </figcaption>
      )}
    </figure>
  )
}
