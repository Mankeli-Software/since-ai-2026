import { Eyebrow } from '@/components/studio'

/** A titled empty panel for a results view that is still to come (T4a/T4b replace the view files). */
export function ViewPlaceholder({ eyebrow, title, note }: { eyebrow: string; title: string; note: string }) {
  return (
    <section className="flex flex-1 flex-col items-start justify-center gap-3 rounded-16 border border-dashed border-grey-3d bg-grey-12 p-10">
      <Eyebrow className="text-orange-hover">{eyebrow}</Eyebrow>
      <h1 className="m-0 font-display text-[44px] leading-[.9] font-extrabold uppercase">{title}</h1>
      <p className="m-0 max-w-[560px] text-[17px] leading-[1.5] text-grey-a3">{note}</p>
    </section>
  )
}
