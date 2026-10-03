import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiData, useAuth } from '../../auth'
import { SiteContent } from '../../types'

export function ResearcherPortal() {
  const { user } = useAuth()
  const [refresh, setRefresh] = useState(0)
  const researcher = useApiData<SiteContent>('/about/researcher', refresh)
  const about = useApiData<SiteContent>('/about/about', refresh)

  useEffect(() => {
    if (researcher.data?.title) document.title = researcher.data.title + ' — رعايتي DZ'
  }, [researcher.data])

  const c = researcher.data

  return (
    <div className="container page">
      <div className="card researcher-hero" style={{ padding: '40px 28px', background: 'linear-gradient(135deg,#7C3AED,#5B21B6)', color: '#fff', borderRadius: 20 }}>
        <div className="flex items-center gap-16 flex-wrap">
          <div className="brand-logo" style={{ width: 84, height: 84, fontSize: 38, background: 'rgba(255,255,255,.16)' }}>🎓</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="small" style={{ opacity: .85 }}>فكرة المذكرة الأكاديمية — إدارة الأعمال السياحية</div>
            <h1 style={{ margin: '4px 0' }}>{c?.title || 'السيرة الذاتية — رجاء بن إسماعيل'}</h1>
            <span className="badge" style={{ background: 'rgba(255,255,255,.16)' }}>المراسلة: rajaaben1805@gmail.com</span>
          </div>
          <div className="flex gap-8">
            <Link className="btn" style={{ background: '#fff', color: '#7C3AED' }} to="/about">من نحن</Link>
            {user?.role === 'admin' && <Link className="btn btn-line" style={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)' }} to="/admin/about">✏️ إدارة المحتوى</Link>}
          </div>
        </div>
      </div>

      <div className="grid grid-2 mt-16">
        {(c?.sections || []).map((s, i) => (
          <div key={i} className="card">
            <div className="card-title"><span className="ico">📝</span> {s.h}</div>
            <p className="muted">{s.p}</p>
          </div>
        ))}
        {about.data && (
          <div className="card" style={{ gridColumn: '1/-1' }}>
            <div className="card-title"><span className="ico">💡</span> {about.data.title}</div>
            <div className="grid grid-2">
              {(about.data.sections || []).map((s, i) => (
                <div key={i} className="kv-row"><span>{s.h}</span><b style={{ whiteSpace: 'normal' }}>{s.p}</b></div>
              ))}
            </div>
            <blockquote style={{ borderRight: '3px solid var(--purple)', padding: '10px 14px', background: 'var(--purple-050)', borderRadius: 10, marginTop: 12 }}>
              "توظيف التقنية لبناء جسور رعاية بين الدولة والجمعيات والأسرة — خصوصاً في المناطق الصحراوية."
            </blockquote>
          </div>
        )}
      </div>
    </div>
  )
}