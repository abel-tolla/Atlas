import { ProviderUnavailableError } from './types'

export interface RetryOptions {
  /** Total tries, including the first. */
  attempts?: number
  /** Waits double each time: 1 s, then 2 s, and so on. */
  baseDelayMs?: number
  /** Never wait longer than this, even if the provider asks. */
  maxDelayMs?: number
  /** Swapped out in tests so they don't really wait. */
  sleep?: (ms: number) => Promise<void>
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Retries a provider call when the provider is briefly unavailable (#67).
 * Any other error, like a rejected token, is thrown at once.
 */
export async function withRetry<T>(
  call: () => Promise<T>,
  { attempts = 3, baseDelayMs = 1000, maxDelayMs = 10_000, sleep = realSleep }: RetryOptions = {},
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call()
    } catch (error) {
      if (!(error instanceof ProviderUnavailableError) || attempt >= attempts) throw error
      const backoff = baseDelayMs * 2 ** (attempt - 1)
      await sleep(Math.min(error.retryAfterMs ?? backoff, maxDelayMs))
    }
  }
}
