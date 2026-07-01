/**
 * DB-gestützte Sperre fürs Neu-Generieren (wie im alten System check=1 „in
 * Bearbeitung"): Solange eine Ansicht generiert wird, steht ein Eintrag in
 * `regen_locks` (D1 `cardb`). So überlebt die Sperre Neuladen, ist für alle
 * Tabs/Nutzer sichtbar und verhindert Doppel-Starts.
 *
 * Tabelle: regen_locks (lock_key TEXT PRIMARY KEY, created_at TEXT).
 * lock_key = marke|modell|jahr|body|trim|farbe|view  (wörtliche DB-Werte).
 * Auto-Ablauf: Einträge älter als TTL gelten als abgelaufen (steckengeblieben).
 */

// Regenerierung dauert ~1–3 Min; 10 Min sind sicher „hängengeblieben".
const TTL = "-10 minutes";

type LockId = {
  marke: string;
  modell: string;
  jahr: number | string;
  body: string;
  trim: string;
  farbe: string;
};

export function regenLockKey(id: LockId, view: string): string {
  return [id.marke, id.modell, id.jahr, id.body, id.trim, id.farbe, view].join(
    "|",
  );
}

export function regenVariantPrefix(id: LockId): string {
  return `${[id.marke, id.modell, id.jahr, id.body, id.trim, id.farbe].join("|")}|`;
}

/** Ist diese Ansicht aktuell (nicht abgelaufen) gesperrt? */
export async function isRegenLocked(
  db: D1Database,
  key: string,
): Promise<boolean> {
  try {
    const r = await db
      .prepare(
        `SELECT 1 FROM regen_locks WHERE lock_key = ? AND created_at > datetime('now','${TTL}')`,
      )
      .bind(key)
      .first();
    return !!r;
  } catch {
    return false;
  }
}

/** Sperre setzen (+ abgelaufene opportunistisch aufräumen). */
export async function setRegenLock(db: D1Database, key: string): Promise<void> {
  try {
    await db
      .prepare(`DELETE FROM regen_locks WHERE created_at <= datetime('now','${TTL}')`)
      .run();
    await db
      .prepare(
        `INSERT OR REPLACE INTO regen_locks (lock_key, created_at) VALUES (?, datetime('now'))`,
      )
      .bind(key)
      .run();
  } catch {
    /* Tabelle fehlt o. Ä. → Sperre ist best effort */
  }
}

/** Sperre lösen (nach dem Speichern des neuen Bildes). */
export async function clearRegenLock(
  db: D1Database,
  key: string,
): Promise<void> {
  try {
    await db.prepare(`DELETE FROM regen_locks WHERE lock_key = ?`).bind(key).run();
  } catch {
    /* best effort */
  }
}

/** Aktuell gesperrte Ansichten einer Variante (view-Namen, nicht abgelaufen). */
export async function activeRegenViews(
  db: D1Database,
  prefix: string,
): Promise<string[]> {
  try {
    const r = await db
      .prepare(
        `SELECT lock_key FROM regen_locks WHERE created_at > datetime('now','${TTL}')`,
      )
      .all();
    return (r.results ?? [])
      .map((x) => String((x as { lock_key?: unknown }).lock_key ?? ""))
      .filter((k) => k.startsWith(prefix))
      .map((k) => k.slice(prefix.length))
      .filter(Boolean);
  } catch {
    return [];
  }
}
