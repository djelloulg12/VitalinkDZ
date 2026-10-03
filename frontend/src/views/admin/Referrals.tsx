import { FormEvent, useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { InLink, InstitutionRef, RedAlertItem, Referral } from '../../types'
import { Avatar, Modal, Field, toast } from '../../ui'
import { docNumber, exportCSV, printDoc } from '../../printutil'

const EMPTY_REF = { patient_name: '', from_institution_id: '', to_institution_id: '', reason: '', medical_note: '', severity: 'normal' }

function statusBadge(s: string) {
  if (s === 'accepted') return <span className="badge badge-green">✔ مقبول</span>
  if (s === 'rejected') return <span className="badge badge-red">✖ مرفوض</span>
  return <span className="badge badge-orange">⏳ قيد الانتظار</span>
}

export function Referrals() {
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useApiData<Referral[]>('/referrals', refresh)
  const reds = useApiData<{ count: number; items: RedAlertItem[] }>('/referrals/red-alerts', refresh)
  const refs = useApiData<InLink[]>('/referrals/links', refresh)
  const inst = useApiData<InstitutionRef[]>('/institutions', 0)
  const [createOpen, setCreateOpen] = useState(false)
  const [linksOpen, setLinksOpen] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_REF })
  const [busy, setBusy] = useState(false)
  const [newLink, setNewLink] = useState({ a: '', b: '' })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/referrals', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          from_institution_id: form.from_institution_id ? Number(form.from_institution_id) : null,
          to_institution_id: form.to_institution_id ? Number(form.to_institution_id) : null,
        }),
      })
      toast(form.severity === 'red' ? 'أُرسلت إحالة طارئة (RED ALERT) — الفريق المناوب على علم' : 'أُرسلت الإحالة إلى الجهة المستقبِلة', 'success')
      setCreateOpen(false)
      setForm({ ...EMPTY_REF })
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const decide = async (id: number, status: string) => {
    try {
      await api(`/referrals/${id}/decide`, { method: 'POST', body: JSON.stringify({ status }) })
      toast(status === 'accepted' ? 'قُبلت الإحالة' : 'رُفضت الإحالة', 'success')
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  const addLink = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/referrals/links', {
        method: 'POST',
        body: JSON.stringify({ institution_a_id: Number(newLink.a), institution_b_id: Number(newLink.b) }),
      })
      toast('تم ربط المؤسستين', 'success')
      setNewLink({ a: '', b: '' })
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const removeLink = async (id: number) => {
    if (!window.confirm('فكّ الربط؟')) return
    try {
      await api(`/referrals/links/${id}`, { method: 'DELETE' })
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    }
  }

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const referrals = data || []

  const exportReferralCSV = () =>
    exportCSV(
      'referrals.csv',
      ['رقم', 'المريض', 'من', 'إلى', 'السبب', 'الحالة', 'قرّرت الجهة', 'تاريخ الإنشاء'],
      referrals.map((r) => [r.id, r.patient_name, r.from?.name || '', r.to?.name || '', r.reason, r.status, r.decided_by, r.created_at || '']),
    )

  const printReferralDoc = (r: Referral) =>
    printDoc({
      title: 'وثيقة إحالة إلكترونية',
      number: docNumber('REF', r.id),
      qr: `VLK-REF:${r.id}:${r.patient_name}`,
      sigs: [{ label: 'الجهة المحيلة' }, { label: 'الجهة المستقبِلة' }, { label: 'ختم المؤسسة' }],
      body: `
        <div class="kv"><span>رقم الإحالة</span><b>${docNumber('REF', r.id)}</b></div>
        <div class="kv"><span>اسم المريض</span><b>${r.patient_name}</b></div>
        <div class="kv"><span>من (الجهة المحيلة)</span><b>${r.from?.name || '—'} ${r.from?.city ? '— ' + r.from.city : ''}</b></div>
        <div class="kv"><span>إلى (الجهة المستقبِلة)</span><b>${r.to?.name || '—'} ${r.to?.city ? '— ' + r.to.city : ''}</b></div>
        <div class="kv"><span>سبب الإحالة</span><b>${r.reason || '—'}</b></div>
        <div class="kv"><span>الملاحظة الطبية</span><b>${r.medical_note || '—'}</b></div>
        <div class="kv"><span>الحالة</span><b>${r.status === 'accepted' ? 'مقبولة' : r.status === 'rejected' ? 'مرفوضة' : 'قيد الانتظار'}</b></div>
        <div class="kv"><span>تاريخ الإنشاء</span><b>${r.created_at ? new Date(r.created_at).toLocaleString('ar-DZ') : '—'}</b></div>
        <div class="kv"><span>وصول الحالة من الجهة المستقبِلة</span><b>${r.decided_by || '—'} ${r.decided_at ? '— ' + new Date(r.decided_at).toLocaleString('ar-DZ') : ''}</b></div>`,
    })

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>نظام الإحالة الإلكتروني (E-Referral)</h2>
          <span className="muted small">إحالة المرضى بين المؤسسات إلكترونياً مع متابعة الحالة</span>
        </div>
        <div className="flex gap-8">
          <button className="btn btn-line" onClick={exportReferralCSV}>⬇️ تصدير CSV</button>
          <button className="btn btn-line" onClick={() => setLinksOpen(true)}>⛓️ ربط المؤسسات</button>
          <button className="btn btn-gold" onClick={() => setCreateOpen(true)}>➕ إحالة جديدة</button>
        </div>
      </div>

      <div className="flex gap-12 mb-16 flex-wrap">
        <span className="badge badge-gray">المجموع: {referrals.length}</span>
        <span className="badge badge-orange">قيد الانتظار: {referrals.filter((r) => r.status === 'pending').length}</span>
        <span className="badge badge-green">مقبول: {referrals.filter((r) => r.status === 'accepted').length}</span>
        <span className="badge badge-red">مرفوض: {referrals.filter((r) => r.status === 'rejected').length}</span>
        {reds.data && reds.data.count > 0 && <span className="badge badge-red">🚨 RED ALERT معلقة: {reds.data.count}</span>}
      </div>

      {reds.data && reds.data.items.length > 0 && (
        <div className="card red-alert-panel mb-16" style={{ borderRight: '5px solid var(--red)', background: 'var(--red-050)' }}>
          <div className="flex items-center gap-8 mb-8" style={{ color: 'var(--red)' }}>
            <span className="big">🚨</span>
            <b style={{ fontSize: 16 }}>تنبيهات إحالة طارئة — تتجاوز بعضها مهلة الاستجابة الست ساعات</b>
          </div>
          {reds.data.items.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-8" style={{ padding: '8px 0', borderBottom: '1px dashed rgba(220,38,38,.2)' }}>
              <div>
                <b style={{ fontSize: 13 }}>#{r.id} — {r.patient_name}</b>
                <div className="small muted">{r.reason}</div>
              </div>
              <span className="badge" style={{ background: r.breached ? 'var(--red)' : 'var(--gold)', color: '#fff' }}>
                {r.breached ? `⏱ استجابة تتجاوز 6 ساعات (${r.age_hours}س)` : `${r.age_hours} س منذ الإنشاء`}
              </span>
            </div>
          ))}
        </div>
      )}

      {!referrals.length && <div className="empty-state"><div className="big">🔄</div>لا إحالات بعد</div>}

      <div className="grid grid-2">
        {referrals.map((r) => (
          <div key={r.id} className="ref-card">
            <div className="flex items-center justify-between gap-8 mb-12">
              <div className="pat-cell">
                <Avatar name={r.patient_name} />
                <div>
                  <b>{r.patient_name}</b>
                  <small className="muted">{r.created_at ? new Date(r.created_at).toLocaleString('ar-DZ', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</small>
                </div>
              </div>
              <span className="flex gap-8 items-center">
                {r.severity === 'red' && <span className="badge badge-red">🚨 طارئة</span>}
                {r.sla_hours != null && <span className="badge badge-white">⏱ {r.sla_hours} س</span>}
                {statusBadge(r.status)}
                <button className="btn btn-line btn-sm" onClick={() => printReferralDoc(r)}>🖨️</button>
              </span>
            </div>

            <div className="ref-flow">
              <div className="card" style={{ boxShadow: 'none', padding: 12 }}>
                <div className="small muted">من</div>
                <b style={{ fontSize: 13 }}>{r.from?.name || '—'}</b>
                <div className="small muted">{r.from?.city ? `${r.from.city} — و.${r.from.wilaya_id}` : ''}</div>
              </div>
              <div className="ref-arrow">⇄</div>
              <div className="card" style={{ boxShadow: 'none', padding: 12 }}>
                <div className="small muted">إلى</div>
                <b style={{ fontSize: 13 }}>{r.to?.name || '—'}</b>
                <div className="small muted">{r.to?.city ? `${r.to.city} — و.${r.to.wilaya_id}` : ''}</div>
              </div>
            </div>

            <div className="mt-12" style={{ background: 'var(--purple-050)', borderRadius: 14, padding: '10px 14px', fontSize: 13 }}>
              <b>السبب: </b>{r.reason || '—'}
              {r.medical_note && (
                <div className="muted small mt-8">{r.medical_note}</div>
              )}
            </div>

            {r.status === 'pending' && (
              <div className="flex gap-8 mt-12">
                <button className="btn btn-success btn-sm" style={{ flex: 1 }} onClick={() => decide(r.id, 'accepted')}>✔ قبول</button>
                <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => decide(r.id, 'rejected')}>✖ رفض</button>
              </div>
            )}
            {r.status !== 'pending' && <div className="small muted mt-12">◉ قررت الجهة المستقبِلة: {r.decided_by || '—'}</div>}
          </div>
        ))}
      </div>

      {createOpen && (
        <Modal title="إنشاء إحالة إلكترونية جديدة" icon="🔄" onClose={() => setCreateOpen(false)} size="modal-lg"
          foot={
            <>
              <button className="btn btn-line" onClick={() => setCreateOpen(false)}>إلغاء</button>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال الإحالة'}</button>
            </>
          }>
          <form onSubmit={submit}>
            <Field label="اسم المريض">
              <input className="form-control" required value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="من (الجهة المُحيلة)">
                <select className="form-control" value={form.from_institution_id} onChange={(e) => setForm({ ...form, from_institution_id: e.target.value })}>
                  <option value="">— اختر —</option>
                  {(inst.data || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
              <Field label="إلى (الجهة المستقبِلة)">
                <select className="form-control" value={form.to_institution_id} onChange={(e) => setForm({ ...form, to_institution_id: e.target.value })}>
                  <option value="">— اختر —</option>
                  {(inst.data || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="سبب الإحالة">
              <input className="form-control" required value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </Field>
            <Field label="ملاحظة طبية">
              <textarea className="form-control" value={form.medical_note} onChange={(e) => setForm({ ...form, medical_note: e.target.value })} />
            </Field>
            <Field label="الأولوية">
              <select className="form-control" value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                <option value="normal">عادية — رد ضمن 48 ساعة</option>
                <option value="red">🚨 طارئة (RED ALERT) — رد ضمن 6 ساعات واتصال الفريق المناوب</option>
              </select>
            </Field>
          </form>
        </Modal>
      )}

      {linksOpen && (
        <Modal title="ربط المؤسسات في نظام الإحالة" icon="⛓️" onClose={() => setLinksOpen(false)} size="modal-lg"
          foot={<button className="btn btn-line" onClick={() => setLinksOpen(false)}>إغلاق</button>}>
          <form className="form-row mb-16" onSubmit={addLink}>
            <Field label="المؤسسة (أ)">
              <select className="form-control" required value={newLink.a} onChange={(e) => setNewLink({ ...newLink, a: e.target.value })}>
                <option value="">—</option>
                {(inst.data || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <Field label="المؤسسة (ب)">
              <select className="form-control" required value={newLink.b} onChange={(e) => setNewLink({ ...newLink, b: e.target.value })}>
                <option value="">—</option>
                {(inst.data || []).map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </Field>
            <div style={{ alignSelf: 'end' }}>
              <button className="btn btn-success" disabled={busy}>➕ ربط</button>
            </div>
          </form>
          <div className="card-title"><span className="ico">⛓️</span> الروابط الحالية ({refs.data?.length || 0})</div>
          {(refs.data || []).map((l) => (
            <div key={l.id} className="flex items-center justify-between gap-8" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <span style={{ fontSize: 13 }}>
                <b>{l.a?.name}</b> ⇄ <b>{l.b?.name}</b>
              </span>
              <button className="btn btn-ghost btn-sm" onClick={() => removeLink(l.id)}>🗑️ فكّ</button>
            </div>
          ))}
          {!refs.data?.length && <p className="muted small">لا روابط — اربط مؤسستين للسماح بالإحالات المباشرة.</p>}
        </Modal>
      )}
    </div>
  )
}