import type { Provider, ProviderAdapter } from './types'

/**
 * One adapter per provider. Part C of the sync plan adds Microsoft and
 * Part D adds Canvas. Until then, syncing those accounts fails with
 * "No sync adapter" and leaves their events as they are.
 */
export const adapters: Partial<Record<Provider, ProviderAdapter>> = {}
