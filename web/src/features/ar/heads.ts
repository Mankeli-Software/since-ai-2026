/** AR heads: files live in assets/clubs/ar/<slug>.{glb,usdz}, served at /assets/clubs (L7, L21). */
export const AR_HEADS = ['101-mkii', '201-mkii', '201t-mkii', '301-cb', '301-mb'] as const
export const arHead = (slug: string | null | undefined) => (AR_HEADS as readonly string[]).includes(slug ?? '') ? slug! : '201t-mkii'
export const arPageUrl = (slug: string) => `${location.origin}/ar.html?head=${arHead(slug)}`
export const headLabel = (slug: string) => `Iron ${slug.toUpperCase().replace('-', ' ')}`
