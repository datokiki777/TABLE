/* Client Totals - GitHub Pages friendly (no backend) */

const STORAGE_KEY = "client_totals_v1";

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

let state = loadState();

/** ---------- helpers ---------- **/
function fmt(n) {
  const v = Number.isFinite(n) ? n : 0;
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Accept "1,234.56" or "1.234,56" or "1234,56"
function parseMoney(value) {
  if (value == null) return 0;
  let s = String(value).trim();
  if (!s) return 0;

  // Remove spaces
  s = s.replace(/\s+/g, "");

  // If has both , and . decide which is decimal (last symbol)
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
    // only comma -> decimal
    s = s.replace(",", ".");
  } else {
    // only dot or none -> ok, remove commas just in case
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

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch {
    return defaultState();
  }
}

function defaultState() {
  return {
    defaultRatePercent: 13.5,
    periods: [
      {
        id: crypto.randomUUID(),
        from: "",
        to: "",
        rows: [
          { id: crypto.randomUUID(), customer: "", gross: "", net: "" },
        ],
      },
    ],
  };
}

function normalizeState(s) {
  const out = {
    defaultRatePercent: clampRate(s?.defaultRatePercent ?? 13.5),
    periods: Array.isArray(s?.periods) ? s.periods : [],
  };
  if (out.periods.length === 0) out.periods = defaultState().periods;

  out.periods = out.periods.map(p => ({
    id: p?.id || crypto.randomUUID(),
    from: p?.from || "",
    to: p?.to || "",
    rows: Array.isArray(p?.rows) && p.rows.length ? p.rows.map(r => ({
      id: r?.id || crypto.randomUUID(),
      customer: r?.customer ?? "",
      gross: r?.gross ?? "",
      net: r?.net ?? "",
    })) : [{ id: crypto.randomUUID(), customer: "", gross: "", net: "" }],
  }));

  return out;
}

/** ---------- rendering ---------- **/
function render() {
  // header
  defaultRateInput.value = String(state.defaultRatePercent);

  // periods
  elPeriods.innerHTML = "";
  state.periods.forEach((p, idx) => {
    const node = tplPeriod.content.cloneNode(true);
    const section = node.querySelector(".period");
    const fromEl = node.querySelector(".fromDate");
    const toEl = node.querySelector(".toDate");
    const rowsTbody = node.querySelector(".rows");
    const addRowBtn = node.querySelector(".addRow");
    const removePeriodBtn = node.querySelector(".removePeriod");

    const totalGrossEl = node.querySelector(".total-gross");
    const totalNetEl = node.querySelector(".total-net");
    const myEurEl = node.querySelector(".my-eur");

    fromEl.value = p.from;
    toEl.value = p.to;

    fromEl.addEventListener("change", () => {
      p.from = fromEl.value;
      saveState();
    });
    toEl.addEventListener("change", () => {
      p.to = toEl.value;
      saveState();
    });

    // rows
    rowsTbody.innerHTML = "";
    p.rows.forEach((r) => {
      const rowNode = tplRow.content.cloneNode(true);
      const tr = rowNode.querySelector("tr");
      const custEl = rowNode.querySelector(".cust");
      const grossEl = rowNode.querySelector(".gross");
      const netEl = rowNode.querySelector(".net");
      const removeRowBtn = rowNode.querySelector(".removeRow");

      custEl.value = r.customer;
      grossEl.value = r.gross;
      netEl.value = r.net;

      custEl.addEventListener("input", () => {
        r.customer = custEl.value;
        saveState();
      });

      grossEl.addEventListener("input", () => {
        r.gross = grossEl.value;
        recalcAndRenderTotals();
        saveState();
      });

      netEl.addEventListener("input", () => {
        r.net = netEl.value;
        recalcAndRenderTotals();
        saveState();
      });

      removeRowBtn.addEventListener("click", () => {
        p.rows = p.rows.filter(x => x.id !== r.id);
        if (p.rows.length === 0) {
          p.rows.push({ id: crypto.randomUUID(), customer: "", gross: "", net: "" });
        }
        saveState();
        render(); // rerender for simplicity
      });

      rowsTbody.appendChild(tr);
    });

    addRowBtn.addEventListener("click", () => {
      p.rows.push({ id: crypto.randomUUID(), customer: "", gross: "", net: "" });
      saveState();
      render();
    });

    removePeriodBtn.addEventListener("click", () => {
      if (!confirm("Delete this period?")) return;
      state.periods = state.periods.filter(x => x.id !== p.id);
      if (state.periods.length === 0) state = defaultState();
      saveState();
      render();
    });

    // totals for this period
    const totals = calcPeriodTotals(p);
    totalGrossEl.textContent = fmt(totals.gross);
    totalNetEl.textContent = fmt(totals.net);
    myEurEl.textContent = fmt(totals.my);

    // small label on section (optional)
    section.dataset.index = String(idx + 1);

    elPeriods.appendChild(node);
  });

  // grand totals
  recalcAndRenderTotals();
}

function calcPeriodTotals(period) {
  const gross = period.rows.reduce((sum, r) => sum + parseMoney(r.gross), 0);
  const net = period.rows.reduce((sum, r) => sum + parseMoney(r.net), 0);
  const my = net * (clampRate(state.defaultRatePercent) / 100);
  return { gross, net, my };
}

function recalcAndRenderTotals() {
  // update each period footer (without full rerender) - easiest: recompute and rerender grand only
  const grand = state.periods.reduce(
    (acc, p) => {
      const t = calcPeriodTotals(p);
      acc.gross += t.gross;
      acc.net += t.net;
      acc.my += t.my;
      return acc;
    },
    { gross: 0, net: 0, my: 0 }
  );

  grandGrossEl.textContent = fmt(grand.gross);
  grandNetEl.textContent = fmt(grand.net);
  grandMyEl.textContent = fmt(grand.my);

  // also update visible period totals (simple approach: rerender all totals by re-rendering if needed)
  // For performance, we can update per-period totals by calling render() when rate changes; for input we do minimal.
  // We'll do a light refresh of period totals here:
  const periodSections = elPeriods.querySelectorAll(".period");
  periodSections.forEach((sec, i) => {
    const p = state.periods[i];
    if (!p) return;
    const t = calcPeriodTotals(p);
    sec.querySelector(".total-gross").textContent = fmt(t.gross);
    sec.querySelector(".total-net").textContent = fmt(t.net);
    sec.querySelector(".my-eur").textContent = fmt(t.my);
  });
}

/** ---------- events ---------- **/
defaultRateInput.addEventListener("input", () => {
  state.defaultRatePercent = clampRate(defaultRateInput.value);
  saveState();
  recalcAndRenderTotals();
});

addPeriodBtn.addEventListener("click", () => {
  state.periods.push({
    id: crypto.randomUUID(),
    from: "",
    to: "",
    rows: [{ id: crypto.randomUUID(), customer: "", gross: "", net: "" }],
  });
  saveState();
  render();
});

exportBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "client-totals-backup.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state = normalizeState(parsed);
    saveState();
    render();
    alert("Imported successfully.");
  } catch (e) {
    alert("Import failed. Please choose a valid backup JSON.");
  } finally {
    importInput.value = "";
  }
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset everything? This will delete all saved data on this device.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = defaultState();
  saveState();
  render();
});

/** ---------- init ---------- **/
render();