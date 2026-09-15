const listView = document.getElementById("listView");
const detailView = document.getElementById("detailView");
const formView = document.getElementById("formView");
const settingsView = document.getElementById("settingsView");
const progressView = document.getElementById("progressView");
const bottomNav = document.getElementById("bottomNav");
const navListBtn = document.getElementById("navListBtn");
const navProgressBtn = document.getElementById("navProgressBtn");
const swimList = document.getElementById("swimList");
const emptyState = document.getElementById("emptyState");
const emptyTitle = document.getElementById("emptyTitle");
const emptyAddBtn = document.getElementById("emptyAddBtn");
const listToolbar = document.getElementById("listToolbar");
const sortSelect = document.getElementById("sortSelect");
const typeFilterSelect = document.getElementById("typeFilterSelect");

const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const next = isDark ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("glideTheme", next);
});

const PENDING_BACKUP_KEY = "glidePendingBackup";
const backupBadge = document.getElementById("backupBadge");
const settingsHint = document.getElementById("settingsHint");
const DEFAULT_SETTINGS_HINT = settingsHint.textContent;

function isBackupPending() {
  return localStorage.getItem(PENDING_BACKUP_KEY) === "true";
}

function updateBackupBadge() {
  backupBadge.classList.toggle("hidden", !isBackupPending());
}

function updateSettingsHint() {
  settingsHint.textContent = isBackupPending()
    ? `${DEFAULT_SETTINGS_HINT} You have changes since your last backup.`
    : DEFAULT_SETTINGS_HINT;
}

function clearBackupPending() {
  localStorage.removeItem(PENDING_BACKUP_KEY);
  updateBackupBadge();
  updateSettingsHint();
}

window.addEventListener("swimdata-dirty", () => {
  showToast("New swim added — remember to back up");
  updateBackupBadge();
});

updateBackupBadge();

document.getElementById("settingsToggle").addEventListener("click", () => {
  updateSettingsHint();
  showView(settingsView);
});

document.getElementById("settingsBackBtn").addEventListener("click", () => {
  showView(lastMainView);
});

const TYPES = [
  { value: "training", label: "Training" },
  { value: "club", label: "Club training" },
  { value: "race", label: "Race" },
];

function typeLabel(value) {
  return TYPES.find((t) => t.value === value)?.label || "Training";
}

const typeSelect = document.getElementById("typeInput");
typeSelect.innerHTML =
  `<option value="" disabled selected hidden>Select type</option>` +
  TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");

typeFilterSelect.innerHTML =
  `<option value="all">All types</option>` +
  TYPES.map((t) => `<option value="${t.value}">${t.label}</option>`).join("");

let sortMode = localStorage.getItem("glideSortMode") || "date";
sortSelect.value = sortMode;
sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  localStorage.setItem("glideSortMode", sortMode);
  refreshList();
});

let typeFilter = localStorage.getItem("glideTypeFilter") || "all";
typeFilterSelect.value = typeFilter;
typeFilterSelect.addEventListener("change", () => {
  typeFilter = typeFilterSelect.value;
  localStorage.setItem("glideTypeFilter", typeFilter);
  refreshList();
});

let swims = [];
let currentId = null;
let lastMainView = listView;

function showView(view) {
  for (const v of [listView, detailView, formView, settingsView, progressView]) v.classList.add("hidden");
  view.classList.remove("hidden");

  const isMainView = view === listView || view === progressView;
  bottomNav.classList.toggle("hidden", !isMainView);
  if (isMainView) {
    lastMainView = view;
    navListBtn.classList.toggle("active", view === listView);
    navProgressBtn.classList.toggle("active", view === progressView);
  }
}

navListBtn.addEventListener("click", () => {
  showView(listView);
});

navProgressBtn.addEventListener("click", () => {
  showView(progressView);
  renderProgressChart();
});

function pad(n) {
  return String(n).padStart(2, "0");
}

function secondsFromHMS(h, m, s) {
  return (Number(h) || 0) * 3600 + (Number(m) || 0) * 60 + (Number(s) || 0);
}

function formatSeconds(total) {
  total = Math.max(0, Math.round(total || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatPace(secondsPerUnit) {
  if (!isFinite(secondsPerUnit) || secondsPerUnit <= 0) return "";
  const m = Math.floor(secondsPerUnit / 60);
  const s = Math.round(secondsPerUnit % 60);
  return `${m}:${pad(s)}`;
}

function pace100(seconds, distance) {
  if (!distance || !seconds) return "";
  return formatPace(seconds / (distance / 100));
}

function pace100Label(seconds, distance) {
  const p = pace100(seconds, distance);
  return p ? `${p} /100m` : "";
}

function paceSortValue(swim) {
  if (!swim.distance || !swim.movementTime) return Infinity;
  return swim.movementTime / (swim.distance / 100);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function venueLabel(swim) {
  const name = swim.poolName || "";
  if ((swim.venue || "pool") === "openwater") {
    return name ? `Open water · ${name}` : "Open water";
  }
  const len = swim.poolLength ? `${swim.poolLength}m` : "";
  if (len && name) return `${len} · ${name}`;
  return len || name;
}

function formatDistanceShort(m) {
  if (!m) return "–";
  if (m >= 1000) return `${(m / 1000).toFixed(m % 1000 === 0 ? 0 : 1)}K`;
  return `${m}`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function renderSwimCard(swim) {
  const li = document.createElement("li");
  li.className = "race-card";
  li.dataset.id = swim.id;

  const pool = venueLabel(swim);
  const pace = pace100(swim.movementTime, swim.distance);

  li.innerHTML = `
    <div class="placeholder placeholder-${swim.type || "training"}">${formatDistanceShort(swim.distance)}</div>
    <div class="info">
      <div class="name">${swim.distance || 0} m</div>
      <div class="meta">
        <span class="type-badge type-${swim.type || "training"}">${typeLabel(swim.type)}</span>
        <span class="meta-date">${formatDate(swim.date)}</span>
        ${pool ? `<span class="result-badge">${escapeHtml(pool)}</span>` : ""}
      </div>
    </div>
    <div class="total">
      <span class="total-value">${pace || "–"}</span>
      ${pace ? `<span class="total-unit">/100m</span>` : ""}
    </div>
  `;
  li.addEventListener("click", () => openDetail(swim.id));
  return li;
}

function refreshPoolNamesDatalist(allSwims) {
  const names = Array.from(new Set(allSwims.map((s) => s.poolName).filter(Boolean))).sort();
  document.getElementById("poolNames").innerHTML = names
    .map((n) => `<option value="${escapeHtml(n)}"></option>`)
    .join("");
}

async function refreshList() {
  const allSwims = await SwimStore.getAll();
  refreshPoolNamesDatalist(allSwims);

  const filtered = typeFilter === "all" ? allSwims : allSwims.filter((s) => (s.type || "training") === typeFilter);

  if (sortMode === "pace") {
    filtered.sort((a, b) => paceSortValue(a) - paceSortValue(b));
  } else {
    filtered.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }
  swims = filtered;

  swimList.innerHTML = "";
  listToolbar.classList.toggle("hidden", allSwims.length === 0);
  emptyState.classList.toggle("hidden", filtered.length > 0);
  if (filtered.length === 0) {
    const noneAtAll = allSwims.length === 0;
    emptyTitle.textContent = noneAtAll ? "No swims yet" : "No swims match this filter";
    emptyAddBtn.classList.toggle("hidden", !noneAtAll);
  }

  for (const swim of filtered) {
    swimList.appendChild(renderSwimCard(swim));
  }
}

const rangeSelect = document.getElementById("rangeSelect");
const chartContainer = document.getElementById("chartContainer");
const chartEmptyState = document.getElementById("chartEmptyState");
const chartLegend = document.getElementById("chartLegend");

let chartRange = localStorage.getItem("glideChartRange") || "4w";
rangeSelect.value = chartRange;
rangeSelect.addEventListener("change", () => {
  chartRange = rangeSelect.value;
  localStorage.setItem("glideChartRange", chartRange);
  renderProgressChart();
});

function chartRangeStart(range, pointDates) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (range === "all") {
    if (pointDates.length === 0) return today;
    return new Date(Math.min(...pointDates.map((d) => d.getTime())));
  }
  const start = new Date(today);
  if (range === "6m") start.setMonth(start.getMonth() - 6);
  else if (range === "1y") start.setFullYear(start.getFullYear() - 1);
  else start.setDate(start.getDate() - 28);
  return start;
}

function linearRegression(xs, ys) {
  const n = xs.length;
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumXX = xs.reduce((a, x) => a + x * x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

async function renderProgressChart() {
  const allSwims = await SwimStore.getAll();
  const withPace = allSwims
    .filter((s) => s.distance > 0 && s.movementTime > 0 && s.date)
    .map((s) => ({
      swim: s,
      date: new Date(s.date + "T00:00:00"),
      paceSec: s.movementTime / (s.distance / 100),
    }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeStart = chartRangeStart(chartRange, withPace.map((p) => p.date));
  const points = withPace.filter((p) => p.date >= rangeStart).sort((a, b) => a.date - b.date);

  const hasPoints = points.length > 0;
  chartEmptyState.classList.toggle("hidden", hasPoints);
  chartContainer.classList.toggle("hidden", !hasPoints);
  chartLegend.classList.toggle("hidden", !hasPoints);
  if (!hasPoints) {
    chartContainer.innerHTML = "";
    chartLegend.innerHTML = "";
    return;
  }

  const xMin = rangeStart.getTime();
  const xMax = Math.max(today.getTime(), xMin + 86400000);

  const paceValues = points.map((p) => p.paceSec);
  let yMin = Math.min(...paceValues);
  let yMax = Math.max(...paceValues);
  if (yMin === yMax) {
    yMin -= 5;
    yMax += 5;
  } else {
    const yPad = (yMax - yMin) * 0.15;
    yMin -= yPad;
    yMax += yPad;
  }
  yMin = Math.max(0, yMin);

  const W = 320;
  const H = 190;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 12;
  const padBottom = 26;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const xPix = (time) => padLeft + ((time - xMin) / (xMax - xMin)) * plotW;
  const yPix = (pace) => padTop + ((pace - yMin) / (yMax - yMin)) * plotH;

  let trendLineSvg = "";
  const reg = points.length >= 2
    ? linearRegression(points.map((p) => (p.date.getTime() - xMin) / 86400000), paceValues)
    : null;
  if (reg) {
    const xEndDays = (xMax - xMin) / 86400000;
    const y1 = reg.intercept;
    const y2 = reg.intercept + reg.slope * xEndDays;
    trendLineSvg = `<line class="chart-trend-line" x1="${xPix(xMin).toFixed(1)}" y1="${yPix(y1).toFixed(1)}" x2="${xPix(xMax).toFixed(1)}" y2="${yPix(y2).toFixed(1)}" />`;
  }

  const dotsSvg = points.map((p) => {
    const cx = xPix(p.date.getTime()).toFixed(1);
    const cy = yPix(p.paceSec).toFixed(1);
    const title = `${formatDate(p.swim.date)} — ${formatPace(p.paceSec)} /100m`;
    return `<circle class="chart-dot" cx="${cx}" cy="${cy}" r="5" style="fill:var(--type-${p.swim.type || "training"})"><title>${escapeHtml(title)}</title></circle>`;
  }).join("");

  const yTickCount = 4;
  const yTicksSvg = [];
  for (let i = 0; i <= yTickCount; i++) {
    const val = yMin + (yMax - yMin) * (i / yTickCount);
    const y = yPix(val).toFixed(1);
    yTicksSvg.push(`<text class="chart-tick-label" x="${padLeft - 6}" y="${y}" text-anchor="end" dominant-baseline="middle">${formatPace(val)}</text>`);
  }

  const xTickCount = 3;
  const xTicksSvg = [];
  for (let i = 0; i <= xTickCount; i++) {
    const t = xMin + (xMax - xMin) * (i / xTickCount);
    const x = xPix(t).toFixed(1);
    const label = new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    xTicksSvg.push(`<text class="chart-tick-label" x="${x}" y="${H - padBottom + 15}" text-anchor="middle">${label}</text>`);
  }

  chartContainer.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}">
      <line class="chart-axis" x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${H - padBottom}" />
      <line class="chart-axis" x1="${padLeft}" y1="${H - padBottom}" x2="${W - padRight}" y2="${H - padBottom}" />
      ${yTicksSvg.join("")}
      ${xTicksSvg.join("")}
      ${trendLineSvg}
      ${dotsSvg}
    </svg>
  `;

  chartLegend.innerHTML = TYPES.map(
    (t) => `<span class="chart-legend-item"><span class="chart-legend-dot" style="background:var(--type-${t.value})"></span>${t.label}</span>`
  ).join("");
}

const PENCIL_ICON = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const TRASH_ICON = `<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z"/></svg>`;

function openDetail(id) {
  const swim = swims.find((s) => s.id === id);
  if (!swim) return;
  currentId = id;

  const content = document.getElementById("detailContent");
  const pool = venueLabel(swim);

  content.innerHTML = `
    <div class="detail-name-row">
      <h3>${swim.distance || 0} m swim</h3>
      <div class="detail-actions">
        <button id="editBtn" class="icon-btn-plain" aria-label="Edit">${PENCIL_ICON}</button>
        <button id="deleteBtn" class="icon-btn-plain danger" aria-label="Delete">${TRASH_ICON}</button>
      </div>
    </div>
    <div class="badges">
      <span class="type-badge type-${swim.type || "training"}">${typeLabel(swim.type)}</span>
      <span class="date">${formatDate(swim.date)}</span>
      ${pool ? `<span class="date">${escapeHtml(pool)}</span>` : ""}
    </div>
    <table class="detail-table">
      <tr><td>Distance</td><td>${swim.distance || 0} m</td></tr>
      <tr><td>Total time</td><td>${formatSeconds(swim.totalTime)}${pace100Label(swim.totalTime, swim.distance) ? `<span class="pace">${pace100Label(swim.totalTime, swim.distance)}</span>` : ""}</td></tr>
      <tr><td>Movement time</td><td>${formatSeconds(swim.movementTime)}${pace100Label(swim.movementTime, swim.distance) ? `<span class="pace">${pace100Label(swim.movementTime, swim.distance)}</span>` : ""}</td></tr>
    </table>
    ${swim.splits && swim.splits.length ? `
    <h4 class="splits-heading">Splits</h4>
    <table class="detail-table">
      ${swim.splits.map((s, i) => `<tr><td>Split ${i + 1} (${s.distance} m)</td><td>${formatSeconds(s.time)}${pace100Label(s.time, s.distance) ? `<span class="pace">${pace100Label(s.time, s.distance)}</span>` : ""}</td></tr>`).join("")}
    </table>
    ` : ""}
  `;

  document.getElementById("editBtn").addEventListener("click", () => openForm(swim));
  document.getElementById("deleteBtn").addEventListener("click", deleteCurrentSwim);

  showView(detailView);
}

async function deleteCurrentSwim() {
  if (!currentId) return;
  if (!confirm("Delete this swim?")) return;
  await SwimStore.remove(currentId);
  currentId = null;
  await refreshList();
  showView(lastMainView);
}

function hmsInputs(target) {
  const wrap = document.querySelector(`.time-input[data-target="${target}"]`);
  return {
    h: wrap.querySelector(".h"),
    m: wrap.querySelector(".m"),
    s: wrap.querySelector(".s"),
  };
}

function setHMS(target, seconds) {
  const { h, m, s } = hmsInputs(target);
  seconds = Math.max(0, Math.round(seconds || 0));
  h.value = Math.floor(seconds / 3600) || "";
  m.value = Math.floor((seconds % 3600) / 60) || "";
  s.value = seconds % 60 || "";
}

function getHMS(target) {
  const { h, m, s } = hmsInputs(target);
  return secondsFromHMS(h.value, m.value, s.value);
}

function setInvalidTime(target, isInvalid) {
  const { h, m, s } = hmsInputs(target);
  [h, m, s].forEach((el) => el.classList.toggle("invalid", isInvalid));
}

const distanceInput = document.getElementById("distanceInput");
const dateInput = document.getElementById("dateInput");
const venueSelect = document.getElementById("venueInput");
const poolLengthWrap = document.getElementById("poolLengthWrap");
const poolLengthSelect = document.getElementById("poolLengthSelect");
const poolLengthCustomWrap = document.getElementById("poolLengthCustomWrap");
const poolLengthCustomInput = document.getElementById("poolLengthCustomInput");
const poolNameLabel = document.getElementById("poolNameLabel");
const poolNameInput = document.getElementById("poolNameInput");

function updatePoolFieldsVisibility() {
  const isPool = venueSelect.value !== "openwater";
  poolLengthWrap.classList.toggle("hidden", !isPool);
  poolLengthCustomWrap.classList.toggle("hidden", !isPool || poolLengthSelect.value !== "custom");
  poolNameLabel.textContent = isPool ? "Pool name" : "Location";
  poolNameInput.placeholder = isPool ? "e.g. Sportfondsenbad" : "e.g. Loosdrecht lake";
}

venueSelect.addEventListener("change", updatePoolFieldsVisibility);
poolLengthSelect.addEventListener("change", updatePoolFieldsVisibility);

function getPoolLength() {
  if (poolLengthSelect.value === "custom") return Number(poolLengthCustomInput.value) || 0;
  return Number(poolLengthSelect.value) || 0;
}

const splitsList = document.getElementById("splitsList");

function addSplitRow(distance, seconds) {
  const row = document.createElement("div");
  row.className = "split-row";
  row.innerHTML = `
    <input type="number" class="split-distance" placeholder="m" min="0" step="any" inputmode="decimal">
    <div class="hms split-hms">
      <input type="number" min="0" max="59" placeholder="hh" class="h">
      <input type="number" min="0" max="59" placeholder="mm" class="m">
      <input type="number" min="0" max="59" placeholder="ss" class="s">
    </div>
    <span class="split-pace"></span>
    <button type="button" class="split-remove" aria-label="Remove split">×</button>
  `;

  const distInput = row.querySelector(".split-distance");
  const hInput = row.querySelector(".h");
  const mInput = row.querySelector(".m");
  const sInput = row.querySelector(".s");
  const paceEl = row.querySelector(".split-pace");

  if (distance) distInput.value = distance;
  if (seconds) {
    hInput.value = Math.floor(seconds / 3600) || "";
    mInput.value = Math.floor((seconds % 3600) / 60) || "";
    sInput.value = seconds % 60 || "";
  }

  function updateRowPace() {
    const d = Number(distInput.value) || 0;
    const t = secondsFromHMS(hInput.value, mInput.value, sInput.value);
    paceEl.textContent = pace100Label(t, d);
  }
  [distInput, hInput, mInput, sInput].forEach((el) => el.addEventListener("input", updateRowPace));
  row.querySelector(".split-remove").addEventListener("click", () => row.remove());

  updateRowPace();
  splitsList.appendChild(row);
}

function getSplitsFromForm() {
  return Array.from(splitsList.querySelectorAll(".split-row"))
    .map((row) => ({
      distance: Number(row.querySelector(".split-distance").value) || 0,
      time: secondsFromHMS(row.querySelector(".h").value, row.querySelector(".m").value, row.querySelector(".s").value),
    }))
    .filter((s) => s.distance > 0 && s.time > 0);
}

document.getElementById("addSplitBtn").addEventListener("click", () => addSplitRow());

function updateComputedDisplays() {
  const distance = Number(distanceInput.value) || 0;
  document.getElementById("totalPaceDisplay").textContent = pace100Label(getHMS("totalTime"), distance);
  document.getElementById("movementPaceDisplay").textContent = pace100Label(getHMS("movementTime"), distance);
}

function resetForm() {
  document.getElementById("swimForm").reset();
  typeSelect.value = "";
  venueSelect.value = "pool";
  poolLengthSelect.value = "25";
  updatePoolFieldsVisibility();
  splitsList.innerHTML = "";
  for (const t of ["totalTime", "movementTime"]) {
    setHMS(t, 0);
    setInvalidTime(t, false);
  }
  updateComputedDisplays();
  typeSelect.classList.remove("invalid");
  distanceInput.classList.remove("invalid");
}

function openForm(swim) {
  resetForm();
  document.getElementById("formTitle").textContent = swim ? "Edit Swim" : "New Swim";

  typeSelect.value = (swim && swim.type) || "";
  dateInput.value = (swim && swim.date) || todayStr();
  venueSelect.value = (swim && swim.venue) || "pool";

  if (swim) {
    distanceInput.value = swim.distance || "";
    if (swim.poolLength === 25 || swim.poolLength === 50) {
      poolLengthSelect.value = String(swim.poolLength);
    } else if (swim.poolLength) {
      poolLengthSelect.value = "custom";
      poolLengthCustomInput.value = swim.poolLength;
    }
    updatePoolFieldsVisibility();
    poolNameInput.value = swim.poolName || "";
    setHMS("totalTime", swim.totalTime);
    setHMS("movementTime", swim.movementTime);
    updateComputedDisplays();
    (swim.splits || []).forEach((s) => addSplitRow(s.distance, s.time));
  }

  showView(formView);
}

document.getElementById("addBtn").addEventListener("click", () => {
  currentId = null;
  openForm(null);
});

document.getElementById("emptyAddBtn").addEventListener("click", () => {
  currentId = null;
  openForm(null);
});

document.getElementById("backBtn").addEventListener("click", () => {
  showView(lastMainView);
});

document.getElementById("cancelBtn").addEventListener("click", () => {
  showView(currentId ? detailView : lastMainView);
});

for (const target of ["totalTime", "movementTime"]) {
  const { h, m, s } = hmsInputs(target);
  [h, m, s].forEach((input) => {
    input.addEventListener("input", () => {
      setInvalidTime(target, false);
      updateComputedDisplays();
    });
  });
}

distanceInput.addEventListener("input", () => {
  distanceInput.classList.remove("invalid");
  updateComputedDisplays();
});

typeSelect.addEventListener("change", () => typeSelect.classList.remove("invalid"));

const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(message) {
  clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("show");
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
}

document.getElementById("swimForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const distance = Number(distanceInput.value) || 0;
  const totalTime = getHMS("totalTime");
  const movementTime = getHMS("movementTime");

  const errors = [];

  if (!typeSelect.value) {
    typeSelect.classList.add("invalid");
    errors.push("Type");
  } else {
    typeSelect.classList.remove("invalid");
  }

  if (!(distance > 0)) {
    distanceInput.classList.add("invalid");
    errors.push("Distance");
  } else {
    distanceInput.classList.remove("invalid");
  }

  if (!(totalTime > 0)) {
    setInvalidTime("totalTime", true);
    errors.push("Total time");
  } else {
    setInvalidTime("totalTime", false);
  }

  if (!(movementTime > 0)) {
    setInvalidTime("movementTime", true);
    errors.push("Movement time");
  } else if (movementTime > totalTime) {
    setInvalidTime("movementTime", true);
    errors.push("Movement time (can't be more than total time)");
  } else {
    setInvalidTime("movementTime", false);
  }

  if (errors.length > 0) {
    showToast(`Please check: ${errors.join(", ")}`);
    return;
  }

  const isPool = venueSelect.value !== "openwater";

  const swim = {
    id: currentId || `${Date.now()}-${Math.floor(performance.now())}`,
    type: typeSelect.value,
    date: dateInput.value || todayStr(),
    distance,
    totalTime,
    movementTime,
    venue: venueSelect.value,
    poolLength: isPool ? getPoolLength() : null,
    poolName: poolNameInput.value.trim() || null,
    splits: getSplitsFromForm(),
  };

  await SwimStore.put(swim);
  currentId = swim.id;
  await refreshList();
  openDetail(swim.id);
});

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportData() {
  const allSwims = await SwimStore.getAll();
  const payload = { app: "glide", version: 1, exportedAt: new Date().toISOString(), swims: allSwims };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const filename = `glide-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], filename, { type: "application/json" });

  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: filename });
      clearBackupPending();
      return;
    }
    throw new Error("share unsupported");
  } catch (err) {
    if (err.name === "AbortError") return;
    downloadBlob(blob, filename);
    clearBackupPending();
  }
}

document.getElementById("exportBtn").addEventListener("click", exportData);

document.getElementById("importBtn").addEventListener("click", () => {
  document.getElementById("importFileInput").click();
});

document.getElementById("importFileInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed.app !== "glide" || !Array.isArray(parsed.swims)) throw new Error("bad shape");

    const existing = new Map((await SwimStore.getAll()).map((s) => [s.id, s]));
    let added = 0;
    let updated = 0;
    for (const imported of parsed.swims) {
      await SwimStore.put(imported);
      if (existing.has(imported.id)) updated++;
      else added++;
    }

    await refreshList();
    showToast(`Imported ${added} new, updated ${updated} existing`);
  } catch {
    showToast("This doesn't look like a Glide backup file");
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update();
      });
    }).catch(() => {});
  });

  let hasReloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloaded) return;
    hasReloaded = true;
    window.location.reload();
  });
}

refreshList();
