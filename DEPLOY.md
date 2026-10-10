# ============================================================
#  نشر «رعايتي DZ» — دليل مجاني وسريع
#  المنصة منشورة الآن على FastAPI Cloud (بلا بطاقة ائتمان)
#  بنية النشر: تطبيق واحد يخدم الواجهة + الخلفية من نفس الرابط
#  → رابط واحد، HTTPS تلقائي، بلا مشاكل CORS
# ============================================================

## الحالة الحالية (منشور فعلياً)

- **الرابط العام:** https://vitalink-dz.fastapicloud.dev
- **قاعدة البيانات:** Neon PostgreSQL (سحابية، مستقلة عن أي جهاز)
- **المنصة:** FastAPI Cloud — خطة Hobby مجانية، لا تحتاج بطاقة ائتمان
- **الحساب:** djelloulg12@hotmail.com (اسم الفريق `djelloulg12-5d8ae3bc`)

> لماذا FastAPI Cloud ولم لا Render؟ خدمة Render اشترطت بطاقة ائتمان لإنشاء أي
> خدمة جديدة (رد `402 Payment information is required`)، وكذلك رفض Vercel إنشاء
> حساب من هذه الشبكة. FastAPI Cloud — وهي خدمة الرسمية لمكتبة FastAPI — تسمح
> بالنشر بالبريد وكلمة المرور فقط.

---

## بنية النشر النهائية

```
المتصفح ──HTTPS──> [FastAPI Cloud] ──> تطبيق واحد:
                                        ├── /            → واجهة React (ملفات ثابتة)
                                        ├── /assets/...  → حزم JS مُجزأة
                                        ├── /api/...     → FastAPI (24 مساراً)
                                        └── /docs        → توثيق تفاعلي
                     قاعدة البيانات: Neon (خارجية، بلا قرص دائم مطلوب)
```

**لماذا تطبيق واحد؟** لأن الواجهة تستدعي `/api` على نفس الأصل، فتبقى كل الإعدادات
المزدوجة (CORS، النطاقات، الشهادات، الأرشفة) غير موجودة.

---

## الخطوة 1 — أنشئ قاعدة البيانات المجانية (دقيقتان)

### الخيار الموصى به: Neon
1. افتح `https://neon.tech` → **Sign up** (GitHub أسرع، بلا بطاقة ائتمان).
2. **Create a project** ← اسم: `vitalink` ← region اختر الأقرب (Europe).
3. من صفحة المشروع: **Connect** ← اختر **Python** ← انسخ الرابط.

سيبدو هكذا (استبدل القيم):
```
postgresql://USER:PASSWORD@ep-xxx.region.neon.tech/neondb?sslmode=require
```

> المنصة تحوّل `postgresql://` تلقائياً إلى `postgresql+asyncpg://` داخلياً،
> وتقرأ `sslmode` وتحوّلها إلى سياق SSL لأن asyncpg لا يفهمها مباشرة.

### البديل: Supabase
`https://supabase.com` ← مشروع جديد ← **Settings → Database → URI** (استخدم المنفذ 6543 للـpooler).

---

## الخطوة 2 — انشر على FastAPI Cloud (بلا بطاقة، مجاني)

### التهيئة (مرة واحدة):
```bash
# 1) ثبّت الأداة (تحتاج Python 3.11+)
pip install "fastapi[standard]"

# 2) سجّل الدخول (يفتح متصفحك للاعتماد)
fastapi login

# 3) أنشئ التطبيق واربطه بالمجلد
cd backend
fastapi cloud apps create --name vitalink-dz --directory backend --link
```

### متغيّرات البيئة (القيم الحقيقية في `.env` محلياً فقط):
```bash
fastapi cloud env set DATABASE_URL   "<رابط Neon>"  --secret
fastapi cloud env set JWT_SECRET     "<سر عشوائي>"   --secret
fastapi cloud env set SECRET_KEY     "<سر عشوائي>"   --secret
fastapi cloud env set ENVIRONMENT    production
fastapi cloud env set DEMO_MODE      true
fastapi cloud env set DEBUG          false
fastapi cloud env set STORAGE_PATH   /tmp/storage
```

### النشر:
```bash
cd backend
fastapi deploy
# → Your app is ready at https://vitalink-dz.fastapicloud.dev
```

> **ملاحظة مهمة:** مجلد التطبيق يجب أن يكون فارغاً (في جذر ما ترفعه) إذا رفعت من
> داخل `backend/`. ضبط `--directory backend` مع الرفع من `backend/` يسبب خطأ
> `app_directory_not_found`.

---

## الخطوة 3 — تحقّق بعد النشر

| ما تختبره | كيف | المتوقع |
|---|---|---|
| الصحة | افتح `/api/health` | `{"status":"ok",...}` |
| الواجهة | افتح `/` | صفحة الترحيب (RTL عربية) |
| الدخول | `POST /api/auth/login` | يعيد رمزاً (JWT) |
| قواعد البيانات | افتح `/api/wilayas` | 58 ولاية |
| الصفحة السياحية | افتح `/tourism` | حمّامات + حزم |
| الروابط العميقة | افتح `/admin/referrals` مباشرة | تفتح (لا 404) |
| وثائق API | افتح `/docs` | Swagger تفاعلي |

التحقق الفعلي بعد النشر: تسجيل دخول `admin` / `demo123` نجح وقراءة
`/api/wilayas` و`/api/institutions` أعادت بيانات Neon الكاملة.

---

## حدود الخطة المجانية (بصراحة)

| المنصة | الحدود | الأثر على المنصة |
|---|---|---|
| FastAPI Cloud Hobby | 3 تطبيقات، 1 نطاق مخصّص | كافٍ تماماً لمنصة واحدة |
| FastAPI Cloud Hobby | 0.1 vCPU / 512MB مشتركة | كافٍ للعرض التوضيحي |
| FastAPI Cloud Hobby | **Scale-to-zero** (ينام بعد الخمول) | أول زائر بعدها ينتظر ثوانٍ للإقلاع |
| FastAPI Cloud Hobby | بلا قرص دائم | لذلك القاعدة خارجية (Neon) وإلا ضاعت البيانات |
| FastAPI Cloud Hobby | بلا إرسال بريد SMTP | لا إشعارات بريد — الإشعارات داخل المنصة تعمل |
| Neon Free | 512MB، يصفّر بعد خمول | أكثر من كافٍ لسجلات المنصة |

**القاعدة العملية:** المنصة وظيفية ومُتاحة مجاناً للعرض والتشغيل. هذا المستوى لا يصلح
لبيئة إنتاج وطنية بحركة دائمة — ما يحتاج خطة مدفوعة (Pro بـ20$/شهر يلغي النوم).

> **الرقابة:** للنشر من GitHub تلقائياً، أضف سر `FASTAPI_CLOUD_TOKEN` في إعدادات
> المستودع ثم استدعِ `fastapi deploy` داخل GitHub Actions.

---

## الإطلاق الرسمي (لاحقاً، خارج المجاني)

1. **نطاق**: اشترِ `.dz` أو `.com` واربطه في FastAPI Cloud (مجاني على Hobby).
2. **أمان**: غيّر `FORCE_PASSWORD_CHANGE=true` و`DEMO_MODE=false`، واحذف `DEFAULT_PASSWORD`.
3. **المصادقة**: استبدل المفاتيح التجريبية بمفاتيح قوية:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

4. **قاعدة البيانات**: انقل من Neon المجاني إلى Neon مدفوع أو Supabase Pro (البيانات لا تُفقد عند الترقية).
5. **النسخ الاحتياطي**: صدّر `pg_dump` أسبوعياً.

---

## تشغيل محلي بملف واحد (Docker)

```bash
docker compose up --build
# ثم افتح http://localhost:8100
```
يحفظ SQLite في volume دائم فلا تضيع البيانات عند إعادة التشغيل.

## تشغيل يدوي (بدون Docker)

```bash
# الخلفية
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8100

# الواجهة (وضع التطوير)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

---

## أسئلة شائعة

**هل يتعطل بعد النوم؟** ينام بعد فترة خمول على الخطة المجانية. أول طلب بعدها
يُعيد الإقلاع خلال ثوانٍ. على الخطة المدفوعة لا ينام أبداً.

**هل تُفقد البيانات؟** لا، لأن القاعدة خارجية (Neon/Supabase) مستقلة عن الحاوية.

**هل تعمل وثائق API؟** نعم على `/docs`.

**هل يمكن ربط نطاق خاص؟** نعم، مجاناً على FastAPI Cloud، خطوة واحدة بعد شراء النطاق.
