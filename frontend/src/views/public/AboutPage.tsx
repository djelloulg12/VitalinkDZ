import React, { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'

export function AboutPage() {
  useEffect(() => {
    api('/about/about')
      .then((c) => {
        if (c && c.title) document.title = c.title + ' — رعايتي DZ'
      })
      .catch(() => {})
  }, [])

  return (
    <div className="container page">
      <div className="card center-hero" style={{ textAlign: 'center', padding: '60px 30px' }}>
        <div className="brand-logo" style={{ width: 84, height: 84, fontSize: 40, margin: '0 auto 16px' }}>❤️</div>
        <h1 style={{ marginBottom: 6 }}>رعايتي DZ — نبض الرعاية المتصل</h1>
        <p className="muted" style={{ maxWidth: 560, margin: '0 auto' }}>
          منظومة وطنية موحدة تربط وزارة الصحة بالقطاع الجمعوي والمؤسسات الصحية ووكالات السياحة العلاجية
          — لرعاية موصولة لكبار السن والمسنّين المعزولين في الجزائر.
        </p>
        <div className="flex gap-8" style={{ justifyContent: 'center', marginTop: 18 }}>
          <Link className="btn btn-primary" to="/login">دخول المنظومة</Link>
          <Link className="btn btn-line" to="/public/associations">الشفافية — الجمعيات</Link>
          <Link className="btn btn-line" to="/portal/researcher">فكرة المنصة</Link>
        </div>
      </div>
      <div className="grid grid-3 mt-16">
        <div className="card"><div className="big">🏥</div><b>متابعة طبية موصولة</b><p className="muted small mt-8">ملف متابعة Offline-First: تدوينات، مؤشرات حيوية، مرفقات، توقيع اعتماد</p></div>
        <div className="card"><div className="big">♨️</div><b>سياحة علاجية منظمة</b><p className="muted small mt-8">حمامّات معدنية، حزم، اقتراح مسار ذكي، موافقة الطبيب قبل السفر</p></div>
        <div className="card"><div className="big">🏅</div><b>جمعيات شريكة</b><p className="muted small mt-8">نظام نقاط وتقييم ميداني مع لوحة شفافية عامة</p></div>
      </div>
    </div>
  )
}