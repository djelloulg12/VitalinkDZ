import { FormEvent, useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { GeoZone } from '../../types'
import { Field, Modal, Stat, toast } from '../../ui'

const EMPTY = { name: '', wilaya_code: '', lat: 0, lng: 0, radius_km: 10, enabled: true }

export function Zones() {
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useApiData<GeoZone[]>('/zones', refresh)
  const [modal, setModal] = useState<null | { id?: number; form: any }>(null)
  const [busy, setBusy] = useState(false)
  const [check, setCheck] = useState<null | { lat: string; lng: string; result: any }>(null)

  const openNew = () => setModal({ form: { ...EMPTY } })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal) return
    setBusy(true)
    try {
      const body = { ...modal.form, wilaya_code: modal.form.wilaya_code ? Number(modal.form.wilaya_code) : null, lat: Number(modal.form.lat), lng: Number(modal.form.lng), radius_km: Number(modal.form.radius_km) }
      await api(modal.id ? `/zones/${modal.id}` : '/zones', { method: modal.id ? 'PUT' : 'POST', body: JSON.stringify(body) })
      toast(modal.id ? 'حُفظ السور' : 'أُنشئ السور', 'success')
      setModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const remove = async (z: GeoZone) => {
    if (!window.confirm('حذف السور؟')) return
    try {
      await api(`/zones/${z.id}`, { method: 'DELETE' })
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const doCheck = async (e: FormEvent) => {
    e.preventDefault()
    if (!check) return
    try {
      const res = await api(`/zones/check?lat=${Number(check.lat)}&lng=${Number(check.lng)}`, { method: 'POST' })
      setCheck({ ...check, result: res })
    } catch (err: any) { toast(err.message, 'error') }
  }

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const zones = data || []

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>الأسوار الجغرافية (Geofencing)</h2>
          <span className="muted small">حدود افتراضية حول الوحدات المتنقلة والحمامات — تنبيه الممرض داخل/خارج النطاق</span>
        </div>
        <button className="btn btn-gold" onClick={openNew}>➕ سور جديد</button>
      </div>

      <div className="flex gap-12 mb-16 flex-wrap items-center">
        <span className="badge badge-purple">📍 {zones.length} سور</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-line btn-sm" onClick={() => setCheck({ lat: '32.491', lng: '3.673', result: null })}>🧭 تجربة فحص نقطة (غرداية)</button>
      </div>

      {!zones.length && <div className="empty-state"><div className="big">📍</div>لا أسوار بعد</div>}

      <div className="grid grid-2">
        {zones.map((z) => (
          <div key={z.id} className="card" style={{ borderRight: `4px solid ${z.enabled ? 'var(--purple)' : 'var(--line)'}` }}>
            <div className="flex items-center justify-between gap-8">
              <b>{z.name}</b>
              <span className={`badge ${z.enabled ? 'badge-green' : 'badge-gray'}`}>{z.enabled ? 'فعال' : 'موقوف'}</span>
            </div>
            <div className="kv-row mt-12"><span>الولاية</span><b>{z.wilaya_code ? `و.${z.wilaya_code}` : 'وطنية'}</b></div>
            <div className="kv-row"><span>الإحداثيات</span><b dir="ltr">{z.lat.toFixed(3)}, {z.lng.toFixed(3)}</b></div>
            <div className="kv-row"><span>نصف القطر</span><b>{z.radius_km} كم</b></div>
            <div className="flex gap-8 mt-12">
              <button className="btn btn-soft btn-sm" onClick={() => setModal({ id: z.id, form: { ...z, wilaya_code: z.wilaya_code != null ? String(z.wilaya_code) : '' } })}>✏️ تعديل</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove(z)}>🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>

      {check && (
        <Modal title="فحص موقع — Geofencing" icon="🧭" onClose={() => setCheck(null)}
          foot={<button className="btn btn-line" onClick={() => setCheck(null)}>إغلاق</button>}>
          <form className="form-row" onSubmit={doCheck}>
            <Field label="خط العرض"><input className="form-control" required dir="ltr" value={check.lat} onChange={(e) => setCheck({ ...check, lat: e.target.value })} /></Field>
            <Field label="خط الطول"><input className="form-control" required dir="ltr" value={check.lng} onChange={(e) => setCheck({ ...check, lng: e.target.value })} /></Field>
            <button className="btn btn-success" style={{ alignSelf: 'end' }}>فحص</button>
          </form>
          {check.result && (
            <div className="mt-16">
              <span className={`badge ${check.result.inside_any ? 'badge-green' : 'badge-red'} mb-12`} style={{ display: 'inline-block' }}>
                {check.result.inside_any ? '✅ داخل الأسوار — موقع معتمد' : '⛔ خارج كل الأسوار — تنبيه'}
              </span>
              {(check.result.zones || []).map((z: any) => (
                <div key={z.zone_id} className="flex items-center justify-between gap-8" style={{ padding: '9px 0', borderBottom: '1px solid var(--line)' }}>
                  <b style={{ fontSize: 13 }}>{z.name}</b>
                  <span className="small">{z.distance_km} كم / {z.radius_km} كم</span>
                  <span className={`badge ${z.state === 'inside' ? 'badge-green' : 'badge-orange'}`}>{z.state === 'inside' ? 'داخل' : 'خارج'}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {modal && (
        <Modal title={modal.id ? 'تعديل سور' : 'سور جغرافي جديد'} icon="📍" onClose={() => setModal(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={save} disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </>}>
          <form onSubmit={save}>
            <Field label="اسم السور"><input className="form-control" required value={modal.form.name} onChange={(e) => setModal({ ...modal, form: { ...modal.form, name: e.target.value } })} /></Field>
            <div className="form-row">
              <Field label="المركز — خط العرض"><input className="form-control" dir="ltr" type="number" step="0.0001" value={modal.form.lat} onChange={(e) => setModal({ ...modal, form: { ...modal.form, lat: e.target.value } })} /></Field>
              <Field label="المركز — خط الطول"><input className="form-control" dir="ltr" type="number" step="0.0001" value={modal.form.lng} onChange={(e) => setModal({ ...modal, form: { ...modal.form, lng: e.target.value } })} /></Field>
            </div>
            <div className="form-row">
              <Field label="نصف القطر (كم)"><input className="form-control" type="number" min={1} value={modal.form.radius_km} onChange={(e) => setModal({ ...modal, form: { ...modal.form, radius_km: e.target.value } })} /></Field>
              <Field label="الولاية"><input className="form-control" type="number" placeholder="58 أو اتركه وطنياً" value={modal.form.wilaya_code} onChange={(e) => setModal({ ...modal, form: { ...modal.form, wilaya_code: e.target.value } })} /></Field>
            </div>
            <label className="flex gap-8 items-center" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={modal.form.enabled} onChange={(e) => setModal({ ...modal, form: { ...modal.form, enabled: e.target.checked } })} />
              <span>سور فعال</span>
            </label>
          </form>
        </Modal>
      )}
    </div>
  )
}