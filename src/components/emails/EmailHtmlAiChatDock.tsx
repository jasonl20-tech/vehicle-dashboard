import {
  ChevronDown,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type TemplateAiChatTurn,
  fetchTemplateAiMeta,
  postTemplateAiChat,
  type TemplateAiModelOption,
} from "../../lib/emailTemplateAiApi";

const MODEL_STORAGE_KEY = "ui.emailTemplates.aiModelId";

function readStoredModelId(): string | null {
  try {
    const v = window.localStorage.getItem(MODEL_STORAGE_KEY);
    return v?.trim() || null;
  } catch {
    return null;
  }
}

function writeStoredModelId(id: string): void {
  try {
    window.localStorage.setItem(MODEL_STORAGE_KEY, id);
  } catch {
    /* empty */
  }
}

export function EmailHtmlAiChatDock({
  show,
  expanded,
  onExpandedChange,
  html,
  onApplyHtml,
}: {
  show: boolean;
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  html: string;
  onApplyHtml: (next: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [models, setModels] = useState<TemplateAiModelOption[]>([]);
  const [defaultModel, setDefaultModel] = useState("");
  const [modelId, setModelId] = useState<string>(() => readStoredModelId() ?? "");
  const [aiConfigured, setAiConfigured] = useState(true);
  const [configHint, setConfigHint] = useState<string | null>(null);
  const [metaErr, setMetaErr] = useState<string | null>(null);

  const [messages, setMessages] = useState<TemplateAiChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [pendingApply, setPendingApply] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetchTemplateAiMeta()
      .then((m) => {
        if (cancelled) return;
        setModels(m.models ?? []);
        setDefaultModel(m.defaultModel ?? "");
        setAiConfigured(Boolean(m.aiConfigured));
        setConfigHint(typeof m.hint === "string" ? m.hint : null);
        setMetaErr(null);
        const stored = readStoredModelId();
        const ids = new Set((m.models ?? []).map((x) => x.id));
        const pick =
          (stored && ids.has(stored) ? stored : null) ??
          m.defaultModel ??
          m.models?.[0]?.id ??
          "";
        if (pick) {
          setModelId(pick);
          writeStoredModelId(pick);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setMetaErr(e instanceof Error ? e.message : String(e));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [show]);

  useEffect(() => {
    if (!show) {
      setMessages([]);
      setInput("");
      setSendErr(null);
      setPendingApply(null);
    }
  }, [show]);

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, expanded, sending]);

  const onPickModel = useCallback((id: string) => {
    setModelId(id);
    writeStoredModelId(id);
  }, []);

  const effectiveModel = useMemo(() => {
    if (modelId && models.some((m) => m.id === modelId)) return modelId;
    if (defaultModel) return defaultModel;
    return models[0]?.id ?? "";
  }, [modelId, models, defaultModel]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || !effectiveModel || sending) return;
    setSending(true);
    setSendErr(null);
    setPendingApply(null);
    const nextMsgs: TemplateAiChatTurn[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(nextMsgs);
    setInput("");
    try {
      const out = await postTemplateAiChat({
        model: effectiveModel,
        currentHtml: html,
        messages: nextMsgs,
      });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: out.reply },
      ]);
      if (out.html && out.html.trim()) {
        setPendingApply(out.html.trim());
      }
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : String(e));
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  }, [input, effectiveModel, sending, messages, html]);

  const applyPending = useCallback(() => {
    if (!pendingApply) return;
    onApplyHtml(pendingApply);
    setPendingApply(null);
  }, [pendingApply, onApplyHtml]);

  if (!show) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-0 right-0 z-[100] flex flex-col items-end gap-2 p-3 sm:p-4"
    >
      {!expanded && (
        <button
          type="button"
          onClick={() => onExpandedChange(true)}
          className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-ink-900 text-white shadow-lg transition hover:bg-ink-800"
          title="KI-Hilfe für E-Mail-HTML"
          aria-label="KI-Hilfe öffnen"
        >
          <Sparkles className="h-5 w-5" />
        </button>
      )}

      {expanded && (
        <div
          className="pointer-events-auto flex max-h-[min(520px,calc(100vh-120px))] w-[min(100vw-24px,380px)] flex-col overflow-hidden rounded-xl border border-hair bg-white shadow-2xl"
          role="dialog"
          aria-label="E-Mail HTML KI-Chat"
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-hair bg-ink-50/90 px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <MessageSquare className="h-4 w-4 shrink-0 text-ink-600" />
              <span className="truncate text-[12.5px] font-semibold text-ink-800">
                HTML · Workers AI
              </span>
            </div>
            <button
              type="button"
              onClick={() => onExpandedChange(false)}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-800"
              aria-label="Chat minimieren"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="shrink-0 border-b border-hair bg-white px-2 py-2">
            <label className="block text-[10px] font-medium uppercase tracking-[0.12em] text-ink-500">
              Modell
            </label>
            <div className="relative mt-1">
              <select
                value={effectiveModel}
                onChange={(e) => onPickModel(e.target.value)}
                disabled={models.length === 0}
                className="w-full appearance-none rounded-md border border-hair bg-white py-1.5 pl-2 pr-7 text-[11.5px] text-ink-900"
              >
                {models.length === 0 ? (
                  <option value="">Modelle laden…</option>
                ) : (
                  models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-500" />
            </div>
            {metaErr && (
              <p className="mt-1 text-[10.5px] text-accent-rose">{metaErr}</p>
            )}
            {!aiConfigured && !metaErr && (
              <p className="mt-1 text-[10.5px] text-accent-amber">
                {configHint ??
                  "Workers AI-Binding in Cloudflare Pages setzen (Variable z. B. workersai)."}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-ink-50/40 px-2 py-2">
            {messages.length === 0 && (
              <p className="px-1 py-2 text-[11.5px] leading-snug text-ink-500">
                Beschreibe Änderungen am HTML (z. B. „Button größer, Text
                kürzer“). Wenn die Antwort JSON mit „html“ enthält, kannst du
                den Vorschlag in den Editor übernehmen.
              </p>
            )}
            <ul className="flex flex-col gap-2">
              {messages.map((m, i) => (
                <li
                  key={`${i}-${m.role}`}
                  className={`rounded-lg px-2.5 py-1.5 text-[11.5px] leading-snug ${
                    m.role === "user"
                      ? "ml-4 bg-ink-900 text-ink-50"
                      : "mr-4 border border-hair bg-white text-ink-800"
                  }`}
                >
                  {m.content}
                </li>
              ))}
            </ul>
            {sendErr && (
              <p className="mt-2 rounded-md border border-accent-rose/40 bg-accent-rose/10 px-2 py-1.5 text-[11px] text-accent-rose">
                {sendErr}
              </p>
            )}
            <div ref={endRef} />
          </div>

          {pendingApply && (
            <div className="shrink-0 border-t border-hair bg-accent-amber/10 px-2 py-2">
              <p className="text-[10.5px] font-medium text-accent-amber">
                HTML-Vorschlag bereit
              </p>
              <button
                type="button"
                onClick={applyPending}
                className="btn-shine press mt-1 w-full rounded-md bg-ink-900 px-2 py-1.5 text-[11.5px] font-medium text-white"
              >
                In Editor übernehmen
              </button>
            </div>
          )}

          <div className="shrink-0 border-t border-hair bg-white p-2">
            <div className="flex gap-1.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                disabled={sending || !effectiveModel || !aiConfigured}
                placeholder="Nachricht an die KI… (Enter senden, Shift+Enter Zeile)"
                className="min-h-0 flex-1 resize-none rounded-md border border-hair bg-white px-2 py-1.5 text-[12px] text-ink-900 placeholder:text-ink-400 focus:border-ink-400 focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void send()}
                disabled={
                  sending ||
                  !input.trim() ||
                  !effectiveModel ||
                  !aiConfigured
                }
                className="inline-flex h-[3.25rem] w-10 shrink-0 items-center justify-center rounded-md bg-ink-900 text-white disabled:opacity-40"
                title="Senden"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
