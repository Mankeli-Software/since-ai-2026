/** `?ff=a,b` feature flags: unfinished UI hides behind these (AGENTS.md 1.1). */
const flags = new Set((new URLSearchParams(location.search).get('ff') ?? '').split(',').filter(Boolean))
export const hasFlag = (name: string) => flags.has(name)
/** Flow v3 is the default studio; `?ff=legacy` brings back the pre-v3 two-column layout for one day. */
export const isV3 = () => !flags.has('legacy')
