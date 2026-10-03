import { useState } from 'react'
import { useApiData } from '../../auth'
import { api } from '../../api'
import { Association } from '../../types'
import { Modal, Field, Stars, toast } from '../../ui'
import { exportCSV, printDoc, stamp } from '../../printutil'

function pointsPreview(visits: number, volunteers: number, activities: number, impact: number) {
  return visits * 10 + volunteers * 5 + activities * 40 + impact * 150
}

export function Associations() {
  const [refresh, setRefresh] = useState(0)
  const { data, error, loading } = useApiData<Association[]>('/associations', refresh)
  const [evalFor, setEvalFor] = useState<Association | null>(null)
  const [form, setForm] = useState({ visits: 0, volunteers: 0, activities: 0, impact: 0, notes: '' })
  const [busy, setBusy] = useState(false)

  const openEval = (a: Association) => {
    setEvalFor(a)
    setForm({ visits: a.visits, volunteers: a.volunteers, activities: a.activities, impact: 0, notes: '' })
  }

  const submit = async () => {
    if (!evalFor) return
    setBusy(true)
    try {
      const r = await api<Association>(`/associations/${evalFor.id}/evaluate`, {
        method: 'POST',
        body: JSON.stringify(form),
      })
      toast(`تم التقييم — النقاط: ${r.points} — ${r.stars} ★`, 'success')
      setEvalFor(null)
      setRefresh((x) => x + 1)
    } catch (err: any) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <p className="muted">جارٍ التحميل…</p>
  if (error) return <p style={{ color: 'var(--red)' }}>{error}</p>
  const rows = data || []
  const preview = evalFor ? pointsPreview(form.visits, form.volunteers, form.activities, form.impact) : 0

  const exportAssocCSV = () =>
    exportCSV(
      'associations.csv',
      ['الترتيب', 'الجمعية', 'الولاية', 'المتطوعون', 'الزيارات', 'الأنشطة', 'النقاط', 'النجوم', 'آخر تقييم'],
      rows.map((a, i) => [i + 1, a.name, a.wilaya_ar || '', a.volunteers, a.visits, a.activities, a.points, a.stars.toFixed(1), stamp()]),
    )

  const printAssocReport = () =>
    printDoc({
      title: 'تقرير تصنيف الجمعيات النشطة',
      number: 'VLK-ASO-RPT-' + new Date().getFullYear(),
      qr: `VLK-ASO:${rows.length}:${rows.reduce((n, a) => n + a.points, 0)}`,
      sigs: [{ label: 'رئيس لجنة التقييم' }, { label: 'المدير' }, { label: 'ختم المصادقة' }],
      body: `
        <div class="kv"><span>عدد الجمعيات المقيّمة</span><b>${rows.length}</b></div>
        <div class="kv"><span>إجمالي النقاط</span><b>${rows.reduce((n, a) => n + a.points, 0)}</b></div>
        <table>
          <thead><tr><th>#</th><th>الجمعية</th><th>الولاية</th><th>متطوع</th><th>زيارة</th><th>نشاط</th><th>نقاط</th><th>نجوم</th></tr></thead>
          <tbody>${rows.map((a, i) => `<tr><td>${i + 1}</td><td>${a.name}</td><td>${a.wilaya_ar || '—'}</td><td>${a.volunteers}</td><td>${a.visits}</td><td>${a.activities}</td><td><b>${a.points}</b></td><td>${a.stars.toFixed(1)} ★</td></tr>`).join('')}</tbody>
        </table>`,
    })

  return (
    <div>
      <div className="section-head">
        <div>
          <h2>نقاط الجمعيات النشطة</h2>
          <span className="muted small">ترتيب تنازلي حسب النقاط — النقاط = 10×الزيارات + 5×المتطوعين + 40×الأنشطة + 150×الأثر الميداني</span>
        </div>
        <div className="flex gap-8">
          <a className="btn btn-line" href="/public/associations">🌐 الشفافية العامة</a>
          <button className="btn btn-line" onClick={exportAssocCSV}>⬇️ تصدير CSV</button>
          <button className="btn btn-line" onClick={printAssocReport}>🖨️ تقرير رسمي</button>
          <span className="badge badge-purple">🏅 {rows.length} جمعية</span>
        </div>
      </div>

      <div className="card">
        {rows.map((a, idx) => (
          <div key={a.id} className="assoc-row">
            <div className={`rank-badge ${idx === 0 ? 'rank-1' : idx === 1 ? 'rank-2' : idx === 2 ? 'rank-3' : 'rank-n'}`}>
              #{idx + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{a.name}</b>
              <div className="small muted">
                {a.wilaya_ar || '—'} {a.wilaya_fr ? ` (${a.wilaya_fr})` : ''}
              </div>
              {a.reward && (
                <div className="flex gap-8 mt-8">
                  <span className={`badge ${idx === 0 ? 'badge-gold' : idx === 1 ? 'badge-teal' : 'badge-purple'}`}>🎖️ {a.reward.badge}</span>
                  <span className="small muted">{a.reward.reward}</span>
                </div>
              )}
            </div>
            <div style={{ minWidth: 90, textAlign: 'center' }}>
              <div className="s-num" style={{ fontSize: 15 }}>{a.volunteers}</div>
              <div className="small muted">متطوع</div>
            </div>
            <div style={{ minWidth: 90, textAlign: 'center' }}>
              <div className="s-num" style={{ fontSize: 15 }}>{a.visits}</div>
              <div className="small muted">زيارة</div>
            </div>
            <div style={{ minWidth: 90, textAlign: 'center' }}>
              <div className="s-num" style={{ fontSize: 20, color: 'var(--purple)' }}>{a.points}</div>
              <div className="small muted">نقطة</div>
            </div>
            <div style={{ minWidth: 110, textAlign: 'center' }}>
              <Stars value={a.stars} />
              <div className="small muted">{a.stars.toFixed(1)}/5</div>
            </div>
            <button className="btn btn-soft btn-sm" onClick={() => openEval(a)}>
              📊 تقييم الأداء الميداني
            </button>
          </div>
        ))}
        {!rows.length && <div className="empty-state"><div className="big">🏅</div>لا جمعيات بعد</div>}
      </div>

      {evalFor && (
        <Modal title="تقييم الأداء الميداني" icon="📊" onClose={() => setEvalFor(null)}
          foot={
            <>
              <button className="btn btn-line" onClick={() => setEvalFor(null)}>إلغاء</button>
              <button className="btn btn-primary" onClick={submit} disabled={busy}>
                {busy ? 'جارٍ الحساب…' : 'حفظ التقييم وإعادة الاحتساب'}
              </button>
            </>
          }>
          <div className="card mb-16" style={{ background: 'var(--purple-050)' }}>
            <b>{evalFor.name}</b>
            <div className="flex justify-between mt-8">
              <span className="muted small">النقاط الحالية</span>
              <b>{evalFor.points} نقطة — <Stars value={evalFor.stars} /> {evalFor.stars.toFixed(1)}</b>
            </div>
          </div>
          <div className="form-row-3">
            <Field label="الزيارات الميدانية">
              <input type="number" min={0} className="form-control" value={form.visits} onChange={(e) => setForm({ ...form, visits: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="عدد المتطوعين">
              <input type="number" min={0} className="form-control" value={form.volunteers} onChange={(e) => setForm({ ...form, volunteers: Number(e.target.value) || 0 })} />
            </Field>
            <Field label="الأنشطة المنظمة">
              <input type="number" min={0} className="form-control" value={form.activities} onChange={(e) => setForm({ ...form, activities: Number(e.target.value) || 0 })} />
            </Field>
          </div>
          <Field label="الأثر الميداني (0–5)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="range" min={0} max={5} value={form.impact} onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })} style={{ flex: 1 }} />
              <span className="badge badge-purple">{form.impact}</span>
            </div>
          </Field>
          <Field label="ملاحظات">
            <textarea className="form-control" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="card" style={{ background: 'var(--green-100)', textAlign: 'center' }}>
            <span className="small" style={{ color: '#15803D' }}>النقاط الجديدة المحسوبة: <b style={{ fontSize: 20 }}>{preview}</b></span>
          </div>
        </Modal>
      )}
    </div>
  )
}