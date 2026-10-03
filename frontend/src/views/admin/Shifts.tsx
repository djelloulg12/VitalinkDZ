import { FormEvent, useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { DutyShift, Staff } from '../../types'
import { Field, Modal, toast } from '../../ui'

export function Shifts() {
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useApiData<DutyShift[]>('/shifts', refresh)
  const staff = useApiData<Staff[]>('/staff', 0)
  const week = useApiData<{ days: { date: string; count: number }[] }>('/shifts/weekly', refresh)
  const [modal, setModal] = useState<null | { id?: number; form: any }>(null)
  const [busy, setBusy] = useState(false)

  const openNew = () => setModal({ form: { staff_id: '', date: new Date().toISOString().slice(0, 10), shift: 'morning', unit: '', note: '' } })

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (!modal) return
    setBusy(true)
    try {
      const body = { ...modal.form, staff_id: Number(modal.form.staff_id) }
      await api('/shifts', { method: 'POST', body: JSON.stringify(body) })
      toast('أُضيفت النوبة', 'success')
      setModal(null)
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') } finally { setBusy(false) }
  }

  const remove = async (s: DutyShift) => {
    if (!window.confirm('حذف النوبة؟')) return
    try {
      await api(`/shifts/${s.id}`, { method: 'DELETE' })
      setRefresh((x) => x + 1)
    } catch (err: any) { toast(err.message, 'error') }
  }

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const rows = data || []
  const label = (s: string) => ({ morning: '☀️ صباحية', evening: '🌤 مسائية', night: '🌙 ليلية' } as Record<string, string>)[s] || s

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>إدارة نوبات العمل (Duty Shifts)</h2>
          <span className="muted small">تنظيم تغطية الأطباء والممرضين عبر الوحدات — صباحية/مسائية/ليلية</span>
        </div>
        <button className="btn btn-gold" onClick={openNew}>➕ نوبة جديدة</button>
      </div>

      <div className="flex gap-8 flex-wrap mb-16">
        <span className="badge badge-purple">🗓 {rows.length} نوبة</span>
        {(week.data?.days || []).slice(0, 7).map((d) => (
          <span key={d.date} className="badge badge-white">{d.date} — {d.count} نوبة</span>
        ))}
      </div>

      {!rows.length && <div className="empty-state"><div className="big">🗓</div>لا نوبات بعد</div>}

      <div className="grid grid-2">
        {rows.map((s) => (
          <div key={s.id} className="card shift-card">
            <div className="flex items-center justify-between gap-8">
              <div>
                <b>{s.staff_name}</b>
                <div className="small muted">{s.staff_kind === 'doctor' ? '🩺 طبيب' : '💉 ممرض'}</div>
              </div>
              <span className={`badge ${s.shift === 'night' ? 'badge-orange' : 'badge-purple'}`}>{label(s.shift)}</span>
            </div>
            <div className="kv-row mt-12"><span>التاريخ</span><b>{s.date}</b></div>
            <div className="kv-row"><span>الوحدة / المكان</span><b>{s.unit || '—'}</b></div>
            {s.note && <div className="small muted mt-8">{s.note}</div>}
            <div className="flex gap-8 mt-12">
              <button className="btn btn-danger btn-sm" onClick={() => remove(s)}>🗑️ حذف</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title="إضافة نوبة عمل" icon="🗓" onClose={() => setModal(null)}
          foot={<>
            <button className="btn btn-line" onClick={() => setModal(null)}>إلغاء</button>
            <button className="btn btn-success" onClick={save} disabled={busy}>{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
          </>}>
          <form onSubmit={save}>
            <Field label="المتعاقد">
              <select className="form-control" required value={modal.form.staff_id} onChange={(e) => setModal({ ...modal, form: { ...modal.form, staff_id: e.target.value } })}>
                <option value="">— اختر —</option>
                {(staff.data || []).map((s) => <option key={s.id} value={s.id}>{s.full_name} ({s.kind === 'doctor' ? 'طبيب' : 'ممرض'})</option>)}
              </select>
            </Field>
            <div className="form-row">
              <Field label="التاريخ">
                <input className="form-control" type="date" required value={modal.form.date} onChange={(e) => setModal({ ...modal, form: { ...modal.form, date: e.target.value } })} />
              </Field>
              <Field label="الشيفت">
                <select className="form-control" value={modal.form.shift} onChange={(e) => setModal({ ...modal, form: { ...modal.form, shift: e.target.value } })}>
                  <option value="morning">صباحية</option>
                  <option value="evening">مسائية</option>
                  <option value="night">ليلية</option>
                </select>
              </Field>
            </div>
            <Field label="الوحدة / المكان">
              <input className="form-control" value={modal.form.unit} onChange={(e) => setModal({ ...modal, form: { ...modal.form, unit: e.target.value } })} />
            </Field>
            <Field label="ملاحظة">
              <textarea className="form-control" rows={2} value={modal.form.note} onChange={(e) => setModal({ ...modal, form: { ...modal.form, note: e.target.value } })} />
            </Field>
          </form>
        </Modal>
      )}
    </div>
  )
}