export const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];
export const HOLIDAYS_URL = "https://calendrier.api.gouv.fr/jours-feries/metropole.json";
const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

export function validatePeriod(year, month) {
  if (!Number.isInteger(year) || year < 1900 || year > 2199 ||
      !Number.isInteger(month) || month < 0 || month > 11) {
    throw new RangeError("Choisis un mois valide et une année entière entre 1900 et 2199.");
  }
}

export function parseHolidays(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Le calendrier officiel a un format inattendu.");
  }
  const holidays = new Map();
  const years = new Set();
  for (const [key, label] of Object.entries(data)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || typeof label !== "string" || !label.trim()) {
      throw new Error("Le calendrier officiel contient une entrée invalide.");
    }
    const [year, month, day] = key.split("-").map(Number);
    validatePeriod(year, month - 1);
    if (new Date(year, month - 1, day, 12).getDate() !== day) {
      throw new Error("Le calendrier officiel contient une date invalide.");
    }
    holidays.set(key, label);
    years.add(year);
  }
  if (!years.size) throw new Error("Le calendrier officiel est vide.");
  for (const year of years) {
    const dates = [...holidays.keys()].filter(key => key.startsWith(`${year}-`));
    if (dates.length < 10 || !holidays.has(`${year}-01-01`) || !holidays.has(`${year}-12-25`)) {
      throw new Error(`Le calendrier officiel semble incomplet pour ${year}.`);
    }
  }
  return { holidays, years: [...years].sort((a, b) => a - b) };
}

export function createMonth(year, month, calendar) {
  validatePeriod(year, month);
  if (!calendar || !calendar.years.includes(year)) {
    throw new RangeError("Cette année n’est pas disponible dans les données officielles.");
  }
  const count = new Date(year, month + 1, 0, 12).getDate();
  return Array.from({ length: count }, (_, index) => {
    const day = index + 1;
    const weekday = new Date(year, month, day, 12).getDay();
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const holiday = calendar.holidays.get(key) || "";
    const weekend = weekday === 0 || weekday === 6;
    return { day, weekday: WEEKDAYS[weekday], holiday, weekend, mission: weekend || holiday ? 0 : 1 };
  });
}

export function summarize(days) {
  const expected = days.filter(day => !day.weekend && !day.holiday).length;
  const worked = days.reduce((sum, day) => {
    if (![0, 0.5, 1].includes(day.mission)) {
      throw new RangeError("Une journée doit valoir 0, 0,5 ou 1 jour en mission.");
    }
    return sum + day.mission;
  }, 0);
  return { expected, worked, difference: expected - worked };
}

export function formatDays(value) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
}
