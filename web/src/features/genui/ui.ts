// Shared Tailwind class strings for gen-UI and result blocks (one look: radius, padding, labels).
export const inputCls =
  'h-10 rounded-md border border-input bg-card px-3 text-sm text-foreground disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-ring'
export const labelCls =
  'flex flex-col gap-1.5 font-display text-xs font-semibold uppercase tracking-[0.12em] text-ink-500'
/** Small uppercase Barlow Condensed label. */
export const eyebrowCls = 'font-display text-xs font-semibold uppercase tracking-[0.14em] text-ink-500'
/** Question text of an input block. */
export const promptCls = 'text-[15px] font-medium leading-snug text-foreground'
/** White spec-sheet card used by result blocks. */
export const cardCls = 'flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-[0_1px_2px_rgba(11,11,11,0.04)] ring-1 ring-card-edge'
/** Button text style: condensed, uppercase. */
export const btnCls = 'h-10 px-5 font-display text-sm font-semibold uppercase tracking-[0.1em]'
/** Chip / option button. Selected = midnight black fill. */
export const chipCls = (selected: boolean) =>
  `inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium transition-colors disabled:cursor-default ${
    selected
      ? 'border-ink-900 bg-ink-900 text-washed-white'
      : 'border-border bg-card text-foreground enabled:hover:border-ink-900 disabled:opacity-60'
  }`
/** Calm callout for close calls and honesty notes. */
export const calloutCls = 'rounded-md border border-orange-100 border-l-2 border-l-tiger-orange bg-orange-50 px-3.5 py-2.5 text-sm text-ink-700'
/** Read-only "you answered" line. */
export const answeredCls = 'text-sm text-ink-500 [&_strong]:font-medium [&_strong]:text-foreground'
/** Dashed panel inside an input block. */
export const panelCls = 'flex flex-col gap-3 rounded-md border border-border bg-background p-4'
