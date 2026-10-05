# ============================================================
#  Vitalink DZ — صورة نشر واحدة (واجهة + خلفية + قاعدة بيانات)
#  الاستعمال:  docker build -t vitalink .  &&  docker run -p 8100:8100 vitalink
# ============================================================

# ---------- 1) بناء الواجهة ----------
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi
COPY frontend/ ./
RUN npm run build

# ---------- 2) بيئة التشغيل: الخلفية تخدم الواجهة المبنية ----------
FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8100

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install -r requirements.txt

COPY backend/app ./app
# الواجهة المبنية تُخدم من نفس الأصل (بلا CORS، رابط واحد)
COPY --from=frontend /fe/dist ./app/static

RUN mkdir -p /app/data /app/storage

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=6s --start-period=45s --retries=3 \
  CMD python -c "import os,urllib.request;urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8100')+'/api/health')"

# SQLite: عامل واحد. Postgres: يمكن رفع العدد.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8100} --proxy-headers --forwarded-allow-ips='*' --timeout-keep-alive 65"]