/**
 * Shared Typen + Validierung für das Schreiben in `controll_status`.
 *
 * CREATE TABLE controll_status (
 *   id INTEGER PRIMARY KEY AUTOINCREMENT,
 *   vehicle_id INTEGER NOT NULL,
 *   view_token TEXT NOT NULL,
 *   mode TEXT NOT NULL,
 *   status TEXT NOT NULL,
 *   updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
 *   key TEXT,
 *   "check" INTEGER NOT NULL DEFAULT 0,
 *   UNIQUE(vehicle_id, view_token, mode)
 * )
 */
export const CONTROLL_STATUS_MODES = [
  "correction",
  "inside",
  "scaling",
  "shadow",
  "transparency",
] as const;
export type ControllStatusMode = (typeof CONTROLL_STATUS_MODES)[number];

/** Status-Werte je nach Modus. */
export const CONTROLL_STATUS_VALUES_BY_MODE: Record<
  ControllStatusMode,
  readonly string[]
> = {
  correction: ["correct", "regen_vertex", "regen_batch", "delete"],
  inside: ["correct", "regen_vertex", "regen_batch", "delete"],
  shadow: ["correct", "regen_vertex", "regen_batch", "delete"],
  transparency: ["correct", "regen_vertex", "regen_batch", "delete"],
  scaling: ["correct", "regen_transparent", "regen_scaling", "delete"],
};

export function isControllStatusMode(s: unknown): s is ControllStatusMode {
  return (
    typeof s === "string" &&
    (CONTROLL_STATUS_VALUES_BY_MODE as Record<string, unknown>)[s] !== undefined
  );
}

export function isAllowedStatusForMode(
  mode: ControllStatusMode,
  status: unknown,
): status is string {
  if (typeof status !== "string") return false;
  return CONTROLL_STATUS_VALUES_BY_MODE[mode].includes(status);
}

const VIEW_TOKEN_MAX = 200;
const KEY_MAX = 1024;

export type ControllStatusUpsertInput = {
  vehicleId: number;
  viewToken: string;
  mode: ControllStatusMode;
  status: string;
  key: string | null;
};

export type ControllStatusValidation =
  | { ok: true; value: ControllStatusUpsertInput }
  | { ok: false; error: string };

export function validateControllStatusBody(
  raw: unknown,
): ControllStatusValidation {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Body muss ein JSON-Objekt sein." };
  }
  const b = raw as Record<string, unknown>;

  const vehicleId = Number(b.vehicleId);
  if (!Number.isInteger(vehicleId) || vehicleId < 1) {
    return { ok: false, error: "vehicleId muss eine positive Ganzzahl sein." };
  }

  const viewToken =
    typeof b.viewToken === "string" ? b.viewToken.trim() : "";
  if (!viewToken) return { ok: false, error: "viewToken fehlt." };
  if (viewToken.length > VIEW_TOKEN_MAX) {
    return {
      ok: false,
      error: `viewToken zu lang (max ${VIEW_TOKEN_MAX} Zeichen).`,
    };
  }

  if (!isControllStatusMode(b.mode)) {
    return {
      ok: false,
      error:
        "mode muss correction | inside | scaling | shadow | transparency sein.",
    };
  }
  const mode: ControllStatusMode = b.mode;

  if (!isAllowedStatusForMode(mode, b.status)) {
    return {
      ok: false,
      error: `status für mode='${mode}' nicht erlaubt. Zulässig: ${CONTROLL_STATUS_VALUES_BY_MODE[
        mode
      ].join(", ")}.`,
    };
  }
  const status = b.status as string;

  let key: string | null = null;
  if (b.key === null || b.key === undefined || b.key === "") {
    key = null;
  } else if (typeof b.key === "string") {
    if (b.key.length > KEY_MAX) {
      return { ok: false, error: `key zu lang (max ${KEY_MAX} Zeichen).` };
    }
    key = b.key;
  } else {
    return { ok: false, error: "key muss String oder null sein." };
  }

  return {
    ok: true,
    value: { vehicleId, viewToken, mode, status, key },
  };
}

export type ControllStatusRow = {
  id: number;
  vehicle_id: number;
  view_token: string;
  mode: string;
  status: string;
  updated_at: string | null;
  key: string | null;
  check: number;
};

export const SELECT_CONTROLL_STATUS_ONE = `SELECT
  id, vehicle_id, view_token, mode, status, updated_at, key, "check" AS "check"
FROM controll_status
WHERE vehicle_id = ? AND view_token = ? AND mode = ?
LIMIT 1`;

/**
 * UPSERT (INSERT … ON CONFLICT DO UPDATE) gemäß `UNIQUE(vehicle_id, view_token, mode)`.
 * Bei INSERT ist `"check" = 0`; bei Konflikt werden Status/Key/`check` aus der
 * Anfrage übernommen (Control-Platform setzt nach „richtig“ wieder Pending).
 */
export const UPSERT_CONTROLL_STATUS_SQL = `INSERT INTO controll_status
  (vehicle_id, view_token, mode, status, key, updated_at, "check")
VALUES (?, ?, ?, ?, ?, datetime('now'), 0)
ON CONFLICT(vehicle_id, view_token, mode) DO UPDATE SET
  status = excluded.status,
  key = excluded.key,
  updated_at = datetime('now'),
  "check" = 0`;
