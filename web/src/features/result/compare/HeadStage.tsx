import { ClubImage } from '@/components/studio'
import { headName } from '../specLabel'

/**
 * R3 stage panel: the selected head over a faint copy of the other one (opacity .16, offset), on the
 * orange-glow panel. Product photos, not the 3D rig, so there is no "3D" badge.
 */
export function HeadStage({ selected, other }: { selected: string; other: string | null }) {
  return (
    <figure className="relative m-0 flex min-h-[240px] items-center justify-center overflow-hidden rounded-16 border border-grey-26 bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,rgba(255,110,1,.18),#121212_70%)]">
      {other && (
        <ClubImage
          key={`faint-${other}`}
          slug={other}
          className="absolute h-[200px] w-auto -translate-x-3.5 -translate-y-1.5 opacity-[.16]"
        />
      )}
      <ClubImage
        key={selected}
        slug={selected}
        alt={headName(selected)}
        className="relative h-[210px] w-auto drop-shadow-[0_30px_40px_rgba(0,0,0,.7)]"
      />
      {other && (
        <figcaption className="absolute right-3 bottom-2.5 left-3 text-[12px] text-grey-8f">
          Faint head is the {headName(other)} for comparison
        </figcaption>
      )}
    </figure>
  )
}
