import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createMonth, parseHolidays, summarize } from "../calendar.js";

// Source: https://calendrier.api.gouv.fr/jours-feries/metropole/2026.json
const fixture = JSON.parse(readFileSync(new URL("./fixtures/metropole-2026.json", import.meta.url), "utf8"));
const calendar = parseHolidays(fixture);

test("prefills October 2026 with exactly 22 billed weekdays", () => {
  const days = createMonth(2026, 9, calendar);
  assert.equal(days.length, 31);
  assert.deepEqual(summarize(days), { expected: 22, worked: 22, difference: 0 });
  assert.equal(days[0].weekday, "jeu.");
  assert.equal(days[2].mission, 0);
});

test("uses official movable holidays, not just fixed dates", () => {
  const may = createMonth(2026, 4, calendar);
  assert.deepEqual(summarize(may), { expected: 17, worked: 17, difference: 0 });
  for (const day of [1, 8, 14, 25]) {
    assert.ok(may[day - 1].holiday);
    assert.equal(may[day - 1].mission, 0);
  }
  assert.equal(createMonth(2026, 3, calendar)[5].holiday, "Lundi de Pâques");
});

test("does not subtract weekend holidays twice", () => {
  const november = createMonth(2026, 10, calendar);
  assert.equal(november[0].holiday, "Toussaint");
  assert.equal(november[0].weekend, true);
  assert.deepEqual(summarize(november), { expected: 20, worked: 20, difference: 0 });
});

test("off days and half-days reduce billing; exceptional work counts", () => {
  const days = createMonth(2026, 9, calendar);
  days[0].mission = 0;
  days[1].mission = 0.5;
  assert.deepEqual(summarize(days), { expected: 22, worked: 20.5, difference: 1.5 });
  days[2].mission = 1;
  assert.deepEqual(summarize(days), { expected: 22, worked: 21.5, difference: 0.5 });
  const may = createMonth(2026, 4, calendar);
  may[0].mission = 1;
  assert.deepEqual(summarize(may), { expected: 17, worked: 18, difference: -1 });
});

test("supports leap years without timezone-dependent date shifts", () => {
  const leapData = Object.fromEntries(Object.entries(fixture).map(([key, value]) => [key.replace("2026", "2024"), value]));
  const days = createMonth(2024, 1, parseHolidays(leapData));
  assert.equal(days.length, 29);
  assert.equal(days[28].weekday, "jeu.");
});

test("rejects unavailable periods, incomplete feeds and invalid mission values", () => {
  assert.throws(() => createMonth(2025, 0, calendar), /disponible/);
  assert.throws(() => createMonth(2026.5, 0, calendar), RangeError);
  assert.throws(() => createMonth(2026, 12, calendar), RangeError);
  for (const data of [null, [], {}, { "2026-01-01": "1er janvier" }, { ...fixture, "2026-02-30": "Invalid" }, { ...fixture, "2026-07-14": "" }]) {
    assert.throws(() => parseHolidays(data));
  }
  const days = createMonth(2026, 9, calendar);
  days[0].mission = 0.25;
  assert.throws(() => summarize(days), RangeError);
});
