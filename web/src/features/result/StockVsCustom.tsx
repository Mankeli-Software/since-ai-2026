import { type ReactNode, useState } from 'react'
import { Button, EnterKbd, Eyebrow, Kbd, useArrowKeys, useEnterKey, useNumberKeys } from '@/components/studio'
import { cn } from '@/lib/utils'
import { ExamplePill } from './chrome'

type Choice = 'stock' | 'custom'

// Mini strike maps (R5 / K7), adapted to the light card: stock strikes sit on the toe, custom ones centre.
const STOCK_DOTS = [[205, 60], [214, 72], [222, 56], [198, 78], [230, 68], [210, 48], [220, 84], [236, 58]]
const CUSTOM_DOTS = [[146, 62], [156, 70], [140, 74], [160, 56], [150, 52], [136, 62], [164, 68], [152, 80]]
const GROOVES = [36, 46, 56, 66, 76, 86, 96]

function StrikeMap({ custom }: { custom: boolean }) {
  return (
    <svg viewBox="0 0 300 130" className="w-full" aria-hidden="true">
      <path
        d="M30 110 L262 110 Q284 110 282 88 L272 40 Q268 22 248 20 L70 14 Q34 12 28 50 Q24 104 30 110 Z"
        fill="#EDEDED"
        stroke="#8F8F8F"
      />
      <g stroke="#D9D9D9" strokeWidth="2">
        {GROOVES.map((y) => <line key={y} x1="70" y1={y} x2="250" y2={y} />)}
      </g>
      <line x1="150" y1="20" x2="150" y2="110" stroke="#0B0B0B" strokeOpacity=".3" strokeDasharray="3 4" />
      {(custom ? CUSTOM_DOTS : STOCK_DOTS).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill={custom ? '#FF6E01' : '#8F8F8F'} />
      ))}
      <text x="40" y="128" fill="#555555" fontFamily="Barlow" fontSize="11">HEEL</text>
      <text x="250" y="128" fill="#555555" fontFamily="Barlow" fontSize="11">TOE</text>
    </svg>
  )
}

function StartLine({ custom }: { custom: boolean }) {
  const end = custom ? 150 : 196
  const c = custom ? '#FF6E01' : '#8F8F8F'
  return (
    <svg viewBox="0 0 300 70" className="w-full" aria-hidden="true">
      <line x1="150" y1="64" x2="150" y2="6" stroke="#C8C8C8" strokeDasharray="4 5" />
      <circle cx="150" cy="10" r="5" fill="none" stroke="#8F8F8F" />
      <path d={`M150 64 L${end} 12`} stroke={c} strokeWidth="3" strokeLinecap="round" />
      <circle cx={end} cy="12" r="5" fill={c} />
    </svg>
  )
}

function ReturnIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12a8 8 0 1 0 3-6.2" />
      <path d="M4 4v4h4" />
    </svg>
  )
}

function TruckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="7" width="13" height="10" rx="1" />
      <path d="M16 10h3l2 3v4h-5" />
    </svg>
  )
}

function Fact({ icon, label, value, pill }: { icon: ReactNode; label: string; value: string; pill?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex size-[30px] items-center justify-center rounded-8 bg-grey-ed">{icon}</span>
      <span className="flex flex-col">
        <span className="text-[12px] text-grey-55">{label}</span>
        <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
          {value}
          {pill && <ExamplePill />}
        </span>
      </span>
    </div>
  )
}

const GREEN = '#3FB950'
const AMBER = '#E3B341'

/**
 * R5 stock vs custom, on the light conversation card: a radiogroup of two cards (custom = recommended),
 * then "Choose this" confirms (number keys 1/2 or ← / → select, Enter confirms). `onPick` gets 'stock' | 'custom' (the block's resume value).
 * Delivery times are example copy from the design until commerce data exists.
 */
export function StockVsCustomView(p: {
  question: string
  reasons: string[]
  stockReturnDays: number
  customReturnable: boolean
  locked: boolean
  picked?: string
  onPick: (v: Choice) => void
}) {
  const [sel, setSel] = useState<Choice>(p.picked === 'stock' ? 'stock' : 'custom')
  const done = p.picked === 'stock' || p.picked === 'custom'
  const off = p.locked || done
  const choices: Choice[] = ['stock', 'custom']
  useNumberKeys(2, (i) => setSel(choices[i]), !off)
  useArrowKeys((dir) => setSel(dir < 0 ? 'stock' : 'custom'), !off)
  useEnterKey(() => p.onPick(sel), !off)

  const cards = [
    {
      id: 'stock' as const,
      title: 'Stock',
      strike: 'Standard lie. Strikes stay where they are.',
      returns: p.stockReturnDays > 0 ? `${p.stockReturnDays} days` : 'Not returnable',
      returnsOk: p.stockReturnDays > 0,
      delivery: '2–3 days',
      deliveryOk: true,
    },
    {
      id: 'custom' as const,
      title: 'Custom',
      strike: 'Built for your strike. Centred, starts on line.',
      returns: p.customReturnable ? 'Returnable' : 'Not returnable',
      returnsOk: p.customReturnable,
      delivery: 'About 2 weeks',
      deliveryOk: false,
    },
  ]

  return (
    <section className="flex flex-col gap-4">
      <p className="m-0 text-[18px] font-semibold leading-snug">{p.question}</p>
      {p.reasons.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[15px] text-grey-44">
          {p.reasons.map((r, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden="true" className="mt-[9px] inline-block size-1.5 flex-none rounded-full bg-grey-8f" />
              {r}
            </li>
          ))}
        </ul>
      )}
      <div role="radiogroup" aria-label="Stock or custom" className="flex gap-3.5">
        {cards.map((c, i) => {
          const on = sel === c.id
          const custom = c.id === 'custom'
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              aria-keyshortcuts={done ? undefined : String(i + 1)}
              disabled={off}
              onClick={() => setSel(c.id)}
              className={cn(
                'flex min-w-0 flex-1 cursor-pointer flex-col gap-2.5 rounded-16 border px-[18px] py-4 text-left font-sans text-midnight transition-ui disabled:cursor-default',
                on ? 'border-tiger-orange bg-[#FFF6EE] shadow-[inset_0_0_0_1px_#FF6E01]' : 'border-grey-d9 bg-white enabled:hover:border-grey-8f',
                off && !on && 'opacity-60',
              )}
            >
              <span className="flex w-full items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn('size-6 flex-none rounded-full', on ? 'border-[7px] border-tiger-orange bg-white' : 'border-2 border-grey-c8 bg-white')}
                />
                <span className="font-display text-[26px] font-bold uppercase leading-none">{c.title}</span>
                {custom && (
                  <Eyebrow className="ml-auto rounded-4 bg-tiger-orange px-2 py-[3px] text-midnight">Recommended</Eyebrow>
                )}
                {!done && <Kbd className={custom ? undefined : 'ml-auto'}>{i + 1}</Kbd>}
              </span>
              <Eyebrow className="text-grey-55">Your strikes</Eyebrow>
              <StrikeMap custom={custom} />
              <Eyebrow className="text-grey-55">Start line</Eyebrow>
              <StartLine custom={custom} />
              <span className={cn('text-[15px] font-semibold', custom ? 'text-orange-text' : 'text-grey-44')}>{c.strike}</span>
              <span className="flex w-full gap-[22px] border-t border-grey-e4 pt-2.5">
                <Fact icon={<ReturnIcon color={c.returnsOk ? GREEN : AMBER} />} label="Returns" value={c.returns} />
                <Fact icon={<TruckIcon color={c.deliveryOk ? GREEN : AMBER} />} label="Delivery" value={c.delivery} pill />
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-[15px] text-grey-55">
          {done ? `You chose ${p.picked}.` : 'Pick one. Not sure? Stock still plays fine for you.'}
        </span>
        {!done && (
          <Button variant="dark" disabled={off} aria-keyshortcuts="Enter" onClick={() => p.onPick(sel)} className="pr-3">
            Choose this
            <EnterKbd />
          </Button>
        )}
      </div>
    </section>
  )
}
