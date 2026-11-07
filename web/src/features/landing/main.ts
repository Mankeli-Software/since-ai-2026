import { initTheme } from '@/lib/theme'

initTheme()

// Demo landing: index.html is a static mirror of the takomogolf.com home page (VISION §6.1, TASKS T6), built by
// web/scripts/mirror-takomo-home.py. Every static link already points at the studio. This catches the rest:
// forms, theme buttons (add to cart, newsletter, country picker) and links that the live reviews widget adds
// at runtime, so nothing posts anywhere and every action lands in the Fitter Studio.
const STUDIO = '/studio.html'

const go = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  location.assign(STUDIO)
}

document.addEventListener('submit', go, true)

// The sticky banner pins under the theme's header bar, which turns position: fixed past 120px of scroll.
const header = document.querySelector<HTMLElement>('.l-header__container')
const banner = document.querySelector<HTMLElement>('.fs-banner')
if (header && banner) {
  const sync = () => {
    const pinned = getComputedStyle(header).position === 'fixed'
    banner.style.top = `${pinned ? Math.max(0, header.getBoundingClientRect().bottom) : 0}px`
  }
  addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true })
  addEventListener('resize', sync)
  sync()
}

document.addEventListener(
  'click',
  (e) => {
    const el = (e.target as Element | null)?.closest('a[href], button[name="add"], button[type="submit"], .quick-add__submit')
    if (!el) return
    const href = el.getAttribute('href')
    if (href !== null && (href === STUDIO || href.startsWith('#'))) return
    go(e)
  },
  true,
)
