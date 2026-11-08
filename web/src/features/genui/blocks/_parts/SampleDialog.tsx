import { useEffect, useId, useRef } from 'react'
import { Button, Eyebrow, OptTile, useNumberKeys } from '@/components/studio'

export interface SampleOption {
  id: string
  label: string
  /** One short line under the label. */
  sub?: string
}

/**
 * #216: the upload buttons open this instead of the OS file picker. It lists simulated options (sample sessions,
 * photo reads); picking one closes it and the card runs its normal import path. Native `<dialog>` + `showModal()`:
 * focus stays inside, Esc and a backdrop click close it. Number keys 1-9 pick while it is open.
 * Every option carries the "Simulated" tag (L6, invariant 11).
 */
export function SampleDialog({ open, title, note, options, empty, onPick, onClose }: {
  open: boolean
  title: string
  /** One line under the title, e.g. "Nothing is uploaded from your computer." */
  note: string
  options: SampleOption[]
  /** Shown when there are no options. */
  empty?: string
  onPick: (index: number) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])
  useNumberKeys(options.length, onPick, open)

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // The dialog box has no padding of its own, so a click on the dialog element itself is the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-20 border-0 bg-washed-white p-0 font-sans text-midnight shadow-card ring-1 ring-card-edge backdrop:bg-[rgba(11,11,11,.6)]"
    >
      {open && (
        <div className="flex flex-col gap-[18px] px-[30px] pt-[26px] pb-7">
          <div className="flex flex-col gap-1.5">
            <h2 id={titleId} className="m-0 text-[20px] leading-snug font-semibold">{title}</h2>
            <p className="m-0 text-[15px] text-grey-55">{note}</p>
          </div>
          {options.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {options.map((o, i) => (
                <li key={o.id}>
                  <OptTile kbd={i < 9 ? i + 1 : undefined} aria-keyshortcuts={i < 9 ? String(i + 1) : undefined} className="w-full py-2.5" onClick={() => onPick(i)}>
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {o.label}
                      <span className="rounded-4 bg-grey-ed px-1.5 py-0.5 text-[11px] font-semibold text-grey-44">Simulated</span>
                    </span>
                    {o.sub && <span className="block text-[14px] leading-snug font-normal text-grey-55">{o.sub}</span>}
                  </OptTile>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[15px] text-grey-44">{empty ?? 'Nothing to pick right now.'}</p>
          )}
          <div className="flex items-center justify-between gap-3 border-t border-grey-e4 pt-3.5">
            <Eyebrow size={11} className="text-grey-8f">Esc closes</Eyebrow>
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      )}
    </dialog>
  )
}
