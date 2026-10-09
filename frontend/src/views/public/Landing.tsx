import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ROLE_INFO } from '../../types'
import { Reveal } from '../../ui'

type Lang = 'ar' | 'fr' | 'en'

const T: Record<Lang, Record<string, string>> = {
  ar: {
    badge: 'منظومة وطنية جزائرية',
    title: 'رعايتي DZ',
    sub: 'نبض الرعاية المتصل — سجل صحّي موحّد، إحالة إلكترونية مغلقة الحلقة، حضور لحظي وسياحة علاجية بمرافقة كاملة.',
    cta_login: 'بوابة الدخول الموحّدة',
    cta_tourism: 'السياحة العلاجية',
    stats_1: '58 ولاية',
    stats_1l: 'تغطية وطنية',
    stats_2: '10 أدوار',
    stats_2l: 'منسّقة عبر منصة واحدة',
    stats_3: '24/7',
    stats_3l: 'حضور واستغاثة لحظية',
    features_h: 'لماذا رعايتي DZ؟',
    features_hs: 'القيمة المضافة المتفردة: اللحظية + الشفافية',
    f1: 'سجل صحي موحّد',
    f1d: 'ملف متصل بين الطبيب والممرض والصيدلي والأسرة — يُقرأ ويُحدَّث لحظياً وفق الصلاحيات.',
    f2: 'إحالة إلكترونية مغلقة',
    f2d: 'من الإحالة إلى القبول إلى النتيجة النهائية مع تتبّع الالتزام الزمني (SLA) وتنبيه الطوارئ.',
    f3: 'حضور لحظي موثّق',
    f3d: 'نبض موقع حي للفرق الميدانية مع وضع دون اتصال ومزامنة تلقائية عند عودة الشبكة.',
    f4: 'رعاية كبار السن',
    f4d: 'وضع خاص للرعاية المنزلية: متابعة، فرق متنقلة، جمعيات نشطة ونقاط مكافأة.',
    f5: 'سياحة علاجية',
    f5d: 'حمّامات معدنية وحزم علاجية كاملة بمرافقة طبية — ومتاحة دولياً بالفرنسية والإنجليزية.',
    f6: 'شفافية وتدقيق',
    f6d: 'سجلّ عمليات كامل (Audit) لكل وصول وتغيير — ثقة قانونية للمؤسسات والدولة.',
    roles_h: 'فاعلون متصلون بمنظومة واحدة',
    how_h: 'كيف تبدأ في ثلاث خطوات',
    h1: 'اختر دورك',
    h1d: 'مريض، طبيب، ممرض، أسرة، جمعية، وكالة… — عشرة أدوار متكاملة.',
    h2: 'ادخل بالحساب التجريبي',
    h2d: 'كل دور له حساب تجريبي جاهز (demo123) لتجربة المنظومة كاملة.',
    h3: 'اعمل وابدع قصص رعاية',
    h3d: 'أنشئ ملفاً، أرسل إحالة، سجّل قياساً أو احجز رحلة علاجية.',
    trust: '🔒 بيانات صحية مشفّرة · 🔍 سجل تدقيق كامل · 📴 يعمل دون إنترنت (PWA) · 🧭 متاح دولياً',
    footer: 'رعايتي DZ — منظومة وطنية موحدة للرعاية الصحية والاجتماعية والسياحة العلاجية.',
  },
  fr: {
    badge: 'Plateforme nationale algérienne',
    title: 'Riayati DZ',
    sub: 'Le pouls d\'une prise en charge connectée — dossier de santé unifié, e-référencement à boucle fermée, présence en temps réel et tourisme médical accompagné.',
    cta_login: 'Portail d\'accès unifié',
    cta_tourism: 'Tourisme médical',
    stats_1: '58 wilayas',
    stats_1l: 'Couverture nationale',
    stats_2: '10 rôles',
    stats_2l: 'Coordonnés sur une seule plateforme',
    stats_3: '24/7',
    stats_3l: 'Présence et urgence en direct',
    features_h: 'Pourquoi Riayati DZ ?',
    features_hs: 'Valeur unique : temps réel + transparence',
    f1: 'Dossier de santé unifié',
    f1d: 'Un dossier connecté médecin, infirmier, pharmacien, famille — lu et mis à jour en temps réel selon les droits.',
    f2: 'E-référencement à boucle fermée',
    f2d: 'De la référence à l\'acceptation puis au résultat final, avec suivi SLA et alertes urgentes.',
    f3: 'Présence vérifiée en direct',
    f3d: 'Position des équipes de terrain avec mode hors-ligne et synchronisation automatique.',
    f4: 'Soins aux aînés',
    f4d: 'Mode dédié aux soins à domicile : suivi, équipes mobiles, associations et points de récompense.',
    f5: 'Tourisme médical',
    f5d: 'Stations thermales et forfaits complets avec accompagnement médical — disponibles en français et anglais.',
    f6: 'Transparence et audit',
    f6d: 'Journal complet de toutes les actions — confiance légale pour les institutions et l\'État.',
    roles_h: 'Des acteurs connectés, une seule plateforme',
    how_h: 'Commencer en trois étapes',
    h1: 'Choisissez votre rôle',
    h1d: 'Patient, médecin, infirmier, famille, association, agence… dix rôles intégrés.',
    h2: 'Connectez-vous en démo',
    h2d: 'Chaque rôle dispose d\'un compte de démonstration (demo123).',
    h3: 'Agissez et créez des parcours',
    h3d: 'Créez un dossier, envoyez une référence, mesurez, ou réservez un forfait.',
    trust: '🔒 Données de santé chiffrées · 🔍 Journal d\'audit complet · 📴 Mode hors-ligne (PWA) · 🧭 Accès international',
    footer: 'Riayati DZ — plateforme nationale unifiée de soins de santé, sociales et de tourisme médical.',
  },
  en: {
    badge: 'Algerian national platform',
    title: 'Riayati DZ',
    sub: 'The pulse of connected care — unified health record, closed-loop e-referral, real-time presence and fully supported medical tourism.',
    cta_login: 'Unified access portal',
    cta_tourism: 'Medical tourism',
    stats_1: '58 wilayas',
    stats_1l: 'National coverage',
    stats_2: '10 roles',
    stats_2l: 'Coordinated on one platform',
    stats_3: '24/7',
    stats_3l: 'Live presence & emergency',
    features_h: 'Why Riayati DZ?',
    features_hs: 'Unique value: real-time + transparency',
    f1: 'Unified health record',
    f1d: 'One file connecting doctor, nurse, pharmacist and family — read and updated live per permissions.',
    f2: 'Closed-loop e-referral',
    f2d: 'From referral to acceptance to final outcome, with SLA tracking and emergency alerts.',
    f3: 'Verified live presence',
    f3d: 'Live positioning of field teams with offline mode and automatic sync.',
    f4: 'Elderly care',
    f4d: 'A dedicated home-care mode: follow-up, mobile teams, active associations and reward points.',
    f5: 'Medical tourism',
    f5d: 'Thermal stations and complete care packages with medical accompaniment — available in French and English.',
    f6: 'Transparency & audit',
    f6d: 'A complete audit trail of every action — legal trust for institutions and the state.',
    roles_h: 'Connected actors, one platform',
    how_h: 'Start in three steps',
    h1: 'Choose your role',
    h1d: 'Patient, doctor, nurse, family, association, agency… ten integrated roles.',
    h2: 'Sign in with the demo account',
    h2d: 'Each role has a ready demo account (demo123).',
    h3: 'Act and create care stories',
    h3d: 'Create a record, send a referral, log a measurement, or book a care package.',
    trust: '🔒 Encrypted health data · 🔍 Full audit trail · 📴 Offline-ready (PWA) · 🧭 International access',
    footer: 'Riayati DZ — unified national platform for healthcare, social care and medical tourism.',
  },
}

export function Landing() {
  const [lang, setLang] = useState<Lang>('ar')
  const t = T[lang]
  const ltr = lang !== 'ar'
  const roles = Object.keys(ROLE_INFO)

  return (
    <div className="landing" dir={ltr ? 'ltr' : 'rtl'}>
      <header className="land-top">
        <div className="land-top-inner">
          <div className="brand">
            <div className="brand-logo">❤️</div>
            <div className="brand-text">
              <b>VITALINK <span>DZ</span></b>
              <small>نبض الرعاية المتصل</small>
            </div>
          </div>
          <nav className="land-nav">
            <Link to="/about">من نحن</Link>
            <Link to="/public/associations">الجمعيات</Link>
            <Link to="/tourism">{t.cta_tourism}</Link>
          </nav>
          <div className="lng-switch" role="group" aria-label="Language">
            {(['ar', 'fr', 'en'] as Lang[]).map((l) => (
              <button key={l} className={`lng-btn ${lang === l ? 'active' : ''}`} onClick={() => setLang(l)}>
                {l === 'ar' ? 'ع' : l === 'fr' ? 'FR' : 'EN'}
              </button>
            ))}
          </div>
          <Link className="btn btn-gold btn-sm" to="/login">{t.cta_login}</Link>
        </div>
      </header>

      <section className="land-hero">
        <div className="hero-orbs" aria-hidden="true"><i /><i /><i /></div>
        <div className="land-hero-inner">
          <span className="badge badge-white land-badge">{t.badge}</span>
          <h1>{t.title}</h1>
          <p className="land-sub">{t.sub}</p>
          <div className="flex gap-12 flex-wrap">
            <Link className="btn btn-primary btn-lg" to="/login">{t.cta_login} ←</Link>
            <Link className="btn btn-gold btn-lg" to="/tourism">🌍 {t.cta_tourism}</Link>
          </div>
          <Reveal className="stagger land-stats" delay={120}>
            <div className="land-stat"><b>{t.stats_1}</b><span>{t.stats_1l}</span></div>
            <div className="land-stat"><b>{t.stats_2}</b><span>{t.stats_2l}</span></div>
            <div className="land-stat"><b>{t.stats_3}</b><span>{t.stats_3l}</span></div>
          </Reveal>
        </div>
      </section>

      <main className="land-main">
        <section className="land-section">
          <Reveal className="land-sec-head"><h2 className="grad-text">{t.features_h}</h2><p>{t.features_hs}</p></Reveal>
          <Reveal className="stagger land-feats" delay={80}>
            {[
              ['📁', t.f1, t.f1d],
              ['🔄', t.f2, t.f2d],
              ['📍', t.f3, t.f3d],
              ['🧓', t.f4, t.f4d],
              ['♨️', t.f5, t.f5d],
              ['📜', t.f6, t.f6d],
            ].map(([ic, h, d]) => (
              <div key={h as string} className="land-feat">
                <div className="land-feat-ico">{ic}</div>
                <b>{h}</b>
                <p>{d}</p>
              </div>
            ))}
          </Reveal>
        </section>

        <section className="land-section">
          <Reveal className="land-sec-head"><h2 className="grad-text">{t.roles_h}</h2></Reveal>
          <Reveal className="stagger land-roles" delay={80}>
            {roles.map((r) => (
              <div key={r} className="land-role">
                <span>{ROLE_INFO[r].icon}</span>
                <b>{ROLE_INFO[r].title}</b>
              </div>
            ))}
          </Reveal>
        </section>

        <section className="land-section">
          <Reveal className="land-sec-head"><h2 className="grad-text">{t.how_h}</h2></Reveal>
          <Reveal className="stagger land-steps" delay={80}>
            {[['1', t.h1, t.h1d], ['2', t.h2, t.h2d], ['3', t.h3, t.h3d]].map(([n, h, d]) => (
              <div key={n} className="land-step">
                <div className="land-step-n">{n}</div>
                <b>{h}</b>
                <p>{d}</p>
              </div>
            ))}
          </Reveal>
        </section>

        <Reveal><div className="land-trust">{t.trust}</div></Reveal>
      </main>

      <footer className="land-foot">
        <p>{t.footer}</p>
        <div className="land-foot-links">
          <Link to="/login">الدخول</Link>
          <Link to="/tourism">السياحة العلاجية</Link>
          <Link to="/about">من نحن</Link>
          <a href="#" onClick={(e) => e.preventDefault()}>الخصوصية</a>
        </div>
      </footer>
    </div>
  )
}