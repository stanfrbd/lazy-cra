import { MONTHS, HOLIDAYS_URL, parseHolidays, createMonth, summarize, formatDays, validatePeriod } from "./calendar.js";
import { createPdf, loadPdfFonts } from "./pdf.js";

const $ = id => document.getElementById(id);
const KEYS = { identity: "lazy-cra.identity.v1", logo: "lazy-cra.logo.v1" };
const now = new Date();
let year = now.getFullYear();
let month = now.getMonth();
let days = [];
let calendar = null;
let logo = null;
let logoVersion = 0;

function notify(message) {
  $("notice").textContent = message;
  $("notice").hidden = false;
}

function readLocal(key) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? null : JSON.parse(value);
  } catch (error) {
    console.error("Lecture du stockage local impossible.", error);
    notify("Impossible de lire les données locales. Tu peux toujours remplir et exporter ton CRA.");
    return null;
  }
}

function saveLocal(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error("Écriture du stockage local impossible.", error);
    notify("Le navigateur refuse l’enregistrement local (stockage désactivé ou plein). Les modifications restent utilisables pour cette visite, mais leur conservation ou suppression n’est pas garantie.");
    return false;
  }
}

function renderLogo() {
  $("logo-input").value = "";
  $("logo-preview").hidden = !logo;
  if (logo) $("logo-preview").src = logo.dataUrl;
  else $("logo-preview").removeAttribute("src");
  $("logo-placeholder").hidden = Boolean(logo);
  $("remove-logo").hidden = !logo;
  $("logo-picker-label").textContent = logo ? "Changer l’image" : "Choisir une image";
}

function renderSummary() {
  const totals = summarize(days);
  $("summary-period").textContent = `${MONTHS[month]} ${year}`;
  $("worked-total").textContent = formatDays(totals.worked);
  $("expected-total").textContent = formatDays(totals.expected);
  $("difference-total").textContent = formatDays(totals.difference);
  $("summary-message").textContent = totals.difference === 0
    ? "Tout pile ! Un mois bien compté, un café bien mérité."
    : totals.difference > 0
      ? `${formatDays(totals.difference)} jour(s) non facturé(s). Les pauses aussi font partie du mois.`
      : `${formatDays(-totals.difference)} jour(s) au-delà des jours ouvrés. Vérifie tes missions les week-ends et fériés.`;
}

function renderMonth() {
  $("month").value = month;
  $("year").value = year;
  $("year").setCustomValidity("");
  $("previous-month").disabled = year === calendar.years[0] && month === 0;
  $("next-month").disabled = year === calendar.years.at(-1) && month === 11;
  const fragment = document.createDocumentFragment();
  for (const day of days) {
    const row = document.createElement("tr");
    if (day.weekend || day.holiday) row.className = "nonworking";
    const dateCell = document.createElement("td");
    const dateNumber = document.createElement("span");
    dateNumber.className = "date-number";
    dateNumber.textContent = String(day.day).padStart(2, "0");
    const weekday = document.createElement("span");
    weekday.className = "date-weekday";
    weekday.textContent = day.weekday;
    dateCell.append(dateNumber, weekday);
    const labelCell = document.createElement("td");
    const label = document.createElement("span");
    label.className = `day-label ${day.holiday ? "holiday" : day.weekend ? "" : "working"}`;
    label.textContent = day.holiday || (day.weekend ? "Week-end" : "Jour ouvré");
    labelCell.append(label);
    const missionCell = document.createElement("td");
    const select = document.createElement("select");
    select.className = `day-select ${day.mission === 0 ? "off" : ""}`;
    select.dataset.day = day.day;
    select.setAttribute("aria-label", `Jours en mission le ${day.day} ${MONTHS[month]} ${year}${day.holiday ? `, ${day.holiday}` : ""}`);
    for (const [value, text] of [[1, "1 · Mission"], [0.5, "0,5 · Demi-jour"], [0, "0 · Off"]]) {
      select.add(new Option(text, value));
    }
    select.value = day.mission;
    missionCell.append(select);
    row.append(dateCell, labelCell, missionCell);
    fragment.append(row);
  }
  $("days").replaceChildren(fragment);
  renderSummary();
}

function changePeriod(nextYear, nextMonth) {
  let nextDays;
  try {
    validatePeriod(nextYear, nextMonth);
    nextDays = createMonth(nextYear, nextMonth, calendar);
  } catch (error) {
    $("year").setCustomValidity(error.message);
    $("year").reportValidity();
    return;
  }
  if (nextYear === year && nextMonth === month) {
    renderMonth();
    return;
  }
  const defaults = createMonth(year, month, calendar);
  const changed = days.some((day, index) => day.mission !== defaults[index].mission);
  if (changed && !window.confirm("Changer de mois effacera la saisie en cours. Continuer ?")) {
    renderMonth();
    return;
  }
  year = nextYear;
  month = nextMonth;
  days = nextDays;
  renderMonth();
}

async function loadCalendar() {
  const controls = ["month", "year", "previous-month", "next-month", "current-month", "reset-month", "export"];
  controls.forEach(id => { $(id).disabled = true; });
  $("retry-calendar").hidden = true;
  $("calendar-status").textContent = "Chargement des jours fériés officiels…";
  $("days").setAttribute("aria-busy", "true");
  try {
    const response = await fetch(HOLIDAYS_URL, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`L’API officielle répond avec le code ${response.status}.`);
    const data = parseHolidays(await response.json());
    const initialDays = createMonth(year, month, data);
    calendar = data;
    days = initialDays;
    $("year").min = calendar.years[0];
    $("year").max = calendar.years.at(-1);
    controls.forEach(id => { $(id).disabled = false; });
    $("calendar-status").textContent = `Jours fériés officiels chargés · ${calendar.years[0]}–${calendar.years.at(-1)}.`;
    renderMonth();
  } catch (error) {
    console.error("Chargement du calendrier officiel impossible.", error);
    $("calendar-status").textContent = "Calendrier officiel indisponible. Vérifie ta connexion puis réessaie. L’export est bloqué pour éviter un CRA incorrect.";
    $("retry-calendar").hidden = false;
  } finally {
    $("days").setAttribute("aria-busy", "false");
  }
}

function persistIdentity() {
  normalizeLastName();
  saveLocal(KEYS.identity, $("remember").checked
    ? { firstName: $("first-name").value, lastName: $("last-name").value }
    : null);
}

function normalizeLastName() {
  const input = $("last-name");
  const value = input.value;
  const upper = value.toLocaleUpperCase("fr-FR");
  if (value === upper) return;
  const start = value.slice(0, input.selectionStart).toLocaleUpperCase("fr-FR").length;
  const end = value.slice(0, input.selectionEnd).toLocaleUpperCase("fr-FR").length;
  input.value = upper;
  input.setSelectionRange(start, end);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Le navigateur ne parvient pas à décoder cette image."));
    image.src = source;
  });
}

async function setLogo(file) {
  if (!file) return;
  const version = ++logoVersion;
  let url;
  try {
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      throw new Error("Choisis un fichier PNG, JPEG ou WebP.");
    }
    if (file.size > 5 * 1024 * 1024) throw new Error("L’image dépasse 5 Mo. Choisis une image plus légère.");
    url = URL.createObjectURL(file);
    const image = await loadImage(url);
    const scale = Math.min(1, 900 / image.naturalWidth, 360 / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Le traitement des images n’est pas disponible dans ce navigateur.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (version !== logoVersion) return;
    logo = { dataUrl: canvas.toDataURL("image/jpeg", 0.92), width: canvas.width, height: canvas.height };
    saveLocal(KEYS.logo, logo);
    renderLogo();
  } catch (error) {
    console.error("Import du logo impossible.", error);
    notify(`Import du logo impossible. ${error.message}`);
  } finally {
    if (url) URL.revokeObjectURL(url);
    if (version === logoVersion) $("logo-input").value = "";
  }
}

async function restoreLocal() {
  const identity = readLocal(KEYS.identity);
  if (identity !== null) {
    if (typeof identity.firstName === "string" && typeof identity.lastName === "string" &&
        identity.firstName.length <= 70 && identity.lastName.length <= 70) {
      $("first-name").value = identity.firstName;
      $("last-name").value = identity.lastName;
      normalizeLastName();
      $("remember").checked = true;
      persistIdentity();
    } else notify("L’identité enregistrée est invalide. Renseigne-la à nouveau ou efface les données locales.");
  }
  const savedLogo = readLocal(KEYS.logo);
  if (savedLogo !== null) {
    const version = logoVersion;
    try {
      if (typeof savedLogo.dataUrl !== "string" || savedLogo.dataUrl.length > 1500000 ||
          !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(savedLogo.dataUrl) ||
          !Number.isInteger(savedLogo.width) || savedLogo.width < 1 || savedLogo.width > 900 ||
          !Number.isInteger(savedLogo.height) || savedLogo.height < 1 || savedLogo.height > 360) {
        throw new Error("Le format du logo enregistré est invalide.");
      }
      const image = await loadImage(savedLogo.dataUrl);
      if (image.naturalWidth !== savedLogo.width || image.naturalHeight !== savedLogo.height) {
        throw new Error("Les dimensions du logo enregistré sont invalides.");
      }
      if (version !== logoVersion) return;
      logo = savedLogo;
      renderLogo();
    } catch (error) {
      console.error("Restauration du logo impossible.", error);
      notify("Le logo enregistré est illisible. Choisis une nouvelle image ou efface les données locales.");
    }
  }
}

MONTHS.forEach((name, index) => $("month").add(new Option(name[0].toLocaleUpperCase("fr-FR") + name.slice(1), index)));
$("month").addEventListener("change", () => changePeriod(Number($("year").value), Number($("month").value)));
$("year").addEventListener("change", () => changePeriod(Number($("year").value), Number($("month").value)));
$("year").addEventListener("input", () => $("year").setCustomValidity(""));
$("previous-month").addEventListener("click", () => changePeriod(month === 0 ? year - 1 : year, (month + 11) % 12));
$("next-month").addEventListener("click", () => changePeriod(month === 11 ? year + 1 : year, (month + 1) % 12));
$("current-month").addEventListener("click", () => {
  const today = new Date();
  changePeriod(today.getFullYear(), today.getMonth());
});
$("days").addEventListener("change", event => {
  const select = event.target;
  if (!(select instanceof HTMLSelectElement)) return;
  const day = days[Number(select.dataset.day) - 1];
  day.mission = Number(select.value);
  select.className = `day-select ${day.mission === 0 ? "off" : day.mission === 0.5 ? "half" : ""}`;
  renderSummary();
});
$("reset-month").addEventListener("click", () => {
  if (!window.confirm("Remettre tous les jours de ce mois à leur valeur par défaut ?")) return;
  days = createMonth(year, month, calendar);
  renderMonth();
});
for (const id of ["first-name", "last-name"]) {
  $(id).addEventListener("input", event => {
    if (event.isComposing) return;
    if (id === "last-name") normalizeLastName();
    $(id).setCustomValidity("");
    if ($("remember").checked) persistIdentity();
  });
}
$("last-name").addEventListener("compositionend", () => {
  normalizeLastName();
  if ($("remember").checked) persistIdentity();
});
$("remember").addEventListener("change", persistIdentity);
$("logo-input").addEventListener("change", event => setLogo(event.target.files[0]));
$("remove-logo").addEventListener("click", () => {
  logoVersion++;
  logo = null;
  saveLocal(KEYS.logo, null);
  renderLogo();
});
$("clear-data").addEventListener("click", () => {
  if (!window.confirm("Effacer le nom, le prénom et le logo enregistrés par Lazy CRA dans ce navigateur ?")) return;
  logoVersion++;
  const identityRemoved = saveLocal(KEYS.identity, null);
  const logoRemoved = saveLocal(KEYS.logo, null);
  $("first-name").value = "";
  $("last-name").value = "";
  $("remember").checked = false;
  logo = null;
  renderLogo();
  if (identityRemoved && logoRemoved) notify("Nom, prénom et logo effacés de ce navigateur. Les journées en cours restent inchangées.");
});
$("export").addEventListener("click", async () => {
  normalizeLastName();
  if (!$("year").reportValidity()) return;
  for (const id of ["first-name", "last-name"]) {
    $(id).setCustomValidity($(id).value.trim() ? "" : "Renseigne ce champ pour ton CRA.");
    if (!$(id).reportValidity()) return;
  }
  $("export").disabled = true;
  try {
    const fonts = await loadPdfFonts();
    const blob = createPdf({
      firstName: $("first-name").value.trim(), lastName: $("last-name").value.trim(),
      year, month, days, logo, fonts,
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const slug = $("last-name").value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-");
    link.href = url;
    link.download = `CRA_${year}-${String(month + 1).padStart(2, "0")}_${slug || "activite"}.pdf`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    console.error("Génération du PDF impossible.", error);
    notify("Le PDF n’a pas pu être généré ou la police Roboto n’a pas pu être chargée. Vérifie ta connexion puis réessaie ; si le problème persiste, consulte la console du navigateur.");
  } finally {
    $("export").disabled = !calendar;
  }
});

$("retry-calendar").addEventListener("click", loadCalendar);
$("month").value = month;
$("year").value = year;
loadCalendar();
renderLogo();
restoreLocal();
