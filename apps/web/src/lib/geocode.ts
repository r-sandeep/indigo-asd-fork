import { hereSearch } from './hereApi'

/**
 * Geocodes an address string via HERE (proxied through the Netlify function).
 * Returns { lat, lng } on success, or null if geocoding fails.
 */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!address.trim()) return null

  type HereResponse = {
    items?: Array<{ position?: { lat: number; lng: number } }>
  }

  try {
    const res = await hereSearch(address, 'geocode')
    if (!res.ok) return null
    const data = (await res.json()) as HereResponse
    const pos  = data.items?.[0]?.position
    return pos ? { lat: pos.lat, lng: pos.lng } : null
  } catch {
    return null
  }
}
