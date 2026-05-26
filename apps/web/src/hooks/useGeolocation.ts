import { useCallback, useEffect, useRef, useState } from 'react'

export interface GeolocationState {
  lat: number | null
  lng: number | null
  accuracyM: number | null
  /** True while waiting for first position fix */
  isLoading: boolean
  /** Geolocation API error message, or null */
  error: string | null
  /** Whether the browser supports geolocation */
  isSupported: boolean
  /** Resets error and re-requests position */
  retry: () => void
}

/**
 * Watches the device GPS continuously via watchPosition.
 * Cleans up the watcher on unmount.
 */
export function useGeolocation(): GeolocationState {
  const [state, setState] = useState<Omit<GeolocationState, 'retry' | 'isSupported'>>({
    lat: null,
    lng: null,
    accuracyM: null,
    isLoading: true,
    error: null,
  })

  const watchIdRef = useRef<number | null>(null)
  const isSupported = 'geolocation' in navigator

  const start = useCallback(() => {
    if (!isSupported) {
      setState(s => ({ ...s, isLoading: false, error: 'GPS not supported on this device.' }))
      return
    }

    setState(s => ({ ...s, isLoading: true, error: null }))

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          lat:       pos.coords.latitude,
          lng:       pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          isLoading: false,
          error:     null,
        })
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location access denied. Please allow GPS in your browser settings.'
            : err.code === err.POSITION_UNAVAILABLE
              ? 'GPS signal unavailable. Move to a clear area.'
              : 'Could not get GPS location. Please try again.'
        setState(s => ({ ...s, isLoading: false, error: msg }))
      },
      {
        enableHighAccuracy: true,
        maximumAge:         5_000,   // accept cached position up to 5 s old
        timeout:            15_000,  // give up after 15 s without a fix
      },
    )
  }, [isSupported])

  useEffect(() => {
    start()
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [start])

  const retry = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    start()
  }, [start])

  return { ...state, isSupported, retry }
}

/** Client-side haversine distance in metres (mirrors the DB function). */
export function haversineMeters(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6_371_000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}
