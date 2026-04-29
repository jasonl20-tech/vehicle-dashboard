/**
 * Email manuell — Platzhalter.
 *
 * An dieser Stelle wird später ein echter Versand-Workflow für
 * einmalige Mails eingebaut (Empfänger eintippen, Betreff/Body
 * verfassen, „Senden" → externer Mail-Worker). Bis dahin zeigen wir
 * bewusst nur einen Hinweis, damit niemand annimmt, hier könne man
 * schon Mails rausschicken.
 */
import { Mail } from "lucide-react";

export default function EmailManuellPage() {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-hair bg-paper text-ink-700">
          <Mail className="h-5 w-5" aria-hidden />
        </div>
        <p className="mt-6 text-[13px] leading-relaxed text-ink-700">
          Einmalige Mails manuell versenden — folgt.
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-ink-500">
          Hier wird der Compose-Workflow eingebaut, sobald der externe
          Mail-Worker einen Send-Endpoint bereitstellt.
        </p>
      </div>
    </div>
  );
}
