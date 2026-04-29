/**
 * Starter-Designs für den Builder. Werden im "Vorlage einfügen"-Dialog
 * angeboten und ersetzen das aktuelle Design beim Klick.
 */
import {
  makeBody,
  makeButton,
  makeColumn,
  makeDivider,
  makeHeading,
  makeImage,
  makeSection,
  makeSpacer,
  makeText,
  newId,
} from "./defaults";
import type { EmailDesign } from "./types";

export type Starter = {
  id: string;
  label: string;
  description: string;
  build: () => EmailDesign;
};

const buildSimple = (): EmailDesign => {
  const sec = makeSection("1");
  sec.padding = { top: 32, right: 32, bottom: 32, left: 32 };
  sec.columns[0]!.blocks = [
    (() => {
      const h = makeHeading(1);
      h.content = "Hallo {{name}},";
      return h;
    })(),
    makeText(),
    makeButton(),
  ];
  return { version: 1, body: makeBody(), sections: [sec] };
};

const buildTransactional = (): EmailDesign => {
  const head = makeSection("1");
  head.backgroundColor = "#0f0f10";
  head.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  head.columns[0]!.blocks = [
    (() => {
      const h = makeHeading(2);
      h.content = "Vehicle Imagery";
      h.color = "#ffffff";
      h.align = "center";
      h.fontSize = 18;
      return h;
    })(),
  ];

  const body = makeSection("1");
  body.padding = { top: 32, right: 32, bottom: 32, left: 32 };
  body.columns[0]!.blocks = [
    (() => {
      const h = makeHeading(2);
      h.content = "Bestätigung deiner Aktion";
      return h;
    })(),
    (() => {
      const t = makeText();
      t.content =
        "Hallo {{name}}, vielen Dank! Hier deine Bestätigung. Falls du Fragen hast, antworte einfach auf diese Mail.";
      return t;
    })(),
    makeDivider(),
    (() => {
      const t = makeText();
      t.content =
        '<p style="margin:0 0 6px;"><strong>E-Mail:</strong> {{email}}</p><p style="margin:0;"><strong>Plan:</strong> {{plan}}</p>';
      return t;
    })(),
    makeSpacer(),
    (() => {
      const b = makeButton();
      b.text = "Zum Dashboard";
      b.href = "{{dashboard_url}}";
      b.align = "center";
      return b;
    })(),
  ];

  const footer = makeSection("1");
  footer.padding = { top: 16, right: 24, bottom: 24, left: 24 };
  footer.columns[0]!.blocks = [
    (() => {
      const t = makeText();
      t.fontSize = 11;
      t.color = "#9999a0";
      t.align = "center";
      t.content =
        'Du erhältst diese Mail, weil du dich registriert hast. <a href="{{unsubscribe_url}}" style="color:#9999a0;">Abmelden</a>';
      return t;
    })(),
  ];

  return { version: 1, body: makeBody(), sections: [head, body, footer] };
};

const buildNewsletter = (): EmailDesign => {
  const head = makeSection("1");
  head.backgroundColor = "#0f0f10";
  head.padding = { top: 28, right: 24, bottom: 28, left: 24 };
  head.columns[0]!.blocks = [
    (() => {
      const h = makeHeading(1);
      h.content = "Newsletter";
      h.color = "#ffffff";
      h.align = "center";
      return h;
    })(),
  ];

  const intro = makeSection("1");
  intro.padding = { top: 28, right: 28, bottom: 16, left: 28 };
  intro.columns[0]!.blocks = [
    (() => {
      const t = makeText();
      t.content =
        "Hallo {{name}}, das gibt's diesen Monat: <strong>Updates</strong>, neue Funktionen und ein paar Tipps direkt aus dem Team.";
      return t;
    })(),
  ];

  const cols = makeSection("1-1");
  cols.padding = { top: 8, right: 28, bottom: 24, left: 28 };
  cols.columns = [makeColumn(), makeColumn()];
  cols.columns[0]!.blocks = [
    (() => {
      const i = makeImage();
      i.src = "https://via.placeholder.com/250x140?text=Update+1";
      i.alt = "";
      return i;
    })(),
    (() => {
      const h = makeHeading(3);
      h.content = "Update 1";
      h.padding = { top: 8, right: 0, bottom: 4, left: 0 };
      return h;
    })(),
    (() => {
      const t = makeText();
      t.content = "Kurzer Text zum ersten Thema dieser Ausgabe.";
      return t;
    })(),
  ];
  cols.columns[1]!.blocks = [
    (() => {
      const i = makeImage();
      i.src = "https://via.placeholder.com/250x140?text=Update+2";
      i.alt = "";
      return i;
    })(),
    (() => {
      const h = makeHeading(3);
      h.content = "Update 2";
      h.padding = { top: 8, right: 0, bottom: 4, left: 0 };
      return h;
    })(),
    (() => {
      const t = makeText();
      t.content = "Zweites Thema in der zweiten Spalte.";
      return t;
    })(),
  ];

  const cta = makeSection("1");
  cta.padding = { top: 0, right: 28, bottom: 32, left: 28 };
  cta.columns[0]!.blocks = [
    (() => {
      const b = makeButton();
      b.text = "Alle Artikel lesen";
      b.align = "center";
      return b;
    })(),
  ];

  const foot = makeSection("1");
  foot.padding = { top: 16, right: 24, bottom: 24, left: 24 };
  foot.columns[0]!.blocks = [
    (() => {
      const t = makeText();
      t.fontSize = 11;
      t.color = "#9999a0";
      t.align = "center";
      t.content =
        'Vehicle Imagery · <a href="{{unsubscribe_url}}" style="color:#9999a0;">Abmelden</a>';
      return t;
    })(),
  ];

  return {
    version: 1,
    body: makeBody(),
    sections: [head, intro, cols, cta, foot],
  };
};

const buildBlank = (): EmailDesign => {
  const sec = makeSection("1");
  sec.padding = { top: 24, right: 24, bottom: 24, left: 24 };
  return {
    version: 1,
    body: makeBody(),
    sections: [sec],
  };
};

export const STARTERS: Starter[] = [
  {
    id: "simple",
    label: "Einfache Mail",
    description: "Begrüßung, Text und ein Button.",
    build: buildSimple,
  },
  {
    id: "transactional",
    label: "Transaktional",
    description: "Header, Daten, Button, Footer mit Abmelde-Link.",
    build: buildTransactional,
  },
  {
    id: "newsletter",
    label: "Newsletter (2 Spalten)",
    description: "Dunkler Header + zwei Themen-Spalten + CTA + Footer.",
    build: buildNewsletter,
  },
  {
    id: "blank",
    label: "Leeres Layout",
    description: "Eine leere Section — alles selbst aufbauen.",
    build: buildBlank,
  },
];

// Eindeutige IDs für Starter-Designs (bei Mehrfach-Klick keine ID-Kollisionen)
export function fresh(d: EmailDesign): EmailDesign {
  const next: EmailDesign = JSON.parse(JSON.stringify(d));
  next.sections.forEach((s) => {
    s.id = newId("sec");
    s.columns.forEach((c) => {
      c.id = newId("col");
      c.blocks.forEach((b) => {
        b.id = newId("blk");
      });
    });
  });
  return next;
}
