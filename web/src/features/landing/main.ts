// Demo landing: index.html is a static mirror of the takomogolf.com home page (VISION §6.1, TASKS T6), built by
// web/scripts/mirror-takomo-home.py. Every static link already points at the studio. This catches the rest:
// forms, theme buttons (add to cart, newsletter, country picker) and links that the live reviews widget adds
// at runtime, so nothing posts anywhere and every action lands in the Fitter Studio.
const STUDIO = '/studio.html?ff=v3'

const go = (e: Event) => {
  e.preventDefault()
  e.stopPropagation()
  location.assign(STUDIO)
}

document.addEventListener('submit', go, true)

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
