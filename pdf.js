import { MONTHS, formatDays, summarize } from "./calendar.js";

const encoder = new TextEncoder();
const ascii = value => encoder.encode(value);
let fontsPromise;

export function loadPdfFonts() {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const responses = await Promise.all([
        "fonts/roboto-metrics.json", "fonts/Roboto-Regular.ttf", "fonts/Roboto-Bold.ttf",
      ].map(async path => {
        const response = await fetch(new URL(path, import.meta.url), {
          credentials: "omit", signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`Chargement de Roboto impossible (${response.status}).`);
        return response;
      }));
      const [metrics, regular, bold] = await Promise.all([
        responses[0].json(), responses[1].arrayBuffer(), responses[2].arrayBuffer(),
      ]);
      return {
        regular: { ...metrics.regular, bytes: new Uint8Array(regular) },
        bold: { ...metrics.bold, bytes: new Uint8Array(bold) },
      };
    })().catch(error => {
      fontsPromise = undefined;
      throw error;
    });
  }
  return fontsPromise;
}

const joinBytes = arrays => {
  const result = new Uint8Array(arrays.reduce((sum, array) => sum + array.length, 0));
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.length;
  }
  return result;
};

function pdfText(value) {
  const replacements = { "œ": "oe", "Œ": "OE", "’": "'", "‘": "'", "–": "-", "—": "-", "…": "...", "\u202f": " ", "\u00a0": " " };
  const text = String(value).normalize("NFC").replace(/[œŒ’‘–—…\u202f\u00a0]/g, character => replacements[character]);
  // Hex strings keep arbitrary user input out of PDF syntax (WinAnsi font).
  return `<${Array.from(text, character => {
    const code = character.codePointAt(0);
    return (code >= 32 && code <= 255 ? code : 63).toString(16).padStart(2, "0");
  }).join("")}>`;
}

export function createPdf({ firstName, lastName, year, month, days, logo, fonts }) {
  const totals = summarize(days);
  const commands = [];
  const colors = { accent: "0.27 0.27 0.27", ink: "0.18 0.18 0.18", muted: "0.45 0.45 0.45" };
  const text = (value, x, y, size = 10, bold = false, color = colors.ink) => {
    commands.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm ${pdfText(value)} Tj ET`);
  };
  const rect = (x, y, width, height, color) => commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
  const line = (x1, y1, x2, y2) => commands.push(`0.87 0.87 0.87 RG 0.5 w ${x1} ${y1} m ${x2} ${y2} l S`);
  const fitText = (value, x, y, maxWidth, size = 10, bold = false, color = colors.ink) => {
    // Use the embedded font's widest glyph to keep wrapped identities inside their column.
    const words = value.split(/\s+/);
    const font = bold ? fonts.bold : fonts.regular;
    const maxLength = Math.floor(maxWidth / (size * Math.max(...font.widths) / 1000));
    const lines = [""];
    for (const word of words) {
      for (let part = word; part.length;) {
        const remaining = maxLength - lines.at(-1).length - (lines.at(-1) ? 1 : 0);
        if (part.length <= remaining) {
          lines[lines.length - 1] += `${lines.at(-1) ? " " : ""}${part}`;
          break;
        }
        if (lines.at(-1)) {
          lines.push("");
        } else {
          lines[lines.length - 1] = part.slice(0, maxLength);
          part = part.slice(maxLength);
          if (part) lines.push("");
        }
      }
    }
    lines.forEach((value, index) => text(value, x, y - index * (size + 2), size, bold, color));
  };

  rect(0, 828, 595.28, 14, colors.accent);
  text("COMPTE RENDU D'ACTIVITÉ", 42, 789, 18, true, colors.accent);
  text(`${MONTHS[month].toLocaleUpperCase("fr-FR")} ${year}`, 42, 763, 12, true);
  if (logo) {
    const scale = Math.min(125 / logo.width, 55 / logo.height);
    const width = +(logo.width * scale).toFixed(2);
    const height = +(logo.height * scale).toFixed(2);
    commands.push(`q ${width} 0 0 ${height} ${553 - width} ${765 + (55 - height) / 2} cm /Logo Do Q`);
  }
  text("NOM", 42, 733, 8, true, colors.muted);
  text("PRÉNOM", 302, 733, 8, true, colors.muted);
  fitText(lastName.toLocaleUpperCase("fr-FR"), 42, 718, 238, 10, true);
  fitText(firstName, 302, 718, 251, 10, true);

  const top = 650;
  const rowHeight = 16;
  rect(42, top, 511, 24, colors.accent);
  text("DATE", 51, top + 8, 8, true, "1 1 1");
  text("CALENDRIER", 132, top + 8, 8, true, "1 1 1");
  text("MISSION", 382, top + 8, 8, true, "1 1 1");
  text("HORS MISSION", 464, top + 8, 8, true, "1 1 1");
  days.forEach((day, index) => {
    const y = top - (index + 1) * rowHeight;
    if (day.mission > 0) rect(42, y, 511, rowHeight, "0.94 0.94 0.94");
    text(`${String(day.day).padStart(2, "0")}  ${day.weekday}`, 51, y + 5, 8);
    text(day.holiday || (day.weekend ? "Week-end" : "Jour ouvré"), 132, y + 5, 8, false, colors.muted);
    text(formatDays(day.mission), 400, y + 5, 9, true, colors.accent);
    text(formatDays(1 - day.mission), 499, y + 5, 9, false, colors.muted);
    line(42, y, 553, y);
  });
  const bottom = top - days.length * rowHeight;
  const summaryY = bottom - 36;
  rect(42, summaryY - 5, 511, 29, "0.92 0.92 0.92");
  text("TOTAL JOURS FACTURÉS", 53, summaryY + 5, 10, true, colors.accent);
  text(formatDays(totals.worked), 499, summaryY + 5, 13, true, colors.accent);
  text("Jours ouvrés du mois (hors fériés)", 53, summaryY - 22, 9, false, colors.muted);
  text(formatDays(totals.expected), 499, summaryY - 22, 10, true);
  text("Différentiel (jours ouvrés - jours facturés)", 53, summaryY - 42, 9, false, colors.muted);
  text(formatDays(totals.difference), 499, summaryY - 42, 10, true);

  const content = ascii(commands.join("\n"));
  const fontDictionary = (font, descriptor) => ascii(`<< /Type /Font /Subtype /TrueType /BaseFont /${font.name} /Encoding /WinAnsiEncoding /FirstChar 32 /LastChar 255 /Widths [${font.widths.join(" ")}] /FontDescriptor ${descriptor} 0 R >>`);
  const fontDescriptor = (font, file, bold) => ascii(`<< /Type /FontDescriptor /FontName /${font.name} /Flags 32 /FontBBox [${font.bbox.join(" ")}] /ItalicAngle 0 /Ascent ${font.ascent} /Descent ${font.descent} /CapHeight ${font.capHeight} /StemV ${bold ? 120 : 80} /FontFile2 ${file} 0 R >>`);
  const fontStream = font => joinBytes([
    ascii(`<< /Length ${font.bytes.length} /Length1 ${font.bytes.length} >>\nstream\n`),
    font.bytes, ascii("\nendstream"),
  ]);
  const objects = [
    ascii("<< /Type /Catalog /Pages 2 0 R >>"),
    ascii("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> ${logo ? "/XObject << /Logo 11 0 R >>" : ""} >> /Contents 6 0 R >>`),
    fontDictionary(fonts.regular, 7),
    fontDictionary(fonts.bold, 9),
    joinBytes([ascii(`<< /Length ${content.length} >>\nstream\n`), content, ascii("\nendstream")]),
    fontDescriptor(fonts.regular, 8, false),
    fontStream(fonts.regular),
    fontDescriptor(fonts.bold, 10, true),
    fontStream(fonts.bold),
  ];
  if (logo) {
    const imageBytes = Uint8Array.from(atob(logo.dataUrl.split(",")[1]), character => character.charCodeAt(0));
    objects.push(joinBytes([
      ascii(`<< /Type /XObject /Subtype /Image /Width ${logo.width} /Height ${logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`),
      imageBytes, ascii("\nendstream"),
    ]));
  }
  const chunks = [ascii("%PDF-1.4\n")];
  const offsets = [0];
  let position = chunks[0].length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const chunk = joinBytes([ascii(`${index + 1} 0 obj\n`), object, ascii("\nendobj\n")]);
    chunks.push(chunk);
    position += chunk.length;
  });
  chunks.push(ascii(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${position}\n%%EOF\n`));
  return new Blob(chunks, { type: "application/pdf" });
}
