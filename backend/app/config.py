from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(_ROOT / ".env")


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "رعايتي DZ — نبض الرعاية المتصل"
    environment: str = "development"
    debug: bool = True

    # SQLite default (dev); postgres supported via DATABASE_URL env.
    database_url: str = f"sqlite+aiosqlite:///{_ROOT / 'data' / 'vitalink.db'}"
    storage_path: str = str(_ROOT / "storage")

    # مجلد الواجهة المبنية (dist) الذي تخدمه الخلفية في الإنتاج — تنسخه صورة Docker إلى app/static
    static_dir: str = str(_ROOT / "backend" / "app" / "static")
    # الرابط العام بعد النشر (يُستخدم في ملف robots/الوصف)
    public_base_url: str = ""

    default_password: str = "demo123"
    jwt_secret: str = "vitalink-dz-dev-secret"
    secret_key: str = "vitalink-dz-dev-secret"
    access_token_expire_minutes: int = 60 * 24

    # الأمان: عند تفعيل force_password_change يُجبر كل مستخدم على تغيير كلمة المرور عند الدخول.
    force_password_change: bool = False
    # وضع العرض التجريبي (يُظهر شارة "بيئة تجريبية" في الواجهة).
    demo_mode: bool = True

    llm_provider: str = "mock"
    llm_model: str = "mock"
    openai_api_key: str = ""

    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def normalized_database_url(self) -> str:
        """توحيد رابط القاعدة: Neon/Supabase تعطي postgres:// → نحوّلها إلى asyncpg.

        asyncpg لا تفهم وسم `sslmode=` ولا `channel_binding=`، فتُنقل إلى `ssl`
        في `database.py` ويلتقطها كائن SSL.
        """
        url = self.database_url.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # إزالة الوسوم غير المدعومة من سلسلة الاستعلام (asyncpg ترفضها)
        # `sslmode` يُنقل إلى `ssl` عبر db_ssl_mode في database.py
        if "?" in url:
            base, _, query = url.partition("?")
            keep = []
            for part in query.split("&"):
                key = part.split("=", 1)[0].strip().lower()
                if key in ("channel_binding", "sslmode"):
                    continue
                keep.append(part)
            url = base + ("?" + "&".join(keep) if keep else "")
        return url

    @property
    def db_ssl_mode(self) -> str | None:
        """قيمة sslmode إن وُجدت في الرابط (require/allow/prefer/...) لإعداد كائن SSL."""
        import re as _re
        m = _re.search(r"[?&]sslmode=([^&]+)", self.database_url.strip())
        return m.group(1) if m else None


settings = Settings()