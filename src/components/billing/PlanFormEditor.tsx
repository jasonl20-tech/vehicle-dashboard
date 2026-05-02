import { useEffect, useState } from "react";
import { putPlan } from "../../lib/billingApi";
import {
  defaultPlanValue,
  parsePlanValue,
  planValueToKvJson,
  type PlanValue,
} from "../../lib/planFormTypes";
import PlanFormFields, { getPlanValidationMsg } from "./PlanFormFields";

type Props = {
  planKey: string;
  planOne: { key: string; value: unknown; raw: string } | null;
  planLoading: boolean;
  planErr: string | null;
  onAfterSave: () => void;
};

/**
 * Plan-Editor für `/dashboard/zahlungen/plaene`. Lädt das Modell aus dem KV-Wert,
 * delegiert das Rendering an `PlanFormFields` und schreibt beim Speichern
 * über `putPlan` zurück in die `plans`-KV.
 */
export default function PlanFormEditor({
  planKey,
  planOne,
  planLoading,
  planErr,
  onAfterSave,
}: Props) {
  const [model, setModel] = useState<PlanValue | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState(false);

  useEffect(() => {
    if (!planOne || planOne.key !== planKey) return;
    let input: unknown = planOne.value;
    if (input == null && planOne.raw) {
      try {
        input = JSON.parse(planOne.raw) as unknown;
      } catch {
        setModel(null);
        setParseError("Gespeichertes JSON ist ungültig");
        return;
      }
    }
    if (input == null) {
      setModel(defaultPlanValue(planKey));
      setParseError(null);
      return;
    }
    const parsed = parsePlanValue(input, planKey);
    if (parsed.ok) {
      setModel(parsed.value);
      setParseError(null);
    } else {
      setModel(null);
      setParseError(parsed.error);
    }
  }, [planKey, planOne]);

  if (planLoading && !planOne) {
    return <p className="py-8 text-[12.5px] text-ink-400">Lade Plan …</p>;
  }
  if (planErr) {
    return (
      <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
        {planErr}
      </p>
    );
  }
  if (parseError && !model) {
    return (
      <div className="space-y-3">
        <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
          Plan-JSON ungültig: {parseError}
        </p>
        <button
          type="button"
          onClick={() => {
            setModel(defaultPlanValue(planKey));
            setParseError(null);
          }}
          className="rounded-md border border-hair bg-white px-3 py-1.5 text-[12.5px] text-ink-700 hover:border-ink-300 hover:text-ink-900"
        >
          Auf Standard-Plan setzen
        </button>
      </div>
    );
  }
  if (!model) {
    return <p className="py-8 text-[12.5px] text-ink-400">…</p>;
  }

  const validationMsg = getPlanValidationMsg(model);

  const onSave = async () => {
    if (validationMsg) {
      setSaveErr(validationMsg);
      return;
    }
    setSaveErr(null);
    setSaving(true);
    try {
      await putPlan(planKey, planValueToKvJson(model));
      setSavedPing(true);
      window.setTimeout(() => setSavedPing(false), 1600);
      onAfterSave();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PlanFormFields model={model} onChange={setModel} />

      {/* Footer / Save */}
      <div className="sticky bottom-0 -mx-6 mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-hair bg-paper/95 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-paper/85">
        <div className="min-w-0 text-[11.5px] text-ink-500">
          {validationMsg ? (
            <span className="text-accent-amber">{validationMsg}</span>
          ) : saveErr ? (
            <span className="text-accent-rose">{saveErr}</span>
          ) : savedPing ? (
            <span className="text-accent-mint">Gespeichert.</span>
          ) : (
            <span className="text-ink-400">
              Änderungen werden nach „Speichern“ übernommen.
            </span>
          )}
        </div>
        <button
          type="button"
          disabled={saving || !!validationMsg}
          onClick={onSave}
          className="rounded-md bg-ink-900 px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-ink-800 disabled:opacity-50"
        >
          {saving ? "Speichere …" : "Plan speichern"}
        </button>
      </div>
    </div>
  );
}
