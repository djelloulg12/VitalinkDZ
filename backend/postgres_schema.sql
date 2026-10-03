-- ============================================================
-- رعايتي DZ — نبض الرعاية المتصل
-- مخطط قاعدة بيانات PostgreSQL المقترح (مسار الترقية من SQLite)
-- الامتثال: قانون حماية البيانات الشخصية 18-07 + TLS 1.3 + AES-256-GCM
-- ============================================================

-- الملاحظات المعمارية:
-- 1) التشفير: الحقول الحساسة (notes/medical) تُخزَّن كمُشفَّر AES-256-GCM (عمود enc)
--    مع nonce منفصل؛ فك التشفير عند الطبقة الخدمية فقط (عند الحاجة).
-- 2) RBAC: enum role + RLS (Row Level Security) لمنع أي قراءة غير مصرح بها.
-- 3) السجل: مقترن مع الأعمدة audit (أو جدول log) وفقاً للقانون 18-07.
-- 4) النسخ الاحتياطي يُنجز عبر pg_dump ثم يُشفر aes-256-gcm (يُقرأ بالكامل).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('admin', 'doctor', 'nurse', 'dass', 'family', 'patient', 'agency', 'thermal', 'researcher');

-- ---------- 1) المستخدمون ----------
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                -- bcrypt/argon2 (لا تُخزن أبداً نصاً صافياً)
  role          user_role NOT NULL,
  full_name     TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  wilaya_code   SMALLINT REFERENCES wilayas(code),
  avatar        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- تحديد نطاق دور المستخدم عبر كلمة مفتاحية Hash (خدعة توجيه صارمة)
CREATE INDEX idx_users_role ON users(role);

-- ---------- 2) الملفات الصحية (بيانات حساسة → مُشفَّرة) ----------
CREATE TABLE health_profiles (
  id             BIGSERIAL PRIMARY KEY,
  patient_id     BIGINT NOT NULL REFERENCES users(id),
  blood_group    TEXT,
  allergies_enc  TEXT,                       -- JSON مُشفَّر AES-256-GCM
  chronic_conditions_enc TEXT,               -- JSON مُشفَّر
  medications_enc TEXT,                      -- JSON مُشفَّر
  emergency_note_enc TEXT,                   -- يظهر فقط في الطوارئ (SOS)
  height_cm       REAL, weight_kg REAL,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- 3) الإحالة الإلكترونية ----------
CREATE TABLE referrals (
  id                  BIGSERIAL PRIMARY KEY,
  patient_name        TEXT NOT NULL,
  from_institution_id BIGINT REFERENCES institutions(id),
  to_institution_id   BIGINT REFERENCES institutions(id),
  reason              TEXT,
  medical_note_enc    TEXT,                  -- مُشفَّر
  severity            TEXT NOT NULL DEFAULT 'normal',   -- normal | red
  sla_hours           INT  NOT NULL DEFAULT 48,
  status              TEXT NOT NULL DEFAULT 'pending',  -- pending|accepted|rejected
  created_by          BIGINT REFERENCES users(id),
  decided_by          BIGINT REFERENCES users(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at          TIMESTAMPTZ
);
CREATE INDEX idx_ref_status  ON referrals(status);
CREATE INDEX idx_ref_severity ON referrals(severity);

-- ---------- 4) الملف الموحّد / التدوينات الطبية ----------
CREATE TABLE medical_notes (
  id              BIGSERIAL PRIMARY KEY,
  patient_name    TEXT NOT NULL,
  referral_id     BIGINT REFERENCES referrals(id) ON DELETE SET NULL,
  kind            TEXT NOT NULL DEFAULT 'consultation',
  date            DATE  NOT NULL DEFAULT CURRENT_DATE,
  summary_enc     TEXT,                     -- مُشفَّر
  vitals_enc      TEXT,                     -- JSON مُشفَّر: pulse/bp/sugar/temp/spo2
  medications_enc TEXT,                     -- JSON مُشفَّر
  attachments_enc TEXT,                     -- JSON مُشفَّر (base64 مُشفَّر)
  author_id       BIGINT REFERENCES users(id),
  signed_by       TEXT,                     -- توقيع اعتمادي (لا يُستبدل عند التعديل)
  signed_at       TIMESTAMPTZ,
  device_id       TEXT,                     -- للـ Offline-First
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_patient ON medical_notes(patient_name);
CREATE INDEX idx_notes_date    ON medical_notes(date);

-- ---------- 5) سجل التدقيق (قانون 18-07) ----------
CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor      TEXT,
  role       user_role,
  action     TEXT,            -- create|update|delete|view|verify|approve|link|gps
  entity     TEXT,            -- staff|referral|followup|association|booking|zone|...
  entity_id  BIGINT,
  detail_enc TEXT,            -- تفاصيل مُشفَّرة عند الحساسية
  old_v      TEXT,
  new_v      TEXT,
  at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_at   ON audit_log(at);
CREATE INDEX idx_audit_ent  ON audit_log(entity, entity_id);

-- ---------- 6) مفتاح تشفير التطبيق ----------
-- يُدار عبر pgcrypto: SELECT gen_random_bytes(32) → يُحفظ في متغيّر بيئة VITALINK_ENC_KEY
-- (لا يُخزَّن في قاعدة البيانات إطلاقاً).

-- ---------- 7) RLS: قواعد صارمة قابلة للتفعيل ----------
-- ALTER TABLE medical_notes ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY notes_doctor ON medical_notes USING (author_id = current_setting('app.uid')::bigint OR
--       current_setting('app.role', true)::text IN ('admin','doctor'));
-- CREATE POLICY notes_agency  ON medical_notes USING (referral_id IN (SELECT id FROM referrals WHERE to_institution_id = current_setting('app.inst')::bigint));
-- CREATE POLICY notes_family  ON medical_notes USING (patient_name = current_setting('app.patient', true));

-- ---------- 8) نسخ احتياطي يومي مشفر (cron) ----------
-- 0 1 * * *  pg_dump -Fc vitalink > /backups/ryt_latest.dump  \
--           && openssl enc -aes-256-gcm -pbkdf2 -pass env:VITALINK_ENC_KEY \
--                                   -in ryt_latest.dump -out ryt-$(date +\%F).bin
-- الاحتفاظ: 14 يوماً، ثم تُرسل النسخ إلى تخزين خارجي (S3/قرص مجاور) ولا تُحوَّل إلا عبر TLS.

-- ملاحظة الترحيل: تطبيقنا الحالي يعمل على SQLite (vitalink.db) مع نفس بنية الجداول رمزياً؛
-- النموذج أعلاه هو "الأشكال المقترحة" لرقية PostgreSQL/Paas لاحقاً دون كسر الواجهات.