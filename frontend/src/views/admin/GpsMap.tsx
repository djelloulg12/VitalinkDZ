import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useApiData } from '../../auth'
import { toast } from '../../ui'

interface GpsData {
  staff: { kind: string; name: string; specialty: string; lat: number; lng: number; region: string }[]
  units: { type: string; name: string; city: string; lat: number; lng: number; region: string; phone: string }[]
  associations: { name: string; points: number; stars: number; lat: number; lng: number; region: string }[]
}

interface Filters {
  doctors: boolean
  nurses: boolean
  units: boolean
  associations: boolean
}

export function GpsMap() {
  const { data, error, loading, reload } = useApiData<GpsData>('/gps/locations', 0)
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)
  const [filters, setFilters] = useState<Filters>({ doctors: true, nurses: true, units: true, associations: true })
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const map = L.map(divRef.current, { center: [32.0, 3.5], zoom: 6, zoomControl: true })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 18,
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer || !data) return
    layer.clearLayers()
    const bounds: L.LatLngBounds = L.latLngBounds([])

    if (filters.doctors) {
      data.staff.filter((s) => s.kind === 'doctor').forEach((s) => {
        const ic = L.divIcon({ html: '<div style="width:16px;height:16px;border-radius:50%;background:#22C55E;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></div>', className: '', iconSize: [16, 16] })
        const m = L.marker([s.lat, s.lng], { icon: ic }).bindPopup(`<b>🩺 ${s.name}</b><br/><span style="color:#15803D">طبيب متعاقد</span><br/>${s.specialty}<br/><span class="muted">${s.region}</span>`)
        layer.addLayer(m)
        bounds.extend([s.lat, s.lng])
      })
    }
    if (filters.nurses) {
      data.staff.filter((s) => s.kind === 'nurse').forEach((s) => {
        const ic = L.divIcon({ html: '<div style="width:16px;height:16px;border-radius:50%;background:#3B82F6;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></div>', className: '', iconSize: [16, 16] })
        const m = L.marker([s.lat, s.lng], { icon: ic }).bindPopup(`<b>💓 ${s.name}</b><br/><span style="color:#1D4ED8">ممرض متعاقد</span><br/>${s.specialty}<br/><span class="muted">${s.region}</span>`)
        layer.addLayer(m)
        bounds.extend([s.lat, s.lng])
      })
    }
    if (filters.units) {
      data.units.forEach((u) => {
        const ic = L.divIcon({ html: '<div style="width:18px;height:18px;border-radius:4px;background:#6C4EFF;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></div>', className: '', iconSize: [18, 18] })
        const m = L.marker([u.lat, u.lng], { icon: ic }).bindPopup(`<b>🏥 ${u.name}</b><br/>${u.city} — ${u.region}<br/>${u.phone ? '☎ ' + u.phone : ''}`)
        layer.addLayer(m)
        bounds.extend([u.lat, u.lng])
      })
    }
    if (filters.associations) {
      data.associations.forEach((a) => {
        const ic = L.divIcon({ html: '<div style="width:16px;height:16px;border-radius:50%;background:#F59E0B;border:3px solid #fff;box-shadow:0 1px 5px rgba(0,0,0,.4)"></div>', className: '', iconSize: [16, 16] })
        const m = L.marker([a.lat, a.lng], { icon: ic }).bindPopup(`<b>🏅 ${a.name}</b><br/>${a.region}<br/><b>${a.points}</b> نقطة — ${a.stars} ★`)
        layer.addLayer(m)
        bounds.extend([a.lat, a.lng])
      })
    }

    if (bounds.isValid() && bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    }
  }, [data, filters])

  const locate = () => {
    if (!navigator.geolocation) {
      toast('المتصفح لا يدعم تحديد الموقع', 'warning')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.setView([pos.coords.latitude, pos.coords.longitude], 13)
        L.marker([pos.coords.latitude, pos.coords.longitude], {
          icon: L.divIcon({ html: '<div style="width:20px;height:20px;border-radius:50%;background:#EF4444;border:3px solid #fff;box-shadow:0 0 0 6px rgba(239,68,68,.25)"></div>', className: '', iconSize: [20, 20] }),
        }).addTo(mapRef.current!).bindPopup('<b>موقعي الحالي</b>').openPopup()
        toast('تم تحديد موقعك على الخريطة', 'success')
        setLocating(false)
      },
      () => {
        toast('تعذّر تحديد الموقع', 'error')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }

  if (loading) return <p className="muted">جارٍ تحميل الخريطة…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>

  const toggle = (k: keyof Filters) => setFilters({ ...filters, [k]: !filters[k] })

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>GPS — الخريطة الميدانية الوطنية</h2>
          <span className="muted small">مواقع الأطباء والممرضين والوحدات الميدانية والجمعيات (OpenStreetMap)</span>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-danger" onClick={locate} disabled={locating}>
            📍 {locating ? 'ملتقط الموقع…' : 'تحديد موقعي'}
          </button>
          <button className="btn btn-line" onClick={reload}>🔄 تحديث</button>
        </div>
      </div>

      <div className="map-legend">
        <label className="lg"><input type="checkbox" checked={filters.doctors} onChange={() => toggle('doctors')} /> <span className="map-dot" style={{ background: '#22C55E' }} /> أطباء متعاقدون</label>
        <label className="lg"><input type="checkbox" checked={filters.nurses} onChange={() => toggle('nurses')} /> <span className="map-dot" style={{ background: '#3B82F6' }} /> ممرضون متعاقدون</label>
        <label className="lg"><input type="checkbox" checked={filters.units} onChange={() => toggle('units')} /> <span className="map-dot" style={{ background: '#6C4EFF' }} /> مستشفيات ووحدات ميدانية</label>
        <label className="lg"><input type="checkbox" checked={filters.associations} onChange={() => toggle('associations')} /> <span className="map-dot" style={{ background: '#F59E0B' }} /> جمعيات نشطة</label>
      </div>

      <div className="map-wrap" ref={divRef} />

      <div className="card mt-16">
        <div className="card-title"><span className="ico">📌</span> ملخص الطبقات على الخريطة</div>
        <div className="grid grid-4">
          <div><div className="s-num" style={{ fontSize: 20 }}>{data?.staff.filter((s) => s.kind === 'doctor').length || 0}</div><div className="small muted">طبيب</div></div>
          <div><div className="s-num" style={{ fontSize: 20 }}>{data?.staff.filter((s) => s.kind === 'nurse').length || 0}</div><div className="small muted">ممرض</div></div>
          <div><div className="s-num" style={{ fontSize: 20 }}>{data?.units.length || 0}</div><div className="small muted">مستشفى / وحدة</div></div>
          <div><div className="s-num" style={{ fontSize: 20 }}>{data?.associations.length || 0}</div><div className="small muted">جمعية</div></div>
        </div>
      </div>
    </div>
  )
}