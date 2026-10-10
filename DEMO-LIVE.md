# رابط العرض المباشر على الإنترنت (Demo)

المنصة منشورة الآن على الإنترنت عبر نفق عام حقيقي (Cloudflare Quick Tunnel)،
وموصلة بقاعدة بيانات سحابية **Neon PostgreSQL** (البيانات تبقى على السحابة ولا تعتمد على جهازك).

- **الرابط العام:** https://collective-numerical-growing-limitation.trycloudflare.com
- **بوابة الدخول:** https://collective-numerical-growing-limitation.trycloudflare.com/login
- **السياحة العلاجية:** https://collective-numerical-growing-limitation.trycloudflare.com/tourism
- **لوحة الإدارة:** https://collective-numerical-growing-limitation.trycloudflare.com/admin

## قاعدة البيانات
- **Neon PostgreSQL 18** (منطقة أوروبا المركزية) — 34 جدولاً و680+ صفاً (بيانات تجريبية كاملة).
- كلمة مرور القاعدة في ملف `.env` محلياً فقط (متجاهَل في Git ولا يُرفع).

## الحسابات التجريبية
كل دور له حساب جاهز، اسم المستخدم هو اسم الدور وكلمة المرور `demo123`:

| الدور | اسم المستخدم |
| --- | --- |
| المدير الوطني | `admin` |
| طبيب | `doctor_1` |
| ممرض متنقّل | `nurse_1` |
| صيدلي | `pharmacist_1` |
| جمعية | `association_1` |
| مستفيد | `beneficiary_1` |

## إعادة تشغيل الخلفية (قاعدة Neon)
```powershell
cd "G:\التطبيقات والبرام\رعايتي\backend"
C:\Python314\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8100
```

## إعادة تشغيل النفق (إن توقف)
```powershell
& "C:\Users\djell\AppData\Local\Temp\opencode\cloudflared.exe" tunnel --url http://localhost:8100 --no-autoupdate
```
ثم انسخ الرابط الجديد من سطر `trycloudflare.com` في المخرجات.
