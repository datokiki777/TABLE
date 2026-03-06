/* =========================================================
   Client Totals (Groups Edition) — GitHub Pages friendly
   ✅ Groups
   ✅ Edit / Review modes (saved)
   ✅ Grand totals: Active group / All groups
   ✅ Custom confirm modal fallback to window.confirm
   ✅ Export/Import:
       - Active group JSON (replace)
       - All groups JSON (MERGE or REPLACE)
   ✅ City field per client row
   ✅ PDF Export (ALL groups) via jsPDF
   ✅ Scroll-to-top
   ✅ Controls collapse toggle (mobile friendly)
   ✅ Floating "+ Client" button in Edit
   ✅ Theme toggle (Dark/Light) + saved in localStorage
========================================================= */

/* =========================
   1) Storage Keys
========================= */

const STORAGE_KEY = "client_totals_groups_v1";
const CONTROLS_KEY = "ct_controls_collapsed";
const THEME_KEY = "ct_theme_v1";

const SUMMARY_COLLAPSED_KEY = "ct_summary_collapsed";
const MONTH_CURSOR_KEY = "ct_month_cursor";

const PERIODS_COLLAPSED_KEY = "ct_periods_collapsed";

/* =========================
   2) DOM
========================= */

// Main UI
const modeEditBtn = document.getElementById("modeEditBtn");
const modeReviewBtn = document.getElementById("modeReviewBtn");
const editView = document.getElementById("editView");
const reviewView = document.getElementById("reviewView");
const elPeriods = document.getElementById("periods");
const tplPeriod = document.getElementById("periodTpl");
const tplRow = document.getElementById("rowTpl");

const defaultRateInput = document.getElementById("defaultRate");
const addPeriodBtn = document.getElementById("addPeriodBtn");
const exportBtn = document.getElementById("exportBtn");
const importInput = document.getElementById("importInput");
const resetBtn = document.getElementById("resetBtn");

const grandGrossEl = document.getElementById("grandGross");
const grandNetEl = document.getElementById("grandNet");
const grandMyEl = document.getElementById("grandMy");

// Summary + Monthly stats
const summarySection = document.querySelector(".summary.card");
const summaryCollapseBtn = document.getElementById("summaryCollapseBtn");
const monthPrevBtn = document.getElementById("monthPrevBtn");
const monthNextBtn = document.getElementById("monthNextBtn");
const monthLabel = document.getElementById("monthLabel");
const monthGrossEl = document.getElementById("monthGross");
const monthNetEl = document.getElementById("monthNet");
const monthMyEl = document.getElementById("monthMy");

// Groups UI
const groupSelect = document.getElementById("groupSelect");
const addGroupBtn = document.getElementById("addGroupBtn");
const renameGroupBtn = document.getElementById("renameGroupBtn");
const deleteGroupBtn = document.getElementById("deleteGroupBtn");

// Grand Total toggle (Active / All)
const totalsActiveBtn = document.getElementById("totalsActiveBtn");
const totalsAllBtn = document.getElementById("totalsAllBtn");

// Export/Import ALL groups
const pdfAllBtn = document.getElementById("pdfAllBtn");
const exportAllBtn = document.getElementById("exportAllBtn");
const importAllInput = document.getElementById("importAllInput");

// Scroll-to-top
const toTopBtn = document.getElementById("toTopBtn");

// Controls collapse toggle button
const controlsToggle = document.getElementById("controlsToggle");

// Floating add client
const fabAddClient = document.getElementById("fabAddClient");

// Confirm modal elements (optional)
const confirmBackdrop = document.getElementById("confirmModal");
const confirmTitleEl = document.getElementById("confirmTitle");
const confirmTextEl = document.getElementById("confirmText");
const confirmNoBtn = document.getElementById("confirmNo");
const confirmYesBtn = document.getElementById("confirmYes");

// Theme controls (flexible)
const themeToggle = document.getElementById("themeToggle");     // optional one button
const themeDarkBtn = document.getElementById("themeDarkBtn");   // optional
const themeLightBtn = document.getElementById("themeLightBtn"); // optional
const themeSwitch = document.getElementById("themeSwitch");     // optional checkbox

/* =========================
   3) App State
========================= */

let appState = loadState();

/* =========================
   4) Utilities
========================= */

function uuid() {
  return crypto?.randomUUID?.() ?? `id-${Math.random().toString(16).slice(2)}-${Date.now()}`;
}

function fmt(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Accepts:
 *  - "1,234.56"
 *  - "1.234,56"
 *  - "1234,56"
 */
function parseMoney(value) {
  if (value == null) return 0;

  let s = String(value).trim();
  if (!s) return 0;

  s = s.replace(/\s+/g, "");

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      // comma decimal, dots thousands
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      // dot decimal, commas thousands
      s = s.replace(/,/g, "");
    }
  } else if (lastComma !== -1 && lastDot === -1) {
    s = s.replace(",", ".");
  } else {
    s = s.replace(/,/g, "");
  }

  const num = Number(s);
  return Number.isFinite(num) ? num : 0;
}

function clampRate(percent) {
  let p = Number(percent);
  if (!Number.isFinite(p)) p = 0;
  if (p < 0) p = 0;
  if (p > 100) p = 100;
  return p;
}

function safeFileName(name) {
  return (name || "group").toString().trim().replace(/[^\w\-]+/g, "_");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getSavedSummaryCollapsed() {
  try {
    return localStorage.getItem(SUMMARY_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function setSummaryCollapsed(v) {
  if (summarySection) {
    summarySection.classList.toggle("summary-collapsed", !!v);
  }
  try {
    localStorage.setItem(SUMMARY_COLLAPSED_KEY, v ? "1" : "0");
  } catch {}
}

function getSavedMonthCursor() {
  try {
    return localStorage.getItem(MONTH_CURSOR_KEY) || "";
  } catch {
    return "";
  }
}

function setSavedMonthCursor(v) {
  try {
    localStorage.setItem(MONTH_CURSOR_KEY, v || "");
  } catch {}
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function daysBetweenInclusive(a, b) {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.floor(ms / 86400000) + 1;
}

function parseDateOnly(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return null;

  const y = Number(parts[0]);
  const m = Number(parts[1]) - 1;
  const d = Number(parts[2]);

  const out = new Date(y, m, d);
  if (Number.isNaN(out.getTime())) return null;
  return out;
}

function monthKeyFromDateObj(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthKey(monthKey) {
  if (!monthKey) return "No data";
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleString("en-US", { month: "long", year: "numeric" });
}

function getMonthStart(monthKey) {
  const [y, m] = monthKey.split("-");
  return new Date(Number(y), Number(m) - 1, 1);
}

function getMonthEnd(monthKey) {
  const [y, m] = monthKey.split("-");
  return new Date(Number(y), Number(m), 0);
}

function getAllMonthKeysForMode(mode = appState.grandMode) {
  const groups = mode === "all" ? appState.groups : [activeGroup()];
  const keys = new Set();

  groups.forEach((gr) => {
    (gr?.data?.periods || []).forEach((p) => {
      const from = parseDateOnly(p?.from);
      const to = parseDateOnly(p?.to);
      if (!from || !to) return;

      let cur = new Date(from.getFullYear(), from.getMonth(), 1);
      const last = new Date(to.getFullYear(), to.getMonth(), 1);

      while (cur <= last) {
        keys.add(monthKeyFromDateObj(cur));
        cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      }
    });
  });

  return [...keys].sort();
}

function getCurrentMonthKey(mode = appState.grandMode) {
  const keys = getAllMonthKeysForMode(mode);
  if (!keys.length) return "";

  const saved = getSavedMonthCursor();
  if (saved && keys.includes(saved)) return saved;

  return keys[keys.length - 1];
}

function getOverlapDaysInclusive(periodFrom, periodTo, monthStart, monthEnd) {
  const start = periodFrom > monthStart ? periodFrom : monthStart;
  const end = periodTo < monthEnd ? periodTo : monthEnd;
  if (start > end) return 0;
  return daysBetweenInclusive(start, end);
}

function calcMonthlyTotals(monthKey, mode = appState.grandMode) {
  if (!monthKey) return { gross: 0, net: 0, my: 0 };

  const monthStart = getMonthStart(monthKey);
  const monthEnd = getMonthEnd(monthKey);
  const groups = mode === "all" ? appState.groups : [activeGroup()];
  const totals = { gross: 0, net: 0, my: 0 };

  groups.forEach((gr) => {
    const st = gr.data;

    (st.periods || []).forEach((p) => {
      const from = parseDateOnly(p.from);
      const to = parseDateOnly(p.to);
      if (!from || !to || to < from) return;

      const totalDays = daysBetweenInclusive(from, to);
      const overlapDays = getOverlapDaysInclusive(from, to, monthStart, monthEnd);
      if (overlapDays <= 0 || totalDays <= 0) return;

      const ratio = overlapDays / totalDays;
      const t = calcPeriodTotals(p, st.defaultRatePercent);

      totals.gross += t.gross * ratio;
      totals.net += t.net * ratio;
      totals.my += t.my * ratio;
    });
  });

  return totals;
}

function renderMonthlyStats() {
  if (!monthLabel || !monthGrossEl || !monthNetEl || !monthMyEl) return;

  const keys = getAllMonthKeysForMode(appState.grandMode);
  const currentKey = getCurrentMonthKey(appState.grandMode);
  const totals = calcMonthlyTotals(currentKey, appState.grandMode);

  monthLabel.textContent = formatMonthKey(currentKey);
  monthGrossEl.textContent = fmt(totals.gross);
  monthNetEl.textContent = fmt(totals.net);
  monthMyEl.textContent = fmt(totals.my);

  if (monthPrevBtn) monthPrevBtn.disabled = !currentKey || currentKey === keys[0];
  if (monthNextBtn) monthNextBtn.disabled = !currentKey || currentKey === keys[keys.length - 1];
}

function shiftMonthCursor(dir) {
  const keys = getAllMonthKeysForMode(appState.grandMode);
  if (!keys.length) return;

  const currentKey = getCurrentMonthKey(appState.grandMode);
  let idx = keys.indexOf(currentKey);
  if (idx === -1) idx = keys.length - 1;

  idx += dir;
  if (idx < 0) idx = 0;
  if (idx > keys.length - 1) idx = keys.length - 1;

  setSavedMonthCursor(keys[idx]);
  renderMonthlyStats();
}

function initSummaryPanel() {
  setSummaryCollapsed(getSavedSummaryCollapsed());

  summaryCollapseBtn?.addEventListener("click", () => {
    const collapsed = summarySection?.classList.contains("summary-collapsed");
    setSummaryCollapsed(!collapsed);
  });

  monthPrevBtn?.addEventListener("click", () => shiftMonthCursor(-1));
  monthNextBtn?.addEventListener("click", () => shiftMonthCursor(1));
}

/* =========================
   5) Theme (Dark/Light)
========================= */

function getSavedTheme() {
  try { return localStorage.getItem(THEME_KEY); } catch { return null; }
}

function setTheme(theme) {
  const t = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = t;

  try { localStorage.setItem(THEME_KEY, t); } catch {}

  // sync checkbox (if exists)
  if (themeSwitch && "checked" in themeSwitch) {
    themeSwitch.checked = t === "light";
  }

  // sync optional buttons
  themeDarkBtn?.classList.toggle("active", t === "dark");
  themeLightBtn?.classList.toggle("active", t === "light");
}

function toggleTheme() {
  const cur = document.body.dataset.theme === "light" ? "light" : "dark";
  setTheme(cur === "light" ? "dark" : "light");
}

function initTheme() {
  setTheme(getSavedTheme() || "dark");

  themeToggle?.addEventListener("click", toggleTheme);
  themeDarkBtn?.addEventListener("click", () => setTheme("dark"));
  themeLightBtn?.addEventListener("click", () => setTheme("light"));
  themeSwitch?.addEventListener("change", () => setTheme(themeSwitch.checked ? "light" : "dark"));
}

/* =========================
   6) Confirm Modal (Yes/No)
========================= */

function hasCustomConfirm() {
  return !!(confirmBackdrop && confirmTitleEl && confirmTextEl && confirmNoBtn && confirmYesBtn);
}

function askConfirm(message, title = "Confirm") {
  return new Promise((resolve) => {
    if (!hasCustomConfirm()) {
      resolve(window.confirm(message));
      return;
    }

    confirmTitleEl.textContent = title;
    confirmTextEl.textContent = message;
    confirmBackdrop.style.display = "flex";

    const cleanup = () => {
      confirmBackdrop.style.display = "none";
      confirmNoBtn.onclick = null;
      confirmYesBtn.onclick = null;
      confirmBackdrop.onclick = null;
      document.onkeydown = null;
    };

    confirmNoBtn.onclick = () => { cleanup(); resolve(false); };
    confirmYesBtn.onclick = () => { cleanup(); resolve(true); };

    confirmBackdrop.onclick = (e) => {
      if (e.target === confirmBackdrop) { cleanup(); resolve(false); }
    };

    document.onkeydown = (e) => {
      if (e.key === "Escape") { cleanup(); resolve(false); }
    };
  });
}

/* =========================
   7) Data Model
========================= */

function emptyRow() {
  return { id: uuid(), customer: "", city: "", gross: "", net: "" };
}

function defaultGroupData() {
  return {
    defaultRatePercent: 13.5,
    periods: [{ id: uuid(), from: "", to: "", rows: [emptyRow()] }],
  };
}

function defaultAppState() {
  const g1 = { id: uuid(), name: "Group 1", data: defaultGroupData() };
  return {
    activeGroupId: g1.id,
    groups: [g1],
    grandMode: "active", // "active" | "all"
    uiMode: "review",    // "edit" | "review"
  };
}

function normalizeGroupData(d) {
  const out = {
    defaultRatePercent: clampRate(d?.defaultRatePercent ?? 13.5),
    periods: Array.isArray(d?.periods) ? d.periods : [],
  };

  if (out.periods.length === 0) out.periods = defaultGroupData().periods;

  out.periods = out.periods.map((p) => ({
    id: p?.id || uuid(),
    from: p?.from || "",
    to: p?.to || "",
    rows:
      Array.isArray(p?.rows) && p.rows.length
        ? p.rows.map((r) => ({
            id: r?.id || uuid(),
            customer: r?.customer ?? "",
            city: r?.city ?? "",
            gross: r?.gross ?? "",
            net: r?.net ?? "",
          }))
        : [emptyRow()],
  }));

  return out;
}

function normalizeAppState(s) {
  const groups = Array.isArray(s?.groups) ? s.groups : [];

  const out = {
    activeGroupId: s?.activeGroupId || "",
    groups: [],
    grandMode: s?.grandMode === "all" ? "all" : "active",
    uiMode: s?.uiMode === "edit" ? "edit" : "review",
  };

  out.groups = (groups.length ? groups : defaultAppState().groups).map((g) => ({
    id: g?.id || uuid(),
    name: (g?.name ?? "Group").toString().trim() || "Group",
    data: normalizeGroupData(g?.data),
  }));

  if (!out.groups.some((g) => g.id === out.activeGroupId)) {
    out.activeGroupId = out.groups[0].id;
  }

  return out;
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); } catch {}
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppState();
    return normalizeAppState(JSON.parse(raw));
  } catch {
    return defaultAppState();
  }
}

function activeGroup() {
  return appState.groups.find((g) => g.id === appState.activeGroupId) || appState.groups[0];
}

function getSavedCollapsedPeriods() {
  try {
    return JSON.parse(localStorage.getItem(PERIODS_COLLAPSED_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCollapsedPeriods(map) {
  try {
    localStorage.setItem(PERIODS_COLLAPSED_KEY, JSON.stringify(map || {}));
  } catch {}
}

function isPeriodCollapsed(periodId) {
  const map = getSavedCollapsedPeriods();
  return !!map[periodId];
}

function setPeriodCollapsed(periodId, collapsed) {
  const map = getSavedCollapsedPeriods();
  map[periodId] = !!collapsed;
  saveCollapsedPeriods(map);
}

function formatDateLocal(d){
  if(!d) return "—";

  const parts = d.split("-");
  if(parts.length !== 3) return d;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatPeriodPreview(from, to) {
  const left = formatDateLocal(from);
  const right = formatDateLocal(to);
  return `${left} → ${right}`;
}

 function updateFloatingAddClientVisibility() {
  const allPeriods = elPeriods?.querySelectorAll?.(".period") ?? [];
  if (!allPeriods.length) {
    document.body.classList.remove("all-periods-collapsed");
    return;
  }

  const hasOpenPeriod = [...allPeriods].some((sec) => !sec.classList.contains("is-collapsed"));
  document.body.classList.toggle("all-periods-collapsed", !hasOpenPeriod);
}

function periodsStrictlyOverlap(aFrom, aTo, bFrom, bTo) {
  if (!aFrom || !aTo || !bFrom || !bTo) return false;

  const aStart = parseDateOnly(aFrom);
  const aEnd = parseDateOnly(aTo);
  const bStart = parseDateOnly(bFrom);
  const bEnd = parseDateOnly(bTo);

  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  if (aEnd < aStart || bEnd < bStart) return false;

  // strict overlap only
  // touching edges is allowed:
  // aEnd === bStart  -> OK
  // aStart === bEnd  -> OK
  return aStart < bEnd && aEnd > bStart;
}

function hasOverlappingPeriodInActiveGroup(periodId, from, to) {
  const g = activeGroup();
  const periods = g?.data?.periods || [];

  return periods.some((p) => {
    if (!p || p.id === periodId) return false;
    return periodsStrictlyOverlap(from, to, p.from, p.to);
  });
}

function isPeriodReversed(from, to) {
  if (!from || !to) return false;

  const fromDate = parseDateOnly(from);
  const toDate = parseDateOnly(to);

  if (!fromDate || !toDate) return false;
  return fromDate > toDate;
}

async function validatePeriodWarnings(periodId, from, to, revertFn) {
  if (from && to && isPeriodReversed(from, to)) {
    const ok = await askConfirm(
      "From date is later than To date. Is that correct?",
      "Invalid period"
    );

    if (!ok) {
      revertFn();
      return false;
    }
  }

  if (from && to && hasOverlappingPeriodInActiveGroup(periodId, from, to)) {
    const ok = await askConfirm(
      "This period overlaps with another period in this group. Is that correct?",
      "Overlapping period"
    );

    if (!ok) {
      revertFn();
      return false;
    }
  }

  return true;
}

/* =========================
   8) Controls Collapse
========================= */

function setControlsCollapsed(v) {
  document.body.classList.toggle("controls-collapsed", !!v);
  try { localStorage.setItem(CONTROLS_KEY, v ? "1" : "0"); } catch {}
}

function initControlsToggle() {
  const saved = (() => {
    try { return localStorage.getItem(CONTROLS_KEY); } catch { return null; }
  })();

  const defaultCollapsed = window.matchMedia?.("(max-width: 720px)")?.matches ? true : false;
  setControlsCollapsed(saved === null ? defaultCollapsed : saved === "1");

  controlsToggle?.addEventListener("click", () => {
    setControlsCollapsed(!document.body.classList.contains("controls-collapsed"));
  });
}

/* =========================
   9) UI Helpers
========================= */

function syncBodyModeClass(mode = appState.uiMode) {
  document.body.classList.toggle("is-edit", mode === "edit");
}

function renderGroupSelect() {
  if (!groupSelect) return;

  groupSelect.innerHTML = "";
  appState.groups.forEach((g) => {
    const opt = document.createElement("option");
    opt.value = g.id;
    opt.textContent = g.name;
    groupSelect.appendChild(opt);
  });

  groupSelect.value = appState.activeGroupId;
}

function updateGrandToggleUI() {
  if (!totalsActiveBtn || !totalsAllBtn) return;

  const isAll = appState.grandMode === "all";
  totalsActiveBtn.classList.toggle("active", !isAll);
  totalsAllBtn.classList.toggle("active", isAll);
}

function setControlsForMode(mode) {
  const isEdit = mode === "edit";
  syncBodyModeClass(mode);

  const enableAlways = [modeEditBtn, modeReviewBtn, totalsActiveBtn, totalsAllBtn, controlsToggle];
  const enableInReview = [groupSelect, exportBtn, exportAllBtn, pdfAllBtn];
  const enableInEdit = [
    groupSelect, addGroupBtn, renameGroupBtn, deleteGroupBtn,
    defaultRateInput,
    addPeriodBtn, resetBtn,
    importInput, importAllInput,
    exportBtn, exportAllBtn,
  ];

  const all = [
    groupSelect, addGroupBtn, renameGroupBtn, deleteGroupBtn,
    defaultRateInput,
    addPeriodBtn, exportBtn, importInput, resetBtn,
    exportAllBtn, importAllInput,
    pdfAllBtn,
  ];

  const setEl = (el, enabled) => {
    if (!el) return;
    if ("disabled" in el) el.disabled = !enabled;
    el.style.pointerEvents = enabled ? "" : "none";
    el.style.opacity = enabled ? "" : "0.55";
  };

  all.forEach((el) => setEl(el, false));
  enableAlways.forEach((el) => setEl(el, true));
  (isEdit ? enableInEdit : enableInReview).forEach((el) => setEl(el, true));

  // show import inputs only in edit
  const importLabelEl = importInput?.closest("label");
  const importAllLabelEl = importAllInput?.closest("label");
  if (importLabelEl) importLabelEl.style.display = isEdit ? "" : "none";
  if (importAllLabelEl) importAllLabelEl.style.display = isEdit ? "" : "none";

  // show PDF only in review
  if (pdfAllBtn) pdfAllBtn.style.display = isEdit ? "none" : "";
}

function setMode(mode) {
  appState.uiMode = mode === "edit" ? "edit" : "review";
  saveState();

  modeEditBtn?.classList.toggle("active", appState.uiMode === "edit");
  modeReviewBtn?.classList.toggle("active", appState.uiMode === "review");

  if (editView && reviewView) {
    if (appState.uiMode === "review") {
      editView.hidden = true;
      reviewView.hidden = false;
      renderReview();
    } else {
      reviewView.hidden = true;
      editView.hidden = false;
    }
  }
   
   setControlsForMode(appState.uiMode);
  updateFloatingAddClientVisibility();
}

/* =========================
   10) Calculations
========================= */

function calcPeriodTotals(period, ratePercent) {
  const gross = period.rows.reduce((sum, r) => sum + parseMoney(r.gross), 0);
  const net = period.rows.reduce((sum, r) => sum + parseMoney(r.net), 0);
  const my = net * (clampRate(ratePercent) / 100);
  return { gross, net, my };
}

function calcGrandTotalsActiveGroup() {
  const g = activeGroup();
  const st = g.data;

  return st.periods.reduce(
    (acc, p) => {
      const t = calcPeriodTotals(p, st.defaultRatePercent);
      acc.gross += t.gross;
      acc.net += t.net;
      acc.my += t.my;
      return acc;
    },
    { gross: 0, net: 0, my: 0 }
  );
}

function calcGrandTotalsAllGroups() {
  const grand = { gross: 0, net: 0, my: 0 };

  appState.groups.forEach((gr) => {
    const st = gr.data;
    st.periods.forEach((p) => {
      const t = calcPeriodTotals(p, st.defaultRatePercent);
      grand.gross += t.gross;
      grand.net += t.net;
      grand.my += t.my;
    });
  });

  return grand;
}

function recalcAndRenderTotals() {
  const g = activeGroup();
  const st = g.data;

  const grand =
    appState.grandMode === "all" ? calcGrandTotalsAllGroups() : calcGrandTotalsActiveGroup();

 if (grandGrossEl){
  grandGrossEl.textContent = fmt(grand.gross);
  grandGrossEl.classList.add("total-flash");
  setTimeout(()=>grandGrossEl.classList.remove("total-flash"),280);
}

if (grandNetEl){
  grandNetEl.textContent = fmt(grand.net);
  grandNetEl.classList.add("total-flash");
  setTimeout(()=>grandNetEl.classList.remove("total-flash"),280);
}

if (grandMyEl){
  grandMyEl.textContent = fmt(grand.my);
  grandMyEl.classList.add("total-flash");
  setTimeout(()=>grandMyEl.classList.remove("total-flash"),280);
}

  // Period totals always reflect ACTIVE group
  const periodSections = elPeriods?.querySelectorAll?.(".period") ?? [];
  periodSections.forEach((sec, i) => {
    const p = st.periods[i];
    if (!p) return;

    const t = calcPeriodTotals(p, st.defaultRatePercent);
    const gEl = sec.querySelector(".total-gross");
    const nEl = sec.querySelector(".total-net");
    const mEl = sec.querySelector(".my-eur");
    if (gEl) gEl.textContent = fmt(t.gross);
    if (nEl) nEl.textContent = fmt(t.net);
    if (mEl) mEl.textContent = fmt(t.my);
  });
  renderMonthlyStats();
}

/* =========================
   11) Render: EDIT
========================= */

function render() {
  renderGroupSelect();
  updateGrandToggleUI();

  const g = activeGroup();
  const st = g.data;

  if (defaultRateInput) defaultRateInput.value = String(st.defaultRatePercent);

  if (!elPeriods || !tplPeriod || !tplRow) {
    recalcAndRenderTotals();
    return;
  }

  elPeriods.innerHTML = "";

  st.periods.forEach((p, idx) => {
    const node = tplPeriod.content.cloneNode(true);

    const section = node.querySelector(".period");
    const collapseBtn = node.querySelector(".period-collapse-btn");
    const collapseMeta = node.querySelector(".period-range-preview");
    const collapseGroupPreview = node.querySelector(".period-group-preview");
    const groupBox = node.querySelector(".period-group-box");
    const bodyWrap = node.querySelector(".period-body-wrap");

    const fromEl = node.querySelector(".fromDate");
    const toEl = node.querySelector(".toDate");
    const rowsTbody = node.querySelector(".rows");
    const addRowBtn = node.querySelector(".addRow");
    const addPeriodInlineBtn = node.querySelector(".addPeriodInline");
    const removePeriodBtn = node.querySelector(".removePeriod");

    const totalGrossEl = node.querySelector(".total-gross");
    const totalNetEl = node.querySelector(".total-net");
    const myEurEl = node.querySelector(".my-eur");

    if (fromEl) fromEl.value = p.from;
    if (toEl) toEl.value = p.to;
    
    if (collapseMeta) {
  collapseMeta.textContent = formatPeriodPreview(p.from, p.to);
}

    if (collapseGroupPreview) {
  collapseGroupPreview.textContent = g.name || "Group";
}

if (groupBox) {
  groupBox.textContent = `Group: ${g.name || "Group"}`;
}

if (section) {
  section.classList.toggle("is-collapsed", isPeriodCollapsed(p.id));
}

   collapseBtn?.addEventListener("click", () => {
  const next = !section.classList.contains("is-collapsed");
  section.classList.toggle("is-collapsed", next);
  setPeriodCollapsed(p.id, next);
  updateFloatingAddClientVisibility();
});

    fromEl?.addEventListener("change", async () => {
  const oldFrom = p.from;
  const nextFrom = fromEl.value;

  p.from = nextFrom;
  
  if (collapseMeta) {
  collapseMeta.textContent = formatPeriodPreview(p.from, p.to);
}

  const ok = await validatePeriodWarnings(
    p.id,
    p.from,
    p.to,
    () => {
  p.from = oldFrom;
  fromEl.value = oldFrom || "";
  if (collapseMeta) {
    collapseMeta.textContent = formatPeriodPreview(p.from, p.to);
       }
    }
  );

  if (!ok) return;

  saveState();
  recalcAndRenderTotals();
  if (appState.uiMode === "review") renderReview();
});

    toEl?.addEventListener("change", async () => {
  const oldTo = p.to;
  const nextTo = toEl.value;

  p.to = nextTo;
  
  if (collapseMeta) {
  collapseMeta.textContent = formatPeriodPreview(p.from, p.to);
  }

  const ok = await validatePeriodWarnings(
    p.id,
    p.from,
    p.to,
    () => {
     p.to = oldTo;
     toEl.value = oldTo || "";
     if (collapseMeta) {
       collapseMeta.textContent = formatPeriodPreview(p.from, p.to);
     }
   }
  );

  if (!ok) return;

  saveState();
  recalcAndRenderTotals();
  if (appState.uiMode === "review") renderReview();
});

    if (rowsTbody) rowsTbody.innerHTML = "";

    p.rows.forEach((r) => {
      const rowNode = tplRow.content.cloneNode(true);
      const tr = rowNode.querySelector("tr");

      const custEl = rowNode.querySelector(".cust");
      const cityEl = rowNode.querySelector(".city");
      const grossEl = rowNode.querySelector(".gross");
      const netEl = rowNode.querySelector(".net");
      const removeRowBtn = rowNode.querySelector(".removeRow");

      if (custEl) custEl.value = r.customer ?? "";
      if (cityEl) cityEl.value = r.city ?? "";
      if (grossEl) grossEl.value = r.gross ?? "";
      if (netEl) netEl.value = r.net ?? "";

      custEl?.addEventListener("input", () => { r.customer = custEl.value; saveState(); });
      cityEl?.addEventListener("input", () => { r.city = cityEl.value; saveState(); });

      grossEl?.addEventListener("input", () => {
        r.gross = grossEl.value;
        recalcAndRenderTotals();
        saveState();
      });

      netEl?.addEventListener("input", () => {
        r.net = netEl.value;
        recalcAndRenderTotals();
        saveState();
      });

      removeRowBtn?.addEventListener("click", async () => {
        const ok = await askConfirm("Delete this client row?", "Delete row");
        if (!ok) return;

        p.rows = p.rows.filter((x) => x.id !== r.id);
        if (p.rows.length === 0) p.rows.push(emptyRow());

        saveState();
        render();
        if (appState.uiMode === "review") renderReview();
      });

      rowsTbody?.appendChild(tr);
    });

    addRowBtn?.addEventListener("click", () => {
  p.rows.push(emptyRow());
  saveState();
  render();
  if (appState.uiMode === "review") renderReview();

  setTimeout(() => {
    const inputs = elPeriods?.querySelectorAll?.("input.cust");
    const lastInput = inputs?.[inputs.length - 1];
    if (lastInput) lastInput.focus();
  }, 50);
});

     addPeriodInlineBtn?.addEventListener("click", () => {
      st.periods.push({
        id: uuid(),
        from: "",
        to: "",
        rows: [emptyRow()],
      });

      saveState();
      render();
      if (appState.uiMode === "review") renderReview();
    });

    removePeriodBtn?.addEventListener("click", async () => {
      const ok = await askConfirm("Delete this period?", "Delete period");
      if (!ok) return;

      st.periods = st.periods.filter((x) => x.id !== p.id);
      if (st.periods.length === 0) st.periods = defaultGroupData().periods;

      saveState();
      render();
      if (appState.uiMode === "review") renderReview();
    });

    const totals = calcPeriodTotals(p, st.defaultRatePercent);
    if (totalGrossEl) totalGrossEl.textContent = fmt(totals.gross);
    if (totalNetEl) totalNetEl.textContent = fmt(totals.net);
    if (myEurEl) myEurEl.textContent = fmt(totals.my);

    if (section) section.dataset.index = String(idx + 1);
    elPeriods.appendChild(node);
  });

     recalcAndRenderTotals();
  updateFloatingAddClientVisibility();
}

/* =========================
   12) Review Search
========================= */

let reviewSearchOutsideHandlerAttached = false;

function buildReviewSearchIndex() {
  const rows = [];

  (appState.groups || []).forEach((gr) => {
    const gName = gr?.name ?? "Group";
    const periods = gr?.data?.periods || [];

    periods.forEach((p) => {
      const from = p?.from || "—";
      const to = p?.to || "—";

      (p?.rows || []).forEach((r) => {
        const customer = (r?.customer ?? "").toString().trim();
        const city = (r?.city ?? "").toString().trim();
        if (!customer && !city) return;

        rows.push({
          group: gName,
          from,
          to,
          customer,
          city,
          gross: fmt(parseMoney(r?.gross)),
          net: fmt(parseMoney(r?.net)),
        });
      });
    });
  });

  return rows;
}

function initReviewSearch() {
  const searchEl = document.getElementById("reviewSearch");
  const resultsEl = document.getElementById("reviewSearchResults");

  if (!searchEl || !resultsEl) return;

  const index = buildReviewSearchIndex();

  const hide = () => {
    resultsEl.style.display = "none";
    resultsEl.innerHTML = "";
  };

  const clear = () => {
    searchEl.value = "";
    hide();
  };

  const renderResults = (list) => {
    if (!list.length) {
      resultsEl.style.display = "block";
      resultsEl.innerHTML = `<div class="review-search-empty">No results</div>`;
      return;
    }

    resultsEl.style.display = "block";
    resultsEl.innerHTML = list.slice(0, 40).map(x => `
      <div class="review-search-item">
        <div class="review-search-name">${escapeHtml(x.customer || "Client")}</div>
        <div class="review-search-meta">
          <span><b>Group:</b> ${escapeHtml(x.group)}</span>
          <span><b>Period:</b> ${escapeHtml(x.from)} → ${escapeHtml(x.to)}</span>
          <span><b>City:</b> ${escapeHtml(x.city || "—")}</span>
          <span><b>Gross:</b> ${escapeHtml(x.gross)}</span>
          <span><b>Net:</b> ${escapeHtml(x.net)}</span>
        </div>
      </div>
    `).join("");
  };

  searchEl.oninput = () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { hide(); return; }

    const filtered = index.filter(x =>
      (x.customer || "").toLowerCase().includes(q) ||
      (x.city || "").toLowerCase().includes(q)
    );

    renderResults(filtered);
  };

  searchEl.onkeydown = (e) => {
    if (e.key === "Escape") clear();
  };

  if (!reviewSearchOutsideHandlerAttached) {
    reviewSearchOutsideHandlerAttached = true;

    document.addEventListener("pointerdown", (e) => {
      const wrap = document.querySelector(".review-search");
      const currentSearch = document.getElementById("reviewSearch");
      const currentResults = document.getElementById("reviewSearchResults");
      if (!wrap || !currentSearch || !currentResults) return;

      if (wrap.contains(e.target)) return;

      currentSearch.value = "";
      currentResults.style.display = "none";
      currentResults.innerHTML = "";
    }, { passive: true });
  }
}

/* =========================
   13) Render: REVIEW
========================= */

function renderReview() {
  if (!reviewView) return;

  const g = activeGroup();
  const st = g.data;

  const groupTotals = st.periods.reduce(
    (acc, p) => {
      const t = calcPeriodTotals(p, st.defaultRatePercent);
      acc.gross += t.gross;
      acc.net += t.net;
      acc.my += t.my;
      acc.periods += 1;
      acc.clients += p.rows.length;
      return acc;
    },
    { gross: 0, net: 0, my: 0, periods: 0, clients: 0 }
  );

  const header = `
    <section class="review-card">
      <div class="review-head">
        <div class="review-search">
          <input id="reviewSearch" class="review-search-input" type="text"
            placeholder="Search client (name or city)..." autocomplete="off" />
          <div id="reviewSearchResults" class="review-search-results" style="display:none;"></div>
        </div>

        <div>
          <h3 class="review-title">${escapeHtml(g.name)} — Review</h3>
          <div class="review-sub">${groupTotals.periods} periods • ${groupTotals.clients} rows • Default ${fmt(st.defaultRatePercent)}%</div>
        </div>
      </div>

      <div class="review-kpis">
        <div class="kpi">
          <div class="kpi-label">Gross</div>
          <div class="kpi-value">${fmt(groupTotals.gross)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">Net</div>
          <div class="kpi-value">${fmt(groupTotals.net)}</div>
        </div>
        <div class="kpi">
          <div class="kpi-label">My €</div>
          <div class="kpi-value">${fmt(groupTotals.my)}</div>
        </div>
      </div>
    </section>
  `;

  const periodsHtml = st.periods.map((p) => {
    const t = calcPeriodTotals(p, st.defaultRatePercent);
    const from = p.from || "—";
    const to = p.to || "—";

    const clients = p.rows.map((r) => {
      const name = r.customer?.trim() || "Client";
      const city = r.city?.trim() || "—";
      return `
        <div class="client-item">
          <div>
            <div class="client-name">${escapeHtml(name)}</div>
            <div class="review-sub" style="margin:2px 0 0 0;">City: <b>${escapeHtml(city)}</b></div>
          </div>
          <div class="client-values">
            <span>Gross:</span> <b>${fmt(parseMoney(r.gross))}</b>
            <span>Net:</span> <b>${fmt(parseMoney(r.net))}</b>
          </div>
        </div>
      `;
    }).join("");

    return `
      <details class="period-card">
        <summary>
          <div class="period-meta">
            <div class="period-range">${escapeHtml(from)} → ${escapeHtml(to)}</div>
            <div class="period-mini">${p.rows.length} clients</div>
          </div>

          <div class="period-sum">
            <span class="badge">Gross: <b>${fmt(t.gross)}</b></span>
            <span class="badge">Net: <b>${fmt(t.net)}</b></span>
            <span class="badge">My €: <b>${fmt(t.my)}</b></span>
          </div>
        </summary>

        <div class="period-body">
          <div class="client-list">
            ${clients || `<div class="hint">No clients.</div>`}
          </div>
        </div>
      </details>
    `;
  }).join("");

  reviewView.innerHTML = header + periodsHtml;
  initReviewSearch();
}

/* =========================
   14) File Helpers
========================= */

function downloadJson(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/* =========================
   15) Import ALL — Merge logic
========================= */

function findGroupByName(name) {
  const key = (name ?? "").toString().trim().toLowerCase();
  if (!key) return null;
  return appState.groups.find((g) => g.name.toLowerCase() === key) || null;
}

function cloneAndReIdGroup(group) {
  const g = {
    id: uuid(),
    name: (group?.name ?? "Group").toString().trim() || "Group",
    data: normalizeGroupData(group?.data),
  };

  g.data.periods = g.data.periods.map((p) => ({
    ...p,
    id: uuid(),
    rows: p.rows.map((r) => ({ ...r, id: uuid() })),
  }));

  return g;
}

function mergeAppState(incomingState) {
  const inc = normalizeAppState(incomingState);

  inc.groups.forEach((incomingGroup) => {
    const existing = findGroupByName(incomingGroup.name);

    if (!existing) {
      appState.groups.push(cloneAndReIdGroup(incomingGroup));
      return;
    }

    const incomingData = normalizeGroupData(incomingGroup.data);

    const appended = incomingData.periods.map((p) => ({
      ...p,
      id: uuid(),
      rows: p.rows.map((r) => ({ ...r, id: uuid() })),
    }));

    existing.data.periods = [...existing.data.periods, ...appended];
  });

  if (!appState.groups.some((g) => g.id === appState.activeGroupId)) {
    appState.activeGroupId = appState.groups[0]?.id || appState.activeGroupId;
  }
}

/* =========================
   16) PDF Export (ALL groups)
========================= */

function exportPdfAllGroups() {
  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) {
    alert("PDF library not loaded. Check jsPDF script tag.");
    return;
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - margin * 2;
  const lineH = 6;

  let y = margin;

  const addPageIfNeeded = (need = lineH) => {
    if (y + need > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const textLine = (txt, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);

    const lines = doc.splitTextToSize(String(txt), maxW);
    lines.forEach((ln) => {
      addPageIfNeeded(lineH);
      doc.text(ln, margin, y);
      y += lineH;
    });
  };

  const hr = () => {
    addPageIfNeeded(4);
    doc.setDrawColor(180);
    doc.line(margin, y, pageW - margin, y);
    y += 5;
  };

  const money = (n) => fmt(Number(n || 0));
  const overall = { gross: 0, net: 0, my: 0, groups: appState.groups.length };

  const groupsData = appState.groups.map((gr) => {
    const st = gr.data;

    const groupTotals = st.periods.reduce(
      (acc, p) => {
        const t = calcPeriodTotals(p, st.defaultRatePercent);
        acc.gross += t.gross;
        acc.net += t.net;
        acc.my += t.my;
        acc.periods += 1;
        acc.rows += p.rows.length;
        return acc;
      },
      { gross: 0, net: 0, my: 0, periods: 0, rows: 0 }
    );

    overall.gross += groupTotals.gross;
    overall.net += groupTotals.net;
    overall.my += groupTotals.my;

    return { gr, st, groupTotals };
  });

  textLine("Client Totals — PDF Report (ALL Groups)", 16, true);
  textLine(`Exported: ${new Date().toLocaleString()}`, 10, false);
  hr();

  textLine("OVERALL SUMMARY", 12, true);
  textLine(`Groups: ${overall.groups}`, 11, false);
  textLine(
    `Gross: ${money(overall.gross)}   Net: ${money(overall.net)}   My €: ${money(overall.my)}`,
    11,
    true
  );
  hr();

  groupsData.forEach(({ gr, st, groupTotals }, gi) => {
    textLine(`GROUP: ${gr.name}`, 13, true);
    textLine(
      `Default %: ${money(st.defaultRatePercent)}%   Periods: ${groupTotals.periods}   Rows: ${groupTotals.rows}`,
      10,
      false
    );
    textLine(
      `Gross: ${money(groupTotals.gross)}   Net: ${money(groupTotals.net)}   My €: ${money(groupTotals.my)}`,
      11,
      true
    );
    hr();

    st.periods.forEach((p, pi) => {
      const from = p.from || "—";
      const to = p.to || "—";
      const t = calcPeriodTotals(p, st.defaultRatePercent);

      textLine(`Period ${pi + 1}: ${from} → ${to}`, 11, true);
      textLine(
        `Gross: ${money(t.gross)}   Net: ${money(t.net)}   My €: ${money(t.my)}   (Clients: ${p.rows.length})`,
        10,
        false
      );

      p.rows.forEach((r) => {
        const name = (r.customer || "Client").toString().trim() || "Client";
        const city = (r.city || "—").toString().trim() || "—";
        const rg = money(parseMoney(r.gross));
        const rn = money(parseMoney(r.net));
        textLine(`• ${name} [${city}] | Gross: ${rg} | Net: ${rn}`, 10, false);
      });

      hr();
    });

    if (gi !== groupsData.length - 1) addPageIfNeeded(20);
  });

  const fileName = `client-totals_ALL_${nowStamp()}.pdf`;

  setTimeout(() => {
    try { doc.save(fileName); }
    catch (e) { console.error(e); alert("PDF export failed (download issue). Try Chrome."); }
  }, 150);
}

/* =========================
   17) Scroll-to-top + Keyboard
========================= */

function toggleToTop() {
  if (!toTopBtn) return;
  if (window.scrollY > 450) toTopBtn.classList.add("show");
  else toTopBtn.classList.remove("show");
}

(function initKeyboardDetect() {
  let baseH = window.innerHeight;

  window.addEventListener("resize", () => {
    const h = window.innerHeight;
    const opened = h < baseH - 120;
    document.body.classList.toggle("keyboard-open", opened);
    if (!opened) baseH = h;
  });
})();

/* =========================
   18) Floating Add Client
========================= */

function addClientToLastPeriod() {
  const g = activeGroup();
  const st = g.data;
  const last = st.periods[st.periods.length - 1];
  if (!last) return;

  last.rows.push(emptyRow());
  saveState();
  render();

  setTimeout(() => {
    const inputs = elPeriods?.querySelectorAll?.("input.cust");
    const lastInput = inputs?.[inputs.length - 1];
    if (lastInput) lastInput.focus();
  }, 50);
}

/* =========================
   19) Events
========================= */

modeEditBtn?.addEventListener("click", () => setMode("edit"));
modeReviewBtn?.addEventListener("click", () => setMode("review"));

groupSelect?.addEventListener("change", () => {
  appState.activeGroupId = groupSelect.value;
  saveState();
  render();
  if (appState.uiMode === "review") renderReview();
});

addGroupBtn?.addEventListener("click", () => {
  const name = prompt("Group name?", `Group ${appState.groups.length + 1}`);
  if (!name) return;

  const g = {
    id: uuid(),
    name: name.toString().trim() || `Group ${appState.groups.length + 1}`,
    data: defaultGroupData(),
  };

  appState.groups.push(g);
  appState.activeGroupId = g.id;
  saveState();

  render();
  setMode("review");
});

renameGroupBtn?.addEventListener("click", () => {
  const g = activeGroup();
  const name = prompt("New group name:", g.name);
  if (!name) return;

  g.name = name.toString().trim() || g.name;
  saveState();
  renderGroupSelect();
  if (appState.uiMode === "review") renderReview();
});

deleteGroupBtn?.addEventListener("click", async () => {
  if (appState.groups.length <= 1) {
    alert("You must keep at least 1 group.");
    return;
  }

  const g = activeGroup();
  const ok = await askConfirm(`Delete group "${g.name}"?`, "Delete group");
  if (!ok) return;

  appState.groups = appState.groups.filter((x) => x.id !== g.id);
  appState.activeGroupId = appState.groups[0].id;

  saveState();
  render();
  if (appState.uiMode === "review") renderReview();
});

defaultRateInput?.addEventListener("input", () => {
  const g = activeGroup();
  g.data.defaultRatePercent = clampRate(defaultRateInput.value);
  saveState();
  recalcAndRenderTotals();
  if (appState.uiMode === "review") renderReview();
});

addPeriodBtn?.addEventListener("click", () => {
  const g = activeGroup();

  g.data.periods.push({ id: uuid(), from: "", to: "", rows: [emptyRow()] });

  saveState();
  render();
  if (appState.uiMode === "review") renderReview();
});

resetBtn?.addEventListener("click", async () => {
  const g = activeGroup();
  const ok = await askConfirm(`Reset group "${g.name}"? This will clear all its data.`, "Reset group");
  if (!ok) return;

  g.data = defaultGroupData();
  saveState();
  render();
  if (appState.uiMode === "review") renderReview();
});

exportBtn?.addEventListener("click", () => {
  const g = activeGroup();
  const payload = { type: "client-totals-group-backup", version: 1, group: g };
  downloadJson(`client-totals-${safeFileName(g.name)}_${nowStamp()}.json`, payload);
});

importInput?.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (parsed?.type === "client-totals-group-backup" && parsed?.group?.data) {
      const g = activeGroup();
      const ok = await askConfirm(`Import will REPLACE data inside "${g.name}". Continue?`, "Import group");
      if (!ok) return;

      g.name = (parsed.group.name ?? g.name).toString().trim() || g.name;
      g.data = normalizeGroupData(parsed.group.data);

      saveState();
      render();
      if (appState.uiMode === "review") renderReview();
      alert("Imported into current group.");
    } else {
      alert("Import failed: wrong format.");
    }
  } catch {
    alert("Import failed: invalid JSON file.");
  } finally {
    importInput.value = "";
  }
});

exportAllBtn?.addEventListener("click", () => {
  const payload = {
    __type: "client_totals_all_groups",
    __ver: 1,
    exportedAt: new Date().toISOString(),
    data: appState,
  };
  downloadJson(`client-totals-ALL-groups_${nowStamp()}.json`, payload);
});

importAllInput?.addEventListener("change", async () => {
  const file = importAllInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    let incoming = null;
    if (parsed?.__type === "client_totals_all_groups" && parsed?.data) incoming = parsed.data;
    else if (parsed?.groups && parsed?.activeGroupId) incoming = parsed;

    if (!incoming) {
      alert("Import failed: wrong file format.");
      return;
    }

    const doMerge = await askConfirm(
      "Import mode: MERGE into current data? (Yes = Merge, No = Next)",
      "Import all groups"
    );

    if (doMerge) {
      mergeAppState(incoming);
      saveState();
      render();
      if (appState.uiMode === "review") renderReview();
      alert("Merged successfully.");
      return;
    }

    const doReplace = await askConfirm(
      "Import mode: REPLACE all current data on this device? (Yes = Replace, No = Cancel)",
      "Import all groups"
    );

    if (!doReplace) return;

    appState = normalizeAppState(incoming);
    saveState();
    render();
    if (appState.uiMode === "review") renderReview();
    alert("Imported successfully.");
  } catch {
    alert("Import failed: invalid JSON file.");
  } finally {
    importAllInput.value = "";
  }
});

totalsActiveBtn?.addEventListener("click", () => {
  appState.grandMode = "active";
  saveState();

  const current = getCurrentMonthKey("active");
  setSavedMonthCursor(current);

  updateGrandToggleUI();
  recalcAndRenderTotals();
});

totalsAllBtn?.addEventListener("click", () => {
  appState.grandMode = "all";
  saveState();

  const current = getCurrentMonthKey("all");
  setSavedMonthCursor(current);

  updateGrandToggleUI();
  recalcAndRenderTotals();
});

pdfAllBtn?.addEventListener("click", () => {
  if (!pdfAllBtn) return;

  pdfAllBtn.disabled = true;
  const oldText = pdfAllBtn.textContent;
  pdfAllBtn.textContent = "Generating PDF...";

  setTimeout(() => {
    try { exportPdfAllGroups(); }
    finally {
      setTimeout(() => {
        pdfAllBtn.disabled = false;
        pdfAllBtn.textContent = oldText;
      }, 1200);
    }
  }, 50);
});

window.addEventListener("scroll", toggleToTop);
toggleToTop();

toTopBtn?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

fabAddClient?.addEventListener("click", () => {
  if (appState.uiMode !== "edit") return;
  addClientToLastPeriod();
});

/* =========================
   20) Init
========================= */

initTheme();
initControlsToggle();
initSummaryPanel();
render();
setMode(appState.uiMode);

/* =========================
   21) Service Worker (update box)
========================= */

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js").then((reg) => {
    reg.addEventListener("updatefound", () => {
      const newWorker = reg.installing;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
          const box = document.getElementById("updateBox");
          const btn = document.getElementById("updateBtn");
          if (box) box.style.display = "block";
          if (btn) btn.onclick = () => window.location.reload();
        }
      });
    });
  });
}
