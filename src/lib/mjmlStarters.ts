/**
 * Starter-MJML-Snippets, die im Editor als "Vorlage einfügen" angeboten
 * werden. Bewusst klein gehalten, um saubere Compile-Ergebnisse zu
 * liefern. Variablen-Tokens (`{{name}}`, `{{company}}`) bleiben drin
 * und werden später vom externen Mail-Worker ersetzt.
 */
export type MjmlStarter = {
  id: string;
  label: string;
  description: string;
  /** Kompletter MJML-Quelltext (ersetzt den aktuellen Inhalt). */
  source: string;
};

export const MJML_STARTER_SIMPLE: string = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text color="#3a3a3d" font-size="14px" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f6f6f6">
    <mj-section background-color="#ffffff" padding="32px" border-radius="8px">
      <mj-column>
        <mj-text font-size="22px" color="#0f0f10" font-weight="600">Hallo {{name}},</mj-text>
        <mj-text>
          Schreibe hier deinen Text. Du kannst Variablen wie
          <strong>{{name}}</strong> oder <strong>{{company}}</strong>
          verwenden.
        </mj-text>
        <mj-button background-color="#0f0f10" color="#ffffff" border-radius="6px" href="https://vehicleimagery.com">
          Aktion ausf&uuml;hren
        </mj-button>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const MJML_TRANSACTIONAL: string = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text color="#3a3a3d" font-size="14px" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f6f6f6">
    <mj-section padding="24px 0 0 0">
      <mj-column>
        <mj-text align="center" font-size="13px" color="#9999a0">
          Vehicle Imagery
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="32px" border-radius="8px">
      <mj-column>
        <mj-text font-size="20px" color="#0f0f10" font-weight="600">
          Best&auml;tigung deiner Aktion
        </mj-text>
        <mj-text>
          Hallo {{name}}, vielen Dank! Hier deine Daten zur Best&auml;tigung:
        </mj-text>
        <mj-table>
          <tr style="border-bottom:1px solid #ececef;text-align:left;">
            <th style="padding:8px 0;color:#9999a0;font-weight:500;font-size:12px;">Feld</th>
            <th style="padding:8px 0;color:#9999a0;font-weight:500;font-size:12px;">Wert</th>
          </tr>
          <tr>
            <td style="padding:8px 0;">E-Mail</td>
            <td style="padding:8px 0;">{{email}}</td>
          </tr>
          <tr>
            <td style="padding:8px 0;">Plan</td>
            <td style="padding:8px 0;">{{plan}}</td>
          </tr>
        </mj-table>
        <mj-button background-color="#0f0f10" color="#ffffff" border-radius="6px" href="{{dashboard_url}}">
          Zum Dashboard
        </mj-button>
      </mj-column>
    </mj-section>
    <mj-section padding="16px 0 24px 0">
      <mj-column>
        <mj-text align="center" font-size="11px" color="#9999a0">
          Du hast diese Mail erhalten, weil du uns deine Adresse mitgeteilt hast.<br/>
          <a href="{{unsubscribe_url}}" style="color:#9999a0;">Abmelden</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const MJML_NEWSLETTER_2COL: string = `<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Helvetica, Arial, sans-serif" />
      <mj-text color="#3a3a3d" font-size="14px" line-height="1.6" />
    </mj-attributes>
  </mj-head>
  <mj-body background-color="#f6f6f6">
    <mj-section background-color="#0f0f10" padding="24px">
      <mj-column>
        <mj-text align="center" color="#ffffff" font-size="18px" font-weight="600">
          Newsletter — {{date}}
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-section background-color="#ffffff" padding="24px">
      <mj-column>
        <mj-text font-size="16px" color="#0f0f10" font-weight="600">Update 1</mj-text>
        <mj-text>Kurzer Text zum ersten Thema. Optional ein Bild dar&uuml;ber.</mj-text>
        <mj-button align="left" background-color="#0f0f10" color="#ffffff" border-radius="4px" href="https://vehicleimagery.com" padding="12px 0 0 0">
          Mehr lesen
        </mj-button>
      </mj-column>
      <mj-column>
        <mj-text font-size="16px" color="#0f0f10" font-weight="600">Update 2</mj-text>
        <mj-text>Zweites Thema in der zweiten Spalte.</mj-text>
        <mj-button align="left" background-color="#0f0f10" color="#ffffff" border-radius="4px" href="https://vehicleimagery.com" padding="12px 0 0 0">
          Mehr lesen
        </mj-button>
      </mj-column>
    </mj-section>
    <mj-section padding="16px 0 24px 0">
      <mj-column>
        <mj-text align="center" font-size="11px" color="#9999a0">
          <a href="{{unsubscribe_url}}" style="color:#9999a0;">Abmelden</a>
        </mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

const MJML_BARE: string = `<mjml>
  <mj-body>
    <mj-section>
      <mj-column>
        <mj-text>Hier MJML einf&uuml;gen \u2026</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

export const MJML_STARTERS: MjmlStarter[] = [
  {
    id: "simple",
    label: "Einfache Mail",
    description: "Eine Spalte, Begrüßung, Text und Button.",
    source: MJML_STARTER_SIMPLE,
  },
  {
    id: "transactional",
    label: "Transaktional",
    description: "Header, Daten-Tabelle, Button, Footer mit Abmeldelink.",
    source: MJML_TRANSACTIONAL,
  },
  {
    id: "newsletter_2col",
    label: "Newsletter (2 Spalten)",
    description: "Dunkler Header + zwei Inhaltsspalten + Footer.",
    source: MJML_NEWSLETTER_2COL,
  },
  {
    id: "bare",
    label: "Leeres Gerüst",
    description: "Minimaler MJML-Skeleton ohne Inhalt.",
    source: MJML_BARE,
  },
];
