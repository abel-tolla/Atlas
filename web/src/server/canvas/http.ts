// HTTPS GET for addresses a user typed in, like their school's Canvas site
// or a calendar feed link.
//
// Our server fetches whatever address the user gives it, so without care
// someone could point it at our own network (for example the cloud
// metadata address 169.254.169.254) and read the answer back. This is
// called server-side request forgery (SSRF). To prevent it:
// - only https, and no user:password@ in the address
// - every IP address the name resolves to is checked at the moment of
//   connecting, including after a redirect, so a name that changes to a
//   private address between checks is still refused
// - at most 3 redirects, a timeout, and a size cap

import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import { request } from 'node:https'
import { BlockList, isIP } from 'node:net'

export interface HttpResponse {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
}

/** What the Canvas code calls. Tests pass a fake one. */
export type HttpGet = (url: string, headers?: Record<string, string>) => Promise<HttpResponse>

/** The address is not one Atlas will fetch: not https, or a private network. */
export class UnsafeAddressError extends Error {
  readonly name = 'UnsafeAddressError'
}

/** No answer: DNS failure, refused connection, timeout, or a broken response. */
export class NetworkError extends Error {
  readonly name = 'NetworkError'
}

const blocked = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // carrier-grade NAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, including cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved and broadcast
] as const) {
  blocked.addSubnet(net, prefix, 'ipv4')
}
for (const [net, prefix] of [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  // IPv4-mapped (::ffff:0:0/96) is not listed: BlockList would then match
  // every IPv4 address too. isPublicAddress unwraps those addresses instead.
  ['64:ff9b::', 96], // IPv4/IPv6 translation
  ['fc00::', 7], // unique local
  ['fe80::', 10], // link-local
  ['ff00::', 8], // multicast
] as const) {
  blocked.addSubnet(net, prefix, 'ipv6')
}

/** True only for an address on the public internet. */
export function isPublicAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, '')
  const family = isIP(bare)
  if (family === 0) return false
  // An IPv4 address written as IPv6 is judged as the IPv4 address it is.
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(bare)
  if (dotted) return isPublicAddress(dotted[1])
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(bare)
  if (hex) {
    const [high, low] = [parseInt(hex[1], 16), parseInt(hex[2], 16)]
    return isPublicAddress(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }
  return !blocked.check(bare, family === 4 ? 'ipv4' : 'ipv6')
}

/** Checks the address's form. The IP addresses are checked when connecting. */
export function checkAddress(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeAddressError('That isn’t a web address.')
  }
  if (url.protocol !== 'https:') throw new UnsafeAddressError('The address must start with https://.')
  if (url.username || url.password) throw new UnsafeAddressError('The address can’t contain a password.')
  // Node skips the lookup below for a written-out IP address, so check it here.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (isIP(host) && !isPublicAddress(host)) {
    throw new UnsafeAddressError('Atlas can’t connect to a private network address.')
  }
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) {
    throw new UnsafeAddressError('Atlas can’t connect to a private network address.')
  }
  return url
}

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void

/** Resolves a name, and refuses it if any of its addresses is private. */
function safeLookup(hostname: string, options: { all?: boolean }, callback: LookupCallback) {
  dnsLookup(hostname, { all: true }, (error, addresses) => {
    if (error) return callback(error, [])
    const list = addresses as LookupAddress[]
    if (list.length === 0 || list.some((a) => !isPublicAddress(a.address))) {
      return callback(new UnsafeAddressError('That address points to a private network.'), [])
    }
    if (options.all) return callback(null, list)
    callback(null, list[0].address, list[0].family)
  })
}

export interface GetOptions {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
}

export function createHttpsGet({
  timeoutMs = 15_000,
  maxBytes = 10 * 1024 * 1024,
  maxRedirects = 3,
}: GetOptions = {}): HttpGet {
  const get = (raw: string, headers: Record<string, string>, redirectsLeft: number) =>
    new Promise<HttpResponse>((resolve, reject) => {
      let url: URL
      try {
        url = checkAddress(raw)
      } catch (error) {
        return reject(error)
      }

      const req = request(url, { method: 'GET', headers, lookup: safeLookup as never }, (res) => {
        const status = res.statusCode ?? 0
        const location = res.headers.location
        if (status >= 300 && status < 400 && location) {
          res.resume()
          if (redirectsLeft <= 0) return reject(new NetworkError('Too many redirects.'))
          const next = new URL(location, url)
          // Never send the token to a different site.
          const nextHeaders = next.host === url.host ? headers : withoutAuthorization(headers)
          return get(next.toString(), nextHeaders, redirectsLeft - 1).then(resolve, reject)
        }

        const chunks: Buffer[] = []
        let size = 0
        res.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > maxBytes) {
            req.destroy(new NetworkError('The response was too large.'))
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () =>
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }),
        )
        res.on('error', (error) => reject(new NetworkError(error.message)))
      })

      req.setTimeout(timeoutMs, () => req.destroy(new NetworkError('The site took too long to answer.')))
      req.on('error', (error) =>
        reject(error instanceof UnsafeAddressError || error instanceof NetworkError ? error : new NetworkError(error.message)),
      )
      req.end()
    })

  return (url, headers = {}) => get(url, { 'user-agent': 'Atlas calendar sync', ...headers }, maxRedirects)
}

function withoutAuthorization(headers: Record<string, string>) {
  return Object.fromEntries(Object.entries(headers).filter(([key]) => key.toLowerCase() !== 'authorization'))
}

export const httpsGet = createHttpsGet()
