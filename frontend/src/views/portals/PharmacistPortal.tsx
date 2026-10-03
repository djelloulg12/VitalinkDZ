import { FormEvent, useState } from 'react'
import { useAuth, useApiData } from '../../auth'
import { api } from '../../api'
import { AdminStats, BreakGlass, InventoryItem, Pharmacy, Prescription, SosDispatch } from '../../types'
import { EmptyState, Field, Modal, PageHead, toast } from '../../ui'

type Tab = 'overview' | 'stock' | 'rx' | 'sos'

export function PharmacistPortal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const [tab, setTab] = useState<Tab>('overview')
  const [addModal, setAddModal] = useState(false)
  const [repId, setRepId] = useState<number | null>(null)
  const [repQty, setRepQty] = useState<number>(20)

  const stats = useApiData<AdminStats>('/admin/stats', refresh)
  const pharm = useApiData<Pharmacy[]>('/pharmacies', refresh)
  const inv = useApiData<{ low_count: number; low: any[]; items: InventoryItem[] }>('/inventory', refresh)
  const rx = useApiData<Prescription[]>('/prescriptions', refresh)
  const dispatches = useApiData<SosDispatch[]>('/sos/dispatches', refresh)
  const bg = useApiData<BreakGlass[]>('/access/break-glass', refresh)

  const s = stats.data
  const openRx = (rx.data || []).filter((r) => r.status === 'open')
  const openDisp = (dispatches.data || []).filter((d) => d.status !== 'resolved')

  const TABS: [Tab, string][] = [
    ['overview', '🗺️ نظرة الصيدلة'],
    ['stock', `📦 المخزون${(inv.data?.low_count || 0) > 0 ? ` (${inv.data?.low_count} ناقص)` : ''}`],
    ['rx', `💊 الروشتات (${openRx.length} مفتوحة)`],
    ['sos', `🚨 الحماية المدنية (${openDisp.length})`],
  ]

  const dispense = async (id: number) => {
    try {
      await api(`/prescriptions/${id}/dispense`, {
        method: 'POST', body: JSON.stringify({}),
      })
      toast('صُرفت الروشتة — خصم تلقائي من المخزون', 'success')
      setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const replenish = async (id: number) => {
    if (!repQty || repQty < 1) { toast('أدخل كمية صحيحة', 'warning'); return }
    try {
      await api(`/inventory/${id}/replenish`, { method: 'POST', body: JSON.stringify({ qty: repQty }) })
      toast('تم التوريد', 'success')
      setRepId(null); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const addStock = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    try {
      await api('/inventory', {
        method: 'POST',
        body: JSON.stringify({
          drug: String(fd.get('drug') || '').trim(), strength: String(fd.get('strength') || ''),
          form: String(fd.get('form') || ''), qty: Number(fd.get('qty')) || 0,
          min_level: Number(fd.get('min')) || 10, pharmacy_id: 1,
        }),
      })
      toast('أُضيف الصنف للمخزون', 'success')
      setAddModal(false); setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  const setDispatch = async (id: number, status: string) => {
    try {
      await api(`/sos/dispatches/${id}/status`, { method: 'POST', body: JSON.stringify({ status }) })
      toast(status === 'resolved' ? 'أُغلق البلاغ بعد التدخل' : 'حُدّث مسار البلاغ', 'success')
      setRefresh((x) => x + 1)
    } catch (e: any) { toast(e.message, 'error') }
  }

  return (
    <div className="container page portal-shell">
      <PageHead icon="💊" title="بوابة الصيدلي الوطني"
        sub="الروشتات الإلكترونية، المخزون الحي، والإسناد للحماية المدنية عبر SOS."
        actions={
          <>
            <span className="hero-chip">🧭 {user?.name}</span>
            <button className="btn btn-gold btn-sm" onClick={() => setAddModal(true)}>➕ صنف مخزون</button>
          </>
        } />

      <div className="tabs mb-16">{TABS.map(([k, l]) => <button key={k} className={`tab-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'overview' && (
        <>
          {(inv.data?.low_count || 0) > 0 && (
            <div className="alert alert-warning mb-16">
              ⚠️ <b>{inv.data?.low_count} صنفاً</b> قُرِب إلى نفاد المخزون (qty &lt; الحد الأدنى) — راجع تبويب المخزون للتوريد العاجل.
            </div>
          )}
          {openRx.length > 0 && (
            <div className="alert alert-info mb-16">
              📋 <b>{openRx.length} روشتة</b> بانتظار الصرف — يمكن صرفها فورياً من تبويب الروشتات.
            </div>
          )}
          <div className="grid grid-4 mb-16">
            {[
              ['🏥', s?.pharmacies ?? '—', 'صيدليات'],
              ['📦', s?.low_stock ?? '—', 'صنوف ناقصة'],
              ['💊', s?.rx_open ?? '—', 'روشتات مفتوحة'],
              ['🚨', s?.sos_fired ?? '—', 'بلاغات SOS نشطة'],
            ].map(([ic, n, l]) => (
              <div key={l as string} className="card stat-card">
                <div className="s-ico" style={{ background: 'var(--purple-050)' }}>{ic}</div>
                <div><div className="s-num">{n}</div><div className="s-lab">{l}</div></div>
              </div>
            ))}
          </div>
          <div className="grid grid-2">
            <div className="card">
              <div className="card-title"><span className="ico">📍</span> الشبكة الصيدلانية</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {(pharm.data || []).map((p) => (
                  <div key={p.id} className="list-item">
                    <div className="lico">🏥</div>
                    <div style={{ flex: 1 }}>
                      <b>{p.name} {p.open_24 && <span className="badge badge-blue">مفتوحة 24/24</span>}</b>
                      <div className="small muted">{p.city} · {p.manager} · {p.items} صنف</div>
                    </div>
                    {p.low > 0 && <span className="badge badge-orange">⚠️ {p.low} ناقص</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title"><span className="ico">🛡️</span> الوصول الطارئ (كسر الزجاج)</div>
              <p className="small muted">جلسات الوصول الطارئ المؤطرة قانونياً (Audit + OTP).</p>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {(bg.data || []).slice(0, 6).map((b) => (
                  <div key={b.id} className="flex items-center justify-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                    <span className="small"><b>{b.requester}</b> — {b.reason.slice(0, 34)}…</span>
                    <span className={`badge ${b.status === 'active' ? 'badge-red' : b.status === 'released' ? 'badge-gray' : 'badge-orange'}`}>{b.status === 'active' ? 'مفعّل' : b.status === 'released' ? 'مغلق' : 'بOTP'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === 'stock' && (
        <>
          {(inv.data?.low || []).length > 0 && (
            <div className="card mb-16" style={{ borderColor: 'var(--orange-100)', borderWidth: 2 }}>
              <div className="card-title"><span className="ico">⚠️</span> منبه النقص الوطني ({inv.data?.low.length})</div>
              <div className="table-wrap"><table className="tbl">
                <thead><tr><th>الصيدلية</th><th>الدواء</th><th>متاح</th><th>أدنى حد</th></tr></thead>
                <tbody>
                  {(inv.data?.low || []).map((l, i) => (
                    <tr key={i}><td>{l.pharmacy}</td><td><b>{l.drug}</b> {l.strength}</td>
                      <td><span className="badge badge-red">⚡ {l.qty}</span></td><td>{l.min_level}</td></tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
          <div className="card">
            <div className="card-title"><span className="ico">📦</span> المخزون الوطني ({inv.data?.items.length ?? 0})</div>
            <div className="table-wrap"><table className="tbl">
              <thead><tr><th>الدواء</th><th>الجرعة</th><th>الصيغة</th><th>الصيدلية</th><th>الكمية</th><th>إجراء</th></tr></thead>
              <tbody>
                {(inv.data?.items || []).map((i) => (
                  <tr key={i.id}>
                    <td><b>{i.drug}</b></td><td>{i.strength}</td><td>{i.form}</td><td>{i.pharmacy}</td>
                    <td>{i.low ? <span className="badge badge-red">⚡ {i.qty}</span> : <span className="badge badge-green">{i.qty}</span>}</td>
                    <td className="row-actions">
                      <button className="btn btn-soft btn-sm" onClick={() => { setRepId(i.id); setRepQty(20) }}>توريد</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        </>
      )}

      {tab === 'rx' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {openRx.length === 0 && <EmptyState icon="💊" text="لا روشتات مفتوحة — كل الروشتات صُرفت أو أُلغيت." />}
          {openRx.map((r) => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div>
                  <b style={{ fontSize: 16 }}>🧾 <span dir="ltr">{r.ref}</span></b>
                  <div className="small muted">مريض: <b>{r.patient_name}</b> · طبيب: {r.doctor_name} · {r.institution}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className="badge badge-blue">بانتظار الصرف</span>
                  <button className="btn btn-primary btn-sm" onClick={() => dispense(r.id)}>✔ صرف وخصم المخزون</button>
                </div>
              </div>
              {r.purpose && <p className="small mt-8" style={{ color: 'var(--ink-2)' }}>🎯 {r.purpose}</p>}
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {(r.items || []).map((it, i) => (
                  <div key={i} className="rx-item">
                    <b>{it.drug}</b>
                    <span className="small muted">{it.strength} · {it.dosage}</span>
                    <span className="small muted">مدة: {it.duration}</span>
                    <span className="badge badge-white">×{it.qty}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {rx.data && openRx.length !== rx.data.length && (
            <details className="card" style={{ opacity: .85 }}>
              <summary className="small muted" style={{ cursor: 'pointer' }}>عرض السجل الكامل ({rx.data.length - openRx.length} صُرفت)</summary>
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {rx.data.filter((r) => r.status !== 'open').map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-8">
                    <span className="small"><b>{r.patient_name}</b> — <span dir="ltr">{r.ref}</span></span>
                    <span className="badge badge-green">صُرفت {r.dispensed_by ? `بواسطة ${r.dispensed_by}` : ''}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {tab === 'sos' && (
        <div style={{ display: 'grid', gap: 10 }}>
          {openDisp.length === 0 && <EmptyState icon="🚨" text="لا بلاغات SOS نشطة — كل شيء تحت السيطرة." />}
          {openDisp.map((d) => (
            <div key={d.id} className="card" style={{ borderColor: d.status === 'fired' ? 'var(--red-100)' : 'var(--orange-100)', borderWidth: 2 }}>
              <div className="flex items-center justify-between gap-12 flex-wrap">
                <div>
                  <b style={{ fontSize: 16 }}>🚨 <span dir="ltr">{d.ref}</span></b>
                  <div className="small muted">{d.patient_name} · {d.phone || '—'} · قناة: {d.channel}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className={`badge ${d.status === 'fired' ? 'badge-red' : 'badge-orange'}`}>{d.status === 'fired' ? 'تم الإطلاق' : 'فريق متجه'}</span>
                  {d.maps ? <a className="btn btn-line btn-sm" href={d.maps} target="_blank" rel="noreferrer">📍 الموقع</a>
                    : <span className="badge badge-gray">بدون GPS</span>}
                  <button className="btn btn-soft btn-sm" onClick={() => setDispatch(d.id, d.status === 'fired' ? 'enroute' : 'resolved')}>
                    {d.status === 'fired' ? 'فريق متجه' : 'أغلق البلاغ'}
                  </button>
                </div>
              </div>
              {d.detail && <p className="small mt-8">{d.detail}</p>}
            </div>
          ))}
        </div>
      )}

      {addModal && (
        <Modal title="إضافة صنف للمخزون" icon="📦" onClose={() => setAddModal(false)} foot={
          <><button className="btn btn-line" onClick={() => setAddModal(false)}>إلغاء</button>
          <button type="submit" form="add-stock-form" className="btn btn-primary">حفظ</button></>
        }>
          <form id="add-stock-form" onSubmit={addStock} className="form-row">
            <Field label="اسم الدواء"><input className="form-control" name="drug" required /></Field>
            <Field label="الجرعة"><input className="form-control" name="strength" placeholder="500mg" /></Field>
            <Field label="الصيغة"><input className="form-control" name="form" placeholder="أقراص / كبسولات / محلول" /></Field>
            <Field label="الكمية"><input className="form-control" name="qty" type="number" min={1} defaultValue={10} /></Field>
            <Field label="الحد الأدنى"><input className="form-control" name="min" type="number" min={0} defaultValue={10} /></Field>
          </form>
        </Modal>
      )}

      {typeof repId === 'number' && (
        <Modal title="توريد كمية إضافية" icon="🚚" onClose={() => setRepId(null)} foot={
          <><button className="btn btn-line" onClick={() => setRepId(null)}>إلغاء</button>
          <button className="btn btn-primary" onClick={() => replenish(repId)}>توريد</button></>
        }>
          <Field label="الكمية الموردة"><input className="form-control" type="number" min="1" value={repQty} onChange={(e) => setRepQty(Number(e.target.value))} /></Field>
        </Modal>
      )}
    </div>
  )
}