import { hereSearch } from './hereApi'

/**
 * Geocodes an address string via HERE (proxied through the Netlify function).
 *
 * Returns { lat, lng } when a match is found.
 * Returns null when HERE returns no results for the address (not an error).
 * Throws an Error for API / network failures so callers can surface a message.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null

  type HereResponse = {
    items?: Array<{ position?: { lat: number; lng: number } }>
  }

  const res = await hereSearch(address, 'geocode')

  if (!res.ok) {
    // Surface the server error message (e.g. "HERE_API_KEY not configured on server")
    const body = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error ?? `HERE geocoding error (${res.status})`)
  }

  const data = (await res.json()) as HereResponse
  const pos  = data.items?.[0]?.position
  return pos ? { lat: pos.lat, lng: pos.lng } : null
}
