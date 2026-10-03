"""Non-blocking JWT-ish token signing + password hashing (stdlib only)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time

from .config import settings

PBKDF2_ITER = 200_000


def _b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def _b64d(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    dig = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITER)
    return f"pbkdf2${PBKDF2_ITER}${_b64(salt)}${_b64(dig)}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iters, salt, dig = stored.split("$")
        salt = _b64d(salt)
        check = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, int(iters))
        return hmac.compare_digest(check, _b64d(dig))
    except Exception:
        return False


def _sign(payload_b64: str, expires: int) -> str:
    msg = f"{payload_b64}.{expires}".encode()
    return _b64(hmac.new(settings.jwt_secret.encode(), msg, hashlib.sha256).digest())


def create_token(user_id: int, role: str, name: str) -> str:
    payload = _b64(json.dumps({"uid": user_id, "role": role, "name": name}).encode())
    exp = int(time.time()) + settings.access_token_expire_minutes * 60
    return f"{payload}.{exp}.{_sign(payload, exp)}"


def decode_token(token: str) -> dict | None:
    try:
        payload, exp_s, sig = token.split(".")
        exp = int(exp_s)
        if time.time() > exp:
            return None
        if not hmac.compare_digest(sig, _sign(payload, exp)):
            return None
        return json.loads(_b64d(payload))
    except Exception:
        return None


def gen_otp() -> tuple[str, str]:
    """يُولّد OTP من 6 أرقام ويعيد (الرمز، مكالمه SHA-256).

    في بيئة العرض يُسلَّم الرمز عبر الاستجابة ليُعاينه المدرب؛
    في الإنتاج يُرسَل الرمز عبر قناة SMS/حماية مدنية (للتوثيق فقط)."""
    import secrets as _secrets
    code = f"{_secrets.randbelow(1_000_000):06d}"
    return code, hashlib.sha256(code.encode()).hexdigest()


def verify_otp(code: str, stored_hash: str) -> bool:
    try:
        return hmac.compare_digest(
            hashlib.sha256(code.strip().encode()).hexdigest(), stored_hash or ""
        )
    except Exception:
        return False