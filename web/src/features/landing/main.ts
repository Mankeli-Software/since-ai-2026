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

// Imperial / metric toggle in header
const topBarContainer = document.querySelector('.l-headerTopBar__container')
if (topBarContainer) {
  const toggleWrap = document.createElement('div')
  toggleWrap.className = 'fs-units-toggle l-flex l-items-center l-mr-4'
  toggleWrap.innerHTML = `
    <div style="display:inline-flex;align-items:center;border:1px solid #3d3d3d;border-radius:6px;background:#1a1a1a;padding:2px;font-size:11px;font-family:inherit;">
      <button type="button" id="fs-unit-imp" style="padding:2px 8px;border-radius:4px;border:none;cursor:pointer;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;background:transparent;color:#a3a3a3;">Imperial</button>
      <button type="button" id="fs-unit-met" style="padding:2px 8px;border-radius:4px;border:none;cursor:pointer;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;background:transparent;color:#a3a3a3;">Metric</button>
    </div>
  `
  const updateUI = () => {
    const cur = localStorage.getItem('takomo_units') === 'metric' ? 'metric' : 'imperial'
    const btnImp = toggleWrap.querySelector<HTMLButtonElement>('#fs-unit-imp')
    const btnMet = toggleWrap.querySelector<HTMLButtonElement>('#fs-unit-met')
    if (btnImp && btnMet) {
      btnImp.style.background = cur === 'imperial' ? '#ff6e01' : 'transparent'
      btnImp.style.color = cur === 'imperial' ? '#121212' : '#a3a3a3'
      btnMet.style.background = cur === 'metric' ? '#ff6e01' : 'transparent'
      btnMet.style.color = cur === 'metric' ? '#121212' : '#a3a3a3'
    }
  }
  toggleWrap.querySelector('#fs-unit-imp')?.addEventListener('click', (e) => {
    e.stopPropagation()
    localStorage.setItem('takomo_units', 'imperial')
    updateUI()
  })
  toggleWrap.querySelector('#fs-unit-met')?.addEventListener('click', (e) => {
    e.stopPropagation()
    localStorage.setItem('takomo_units', 'metric')
    updateUI()
  })
  updateUI()
  topBarContainer.prepend(toggleWrap)
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
