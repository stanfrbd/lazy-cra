import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMonth, parseHolidays } from "../calendar.js";
import { createPdf } from "../pdf.js";

const calendar = parseHolidays(JSON.parse(readFileSync(new URL("./fixtures/metropole-2026.json", import.meta.url), "utf8")));
const metrics = JSON.parse(readFileSync(new URL("../fonts/roboto-metrics.json", import.meta.url), "utf8"));
const fonts = Object.fromEntries(["regular", "bold"].map(style => [
  style, {
    ...metrics[style],
    bytes: readFileSync(new URL(`../fonts/Roboto-${style === "bold" ? "Bold" : "Regular"}.ttf`, import.meta.url)),
  },
]));

function assertPdfStructure(bytes) {
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4\n"));
  const xref = Number(/startxref\n(\d+)/.exec(text)[1]);
  assert.equal(text.slice(xref, xref + 4), "xref");
  const entries = [...text.matchAll(/(\d{10}) 00000 n /g)];
  entries.forEach((entry, index) => {
    assert.ok(text.slice(Number(entry[1])).startsWith(`${index + 1} 0 obj\n`));
  });
  for (const match of text.matchAll(/\/Length (\d+)(?: \/Length1 \d+)? >>\nstream\n/g)) {
    const end = match.index + match[0].length + Number(match[1]);
    assert.equal(text.slice(end, end + 10), "\nendstream");
  }
  assert.equal((text.match(/\/Type \/Page\b/g) || []).length, 1);
  assert.ok(text.endsWith("%%EOF\n"));
  return text;
}

test("generates one A4 page with accurate byte offsets, accents and billed totals", async () => {
  const days = createMonth(2026, 9, calendar);
  days[0].mission = 0.5;
  const blob = createPdf({ firstName: "Élodie", lastName: "D’Œuvre (test) \\ /Page", year: 2026, month: 9, days, logo: null, fonts });
  assert.equal(blob.type, "application/pdf");
  const text = assertPdfStructure(new Uint8Array(await blob.arrayBuffer()));
  assert.match(text, /\/MediaBox \[0 0 595.28 841.89\]/);
  assert.ok(text.includes("<c96c6f646965>"));
  assert.ok(text.includes("<32312c35>")); // 21,5 billed days
  assert.ok(!text.includes("D’Œuvre"));
  assert.ok(text.includes("<44274f455556524520285445535429205c202f50414745>"));
  assert.match(text, /42 718 Tm <44274f455556524520285445535429205c202f50414745>/);
  assert.match(text, /302 718 Tm <c96c6f646965>/);
  assert.match(text, /\/BaseFont \/Roboto-Regular/);
  assert.match(text, /\/BaseFont \/Roboto-Bold/);
  for (const style of ["regular", "bold"]) {
    assert.ok(Buffer.from(await blob.arrayBuffer()).includes(fonts[style].bytes));
  }
});

test("embeds logo binary without corrupting PDF stream lengths or xref", async () => {
  const binary = Uint8Array.from([0xff, 0xd8, 0x00, 0x80, 0xff, 0xd9]);
  const logo = { dataUrl: `data:image/jpeg;base64,${Buffer.from(binary).toString("base64")}`, width: 120, height: 40 };
  const blob = createPdf({ firstName: "Camille", lastName: "Exemple", year: 2026, month: 10, days: createMonth(2026, 10, calendar), logo, fonts });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = assertPdfStructure(bytes);
  assert.match(text, /\/Subtype \/Image \/Width 120 \/Height 40/);
  assert.match(text, /\/XObject << \/Logo 11 0 R >>/);
  assert.ok(Buffer.from(bytes).includes(Buffer.from(binary)));
});

test("highlights actual missions, including half-days and exceptional weekend or holiday work", async () => {
  const days = createMonth(2026, 4, calendar);
  days[0].mission = 0.5; // Worked holiday.
  days[1].mission = 1; // Worked Saturday.
  days[3].mission = 0; // Unworked Monday.
  const blob = createPdf({ firstName: "Camille", lastName: "Exemple", year: 2026, month: 4, days, logo: null, fonts });
  const pdf = assertPdfStructure(new Uint8Array(await blob.arrayBuffer()));
  const highlightedDays = [...pdf.matchAll(/[\d.]+ [\d.]+ [\d.]+ rg 42 (\d+) 511 16 re f/g)]
    .map(match => (650 - Number(match[1])) / 16);
  assert.deepEqual(highlightedDays, days.filter(day => day.mission > 0).map(day => day.day));
});
