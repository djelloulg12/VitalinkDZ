import { FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { PublicPackage, PublicStation } from '../../types'
import { Field, toast, Reveal } from '../../ui'

type Lang = 'ar' | 'fr' | 'en'

const T: Record<Lang, Record<string, string>> = {
  ar: {
    title: 'السياحة العلاجية في الجزائر',
    sub: 'حمّامات معدنية موثّقة، حزم علاجية كاملة بمرافقة طبية، وتنظيم عبر وكالات مرخّصة — ونحن نستقبل استعلاماتكم الدولية.',
    stations_h: 'وجهات الحموية المعدنية',
    packages_h: 'الحزم العلاجية الجاهزة',
    inquiry_h: 'اطلب استشارتك العلاجية',
    name: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    country: 'بلد الإقامة',
    treatment: 'العلاج/الحالة المطلوبة',
    destination: 'الوجهة المفضلة (اختياري)',
    nights: 'مدة الإقامة المقترحة',
    message: 'أي تفاصيل إضافية',
    send: 'إرسال الاستعلام',
    sent: 'استُلم استعلامك — سيتواصل معك المنسق خلال 48 ساعة. ✅',
    close: 'إغلاق',
    login: 'بوابة الدخول',
    back_home: 'الرئيسية',
    nights_l: 'ليلة',
    from: 'ابتداءً من',
    dzd: 'دج',
    rating: 'التقييم',
    water: 'حرارة الماء',
    empty: 'لا توجد عروض بعد — عد لاحقاً.',
    note: 'بعد وصولك: مراجعة طبيب المصلحة، بروتوكول جلسات، تأمين صحي وسياحي اختياري، ومتابعة ما بعد العلاج.',
  },
  fr: {
    title: 'Tourisme médical en Algérie',
    sub: 'Stations thermales répertoriées, forfaits complets avec accompagnement médical et organisation par agences agréées — nous recevons vos demandes internationales.',
    stations_h: 'Destinations thermales',
    packages_h: 'Forfaits médicaux prêts',
    inquiry_h: 'Demandez votre consultation',
    name: 'Nom complet',
    email: 'E-mail',
    country: 'Pays de résidence',
    treatment: 'Traitement / pathologie',
    destination: 'Destination préférée (optionnel)',
    nights: 'Durée de séjour souhaitée',
    message: 'Détails complémentaires',
    send: 'Envoyer la demande',
    sent: 'Demande bien reçue — un coordinateur vous contactera sous 48h. ✅',
    close: 'Fermer',
    login: 'Portail d\'accès',
    back_home: 'Accueil',
    nights_l: 'nuits',
    from: 'À partir de',
    dzd: 'DZD',
    rating: 'Note',
    water: 'Température de l\'eau',
    empty: 'Aucune offre pour l\'instant — revenez bientôt.',
    note: 'Sur place : consultation médicale, protocole de séances, assurance santé/voyage optionnelle et suivi post-cure.',
  },
  en: {
    title: 'Medical tourism in Algeria',
    sub: 'Documented thermal springs, complete care packages with medical accompaniment, and licensed agencies — we welcome international inquiries.',
    stations_h: 'Thermal destinations',
    packages_h: 'Ready care packages',
    inquiry_h: 'Request your consultation',
    name: 'Full name',
    email: 'Email',
    country: 'Country of residence',
    treatment: 'Treatment / condition',
    destination: 'Preferred destination (optional)',
    nights: 'Proposed stay length',
    message: 'Additional details',
    send: 'Send inquiry',
    sent: 'Inquiry received — a coordinator will contact you within 48h. ✅',
    close: 'Close',
    login: 'Login portal',
    back_home: 'Home',
    nights_l: 'nights',
    from: 'From',
    dzd: 'DZD',
    rating: 'Rating',
    water: 'Water temperature',
    empty: 'No offers yet — please come back later.',
    note: 'On site: medical consultation, session protocol, optional health/travel insurance and post-treatment follow-up.',
  },
}

export function MedicalTourism() {
  const [lang, setLang] = useState<Lang>('ar')
  const t = T[lang]
  const ltr = lang !== 'ar'

  const [stations, setStations] = useState<PublicStation[] | null>(null)
  const [packages, setPackages] = useState<PublicPackage[] | null>(null)
  const [form, setForm] = useState({
    name: '', email: '', country: '', treatment: '', destination: '', nights: '', message: '',
  })
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    api<PublicStation[]>('/public/stations').then(setStations).catch(() => setStations([]))
    api<PublicPackage[]>('/public/packages').then(setPackages).catch(() => setPackages([]))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/public/inquiries', {
        method: 'POST',
        body: JSON.stringify({ ...form, lang }),
      })
      setSent(true)
      setForm({ name: '', email: '', country: '', treatment: '', destination: '', nights: '', message: '' })
    } catch (err: any) {
      toast(err.message || 'تعذّر الإرسال', 'error')
    } finally {
      setBusy(false)
    }
  }

  const fmt = (n: number) => (n ? n.toLocaleString(lang === 'ar' ? 'ar-DZ' : 'en-US') : '—')

  return (
    <div className="landing tour" dir={ltr ? 'ltr' : 'rtl'}>
      <header className="land-top">
        <div className="land-top-inner">
          <Link className="brand" to="/">
            <div className="brand-logo">❤️</div>
            <div className="brand-text"><b>VITALINK <span>DZ</span></b><small>نبض الرعاية المتصل</small></div>
          </Link>
          <nav className="land-nav">
            <Link to="/">{t.back_home}</Link>
            <Link to="/login" className="btn btn-ghost btn-sm">{t.login} ←</Link>
          </nav>
          <div className="lng-switch" role="group" aria-label="Language">
            {(['ar', 'fr', 'en'] as Lang[]).map((l) => (
              <button key={l} className={`lng-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
                {l === 'ar' ? 'ع' : l === 'fr' ? 'FR' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="land-hero tour-hero">
        <div className="hero-orbs" aria-hidden="true"><i /><i /><i /></div>
        <div className="land-hero-inner">
          <span className="badge badge-gold land-badge">🌍 {lang === 'ar' ? 'بوابتك الدولية' : lang === 'fr' ? 'Votre porte internationale' : 'Your international gateway'}</span>
          <h1>{t.title}</h1>
          <p className="land-sub">{t.sub}</p>
        </div>
      </section>

      <main className="land-main">
        <section className="land-section">
          <Reveal className="land-sec-head"><h2 className="grad-text">{t.stations_h}</h2></Reveal>
          <Reveal className="stagger tour-stations" delay={80}>
            {(stations ?? []).map((s) => (
              <div key={s.id} className="tour-station">
                <div className="flex items-center justify-between gap-8">
                  <b style={{ fontSize: 16 }}>♨️ {s.name}</b>
                  <span className="badge badge-purple">{s.wilaya_ar}</span>
                </div>
                <p className="small muted mb-12">{s.treatments}</p>
                <div className="flex gap-8 flex-wrap small">
                  <span className="badge badge-white">🌡 {s.water_temp}°C</span>
                  <span className="badge badge-white">⭐ {s.rating_avg || '—'}</span>
                  {s.packages_count > 0 && <span className="badge badge-green">{s.packages_count} {lang === 'ar' ? 'حزمة' : lang === 'fr' ? 'forfaits' : 'packages'}</span>}
                </div>
                {s.min_price > 0 && (
                  <div className="tour-price" style={{ fontSize: 14 }}>
                    {t.from} <b>{fmt(s.min_price)} {t.dzd}</b>
                  </div>
                )}
              </div>
            ))}
            {stations && stations.length === 0 && <p className="muted">{t.empty}</p>}
          </Reveal>
        </section>

        <section className="land-section">
          <Reveal className="land-sec-head"><h2 className="grad-text">{t.packages_h}</h2></Reveal>
          <Reveal className="stagger tour-packs" delay={80}>
            {(packages ?? []).map((p) => (
              <div key={p.id} className="tour-pack">
                <span className="badge badge-gold" style={{ alignSelf: 'flex-start' }}>🌍</span>
                <b style={{ fontSize: 16 }}>{p.title}</b>
                <div className="small muted">{p.destination || p.station_name} · {p.nights} {t.nights_l}</div>
                <p className="small" style={{ margin: '8px 0' }}>{p.includes}</p>
                <div className="small muted">{p.treatments}</div>
                <div className="tour-price"><b>{fmt(p.price)} {t.dzd}</b><small>{p.agency_name}</small></div>
              </div>
            ))}
            {packages && packages.length === 0 && <p className="muted">{t.empty}</p>}
          </Reveal>
        </section>

        <section className="land-section tour-inquiry">
          <Reveal className="land-sec-head"><h2 className="grad-text">{t.inquiry_h}</h2></Reveal>
          <Reveal><div className="card" style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
            {sent ? (
              <div className="alert alert-success mb-8">{t.sent} <Link to="/login" className="btn btn-gold btn-sm mt-8">← {t.login}</Link></div>
            ) : (
              <form onSubmit={submit}>
                <div className="form-row">
                  <Field label={t.name}><input className="form-control" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                  <Field label={t.email}><input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
                </div>
                <div className="form-row">
                  <Field label={t.country}><input className="form-control" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
                  <Field label={t.treatment}><input className="form-control" required value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} /></Field>
                </div>
                <div className="form-row">
                  <Field label={t.destination}>
                    <select className="form-control" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })}>
                      <option value="">—</option>
                      {(stations ?? []).map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label={t.nights}><input className="form-control" value={form.nights} onChange={(e) => setForm({ ...form, nights: e.target.value })} placeholder="7" /></Field>
                </div>
                <Field label={t.message}><textarea className="form-control" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></Field>
                <button className="btn btn-primary" disabled={busy}>{busy ? '…' : `${t.send} 🌍`}</button>
              </form>
            )}
            <p className="small muted mt-16" style={{ lineHeight: 1.8 }}>🩺 {t.note}</p>
          </div></Reveal>
        </section>
      </main>

      <footer className="land-foot">
        <p>VITALINK DZ — {lang === 'ar' ? 'نبض الرعاية المتصل' : lang === 'fr' ? 'le pouls d\'une prise en charge connectée' : 'the pulse of connected care'}</p>
        <div className="land-foot-links">
          <Link to="/">{t.back_home}</Link>
          <Link to="/login">{t.login}</Link>
        </div>
      </footer>
    </div>
  )
}