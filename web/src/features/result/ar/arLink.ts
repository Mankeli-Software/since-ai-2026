/** The AR page for a head: `ar.html?head=<slug>` next to the current page (web/ar.html reads `?head=`). */
export function arUrl(head: string): string {
  return new URL(`ar.html?head=${encodeURIComponent(head)}`, location.href).href
}
