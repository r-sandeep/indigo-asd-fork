/**
 * HERE API routing helper.
 *
 * Production / netlify dev → calls /.netlify/functions/address-search
 *   (server-side proxy — no CORS or domain restrictions on the key)
 *
 * Local `pnpm dev` fallback → if VITE_HERE_API_KEY is set, calls HERE directly
 *   (useful when you don't want to run `netlify dev` just to test address search)
 */

export type HereMode = 'autocomplete' | 'geocode'

export async function hereSearch(q: string, mode: HereMode): Promise<Response> {
  // Dev direct-call fallback: if a client-side key is present, hit HERE directly.
  // This avoids needing `netlify dev` for local address-search testing.
  const devKey = import.meta.env.VITE_HERE_API_KEY as string | undefined
  if (devKey) {
    const base  = mode === 'geocode'
      ? 'https://geocode.search.hereapi.com/v1/geocode'
      : 'https://autocomplete.search.hereapi.com/v1/autocomplete'
    const limit = mode === 'geocode' ? '1' : '6'
    const extra = mode === 'autocomplete' ? '&types=houseNumber' : ''
    return fetch(`${base}?q=${encodeURIComponent(q)}&in=countryCode:USA&limit=${limit}${extra}&apiKey=${devKey}`)
  }

  // Default: server-side proxy (production + `netlify dev`)
  return fetch(
    `/.netlify/functions/address-search` +
    `?mode=${mode}&q=${encodeURIComponent(q)}`,
  )
}
