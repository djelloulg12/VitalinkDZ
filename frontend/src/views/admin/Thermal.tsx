import { FormEvent, useState } from 'react'
import { useApiData, useAuth } from '../../auth'
import { api } from '../../api'
import { HealthPackage, Review, ThermalBooking, ThermalReport, ThermalStation } from '../../types'
import { Field, Modal, Stars, toast } from '../../ui'

type Tab = 'stations' | 'bookings' | 'reports' | 'suggest'

export function Thermal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<Tab>('stations')
  const stations = useApiData<ThermalStation[]>('/thermal/stations', refresh)
  const packages = useApiData<HealthPackage[]>('/thermal/packages', refresh)
  const bookings = useApiData<ThermalBooking[]>('/thermal/bookings', refresh)
  const reports = useApiData<ThermalReport>('/thermal/reports', refresh)
  const [bookModal, setBookModal] = useState<null | { form: any }>(null)
  const [revModal, setRevModal] = useState<null | { station_id: number }>(null)
  const [revForm, setRevForm] = useState({ stars: 5, comment: '' })
  const [suggestQ, setSuggestQ] = useState('')
  const [suggestRes, setSuggestRes] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const isDoc = user?.role === 'doctor'

  const book = async (e: FormEvent) => {
    e.preventDefault()
    if (!bookModal) return
    setBusy(true)
    try {
      await api('/thermal/bookings', { method: 'POST', body: JSON.stringify({ ...bookModal.form, price: Number(bookModal.form.price), insurance: bookModal.form.insurance }) })
      toast('أُنشئ الحجز — بانتظار موافقة الطبيب قبل السفر', 'success')
      setBookModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const approve = async (id: number, ok: boolean) => {
    try {
      await api(`/thermal/bookings/${id}/approve?approved=${ok}`, { method: 'PUT' })
      toast(ok ? 'موافقة الطبيب — سفر معتمد' : 'رُفض السفر', ok ? 'success' : 'warning')
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const addReview = async (e: FormEvent) => {
    e.preventDefault()
    if (!revModal) return
    try {
      await api('/thermal/reviews', { method: 'POST', body: JSON.stringify({ target_type: 'station', target_id: revModal.station_id, stars: Number(revForm.stars), comment: revForm.comment }) })
      toast('شكراً على تقييمك', 'success')
      setRevModal(null)
      setRevForm({ stars: 5, comment: '' })
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const suggest = async (e: FormEvent) => {
    e.preventDefault()
    if (!suggestQ.trim()) return
    try {
      const res = await api(`/thermal/suggest?diagnosis=${encodeURIComponent(suggestQ.trim())}`, { method: 'POST' })
      setSuggestRes(res)
    } catch (err: any) { toast(err.message, 'error') }
  }

  const TABS: [Tab, string][] = [['stations', '♨️ المحطات والحمّامات'], ['bookings', '📅 الحجوزات'], ['reports', '📊 التقارير'], ['suggest', '🧠 اقتراح المسار (AI)']]
  const list = stations.data || []

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>السياحة العلاجية والحمامّات المعدنية</h2>
          <span className="muted small">مسار علاجي حراري مع تأمين صحي وسياحي وموافقة الطبيب قبل السفر</span>
        </div>
        <button className="btn btn-gold" onClick={() => setBookModal({ form: { station_id: '', package_id: '', patient_name: '', date_start: '', date_end: '', price: 0, insurance: true } })}>➕ حجز سياحة علاجية</button>
      </div>

      <div className="tabs mb-16">
        {TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {tab === 'stations' && (
        <div className="grid grid-2">
          {list.map((s) => (
            <div key={s.id} className="card">
              <div className="flex items-center justify-between gap-8 mb-8">
                <div>
                  <b style={{ fontSize: 16 }}>{s.name}</b>
                  <div className="small muted">و.^{s.wilaya_id ?? '—'} · حرارة الماء {s.water_temp}°C</div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <Stars value={s.rating_avg} />
                  <div className="small muted">{s.rating_avg} / 5</div>
                </div>
              </div>
              <div className="small" style={{ background: 'var(--purple-050)', borderRadius: 10, padding: 10, marginBottom: 8 }}>
                <b>تعالج:</b> {s.treatments || '—'}
              </div>
              <div className="small muted mb-8">{s.services || '—'}</div>
              {(s.packages || []).length > 0 && <div className="card-title"><span className="ico">🎁</span> الحزم</div>}
              {(s.packages || []).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-8" style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)', fontSize: 13 }}>
                  <span><b>{p.title}</b> <span className="muted">· {p.nights} ليالٍ</span></span>
                  <b>{p.price.toLocaleString('ar-DZ')} دج</b>
                </div>
              ))}
              {(s.reviews || []).length > 0 && (<div className="card-title mt-12"><span className="ico">⭐</span> التقييمات</div>)}
              {(s.reviews || []).map((r) => (
                <div key={r.id} className="small" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                  <Stars value={r.stars} /> <b>{r.user_name}</b>: {r.comment || '—'}
                </div>
              ))}
              <div className="flex gap-8 mt-12">
                <button className="btn btn-soft btn-sm" onClick={() => setRevModal({ station_id: s.id })}>⭐ تقييم المحطة</button>
                {s.packages?.length ? <button className="btn btn-line btn-sm" onClick={() => { const p = s.packages![0]; setBookModal({ form: { station_id: String(s.id), package_id: String(p.id), patient_name: '', date_start: '', date_end: '', price: p.price, insurance: true } }) }}>📅 احجز عبر الحزمة</button> : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'bookings' && (
        <div>
          <div className="flex gap-8 flex-wrap mb-16">
            <span className="badge badge-purple">📅 {bookings.data?.length || 0}</span>
            <span className="badge badge-orange">⏳ بانتظار موافقة الطبيب: {(bookings.data || []).filter((b) => b.status === 'pending').length}</span>
            <span className="badge badge-green">مؤمَّن: {(bookings.data || []).filter((b) => b.insurance).length}</span>
          </div>
          {!bookings.data?.length && <div className="empty-state"><div className="big">📅</div>لا حجوزات بعد</div>}
          <div className="grid grid-2">
            {(bookings.data || []).map((b) => (
              <div key={b.id} className="card">
                <div className="flex items-center justify-between gap-8 mb-8">
                  <div><b>{b.patient_name}</b><div className="small muted">{b.station_name}</div></div>
                  <span className={`badge ${b.doctor_approved === true ? 'badge-green' : b.doctor_approved === false ? 'badge-red' : 'badge-orange'}`}>
                    {b.doctor_approved === true ? '✔ موافقة الطبيب' : b.doctor_approved === false ? '✖ مرفوض' : '⏳ بانتظار الطبيب'}
                  </span>
                </div>
                <div className="kv-row"><span>الفترة</span><b>{b.date_start} → {b.date_end}</b></div>
                <div className="kv-row"><span>السعر</span><b>{b.price.toLocaleString('ar-DZ')} دج</b></div>
                <div className="kv-row"><span>التأمين</span><b>{b.insurance_label}</b></div>
                <div className="kv-row"><span>الحالة</span><b>{b.status}</b></div>
                {b.status === 'pending' && isDoc && (
                  <div className="flex gap-8 mt-12">
                    <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => approve(b.id, true)}>✔ أوافق على السفر</button>
                    <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => approve(b.id, false)}>✖ أرفض</button>
                  </div>
                )}
                <div className="small muted mt-8">سجّله: {b.created_by || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'reports' && reports.data && (
        <div>
          <div className="grid grid-4">
            <div className="card stat-card"><div className="s-ico bg-purple">📅</div><div><div className="s-num">{reports.data.total}</div><div className="s-lab">إجمالي الحجوزات</div></div></div>
            <div className="card stat-card"><div className="s-ico bg-green">✔</div><div><div className="s-num">{reports.data.approved}</div><div className="s-lab">معتمَدة للعلاج</div></div></div>
            <div className="card stat-card"><div className="s-ico bg-gold">💰</div><div><div className="s-num">{reports.data.revenue_dzd.toLocaleString('ar-DZ')} دج</div><div className="s-lab">الإيراد المتوقع</div></div></div>
            <div className="card stat-card"><div className="s-ico bg-blue">🛡️</div><div><div className="s-num">{reports.data.insured}</div><div className="s-lab">حجوزات مؤمَّنة</div></div></div>
          </div>
          <div className="card mt-16">
            <div className="card-title"><span className="ico">📊</span> المحطات الأكثر طلباً</div>
            {(reports.data.top_stations || []).map((t, i) => (
              <div key={i} className="flex items-center justify-between gap-8" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <b style={{ fontSize: 13 }}>{i + 1}. {t.name}</b>
                <span className="badge badge-purple">{t.count} حجز</span>
              </div>
            ))}
            {!reports.data.top_stations?.length && <p className="muted small">لا بيانات بعد</p>}
          </div>
        </div>
      )}

      {tab === 'suggest' && (
        <div>
          <div className="card" style={{ maxWidth: 560 }}>
            <div className="card-title"><span className="ico">🧠</span> اقتراح المسار العلاجي (ذكاء مبسّط + قاعدة معرفة)</div>
            <form className="flex gap-8 mb-8" onSubmit={suggest}>
              <input className="form-control" placeholder="أدخل التشخيص: روماتيزم، مفاصل، جلدية، فقرات، دورة دموية…" value={suggestQ} onChange={(e) => setSuggestQ(e.target.value)} />
              <button className="btn btn-primary">اقترح</button>
            </form>
            {suggestRes && (
              <div>
                <div className="small" style={{ background: 'var(--gold-050)', borderRadius: 10, padding: 10, marginBottom: 10 }}>
                  ⚠️ {suggestRes.disclaimer}
                </div>
                <div className="card-title"><span className="ico">🎯</span> أفضل تطابق</div>
                {suggestRes.top ? (
                  <div className="card" style={{ boxShadow: 'none', border: '1px solid var(--line)' }}>
                    <b>{suggestRes.top.name}</b>
                    <div className="small muted">ماء {suggestRes.top.temp}°C — {suggestRes.top.treatments}</div>
                  </div>
                ) : <p className="muted small">لا محطة تطابق التشخيص — راجع مع الطبيب.</p>}
                {(suggestRes.matches || []).length > 0 && (
                  <>
                    <div className="card-title mt-12"><span className="ico">📋</span> تطابقات أخرى (مرتبة)</div>
                    {suggestRes.matches.map((m: any) => (
                      <div key={m.id} className="flex items-center justify-between gap-8" style={{ padding: '7px 0', borderBottom: '1px dashed var(--line)' }}>
                        <b style={{ fontSize: 13 }}>{m.name}</b>
                        <span className="badge badge-white">درجة {m.score} · {m.temp}°C</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {bookModal && (
        <Modal title="حجز سياحة علاجية" icon="📅" onClose={() => setBookModal(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setBookModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={book} disabled={busy}>{busy ? '…' : 'إنشاء الحجز'}</button>
          </>}>
          <form onSubmit={book}>
            <div className="form-row">
              <Field label="المحطة">
                <select className="form-control" value={bookModal.form.station_id} onChange={(e) => setBookModal({ ...bookModal, form: { ...bookModal.form, station_id: e.target.value } })}>
                  <option value="">— اختر —</option>
                  {list.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
              <Field label="اسم المريض"><input className="form-control" required value={bookModal.form.patient_name} onChange={(e) => setBookModal({ ...bookModal, form: { ...bookModal.form, patient_name: e.target.value } })} /></Field>
            </div>
            <div className="form-row">
              <Field label="البداية"><input className="form-control" type="date" value={bookModal.form.date_start} onChange={(e) => setBookModal({ ...bookModal, form: { ...bookModal.form, date_start: e.target.value } })} /></Field>
              <Field label="النهاية"><input className="form-control" type="date" value={bookModal.form.date_end} onChange={(e) => setBookModal({ ...bookModal, form: { ...bookModal.form, date_end: e.target.value } })} /></Field>
            </div>
            <div className="form-row">
              <Field label="السعر (دج)"><input className="form-control" type="number" min={0} value={bookModal.form.price} onChange={(e) => setBookModal({ ...bookModal, form: { ...bookModal.form, price: e.target.value } })} /></Field>
              <label className="flex gap-8 items-center" style={{ alignSelf: 'end', paddingBottom: 10 }}>
                <input type="checkbox" checked={bookModal.form.insurance} onChange={(e) => setBookModal({ ...bookModal, form: { ...bookModal.form, insurance: e.target.checked } })} />
                <span>🛡️ تأمين صحي وسياحي</span>
              </label>
            </div>
            <div className="small muted">بعد الحجز يتحقق الطبيب من الاستطباب ويعطي الموافقة قبل السفر (قانون 18-07).</div>
          </form>
        </Modal>
      )}

      {revModal && (
        <Modal title="تقييم المحطة الحموية" icon="⭐" onClose={() => setRevModal(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setRevModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={addReview}>إرسال التقييم</button>
          </>}>
          <form onSubmit={addReview}>
            <div className="flex gap-8 mb-12" style={{ justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={`btn ${Number(revForm.stars) >= n ? 'btn-gold' : 'btn-line'}`} onClick={() => setRevForm({ ...revForm, stars: n })} style={{ fontSize: 18 }}>★</button>
              ))}
            </div>
            <Field label="تعليقك"><textarea className="form-control" rows={3} value={revForm.comment} onChange={(e) => setRevForm({ ...revForm, comment: e.target.value })} /></Field>
          </form>
        </Modal>
      )}
    </div>
  )
}