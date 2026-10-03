import { Geolocation } from '@capacitor/geolocation'

export interface GeoFix {
  lat: number
  lng: number
  acc: number
  at: number
  source: 'native' | 'browser' | 'none'
  reason?: string
}

function isNative(): boolean {
  const C = (window as any).Capacitor
  return !!(C && C.isNativePlatform && C.isNativePlatform())
}

/**
 * تثبيت الموقع الحالي بدقة عالية — يعمل داخل التطبيق الأصلي (GPS النظام)
 * أو عبر متصفح الويب، ويعود فوراً مع سبب التعطّل إن فشل.
 */
export async function getPosition(timeout = 8000): Promise<GeoFix> {
  if (isNative()) {
    try {
      const p = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: timeout,
        maximumAge: 15000,
      })
      return { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? 0, at: p.timestamp, source: 'native' }
    } catch (err: any) {
      return { lat: 0, lng: 0, acc: 0, at: Date.now(), source: 'native', reason: err?.message || 'native-err' }
    }
  }
  if (navigator.geolocation) {
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy ?? 0, at: p.timestamp, source: 'browser' }),
        (e) => resolve({ lat: 0, lng: 0, acc: 0, at: Date.now(), source: 'browser', reason: e.message }),
        { enableHighAccuracy: true, timeout, maximumAge: 20000 },
      )
    })
  }
  return { lat: 0, lng: 0, acc: 0, at: Date.now(), source: 'none', reason: 'no-geolocation' }
}

/** روابط مباشرة للموقع — تُستعمل في البلاغ ورسالة SMS. */
export function mapsLink(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`
}