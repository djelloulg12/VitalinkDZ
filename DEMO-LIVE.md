# رابط العرض المباشر على الإنترنت (Demo)

المنصة منشورة الآن على الإنترنت عبر نفق عام حقيقي (Cloudflare Quick Tunnel).
يعمل هذا الرابط ما دام جهازك مُشغّلاً ولن يبقى دائماً — للنشر الدائم انظر `DEPLOY.md`.

- **الرابط العام:** https://collective-numerical-growing-limitation.trycloudflare.com
- **بوابة الدخول:** https://collective-numerical-growing-limitation.trycloudflare.com/login
- **السياحة العلاجية:** https://collective-numerical-growing-limitation.trycloudflare.com/tourism
- **لوحة الإدارة:** https://collective-numerical-growing-limitation.trycloudflare.com/admin

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

## إعادة تشغيل النفق (إن توقف)
النفق يعمل من الخلفية عبر cloudflared. لإعادة تشغيله:

```powershell
& "C:\Users\djell\AppData\Local\Temp\opencode\cloudflared.exe" tunnel --url http://localhost:8100 --no-autoupdate
```

ثم انسخ الرابط الجديد من سطر `trycloudflare.com` في مخرجات الطرفية.
يجب أن يكون خادم الخلفية يعمل على المنفذ `8100` أولاً.
