const DATA_URL = "data/dashboard.json";

const palette = ["#2563eb", "#16a34a", "#f59e0b", "#7c3aed", "#64748b", "#0f766e", "#dc2626"];

const state = {
  data: null,
  currentOperation: null,
};

const $ = (id) => document.getElementById(id);

function fidelityFromError(error) {
  return error == null ? null : 100 - Number(error);
}

function fmtPct(value, digits = 2) {
  return value == null ? "—" : `${Number(value).toFixed(digits)}%`;
}

function fmtDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function statusLabel(status) {
  const labels = {
    ON_TRACK: "On track",
    AT_RISK: "At risk",
    INCOMPLETE: "Incomplete",
    NOT_POPULATED: "Not populated",
  };
  return labels[status] || status || "—";
}

function statusClass(status) {
  if (status === "ON_TRACK") return "good";
  if (status === "AT_RISK") return "risk";
  return "partial";
}

function evidenceClass(label = "") {
  const normalized = label.toLowerCase();
  if (normalized.includes("measured") && normalized.includes("sim")) return "hybrid";
  if (normalized.includes("measured")) return "measured";
  if (normalized.includes("sim")) return "simulated";
  if (normalized.includes("estimated") || normalized.includes("mixed")) return "derived";
  if (normalized.includes("unknown")) return "unknown";
  return "derived";
}

function sourceBadge(text) {
  return `<span class="evidence-badge ${evidenceClass(text)}">${text || "Unknown"}</span>`;
}

function renderOverview() {
  const list = $("operationList");
  list.innerHTML = "";

  state.data.operations.forEach((op) => {
    const fidelity = fidelityFromError(op.current_error_pct);
    const target = fidelityFromError(op.spec_error_pct);
    const row = document.createElement("button");
    row.type = "button";
    row.className = `operation-row ${op.id === "2q" ? "featured" : ""}`;
    row.dataset.operation = op.id;
    row.innerHTML = `
      <span class="operation-cell identity">
        <span class="operation-icon">${op.icon}</span>
        <span><strong>${op.short_name}</strong><small>${op.maturity === "PLACEHOLDER" ? "Awaiting approved snapshot" : op.maturity}</small></span>
      </span>
      <span class="operation-cell metric"><strong>${fmtPct(fidelity)}</strong><small>${fidelity == null ? "Not yet available" : "Fidelity"}</small></span>
      <span class="operation-cell metric"><strong>${fmtPct(target)}</strong><small>${target == null ? "Not set" : "Fidelity"}</small></span>
      <span class="operation-cell"><span class="status-badge ${statusClass(op.status)}">${statusLabel(op.status)}</span></span>
      <span class="operation-cell date-cell"><strong>${fmtDate(op.live_at)}</strong><small>${op.live_at ? "latest source" : "not populated"}</small></span>
      <span class="operation-cell action-cell"><span class="open-button">Abrir página <span>→</span></span></span>
    `;
    row.addEventListener("click", () => openOperation(op.id));
    list.appendChild(row);
  });
}

function openOperation(id, pushHash = true) {
  const op = state.data.operations.find((item) => item.id === id) || state.data.operations.find((item) => item.id === "2q");
  state.currentOperation = op;

  $("overviewView").hidden = true;
  $("operationView").hidden = false;
  $("breadcrumbOperation").textContent = op.short_name;
  $("operationIcon").textContent = op.icon;
  $("operationTitle").textContent = op.title;
  $("operationDescription").textContent = op.description;

  const context = [
    `QPU: ${state.data.site.qpu}`,
    `Status: ${statusLabel(op.status)}`,
  ];
  if (op.protocol) context.splice(1, 0, `Protocol: ${op.protocol}`);
  if (op.snapshot_id) context.push(`Snapshot: ${op.snapshot_id}`);
  $("contextPills").innerHTML = context.map((item) => `<span>${item}</span>`).join("");

  renderKpis(op);
  renderDashboard(op);
  renderPerformance(op);
  renderBudgetDetails(op);
  renderHistory(op);
  closeAllAccordions();

  if (pushHash) history.replaceState(null, "", `#operation=${encodeURIComponent(op.id)}`);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showOverview(pushHash = true) {
  state.currentOperation = null;
  $("operationView").hidden = true;
  $("overviewView").hidden = false;
  if (pushHash) history.replaceState(null, "", "#overview");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderKpis(op) {
  const fidelity = fidelityFromError(op.current_error_pct);
  const target = fidelityFromError(op.spec_error_pct);
  $("currentFidelity").textContent = fmtPct(fidelity);
  $("currentFidelitySub").textContent = fidelity == null
    ? "No quantitative snapshot is asserted"
    : `derived from synthetic ε = ${fmtPct(op.current_error_pct, 2)}`;
  $("bestObserved").textContent = "—";
  $("bestObservedNote").textContent = "Not populated in this dataset";
  $("targetFidelity").textContent = fmtPct(target);
  $("targetNote").textContent = target == null ? "No approved target in V3 data" : "converted from V2 error spec";
  $("lastUpdate").textContent = fmtDate(op.live_at);
  $("snapshotStatus").textContent = op.snapshot_status || op.scientific_acceptance || "—";
}

function renderDashboard(op) {
  const quantified = op.current_error_pct != null;
  $("quantifiedDashboard").hidden = !quantified;
  $("partialDashboard").hidden = quantified;

  if (!quantified) {
    $("partialTitle").textContent = `${op.short_name}: quantitative budget not yet closed`;
    $("partialText").textContent = op.description;
    const facts = [
      ["Known attribution", op.known_attribution_pct == null ? "—" : fmtPct(op.known_attribution_pct, 0)],
      ["Unknown", op.unknown_pct == null ? "—" : fmtPct(op.unknown_pct, 0)],
      ["Owner", op.owner || "—"],
      ["Reviewer", op.reviewer || "—"],
      ["Main gap", op.main_gap || "—"],
      ["Next target", op.main_target || "—"],
    ];
    $("partialFacts").innerHTML = facts.map(([k, v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("");
    return;
  }

  renderTrend(op);
  renderStackedBudget(op);
}

function renderTrend(op) {
  const historyData = op.history || [];
  if (historyData.length <= 1) {
    const fidelity = fidelityFromError(op.current_error_pct);
    $("trendArea").innerHTML = `
      <div class="single-point-chart" aria-label="Single current fidelity snapshot">
        <div class="chart-grid"><span>100%</span><span>99%</span><span>98%</span><span>97%</span></div>
        <div class="single-point" style="--y:${Math.max(8, Math.min(88, (100 - fidelity) * 30 + 16))}%">
          <span class="point-dot"></span><strong>${fmtPct(fidelity)}</strong><small>${fmtDate(op.live_at)}</small>
        </div>
      </div>
      <p class="empty-history">Historical data not yet populated. V3 does not fabricate a trend from a single snapshot.</p>
    `;
    return;
  }

  const values = historyData.map((h) => h.fidelity_pct);
  const min = Math.min(...values) - 0.2;
  const max = Math.max(...values) + 0.2;
  const points = historyData.map((h, i) => {
    const x = historyData.length === 1 ? 50 : 6 + (i / (historyData.length - 1)) * 88;
    const y = 88 - ((h.fidelity_pct - min) / (max - min)) * 72;
    return `${x},${y}`;
  }).join(" ");
  $("trendArea").innerHTML = `<svg viewBox="0 0 100 100" class="trend-svg" preserveAspectRatio="none"><polyline points="${points}" fill="none" stroke="currentColor" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
}

function renderStackedBudget(op) {
  const contributors = op.contributors || [];
  $("budgetCompleteness").textContent = `Completitud: ${fmtPct(op.known_attribution_pct, 0)} atribuible`;
  $("stackedBudget").innerHTML = contributors.map((c, i) => {
    const label = c.share_pct >= 9 ? `${c.share_pct}%` : "";
    return `<span class="budget-segment" style="width:${c.share_pct}%;background:${palette[i % palette.length]}" title="${c.name}: ${c.share_pct}% del error total"><b>${label}</b></span>`;
  }).join("");
  $("budgetLegend").innerHTML = contributors.map((c, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${c.name}<strong>${c.share_pct}%</strong></span>`).join("");
  $("compositionWarning").textContent = op.composition_method
    ? `Método: ${op.attribution_method || op.composition_method}. Esta vista 0–100% sólo es válida para este accounting sintético aditivo.`
    : "No hay método de composición cerrado; no se fuerza un camembert ni una suma a 100%.";
}

function renderPerformance(op) {
  const fidelity = fidelityFromError(op.current_error_pct);
  const rows = [
    ["Observed fidelity", fmtPct(fidelity), fidelity == null ? "Unknown" : "Synthetic / derived"],
    ["Corrected / postselected", fmtPct(op.corrected_fidelity_pct), op.corrected_fidelity_pct == null ? "Not populated" : "Post-processed"],
    ["Benchmark", op.benchmark || "—", op.benchmark ? "Measured" : "Not populated"],
    ["Uncertainty", op.uncertainty_error_pp == null ? "—" : `±${op.uncertainty_error_pp.toFixed(2)} pp`, op.uncertainty_error_pp == null ? "Unknown" : "Synthetic"],
    ["Convention", op.metric_convention || (fidelity == null ? "—" : "Fidelity = 1 − error"), "Convention"],
    ["Measurement chain", op.measurement_chain || "—", op.measurement_chain ? "Synthetic" : "Not populated"],
  ];
  $("performanceContent").innerHTML = `
    <div class="detail-table-wrap">
      <table class="detail-table performance-table">
        <thead><tr><th>Field</th><th>Value</th><th>Evidence / convention</th></tr></thead>
        <tbody>${rows.map(([a,b,c]) => `<tr><td>${a}</td><td><strong>${b}</strong></td><td>${sourceBadge(c)}</td></tr>`).join("")}</tbody>
      </table>
    </div>
    <div class="info-note compact"><span class="info-icon">i</span><span>La capa visible privilegia Fidelity. La magnitud de error <strong>ε = 1 − F</strong> se conserva en el nivel técnico cuando es necesaria para la descomposición.</span></div>
  `;
}

function renderBudgetDetails(op) {
  if (!op.contributors || op.contributors.length === 0) {
    $("budgetContent").innerHTML = `<div class="empty-detail"><strong>No contributor table yet.</strong><p>${op.main_gap || "This operation has not been decomposed."}</p></div>`;
    return;
  }

  const rows = op.contributors.map((c) => `
    <tr>
      <td><strong>${c.name}</strong></td>
      <td>${c.impact_error_pp == null ? "—" : `${Number(c.impact_error_pp).toFixed(4)} pp`}</td>
      <td><strong>${fmtPct(c.share_pct, 1)}</strong></td>
      <td>${sourceBadge(c.evidence)}</td>
      <td><span class="confidence ${String(c.confidence || "").toLowerCase()}">${c.confidence || "—"}</span></td>
      <td>${c.owner || "—"}</td>
    </tr>
  `).join("");

  const modelCard = op.model_vs_experiment
    ? `<div class="model-card"><span>MODEL ↔ EXPERIMENT</span><strong>${op.model_vs_experiment.experiment}</strong><b>vs</b><strong>${op.model_vs_experiment.simulation}</strong></div>`
    : `<div class="model-card muted"><span>MODEL ↔ EXPERIMENT</span><strong>Not evaluated for this snapshot</strong><small>V3 deliberately does not mix model-matching numbers from another campaign or protocol.</small></div>`;

  $("budgetContent").innerHTML = `
    <div class="detail-table-wrap">
      <table class="detail-table">
        <thead><tr><th>Contributor</th><th>Impacto abs.</th><th>% del error total</th><th>Evidencia</th><th>Confidence</th><th>Owner</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="budget-detail-footer">
      <div class="method-card"><span>Attribution method</span><strong>${op.attribution_method || op.composition_method || "Not yet closed"}</strong><small>${op.main_target || "—"}</small></div>
      ${modelCard}
    </div>
  `;
}

function renderHistory(op) {
  const historyData = op.history || [];
  const snapshotRows = historyData.length
    ? historyData.map((h) => `<tr><td>${fmtDate(h.date)}</td><td><code>${h.snapshot || "—"}</code></td><td>${state.data.site.qpu}</td><td>${op.protocol || op.operating_point || "—"}</td><td>${fmtPct(h.fidelity_pct)}</td><td><span class="status-badge good">${h.status || "CURRENT"}</span></td></tr>`).join("")
    : `<tr><td colspan="6" class="empty-cell">No snapshot history populated in V3.</td></tr>`;

  const provenance = [
    ["Operating point", op.operating_point || "—"],
    ["Owner", op.owner || "—"],
    ["Reviewer", op.reviewer || "—"],
    ["Accepted", fmtDate(op.accepted_at)],
    ["Scientific acceptance", op.scientific_acceptance || "—"],
    ["Model confidence", op.model_confidence || "—"],
  ];

  $("historyContent").innerHTML = `
    <div class="history-grid">
      <div>
        <span class="eyebrow">Snapshots</span>
        <div class="detail-table-wrap">
          <table class="detail-table snapshot-table">
            <thead><tr><th>Date</th><th>Snapshot</th><th>QPU</th><th>Protocol / config</th><th>Fidelity</th><th>Status</th></tr></thead>
            <tbody>${snapshotRows}</tbody>
          </table>
        </div>
      </div>
      <aside class="provenance-card">
        <span class="eyebrow">Provenance</span>
        ${provenance.map(([k,v]) => `<div><span>${k}</span><strong>${v}</strong></div>`).join("")}
      </aside>
    </div>
    <div class="info-note compact"><span class="info-icon">i</span><span>History is append-only by design. V3 currently contains only the snapshot(s) explicitly present in its own dataset; older or cross-protocol values are not synthesized into a fake time series.</span></div>
  `;
}

function closeAllAccordions() {
  document.querySelectorAll(".accordion-trigger").forEach((trigger) => {
    trigger.setAttribute("aria-expanded", "false");
    trigger.querySelector(".chevron").textContent = "▶";
    trigger.querySelector(".click-hint").textContent = "Click para desplegar";
    const panel = document.getElementById(trigger.getAttribute("aria-controls"));
    panel.hidden = true;
  });
}

function bindAccordions() {
  document.querySelectorAll(".accordion-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const expanded = trigger.getAttribute("aria-expanded") === "true";
      const panel = document.getElementById(trigger.getAttribute("aria-controls"));
      trigger.setAttribute("aria-expanded", String(!expanded));
      trigger.querySelector(".chevron").textContent = expanded ? "▶" : "▼";
      trigger.querySelector(".click-hint").textContent = expanded ? "Click para desplegar" : "Click para cerrar";
      panel.hidden = expanded;
    });
  });
}

function routeFromHash() {
  const match = window.location.hash.match(/operation=([^&]+)/);
  if (match) openOperation(decodeURIComponent(match[1]), false);
  else showOverview(false);
}

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    renderOverview();
    bindAccordions();
    $("backToOverview").addEventListener("click", () => showOverview());
    window.addEventListener("hashchange", routeFromHash);
    routeFromHash();
  } catch (error) {
    console.error(error);
    document.body.innerHTML = `<main class="fatal"><h1>Error Budgets V3</h1><p>No se pudo cargar <code>${DATA_URL}</code>.</p><pre>${String(error)}</pre></main>`;
  }
}

init();
