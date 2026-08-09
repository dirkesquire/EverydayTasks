// Date formatting and "highlight" helpers built on Intl.
const HIGHLIGHT_WINDOW_DAYS = 30;

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(b) - startOfDay(a)) / msPerDay);
}

// Returns 'past' | 'soon' | 'normal' relative to now, using a
// HIGHLIGHT_WINDOW_DAYS look-ahead window for "soon".
function getDateStatus(isoString, referenceDate = new Date()) {
  if (!isoString) return "normal";
  const target = new Date(isoString);
  const diffDays = daysBetween(referenceDate, target);
  if (diffDays < 0) return "past";
  if (diffDays <= HIGHLIGHT_WINDOW_DAYS) return "soon";
  return "normal";
}

function formatDate(isoString) {
  if (!isoString) return "";
  return dateFormatter.format(new Date(isoString));
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  return dateTimeFormatter.format(new Date(isoString));
}

// Formats a relative-time label, e.g. "in 3 days" / "2 days ago",
// picking the largest sensible unit automatically.
function formatRelative(isoString, referenceDate = new Date()) {
  if (!isoString) return "";
  const target = new Date(isoString);
  const diffDays = daysBetween(referenceDate, target);
  const absDays = Math.abs(diffDays);

  if (absDays === 0) return relativeFormatter.format(0, "day");
  if (absDays < 7) return relativeFormatter.format(diffDays, "day");
  if (absDays < 30) return relativeFormatter.format(Math.round(diffDays / 7), "week");
  if (absDays < 365) return relativeFormatter.format(Math.round(diffDays / 30), "month");
  return relativeFormatter.format(Math.round(diffDays / 365), "year");
}

// Formats a PreparationNeeded {value, unit} pair using Intl.RelativeTimeFormat,
// e.g. { value: -14, unit: "day" } -> "14 days before"
function formatPreparation(prep) {
  if (!prep || prep.value == null || !prep.unit) return "";
  const label = relativeFormatter.format(prep.value, prep.unit);
  return prep.value < 0 ? `${label.replace(/^-?/, "")} (start prep early)` : label;
}

// Builds a <span> element with the right highlight class applied for a date.
function renderDateBadge(isoString, { includeRelative = true } = {}) {
  const span = document.createElement("span");
  if (!isoString) {
    span.className = "date-badge date-none";
    span.textContent = "No date";
    return span;
  }
  const status = getDateStatus(isoString);
  span.className = `date-badge date-${status}`;
  const rel = includeRelative ? ` (${formatRelative(isoString)})` : "";
  span.textContent = `${formatDate(isoString)}${rel}`;
  span.title = formatDateTime(isoString);
  return span;
}
