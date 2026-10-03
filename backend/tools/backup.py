"""نسخ احتياطي يومي مشفَّر AES-256-GCM لقاعدة البيانات — قانون 18-07.

الاستخدام:
    python -m tools.backup              (نسخ الآن)
    python -m tools.backup --prune 14   (حذف ما يتجاوز N يوم)

المخرجات: backups/ryt-<YYYY-MM-DD-HHMM>.bin (مشفَّر) + backups/latest.bin
الاستعادة: بيانات أقل أهمية مطابقة للمفتاح المخزّن في data/.enc_key.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent  # backend/app.. -> backend
PROJECT = BACKEND.parent                            # جذر المشروع (حيث data/)
sys.path.insert(0, str(BACKEND))

from app.crypto import encrypt_bytes  # noqa: E402

DB_FILE = PROJECT / "data" / "vitalink.db"
OUT_DIR = PROJECT / "backups"


def backup() -> Path:
    if not DB_FILE.exists():
        raise SystemExit(f"قاعدة البيانات غير موجودة: {DB_FILE}")
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M")
    raw = DB_FILE.read_bytes()
    enc = encrypt_bytes(raw)
    target = OUT_DIR / f"ryt-{stamp}.bin"
    target.write_bytes(enc)
    (OUT_DIR / "latest.bin").write_bytes(enc)
    print(f"✓ نسخة احتياطية مشفَّرة: {target.name} ({len(enc):,} بايت)")
    return target


def prune(keep_days: int) -> list[Path]:
    cutoff = datetime.now().timestamp() - keep_days * 86400
    removed: list[Path] = []
    for p in sorted(OUT_DIR.glob("ryt-*.bin")):
        if p.stat().st_mtime < cutoff:
            p.unlink(missing_ok=True)
            removed.append(p)
    if removed:
        print(f"🗑 حُذف {len(removed)} نسخة أقدم من {keep_days} يوم")
    else:
        print("لا نسخ قديمة للحذف")
    return removed


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except AttributeError:
        pass
    ap = argparse.ArgumentParser()
    ap.add_argument("--prune", type=int, default=14)
    args = ap.parse_args()
    backup()
    prune(args.prune)