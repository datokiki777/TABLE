/* =========================================================
   Client Totals (Groups Edition) — GitHub Pages friendly
   ✅ Groups
   ✅ Edit / Review modes (Review default on first load)
   ✅ Grand totals: Active group / All groups
   ✅ Custom confirm modal fallback to window.confirm
   ✅ Export/Import:
       - Active group JSON
       - All groups JSON (MERGE or REPLACE)
   ✅ City field per client row
   ✅ PDF Export (ALL groups) via jsPDF
   ✅ Scroll-to-top
   ✅ Controls collapse toggle (mobile friendly)
   ✅ Floating "+ Client" button in Edit
========================================================= */

/* =========================
   1) Storage + DOM
========================= */

const STORAGE_KEY = "client_totals_groups_v1";
const CONTROLS_KEY = "ct_controls_collapsed";

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
const importLabel = document.getElementById("importLabel");
const importAllLabel = document.getElementById("importAllLabel");
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

/* =========================
   2) App State
========================= */

let appState = loadState();

/* =========================
   3) Utilities
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

        // ცარიელი რიგები არ ჩავაგდოთ ინდექსში
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
  const wrapEl = searchEl?.closest(".review-search") || null;

  if (!searchEl || !resultsEl) return;

  // თავიდან ვაკეთებთ ინდექსს ყოველ renderReview()-ზე (რომ ახლანდელი მონაცემები ეჭიროს)
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

  // ძებნა (name ან city)
  searchEl.oninput = () => {
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { hide(); return; }

    const filtered = index.filter(x =>
      (x.customer || "").toLowerCase().includes(q) ||
      (x.city || "").toLowerCase().includes(q)
    );

    renderResults(filtered);
  };

  // ESC -> clear
  searchEl.onkeydown = (e) => {
    if (e.key === "Escape") clear();
  };

  // გარეთ დაჭერა -> clear (როგორც გინდა შენ)
  document.addEventListener("pointerdown", (e) => {
    if (!wrapEl) return;
    if (wrapEl.contains(e.target)) return; // search-ზე თუ დააჭირა, არ გაწმინდოს
    clear();
  }, { passive: true });
}

/* =========================
   4) Confirm Modal (Yes/No)
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

    confirmNoBtn.onclick = () => {
      cleanup();
      resolve(false);
    };

    confirmYesBtn.onclick = () => {
      cleanup();
      resolve(true);
    };

    // Click outside -> No
    confirmBackdrop.onclick = (e) => {
      if (e.target === confirmBackdrop) {
        cleanup();
        resolve(false);
      }
    };

    // ESC -> No
    document.onkeydown = (e) => {
      if (e.key === "Escape") {
        cleanup();
        resolve(false);
      }
    };
  });
}

/* =========================
   5) Data Model
========================= */

function emptyRow() {
  return { id: uuid(), customer: "", city: "", gross: "", net: "" };
}

function defaultGroupData() {
  return {
    defaultRatePercent: 13.5,
    periods: [
      {
        id: uuid(),
        from: "",
        to: "",
        rows: [emptyRow()],
      },
    ],
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
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

/* =========================
   6) UI Helpers
========================= */

function syncBodyModeClass() {
  document.body.classList.toggle("is-edit", appState.uiMode === "edit");
}

function setControlsCollapsed(v) {
  document.body.classList.toggle("controls-collapsed", !!v);
  try {
    localStorage.setItem(CONTROLS_KEY, v ? "1" : "0");
  } catch {}
}

function initControlsToggle() {
  const saved = (() => {
    try {
      return localStorage.getItem(CONTROLS_KEY);
    } catch {
      return null;
    }
  })();

  const defaultCollapsed = window.matchMedia?.("(max-width: 720px)")?.matches ? true : false;
  setControlsCollapsed(saved === null ? defaultCollapsed : saved === "1");

  controlsToggle?.addEventListener("click", () => {
    const isCollapsed = document.body.classList.contains("controls-collapsed");
    setControlsCollapsed(!isCollapsed);
  });
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
  syncBodyModeClass();

  const enableAlways = [modeEditBtn, modeReviewBtn, totalsActiveBtn, totalsAllBtn, controlsToggle];

  // Review: only safe actions + group switch
  const enableInReview = [groupSelect, exportBtn, exportAllBtn, pdfAllBtn];

  // Edit: full control
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

  // Import labels hide in Review
  const importLabelEl = importInput?.closest("label");
  const importAllLabelEl = importAllInput?.closest("label");
  if (importLabelEl) importLabelEl.style.display = isEdit ? "" : "none";
  if (importAllLabelEl) importAllLabelEl.style.display = isEdit ? "" : "none";

  // PDF button only in Review
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
      renderReview(); // always refresh
    } else {
      reviewView.hidden = true;
      editView.hidden = false;
    }
  }

  setControlsForMode(appState.uiMode);
}

/* =========================
   7) Calculations
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

  if (grandGrossEl) grandGrossEl.textContent = fmt(grand.gross);
  if (grandNetEl) grandNetEl.textContent = fmt(grand.net);
  if (grandMyEl) grandMyEl.textContent = fmt(grand.my);

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
}

/* =========================
   8) Render: EDIT
========================= */

function render() {
  renderGroupSelect();
  updateGrandToggleUI();

  const g = activeGroup();
  const st = g.data;

  if (defaultRateInput) defaultRateInput.value = String(st.defaultRatePercent);

  // If templates missing, don't crash
  if (!elPeriods || !tplPeriod || !tplRow) {
    recalcAndRenderTotals();
    return;
  }

  elPeriods.innerHTML = "";

  st.periods.forEach((p, idx) => {
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

    if (fromEl) fromEl.value = p.from;
    if (toEl) toEl.value = p.to;

    fromEl?.addEventListener("change", () => {
      p.from = fromEl.value;
      saveState();
      if (appState.uiMode === "review") renderReview();
    });

    toEl?.addEventListener("change", () => {
      p.to = toEl.value;
      saveState();
      if (appState.uiMode === "review") renderReview();
    });

    // Rows
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

      custEl?.addEventListener("input", () => {
        r.customer = custEl.value;
        saveState();
      });

      cityEl?.addEventListener("input", () => {
        r.city = cityEl.value;
        saveState();
      });

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
}

/* =========================
   9) Render: REVIEW (with City)
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

  const periodsHtml = st.periods
    .map((p) => {
      const t = calcPeriodTotals(p, st.defaultRatePercent);
      const from = p.from || "—";
      const to = p.to || "—";

      const clients = p.rows
        .map((r) => {
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
        })
        .join("");

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
    })
    .join("");

  reviewView.innerHTML = header + periodsHtml;
  initReviewSearch(); // <-- ეს ხაზი დაამატე
}
  // --- Review Search wiring ---
  const searchEl = document.getElementById("reviewSearch");
  const resultsEl = document.getElementById("reviewSearchResults");

  if (searchEl && resultsEl) {
    const allRows = [];
    appState.groups.forEach((gr) => {
      gr.data.periods.forEach((p) => {
        p.rows.forEach((r) => {
          allRows.push({
            group: gr.name,
            from: p.from || "—",
            to: p.to || "—",
            customer: (r.customer || "").toString(),
            city: (r.city || "").toString(),
            gross: parseMoney(r.gross),
            net: parseMoney(r.net),
          });
        });
      });
    });

    const renderResults = (list) => {
      if (!list.length) {
        resultsEl.style.display = "block";
        resultsEl.innerHTML = `<div class="review-search-empty">No results</div>`;
        return;
      }

      resultsEl.style.display = "block";
      resultsEl.innerHTML = list.slice(0, 30).map(x => `
        <div class="review-search-item">
          <div class="review-search-name">${escapeHtml(x.customer || "Client")}</div>
          <div class="review-search-meta">
            <span><b>Group:</b> ${escapeHtml(x.group)}</span>
            <span><b>Period:</b> ${escapeHtml(x.from)} → ${escapeHtml(x.to)}</span>
            <span><b>City:</b> ${escapeHtml(x.city || "—")}</span>
            <span><b>Gross:</b> ${fmt(x.gross)}</span>
            <span><b>Net:</b> ${fmt(x.net)}</span>
          </div>
        </div>
      `).join("");
    };

    searchEl.addEventListener("input", () => {
      const q = searchEl.value.trim().toLowerCase();
      if (!q) {
        resultsEl.style.display = "none";
        resultsEl.innerHTML = "";
        return;
      }
      const filtered = allRows.filter(x =>
        x.customer.toLowerCase().includes(q) || x.city.toLowerCase().includes(q)
      );
      renderResults(filtered);
    });
  }

/* =========================
   10) File Helpers
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
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(
    d.getHours()
  )}${pad(d.getMinutes())}`;
}

/* =========================
   11) Import ALL — Merge logic
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
   12) PDF Export (ALL groups)
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

  // Small delay helps mobile browsers not freeze
  setTimeout(() => {
    try {
      doc.save(fileName);
    } catch (e) {
      console.error(e);
      alert("PDF export failed (download issue). Try Chrome.");
    }
  }, 150);
}

/* =========================
   13) Scroll-to-top
========================= */

function toggleToTop() {
  if (!toTopBtn) return;
  if (window.scrollY > 450) toTopBtn.classList.add("show");
  else toTopBtn.classList.remove("show");
}

/* =========================
   14) Keyboard detect (mobile)
========================= */

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
   15) Floating Add Client
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
   16) Event Wiring
========================= */

modeEditBtn?.addEventListener("click", () => setMode("edit"));
modeReviewBtn?.addEventListener("click", () => setMode("review"));

groupSelect?.addEventListener("change", () => {
  appState.activeGroupId = groupSelect.value;
  saveState();
  render();
  if (appState.uiMode === "review") renderReview();
});

// Add group
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

// Rename group
renameGroupBtn?.addEventListener("click", () => {
  const g = activeGroup();
  const name = prompt("New group name:", g.name);
  if (!name) return;

  g.name = name.toString().trim() || g.name;
  saveState();
  renderGroupSelect();
  if (appState.uiMode === "review") renderReview();
});

// Delete group (keep at least 1)
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

// Default %
defaultRateInput?.addEventListener("input", () => {
  const g = activeGroup();
  g.data.defaultRatePercent = clampRate(defaultRateInput.value);
  saveState();
  recalcAndRenderTotals();
  if (appState.uiMode === "review") renderReview();
});

// Add period
addPeriodBtn?.addEventListener("click", () => {
  const g = activeGroup();

  g.data.periods.push({
    id: uuid(),
    from: "",
    to: "",
    rows: [emptyRow()],
  });

  saveState();
  render();
  if (appState.uiMode === "review") renderReview();
});

// Reset CURRENT group only
resetBtn?.addEventListener("click", async () => {
  const g = activeGroup();
  const ok = await askConfirm(`Reset group "${g.name}"? This will clear all its data.`, "Reset group");
  if (!ok) return;

  g.data = defaultGroupData();
  saveState();
  render();
  if (appState.uiMode === "review") renderReview();
});

// Export ACTIVE group only
exportBtn?.addEventListener("click", () => {
  const g = activeGroup();
  const payload = { type: "client-totals-group-backup", version: 1, group: g };
  downloadJson(`client-totals-${safeFileName(g.name)}_${nowStamp()}.json`, payload);
});

// Import into CURRENT group (replaces its data)
importInput?.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (parsed?.type === "client-totals-group-backup" && parsed?.group?.data) {
      const g = activeGroup();
      const ok = await askConfirm(
        `Import will REPLACE data inside "${g.name}". Continue?`,
        "Import group"
      );
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

// Export ALL groups
exportAllBtn?.addEventListener("click", () => {
  const payload = {
    __type: "client_totals_all_groups",
    __ver: 1,
    exportedAt: new Date().toISOString(),
    data: appState,
  };
  downloadJson(`client-totals-ALL-groups_${nowStamp()}.json`, payload);
});

// Import ALL: MERGE or REPLACE
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

// Grand Total toggle
totalsActiveBtn?.addEventListener("click", () => {
  appState.grandMode = "active";
  saveState();
  updateGrandToggleUI();
  recalcAndRenderTotals();
});

totalsAllBtn?.addEventListener("click", () => {
  appState.grandMode = "all";
  saveState();
  updateGrandToggleUI();
  recalcAndRenderTotals();
});

// PDF ALL (Review only)
pdfAllBtn?.addEventListener("click", () => {
  if (!pdfAllBtn) return;

  pdfAllBtn.disabled = true;
  const oldText = pdfAllBtn.textContent;
  pdfAllBtn.textContent = "Generating PDF...";

  setTimeout(() => {
    try {
      exportPdfAllGroups();
    } finally {
      setTimeout(() => {
        pdfAllBtn.disabled = false;
        pdfAllBtn.textContent = oldText;
      }, 1200);
    }
  }, 50);
});

// Scroll-to-top
window.addEventListener("scroll", toggleToTop);
toggleToTop();

toTopBtn?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Floating add client
fabAddClient?.addEventListener("click", () => {
  if (appState.uiMode !== "edit") return;
  addClientToLastPeriod();
});

/* =========================
   17) Init
========================= */

// Review default ONLY first-time (already handled by defaultAppState())
// so: do NOT overwrite every time.

initControlsToggle();
render();
setMode("review");

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js').then(reg => {

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {

          document.getElementById("updateBox").style.display = "block";

          document.getElementById("updateBtn").onclick = () => {
            window.location.reload();
          };

        }
      });

    });

  });
}

