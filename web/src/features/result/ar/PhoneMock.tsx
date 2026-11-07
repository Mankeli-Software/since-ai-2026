import { ClubImage } from '@/components/studio'
import { headName } from '../specLabel'

/** R4 phone mock (V3-R4-AR): 300×500 phone, room gradient with a striped floor, the head tilted at -14°, a pill. */
export function PhoneMock({ head }: { head: string }) {
  const name = headName(head)
  return (
    <div className="relative h-[500px] w-[300px] flex-none overflow-hidden rounded-40 border-8 border-grey-26 bg-midnight shadow-[0_40px_80px_rgba(0,0,0,.6)]">
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,#6B6157_0%,#8C7E6E_45%,#5B4F43_100%)]" />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-[52%] bottom-0 bg-[repeating-linear-gradient(90deg,rgba(0,0,0,.08)_0_40px,transparent_40px_80px),linear-gradient(180deg,#7A6A58,#4E4236)]"
      />
      <ClubImage
        slug={head}
        alt={`${name} placed in a room in AR`}
        className="absolute top-[170px] left-[30px] h-[250px] w-auto max-w-none -rotate-[14deg] drop-shadow-[10px_30px_20px_rgba(0,0,0,.5)]"
      />
      <span aria-hidden="true" className="absolute top-[18px] left-1/2 h-6 w-[90px] -translate-x-1/2 rounded-12 bg-midnight" />
      <span className="absolute inset-x-4 bottom-5 flex h-10 items-center justify-center rounded-full bg-[rgba(11,11,11,.75)] font-display text-[13px] font-semibold tracking-[0.16em] text-washed-white uppercase">
        {name}, actual size
      </span>
    </div>
  )
}
