"""الروشتة الإلكترونية والصيدليات والمخزون — المرحلة 2α.

- طبيب يصدر روشتة (RX) ببنود دوائية؛
- الصيدلي يعاين الروشتات، يقابل المخزون، ويصرف بخصم تلقائي؛
- إنذار النقص (stock < min_level) أمام الجميع للتنسيق السريع.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..audit import record
from ..deps import current_user, get_db, require_role
from ..models import InventoryItem, Pharmacy, Prescription, PrescriptionItem

router = APIRouter(prefix="/api", tags=["pharmacy"])


# ---------- الصيدليات ----------

@router.get("/pharmacies")
async def list_pharmacies(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Pharmacy).where(Pharmacy.active.is_(True)))
    rows = res.scalars().all()
    prices: list[dict] = []
    for p in rows:
        nitems = await db.execute(select(InventoryItem).where(InventoryItem.pharmacy_id == p.id))
        items = nitems.scalars().all()
        prices.append({
            "id": p.id, "name": p.name, "wilaya_id": p.wilaya_id, "city": p.city,
            "phone": p.phone, "manager": p.manager, "license_no": p.license_no,
            "open_24": p.open_24, "items": len(items),
            "low": sum(1 for i in items if i.qty < i.min_level),
        })
    return prices


class PharmacyIn(BaseModel):
    name: str
    city: str = ""
    phone: str = ""
    manager: str = ""
    wilaya_id: int | None = None
    license_no: str = ""
    open_24: bool = False


@router.post("/pharmacies")
async def create_pharmacy(body: PharmacyIn, payload=Depends(require_role("admin", "pharmacist")),
                          db: AsyncSession = Depends(get_db)):
    p = Pharmacy(name=body.name, city=body.city, phone=body.phone, manager=body.manager,
                 wilaya_id=body.wilaya_id, license_no=body.license_no, open_24=body.open_24)
    db.add(p)
    await db.flush()
    await record(db, actor=payload.get("name", ""), action="create", entity="pharmacy",
                 entity_id=p.id, detail=f"صيدلية جديدة: {p.name}")
    await db.commit()
    return {"id": p.id}


# ---------- المخزون ----------

class StockIn(BaseModel):
    drug: str
    strength: str = ""
    form: str = ""
    qty: int = Field(ge=0)
    min_level: int = Field(default=10, ge=0)
    pharmacy_id: int | None = None


def _low_tags(items: list[InventoryItem]) -> set[str]:
    return {i.drug for i in items if i.qty < i.min_level}


@router.get("/inventory")
async def list_inventory(db: AsyncSession = Depends(get_db)):
    """المخزون الوطني الموحد مع تبويب النواقص."""
    res = await db.execute(select(InventoryItem).order_by(InventoryItem.drug))
    items = res.scalars().all()
    by_ph: dict[int, list[InventoryItem]] = {}
    for i in items:
        by_ph.setdefault(i.pharmacy_id, []).append(i)
    ph_res = await db.execute(select(Pharmacy))
    names = {p.id: p.name for p in ph_res.scalars().all()}
    low = [
        {"pharmacy_id": p_id, "pharmacy": names.get(p_id, ""), "drug": i.drug,
         "strength": i.strength, "form": i.form, "qty": i.qty, "min_level": i.min_level}
        for p_id, lst in by_ph.items() for i in lst if i.qty < i.min_level
    ]
    return {
        "low_count": len(low), "low": low,
        "items": [
            {"id": i.id, "pharmacy_id": i.pharmacy_id, "pharmacy": names.get(i.pharmacy_id, ""),
             "drug": i.drug, "strength": i.strength, "form": i.form, "qty": i.qty,
             "min_level": i.min_level, "low": i.qty < i.min_level}
            for i in items
        ],
    }


class ReplenishIn(BaseModel):
    qty: int = Field(ge=1)
    surge: bool = False  # إمداد طارئ يتجاوز التدقيق العادي


@router.post("/inventory/{item_id}/replenish")
async def replenish(item_id: int, body: ReplenishIn,
                    payload=Depends(require_role("admin", "pharmacist")),
                    db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryItem).where(InventoryItem.id == item_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="صنف غير موجود")
    item.qty += body.qty
    await record(db, actor=payload.get("name", ""), action="update", entity="inventory",
                 entity_id=item.id, detail=f"توريد +{body.qty} {item.drug}" +
                 (" (إمداد طارئ)" if body.surge else ""))
    await db.commit()
    return {"id": item.id, "qty": item.qty, "low": item.qty < item.min_level}


@router.post("/inventory")
async def add_stock(body: StockIn, payload=Depends(require_role("admin", "pharmacist")),
                    db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(InventoryItem).where(
        InventoryItem.drug == body.drug, InventoryItem.pharmacy_id == body.pharmacy_id or 1))
    item = res.scalar_one_or_none()
    if item:
        item.qty += body.qty
        item.min_level = body.min_level
        await record(db, actor=payload.get("name", ""), action="update", entity="inventory",
                     entity_id=item.id, detail=f"إضافة +{body.qty} إلى {item.drug}")
    else:
        item = InventoryItem(pharmacy_id=body.pharmacy_id or 1, drug=body.drug,
                             strength=body.strength, form=body.form, qty=body.qty,
                             min_level=body.min_level)
        db.add(item)
        await record(db, actor=payload.get("name", ""), action="create", entity="inventory",
                     entity_id=0, detail=f"صنف جديد: {body.drug} ×{body.qty}")
    await db.commit()
    await db.refresh(item)
    return {"id": item.id, "qty": item.qty}


# ---------- الروشتات ----------

class RxItemIn(BaseModel):
    drug: str
    strength: str = ""
    dosage: str = ""
    duration: str = ""
    qty: int = Field(ge=1)


class RxIn(BaseModel):
    patient_name: str
    purpose: str = ""
    notes: str = ""
    institution: str = ""
    items: list[RxItemIn] = []


def _ref() -> str:
    return "RX-" + datetime.now(timezone.utc).strftime("%Y%m%d") + "-" + \
        f"{int(datetime.now().timestamp() % 100000):05d}"


async def _ser_rx(db: AsyncSession, r: Prescription) -> dict:
    res = await db.execute(select(PrescriptionItem).where(PrescriptionItem.prescription_id == r.id))
    items = res.scalars().all()
    return {
        "id": r.id, "ref": r.ref, "patient_name": r.patient_name, "doctor_name": r.doctor_name,
        "institution": r.institution, "purpose": r.purpose, "notes": r.notes,
        "status": r.status, "created_at": r.created_at.isoformat() if r.created_at else None,
        "dispensed_by": r.dispensed_by, "dispensed_at": r.dispensed_at.isoformat() if r.dispensed_at else None,
        "items": [{"drug": i.drug, "strength": i.strength, "dosage": i.dosage,
                   "duration": i.duration, "qty": i.qty} for i in items],
    }


@router.post("/prescriptions")
async def create_rx(body: RxIn, payload=Depends(require_role("admin", "doctor", "pharmacist")),
                    db: AsyncSession = Depends(get_db)):
    if not body.items:
        raise HTTPException(status_code=422, detail="الروشتة تحتاج بنداً واحداً على الأقل")
    r = Prescription(
        ref=_ref(), patient_name=body.patient_name.strip(),
        doctor_name=payload.get("name", ""), institution=body.institution,
        purpose=body.purpose, notes=body.notes,
    )
    db.add(r)
    await db.flush()
    for it in body.items:
        db.add(PrescriptionItem(prescription_id=r.id, drug=it.drug.strip(), strength=it.strength,
                                dosage=it.dosage, duration=it.duration, qty=it.qty))
    await record(db, actor=r.doctor_name, action="create", entity="prescription",
                 entity_id=r.id, detail=f"روشتة {r.ref} للمريض: {r.patient_name} ({len(body.items)} بند)")
    await db.commit()
    return await _ser_rx(db, r)


@router.get("/prescriptions")
async def list_rx(patient: str = "", payload=Depends(current_user),
                  db: AsyncSession = Depends(get_db)):
    q = select(Prescription).order_by(Prescription.created_at.desc()).limit(300)
    if patient.strip():
        q = q.where(Prescription.patient_name.ilike(f"%{patient.strip()}%"))
    res = await db.execute(q)
    return [await _ser_rx(db, r) for r in res.scalars().all()]


@router.get("/prescriptions/{rx_id}")
async def get_rx(rx_id: int, payload=Depends(current_user), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Prescription).where(Prescription.id == rx_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="روشتة غير موجودة")
    return await _ser_rx(db, r)


@router.post("/prescriptions/{rx_id}/dispense")
async def dispense_rx(rx_id: int, body: dict = {},
                      payload=Depends(require_role("admin", "pharmacist")),
                      db: AsyncSession = Depends(get_db)):
    """الصرف: يتحقق من توفر كل بند ويخصم من المخزون، ويعلّم الروشتة 'صُرفت'."""
    res = await db.execute(select(Prescription).where(Prescription.id == rx_id))
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="روشتة غير موجودة")
    if r.status != "open":
        raise HTTPException(status_code=409, detail="الروشتة سبق صرفها أو أُلغيت")
    items = (await db.execute(
        select(PrescriptionItem).where(PrescriptionItem.prescription_id == r.id))).scalars().all()

    missing: list[str] = []
    for it in items:
        inv = (await db.execute(select(InventoryItem).where(
            InventoryItem.drug == it.drug))).scalars().all()
        avail = sum(i.qty for i in inv)
        if avail < it.qty:
            missing.append(f"{it.drug} (مطلوب {it.qty}، متاح {avail})")
    if missing:
        raise HTTPException(status_code=409, detail="نقص بالمخزون: " + "؛ ".join(missing))

    # الخصم من أول توفر
    for it in items:
        need = it.qty
        for inv in (await db.execute(select(InventoryItem).where(
                InventoryItem.drug == it.drug).order_by(InventoryItem.qty.desc()))).scalars().all():
            if need <= 0:
                break
            take = min(inv.qty, need)
            inv.qty -= take
            need -= take

    r.status = "dispensed"
    r.dispensed_by = payload.get("name", "")
    r.dispensed_at = datetime.now(timezone.utc)
    await record(db, actor=r.dispensed_by, action="update", entity="prescription",
                 entity_id=r.id, detail=f"صُرفت روشتة {r.ref} للمريض: {r.patient_name}")
    await db.commit()
    return await _ser_rx(db, r)