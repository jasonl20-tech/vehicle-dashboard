import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import PlanFormFields, {
  Field,
  Grid2,
  Section,
  TextInput,
  getPlanValidationMsg,
} from "../components/billing/PlanFormFields";
import { useJsonApi } from "../lib/billingApi";
import {
  CUSTOMER_KEY_STATUSES,
  isPlanNameTestKey,
  customerKeyUrlOne,
  parseCustomerKeyValue,
  putCustomerKey,
  shortKey,
  type CustomerKeyOneResponse,
  type CustomerKeyValue,
} from "../lib/customerKeysApi";
import { type PlanValue } from "../lib/planFormTypes";

export default function KundenKeyDetailPage() {
  const { key: keyParam } = useParams();
  const location = useLocation();
  const kid = keyParam ? decodeURIComponent(keyParam) : "";
  const isTestArea = location.pathname.startsWith("/kunden/test-keys");

  const one = useJsonApi<CustomerKeyOneResponse>(
    kid ? customerKeyUrlOne(kid) : null,
  );

  const reload = useCallback(() => {
    one.reload();
  }, [one]);

  return (
    <>
      <PageHeader
        eyebrow="Kundenmanagement"
        title={isTestArea ? "Kundentest-Key bearbeiten" : "Kunden-Key bearbeiten"}
        hideCalendarAndNotifications
        description={
          isTestArea ? (
            <>
              Test-Plan: <span className="font-mono text-[12px]">plan_id</span>{" "}
              oder <span className="font-mono text-[12px]">plan_name</span> enthält{" "}
              <span className="font-medium">test</span>. Diese Keys erscheinen nur
              unter „Kundentest keys“.
            </>
          ) : (
            <>
              Produktions-Key (ohne „test“ im Plan-Namen). Übersicht unter
              „Kunden keys“; Pläne mit <span className="font-medium">test</span> im
              Namen unter „Kundentest keys“.
            </>
          )
        }
        rightSlot={
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-hair bg-white text-ink-500 transition-colors hover:border-ink-300 hover:text-ink-800"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${one.loading ? "animate-spin" : ""}`}
            />
          </button>
        }
      />

      <p className="mb-6">
        <Link
          to={isTestArea ? "/kunden/test-keys" : "/kunden/keys"}
          className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-600 transition-colors hover:text-ink-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {isTestArea
            ? "Zurück zu Kundentest keys"
            : "Zurück zu Kunden keys"}
        </Link>
      </p>

      {!kid ? (
        <p className="text-[12.5px] text-accent-rose">Ungültiger Link.</p>
      ) : (
        <CustomerKeyEditor
          key={kid}
          kid={kid}
          one={one.data}
          err={one.error}
          loading={one.loading}
          onAfterSave={reload}
        />
      )}
    </>
  );
}

function CustomerKeyEditor({
  kid,
  one,
  err,
  loading,
  onAfterSave,
}: {
  kid: string;
  one: CustomerKeyOneResponse | null;
  err: string | null;
  loading: boolean;
  onAfterSave: () => void;
}) {
  const [model, setModel] = useState<CustomerKeyValue | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [savedPing, setSavedPing] = useState(false);

  useEffect(() => {
    if (!one || one.key !== kid) return;
    let input: unknown = one.value;
    if (input == null && one.raw) {
      try {
        input = JSON.parse(one.raw) as unknown;
      } catch {
        setModel(null);
        setParseError("Gespeichertes JSON ist ungültig");
        return;
      }
    }
    const parsed = parseCustomerKeyValue(input);
    if (parsed.ok) {
      setModel(parsed.value);
      setParseError(null);
    } else {
      setModel(null);
      setParseError(parsed.error);
    }
  }, [one, kid]);

  if (loading && !one) {
    return (
      <p className="py-8 text-[12.5px] text-ink-400">Lade Kunden-Key …</p>
    );
  }
  if (err) {
    return (
      <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
        {err}
      </p>
    );
  }
  if (parseError && !model) {
    return (
      <p className="border-l-2 border-accent-rose px-3 py-2 text-[12.5px] text-accent-rose">
        Wert ungültig: {parseError}
      </p>
    );
  }
  if (!model) {
    return <p className="py-8 text-[12.5px] text-ink-400">…</p>;
  }

  const planValidation = getPlanValidationMsg(model.plan);
  const customerValidation = ((): string | null => {
    if (model.customer.email && !/^\S+@\S+\.\S+$/.test(model.customer.email)) {
      return "Email: ungültiges Format";
    }
    if (!model.plan_id.trim()) return "plan_id darf nicht leer sein";
    if (!model.status.trim()) return "status darf nicht leer sein";
    return null;
  })();
  const validationMsg = customerValidation ?? planValidation;

  const setPlan = (next: PlanValue) =>
    setModel((m) => (m ? { ...m, plan: next } : m));

  const onSave = async () => {
    if (!model || validationMsg) {
      if (validationMsg) setSaveErr(validationMsg);
      return;
    }
    setSaveErr(null);
    setSaving(true);
    try {
      await putCustomerKey(kid, model);
      setSavedPing(true);
      window.setTimeout(() => setSavedPing(false), 1600);
      onAfterSave();
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  const customerLabel = model.customer.email || shortKey(kid);
  const isTest = isPlanNameTestKey(model.plan_id, model.plan.plan_name);

  return (
    <div className="max-w-4xl border-t border-hair pt-8">
      <div className="mb-6 flex items-baseline justify-between gap-3 border-b border-hair pb-4">
        <div className="min-w-0">
          <p className="text-[10.5px] font-medium uppercase tracking-[0.16em] text-ink-400">
            {isTest ? "Kundentest-Key" : "Kunden-Key"} · {model.plan_id}
          </p>
          <p
            className="mt-1 truncate font-display text-[20px] tracking-tightish text-ink-900"
            title={kid}
          >
            {customerLabel}
          </p>
          <p
            className="mt-0.5 truncate font-mono text-[11.5px] text-ink-500"
            title={kid}
          >
            {kid}
          </p>
        </div>
      </div>

      <Section title="Status & Kunde">
        <div className="space-y-5">
          <Grid2>
            <Field label="status">
              <select
                value={model.status}
                onChange={(e) =>
                  setModel((m) => (m ? { ...m, status: e.target.value } : m))
                }
                className="w-full border-b border-hair bg-transparent py-1.5 text-[12.5px] text-ink-800 outline-none focus:border-ink-700"
              >
                {[
                  ...new Set([model.status, ...CUSTOMER_KEY_STATUSES]),
                ].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="plan_id" hint="„test“ in plan_id/plan_name → Kundentest keys">
              <TextInput
                value={model.plan_id}
                onChange={(v) =>
                  setModel((m) => (m ? { ...m, plan_id: v } : m))
                }
                mono
              />
            </Field>
          </Grid2>

          <Field label="customer.email">
            <TextInput
              type="email"
              value={model.customer.email}
              onChange={(v) =>
                setModel((m) =>
                  m ? { ...m, customer: { ...m.customer, email: v } } : m,
                )
              }
              placeholder="kunde@example.com"
            />
          </Field>

          <Grid2>
            <Field label="customer.stripe_customer_id">
              <TextInput
                value={model.customer.stripe_customer_id ?? ""}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? {
                          ...m,
                          customer: {
                            ...m.customer,
                            stripe_customer_id: v.trim() || null,
                          },
                        }
                      : m,
                  )
                }
                placeholder="cus_…"
                mono
              />
            </Field>
            <Field
              label="customer.stripe_subscription_id"
              hint="z. B. one_time_purchase"
            >
              <TextInput
                value={model.customer.stripe_subscription_id}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? {
                          ...m,
                          customer: {
                            ...m.customer,
                            stripe_subscription_id: v,
                          },
                        }
                      : m,
                  )
                }
                mono
              />
            </Field>
          </Grid2>

          <Grid2>
            <Field label="metadata.created_at" hint="ISO 8601 (UTC)">
              <TextInput
                value={model.metadata.created_at}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? { ...m, metadata: { ...m.metadata, created_at: v } }
                      : m,
                  )
                }
                mono
              />
            </Field>
            <Field
              label="metadata.expires_at"
              hint="Ablauf (ISO) — optional, alternativ reicht plan.expires_in_seconds + created"
            >
              <TextInput
                value={model.metadata.expires_at ?? ""}
                onChange={(v) =>
                  setModel((m) =>
                    m
                      ? {
                          ...m,
                          metadata: {
                            ...m.metadata,
                            expires_at: v.trim() || undefined,
                          },
                        }
                      : m,
                  )
                }
                placeholder="2026-12-31T23:59:59.000Z"
                mono
              />
            </Field>
          </Grid2>
        </div>
      </Section>

      <PlanFormFields model={model.plan} onChange={setPlan} />

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
          {saving ? "Speichere …" : "Kunden-Key speichern"}
        </button>
      </div>
    </div>
  );
}
