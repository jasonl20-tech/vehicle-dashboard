import QRCode from "react-qr-code";

type Props = {
  otpauthUri: string;
  /** Seitenlänge des quadratischen SVG in px */
  size?: number;
  className?: string;
};

/**
 * Rendert den `otpauth://…`-URI als QR-Code komplett im Browser (SVG).
 * Kein externer QR-Generator – das Geheimnis aus dem URI verlässt den Client nicht.
 */
export default function TotpQrCode({
  otpauthUri,
  size = 200,
  className = "",
}: Props) {
  const v = otpauthUri.trim();
  if (!v) return null;

  return (
    <figure className={className.trim() || undefined}>
      <div className="inline-block rounded-lg border border-hair bg-white p-3 shadow-sm">
        <QRCode
          value={v}
          size={size}
          level="M"
          fgColor="#111827"
          bgColor="#FFFFFF"
          style={{
            height: "auto",
            maxWidth: "100%",
            width: "100%",
            display: "block",
          }}
          viewBox={`0 0 ${size} ${size}`}
        />
      </div>
      <figcaption className="mt-2 text-center text-[11px] leading-snug text-ink-500">
        Mit der Authenticator-App scannen
      </figcaption>
    </figure>
  );
}
