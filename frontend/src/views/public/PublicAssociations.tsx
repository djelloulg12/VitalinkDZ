import React, { useEffect, useState } from 'react'
import { api } from '../../api'
import { Stars } from '../../ui'

interface Pub { tiers: { min: number; badge: string; reward: string }[]; associations: any[] }

export function PublicAssociations() {
  const [data, setData] = useState<Pub | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { api<Pub>('/associations/public').then(setData).catch((e) => setErr(e.message)) }, [])

  return (
    <div className="container page">
      <div className="section-head">
        <div>
          <h2>لوحة الشفافية — الجمعيات الشريكة</h2>
          <span className="muted small">بيّنات عامة محدَّثة من التقييم الميداني والزيارات الفعلية — بدون بيانات حساسة</span>
        </div>
        <a className="btn btn-line btn-sm" href="/login">رجوع للمنظومة</a>
      </div>

      {err && <p style={{ color: 'var(--red)' }}>{err}</p>}
      {!data && !err && <p className="muted">جارٍ التحميل…</p>}
      {data && (
        <>
          <div className="card mb-16">
            <div className="card-title"><span className="ico">🏅</span> سلم المكافآت الوطني</div>
            <div className="grid grid-3">
              {(data.tiers || []).map((t) => (
                <div key={t.badge} className="reward-tier" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 12 }}>
                  <span className="badge badge-purple" style={{ whiteSpace: 'nowrap' }}>{t.badge}</span>
                  <div className="small muted">{t.reward} <div><b style={{ fontSize: 11 }}>{t.min}+ نقطة</b></div></div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-2">
            {(data.associations || []).map((a) => (
              <div key={a.id} className="card">
                <div className="flex items-center justify-between gap-8">
                  <b style={{ fontSize: 15 }}>{a.name}</b>
                  <span className="badge badge-green">{a.badge}</span>
                </div>
                <div className="small muted">{a.wilaya_ar ? `ولاية ${a.wilaya_ar}` : '—'}</div>
                <div className="flex gap-4 flex-wrap mt-12">
                  <span className="badge badge-white">👥 {a.volunteers} متطوع</span>
                  <span className="badge badge-white">🚶 {a.visits} زيارة</span>
                  <span className="badge badge-white">📢 {a.activities} نشاط</span>
                  <span className="badge badge-purple">★ {a.points} نقطة</span>
                </div>
                <div className="mt-8"><Stars value={a.stars} max={5} /></div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}