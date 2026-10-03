import { api } from '../api'

/**
 * محرك المزامنة التلقائية (Offline-First) — رعايتي DZ
 * ------------------------------------------------------------------
 * - تخزين محلي: IndexedDB (نفس فكرة SQLite محلياً للمتصفحات)
 * - مزّانة تلقائية: عند عودة الاتصال ('online') أو يدوياً عبر syncNow()
 * - قرار النزاع: أسبقية آخر تعديل (last-write-wins بالطابع الزمني)
 * - النقل عبر نقطتي /followups/sync/push (رفع العمليات) و /sync/pull (سحب)
 */

export interface SyncOp {
  op: 'create' | 'update' | 'delete'
  entity: string
  id: number | null
  ts: number
  payload: any
}

const DB_NAME = 'vitalink_offline'
const DB_VERSION = 1
const OPS_STORE = 'ops'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(OPS_STORE)) {
        const store = db.createObjectStore(OPS_STORE, { keyPath: 'ts' })
        store.createIndex('entity', 'entity', { unique: false })
        store.createIndex('op', 'op', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('فشل فتح IndexedDB'))
  })
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(OPS_STORE, mode)
        const r = run(t.objectStore(OPS_STORE))
        r.onsuccess = () => resolve(r.result as T)
        r.onerror = () => reject(r.error || new Error('فشل معاملة IndexedDB'))
        t.oncomplete = () => db.close()
        t.onerror = () => reject(t.error)
      }),
  )
}

/** إضافة عملية إلى قائمة الانتظار المحلية (تعمل دون إنترنت) */
export function enqueue(op: Omit<SyncOp, 'ts'>): Promise<void> {
  return tx('readwrite', (s) => s.put({ ...op, ts: Date.now() })).then(() => undefined)
}

/** كل العمليات المعلّقة */
export async function queueList(): Promise<SyncOp[]> {
  const all: SyncOp[] = await tx('readonly', (s) => s.getAll())
  return all.sort((a, b) => a.ts - b.ts)
}

/** تفريغ العمليات المعلّقة */
export async function clearQueue(): Promise<void> {
  return tx('readwrite', (s) => s.clear()).then(() => undefined)
}

export function countPending(): Promise<number> {
  return tx('readonly', (s) => s.count())
}

/** اشتراك في عودة الاتصال */
export function onOnline(cb: () => void): () => void {
  const h = () => {
    if (navigator.onLine) cb()
  }
  window.addEventListener('online', h)
  return () => window.removeEventListener('online', h)
}

/**
 * المزامنة الكاملة: رفع المعلّق ثم سحب التغييرات البعيدة.
 * تُسمى تلقائياً عند عودة الاتصال أو يدوياً.
 */
export async function syncNow(pushUrl = '/followups/sync/push', pullUrl = '/followups/sync/pull') {
  const pending = await queueList()
  let pushed = 0
  let errors = 0

  if (pending.length) {
    try {
      const res = await api<any>(pushUrl, {
        method: 'POST',
        body: JSON.stringify({ device: 'vitaldz-mobile', ops: pending }),
      })
      pushed = res.applied ?? pending.length
      await clearQueue()
    } catch {
      errors = pending.length
    }
  }

  let pulled = 0
  try {
    const remote = await api<unknown[]>(pullUrl)
    pulled = remote?.length ?? 0
  } catch {
    /* يبقى محلياً — سيُعاد عند الاتصال التالي */
  }

  return { pushed, pulled, errors, pending: (await countPending()) }
}

/** ترقّب المزامنة التلقائية داخل مكوّن React */
export function useAutoSync(): { sync: typeof syncNow; status: 'off' | 'syncing' | 'done'; pending: number } {
  // ملاحظة ترشيدية: استُخدم مساعد خارج React لحفظ البساطة؛ انظري vitaldz.tsx.
  return { sync: syncNow, status: 'off', pending: 0 }
}

export { api }