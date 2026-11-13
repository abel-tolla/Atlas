import { createCanvasAdapter } from '../canvas/adapter'
import type { Provider, ProviderAdapter } from './types'

/**
 * One adapter per provider. Canvas is Part D of the sync plan. Microsoft
 * (Part C) is next: until then, syncing a Microsoft account fails with
 * "No sync adapter" and leaves its events as they are.
 */
export const adapters: Partial<Record<Provider, ProviderAdapter>> = {
  canvas: createCanvasAdapter(),
}
