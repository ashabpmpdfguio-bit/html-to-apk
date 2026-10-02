# HTML → APK Studio Pro 2.0

رابط کاربری بسیار ساده برای کاربر نهایی:
- HTML / ZIP
- نام برنامه
- آیکن اختیاری
- یک دکمه ساخت APK

## امکانات
- پروژه‌های چندفایلی ZIP
- پیشرفت مرحله‌ای ساخت
- خروجی Release APK (unsigned)
- تولید خودکار آیکن در densityهای مختلف
- WebView با JavaScript و DOM Storage
- پاک‌سازی فایل آپلودی پس از شروع build
- API جدا برای status و download
- مناسب توسعه به صف build و کانتینر

## راه‌اندازی سرور
نیازمند Node.js 20+، Java 17، Android SDK API 35 و `unzip`.
```bash
npm install
npm start
```
سپس پورت 3000 را باز کنید.

## امضای Release
این نسخه Release APK تولید می‌کند اما برای انتشار عمومی نیاز به keystore و signing دارد.
برای production بهتر است build worker داخل container اجرا شود و keystore در secret manager نگهداری شود.


## رفع مشکل Failed to fetch
این برنامه یک backend لازم دارد. اگر `index.html` را مستقیم باز کنید یا فقط فایل‌های `public` را روی هاست استاتیک بگذارید، `/api/build` وجود ندارد و مرورگر `Failed to fetch` نشان می‌دهد.

### اجرای معمولی
```bash
npm install
npm start
```
بعد در مرورگر:
`http://SERVER-IP:3000`

### اجرای پیشنهادی با Docker
```bash
docker compose up --build -d
```
بعد:
`http://SERVER-IP:3000`

صفحه اکنون قبل از فعال کردن دکمه، `/api/health` را بررسی می‌کند و اگر backend در دسترس نباشد پیام واضح نشان می‌دهد.

### نکته
برای build واقعی Android باید Java، Android SDK، Build Tools و Gradle در محیط backend موجود باشند. Dockerfile این وابستگی‌ها را برای Linux فراهم می‌کند.
