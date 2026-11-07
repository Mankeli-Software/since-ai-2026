import type { ReactNode } from 'react'
import { Eyebrow } from '@/components/studio'

/** R2 chart panel (spec §6): bg #121212, border #262626, r16, padding 18/22, eyebrow #A3A3A3. */
export function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-16 border border-page-line bg-panel px-[22px] py-[18px] text-on-page">
      <Eyebrow className="text-on-page-2">{title}</Eyebrow>
      {children}
    </div>
  )
}
