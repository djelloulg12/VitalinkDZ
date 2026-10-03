"""تشفير AES-256-GCM عند التخزين — قانون 18-07 وحماية البيانات الصحية.

- المفتاح: متغيّر البيئة VITALINK_ENC_KEY (base64 لـ 32 بايت)؛
  إن لم يوجد يُنشأ مرة واحدة ويُحفظ في data/.enc_key حتى لا تُفقد البيانات.
- الصيغة المخزَّنة:  ENCv1:<b64 nonce>:<b64 ciphertext>
- القيم القديمة (قبل التشفير) تُرجع كما هي (توافق رجعي)، والخلل القرائي لا يُسقط السجل.
"""

from __future__ import annotations

import base64
import json
import os
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX = "ENCv1:"
_key: bytes | None = None


def _project_root() -> Path:
    # backend/app -> backend -> project root
    return Path(__file__).resolve().parent.parent.parent


def _load_or_create_key() -> bytes:
    global _key
    if _key:
        return _key
    env = os.environ.get("VITALINK_ENC_KEY", "")
    if env:
        _key = base64.b64decode(env, validate=True)
    else:
        keyfile = _project_root() / "data" / ".enc_key"
        if keyfile.exists():
            _key = base64.b64decode(keyfile.read_text().strip(), validate=True)
        else:
            _key = AESGCM.generate_key(bit_length=256)
            keyfile.parent.mkdir(parents=True, exist_ok=True)
            keyfile.write_text(base64.b64encode(_key).decode())
    if len(_key) != 32:
        raise RuntimeError("VITALINK_ENC_KEY يجب أن يكون 32 بايت (AES-256)")
    return _key


def encrypt_text(plain: str | None) -> str | None:
    if not plain:
        return plain
    aes = AESGCM(_load_or_create_key())
    nonce = os.urandom(12)
    ct = aes.encrypt(nonce, plain.encode("utf-8"), None)
    return f"{_PREFIX}{base64.b64encode(nonce).decode()}:{base64.b64encode(ct).decode()}"


def decrypt_text(payload: str | None) -> str | None:
    if not payload:
        return payload
    if not payload.startswith(_PREFIX):
        return payload  # بيانات قديمة غير مشفرة (توافق رجعي)
    try:
        _, n64, c64 = payload.split(":", 2)
        nonce = base64.b64decode(n64)
        ct = base64.b64decode(c64)
        return AESGCM(_load_or_create_key()).decrypt(nonce, ct, None).decode("utf-8")
    except Exception:
        return payload  # لا نسقط السجل عند أي خلل قراءة


def encrypt_json(data) -> str:
    return encrypt_text(json.dumps(data, ensure_ascii=False)) or ""


def decrypt_json(payload: str | None):
    if not payload:
        return None
    try:
        return json.loads(decrypt_text(payload) or "null")
    except Exception:
        return None


_MAGIC = b"RYTv1"
_MAGIC_LEN = len(_MAGIC)


def encrypt_bytes(data: bytes) -> bytes:
    """تشفير ثنائي لنسخ احتياطية (غير قابل للعرض): magic + nonce(12) + ciphertext."""
    aes = AESGCM(_load_or_create_key())
    nonce = os.urandom(12)
    return _MAGIC + nonce + aes.encrypt(nonce, data, None)


def decrypt_bytes(token: bytes) -> bytes:
    if not token.startswith(_MAGIC):
        raise ValueError("نسخة احتياطية غير صالحة أو قديمة (بدون توقيع RYTv1)")
    nonce = token[_MAGIC_LEN:_MAGIC_LEN + 12]
    ct = token[_MAGIC_LEN + 12:]
    return AESGCM(_load_or_create_key()).decrypt(nonce, ct, None)