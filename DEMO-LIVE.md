# رابط المنصة على الإنترنت (دائم)

المنصة منشورة الآن على **FastAPI Cloud** — رابط ثابت لا يتغيّر، ولا يحتاج جهازك
مطفأً ليبقى يعمل. وموصلة بقاعدة بيانات سحابية **Neon PostgreSQL** (البيانات تبقى
على السحابة ولا تعتمد على جهازك).

- **الرابط العام:** https://vitalink-dz.fastapicloud.dev
- **بوابة الدخول:** https://vitalink-dz.fastapicloud.dev/login
- **السياحة العلاجية:** https://vitalink-dz.fastapicloud.dev/tourism
- **لوحة الإدارة:** https://vitalink-dz.fastapicloud.dev/admin
- **وثائق API:** https://vitalink-dz.fastapicloud.dev/docs

> الرابط السابق عبر نفق Cloudflare (`trycloudflare.com`) كان مؤقتاً ويتغيّر عند كل
> تشغيل — استُبدل بالرابط الثابت أعلاه.

## قاعدة البيانات
- **Neon PostgreSQL 18** (منطقة أوروبا المركزية) — 34 جدولاً و680+ صفاً (بيانات تجريبية كاملة).
- كلمة مرور القاعدة في ملف `.env` محلياً فقط (متجاهَل في Git ولا يُرفع)، وقد رُفعت
  كمتغيّر سرّي في إعدادات FastAPI Cloud.

## الحسابات التجريبية
كل دور له حساب جاهز، وكلمة المرور لدى الجميع `demo123`:

| الدور | اسم المستخدم |
| --- | --- |
| المدير الوطني | `admin` |
| مساعد المدير | `admin2` |
| طبيب | `doctor_1` / `doctor_2` |
| ممرّض متنقّل | `nurse_1` / `nurse_2` |
| صيدلي | `pharma_1` |
| مريض | `patient_1` |
| مرافق عائلي | `family_1` |
| النشاط الاجتماعي | `dass_1` |
| وكالة سياحة علاجية | `agency_1` |
| محطة حموية | `thermal_1` |
| باحث | `researcher_1` |

> **ملاحظة:** المنصة تنام بعد فترة خمول (خطة مجانية)، فأول طلب قد يعيد `503`
> خلال الإقلاع البارد. أعد المحاولة بعد ثوانٍ وينجح.

## النشر بعد أي تعديل
```powershell
cd "G:\التطبيقات والبرام\رعايتي\backend"
$env:SSL_CERT_FILE = "C:\Users\djell\AppData\Local\Temp\opencode\pw\system-roots.pem"
& "C:\Users\djell\AppData\Roaming\Python\Python314\Scripts\fastapi.exe" deploy
```
> متغيّر `SSL_CERT_FILE` ضروري على هذا الجهاز لأن الشبكة تمرّ عبر فاحص TLS ذاتي
> التوقيع، وأداة النشر تثق بـ certifi فقط.

## لوحة التحكم
`https://dashboard.fastapicloud.com` — الدخول بالبريد وكلمة المرور المحفوظتين في
`pw/fastapicloud-pw.txt` (محلي، لا يُرفع).

## التشغيل المحلي (اختياري، للتطوير)
```powershell
cd "G:\التطبيقات والبرام\رعايتي\backend"
C:\Python314\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8100
```
