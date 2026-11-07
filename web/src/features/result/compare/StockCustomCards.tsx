import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Eyebrow } from '@/components/studio'
import { cn } from '@/lib/utils'
import { ExamplePill } from '../chrome'

export type Purchase = 'stock' | 'custom'

// Mini strike maps on the dark stage (V3-R5-Stock). Illustrations of "toe vs centred", not plotted shots.
const STOCK_DOTS = [[205, 60], [214, 72], [222, 56], [198, 78], [230, 68], [210, 48], [220, 84], [236, 58]]
const CUSTOM_DOTS = [[146, 62], [156, 70], [140, 74], [160, 56], [150, 52], [136, 62], [164, 68], [152, 80]]
const GROOVES = [36, 46, 56, 66, 76, 86, 96]
const GREEN = '#3FB950'
const AMBER = '#E3B341'

function StrikeMap({ custom }: { custom: boolean }) {
  return (
    <svg viewBox="0 0 300 130" className="max-h-[120px] w-full" aria-hidden="true">
      <path d="M30 110 L262 110 Q284 110 282 88 L272 40 Q268 22 248 20 L70 14 Q34 12 28 50 Q24 104 30 110 Z" fill="#1F1F1F" stroke="#5F5F5F" />
      <g stroke="#3D3D3D" strokeWidth="2">
        {GROOVES.map((y) => (
          <line key={y} x1="70" y1={y} x2="250" y2={y} />
        ))}
      </g>
      <line x1="150" y1="20" x2="150" y2="110" stroke="#F8F8F8" strokeOpacity=".35" strokeDasharray="3 4" />
      {(custom ? CUSTOM_DOTS : STOCK_DOTS).map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="6" fill={custom ? '#FF6E01' : '#C8C8C8'} />
      ))}
      <text x="40" y="128" fill="#8F8F8F" fontFamily="Barlow" fontSize="11">
        HEEL
      </text>
      <text x="250" y="128" fill="#8F8F8F" fontFamily="Barlow" fontSize="11">
        TOE
      </text>
    </svg>
  )
}

function StartLine({ custom }: { custom: boolean }) {
  const end = custom ? 150 : 196
  const c = custom ? '#FF6E01' : '#C8C8C8'
  return (
    <svg viewBox="0 0 300 70" className="max-h-[52px] w-full" aria-hidden="true">
      <line x1="150" y1="64" x2="150" y2="6" stroke="#3D3D3D" strokeDasharray="4 5" />
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
    <span className="flex items-center gap-2.5">
      <span className="inline-flex size-[30px] items-center justify-center rounded-8 bg-grey-1a">{icon}</span>
      <span className="flex flex-col">
        <span className="text-[12px] text-grey-8f">{label}</span>
        <span className="inline-flex items-center gap-1.5 text-[15px] font-semibold">
          {value}
          {pill && <ExamplePill />}
        </span>
      </span>
    </span>
  )
}

export interface StockCustomCardsProps {
  value: Purchase
  onChange(v: Purchase): void
  /** "Stock, 0°" / "Custom, +1° upright". */
  stockTitle: string
  customTitle: string
  /** From the block (tool output). */
  stockReturnDays: number
  customReturnable: boolean
  lean?: 'stock' | 'custom' | 'either'
  className?: string
}

/**
 * R5 stock vs custom on the dark stage: `role=radiogroup` of two `role=radio` cards (custom = recommended),
 * arrow keys move the choice. Delivery times are example copy (fixtures/commerce.ts PURCHASE_COPY).
 */
export function StockCustomCards({ value, onChange, stockTitle, customTitle, stockReturnDays, customReturnable, lean, className }: StockCustomCardsProps) {
  const refs = useRef<Record<Purchase, HTMLButtonElement | null>>({ stock: null, custom: null })
  const cards = [
    {
      id: 'stock' as const,
      title: stockTitle,
      strike: 'Standard lie, strikes stay toward the toe',
      returns: stockReturnDays > 0 ? `${stockReturnDays} days` : 'Not returnable',
      returnsOk: stockReturnDays > 0,
      delivery: '2–3 days',
      deliveryOk: true,
    },
    {
      id: 'custom' as const,
      title: customTitle,
      strike: 'Centred, starts on line',
      returns: customReturnable ? 'Returnable' : 'Not returnable',
      returnsOk: customReturnable,
      delivery: 'About 2 weeks',
      deliveryOk: false,
    },
  ]

  const onKey = (e: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
    e.preventDefault()
    const next: Purchase = value === 'stock' ? 'custom' : 'stock'
    onChange(next)
    refs.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Stock or custom" onKeyDown={onKey} className={cn('flex gap-3.5 max-md:flex-col max-md:gap-2.5', className)}>
      {cards.map((c) => {
        const on = value === c.id
        const custom = c.id === 'custom'
        const isRecommended = lean !== undefined ? c.id === lean : custom
        return (
          <button
            key={c.id}
            ref={(el) => {
              refs.current[c.id] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(c.id)}
            className={cn(
              'flex min-w-0 flex-1 cursor-pointer flex-col gap-2.5 rounded-16 px-[18px] py-4 text-left font-sans text-washed-white transition-ui',
              on ? 'border-2 border-tiger-orange bg-selected-dark' : 'border border-grey-3d bg-grey-12 hover:border-grey-8f',
            )}
          >
            <span className="flex w-full items-center gap-3">
              <span
                aria-hidden="true"
                className={cn('size-6 flex-none rounded-full', on ? 'border-[7px] border-tiger-orange bg-midnight' : 'border-2 border-grey-5f')}
              />
              <span className="font-display text-[26px] leading-none font-bold uppercase max-md:text-[22px]">{c.title}</span>
              {isRecommended && <Eyebrow className="ml-auto rounded-4 bg-tiger-orange px-2 py-[3px] text-midnight">Recommended</Eyebrow>}
            </span>
            <Eyebrow className="text-grey-8f">Your strikes</Eyebrow>
            <StrikeMap custom={custom} />
            <Eyebrow className="text-grey-8f">Start line</Eyebrow>
            <StartLine custom={custom} />
            <span className={cn('text-[15px] font-semibold', custom ? 'text-tiger-orange' : 'text-grey-c8')}>{c.strike}</span>
            <span className="flex w-full gap-[22px] border-t border-grey-26 pt-2.5">
              <Fact icon={<ReturnIcon color={c.returnsOk ? GREEN : AMBER} />} label="Returns" value={c.returns} />
              <Fact icon={<TruckIcon color={c.deliveryOk ? GREEN : AMBER} />} label="Delivery" value={c.delivery} pill />
            </span>
          </button>
        )
      })}
    </div>
  )
}
