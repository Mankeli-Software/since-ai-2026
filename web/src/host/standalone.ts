// Plan 7.4. Only the standalone adapter exists before the Final phase (L2); Shopify/generic come later.
export interface CartLine {
  variantId: string
  quantity: number
  properties?: Record<string, string>
}
export interface CartResult {
  ok: boolean
  message?: string
}

export interface HostAdapter {
  platform: 'shopify' | 'generic' | 'standalone'
  addToCart(lines: CartLine[]): Promise<CartResult>
  openCart(): Promise<void>
  getCustomer(): Promise<{ loggedIn: boolean; id?: string }>
  navigate(url: string): void
  close(): void
}

/** window.parent === window. Stub cart: nothing is sold from the standalone studio yet. */
export const standaloneAdapter: HostAdapter = {
  platform: 'standalone',
  addToCart: async (lines) => ({ ok: true, message: `Mock cart: ${lines.length} line(s)` }),
  openCart: async () => {},
  getCustomer: async () => ({ loggedIn: false }),
  navigate: (url) => {
    location.href = url
  },
  close: () => {},
}

export const host: HostAdapter = standaloneAdapter
