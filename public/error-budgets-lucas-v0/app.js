const state = {
  data: null,
  build: null,
  route: "overview",
  selectedOperation: "2q"
};

const palette = ["#45478d","#35628e","#327d91","#26938d","#24a47c","#48b765","#82c746","#b5d62d"];

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];

function esc(value){
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}
function pct(v, digits=1){ return v == null ? "—" : `${(v*100).toFixed(digits)}%`; }
function probability(v){
  if(v == null) return "—";
  return v >= .01 ? v.toFixed(4) : v.toExponential(2);
}
function formatDate(s){
  if(!s) return "—";
  const d = new Date(`${s}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB",{day:"2-digit",month:"short",year:"numeric"}).format(d);
}
function badge(text, kind="tbd"){ return `<span class="badge ${kind}">${esc(text)}</span>`; }
function confidenceBadge(v){
  const k = v==="HIGH" ? "high-confidence" : v==="MEDIUM" ? "medium-confidence" : "low-confidence";
  return badge(v,k);
}
function technicalBadge(v){
  const k = v==="PASS" ? "pass" : v==="WATCH" ? "watch" : v==="FAIL" ? "fail" : "incomplete";
  return badge(v,k);
}
function evidenceBadge(v){
  const map = {Measured:"ok",Simulated:"partial",Estimated:"watch",Literature:"partial",Unknown:"unknown"};
  return badge(v,map[v]||"tbd");
}
function severityBadge(v){ return badge(v, v==="HIGH"?"high":v==="MEDIUM"?"watch":"ok"); }
function operationById(id){ return state.data.operations.find(o=>o.id===id); }
function isPilot(op){ return op.total_error != null; }
function topContributor(op){
  if(!isPilot(op)) return null;
  return [...op.contributors].filter(c=>!c.name.startsWith("Unknown")).sort((a,b)=>b.share-a.share)[0];
}
function freshnessDays(date){
  if(!date) return null;
  const a = new Date(date+"T00:00:00Z");
  const b = new Date(state.data.meta.generated_at);
  return Math.floor((b-a)/86400000);
}
function validationFor(op){
  if(!isPilot(op)) return {
    overall:"INCOMPLETE",
    checks:[
      ["Quantitative budget","NOT AVAILABLE","incomplete"],
      ["KPI contract",op.kpi ? "PRESENT":"MISSING",op.kpi?"pass":"fail"],
      ["Owner",op.owner && !op.owner.startsWith("TBD") ? "PRESENT":"MISSING",op.owner && !op.owner.startsWith("TBD")?"pass":"fail"],
      ["Technical source","CONTRACT READY","watch"]
    ]
  };
  const sumAbs=op.contributors.reduce((s,c)=>s+c.absolute,0);
  const sumShare=op.contributors.reduce((s,c)=>s+c.share,0);
  const arithmetic=Math.abs(sumAbs-op.total_error)<1e-12;
  const shares=Math.abs(sumShare-1)<1e-9;
  const metadata=op.contributors.every(c=>c.id && c.owner && c.method && c.evidence_class && c.evidence_date);
  const unknown=op.contributors.some(c=>c.name.includes("Unknown"));
  const fresh=freshnessDays(op.last_evidence_date) <= 30;
  const overall = arithmetic && shares && metadata && unknown ? "WATCH" : "FAIL";
  return {
    overall,
    checks:[
      ["Arithmetic closure", arithmetic?"PASS":"FAIL", arithmetic?"pass":"fail"],
      ["0–100% share closure", shares?"PASS":"FAIL", shares?"pass":"fail"],
      ["Required provenance fields", metadata?"PASS":"FAIL", metadata?"pass":"fail"],
      ["Unknown residual represented", unknown?"PASS":"FAIL", unknown?"pass":"fail"],
      ["Evidence freshness (<30 d)", fresh?"PASS":"STALE", fresh?"pass":"watch"],
      ["Scientific acceptance","NOT AUTOMATED","watch"]
    ]
  };
}
function updateNav(){
  $$(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.route===state.route));
}
function setRoute(route, opId){
  state.route=route;
  if(opId) state.selectedOperation=opId;
  updateNav();
  render();
  window.scrollTo({top:0,behavior:"instant"});
}
function readHash(){
  const raw=location.hash.replace(/^#/,"");
  if(raw.startsWith("operations/")){
    state.route="operations";
    state.selectedOperation=raw.split("/")[1]||"2q";
  }else if(["overview","operations","targets","changes","trust"].includes(raw)){
    state.route=raw;
  }
}
function pushRoute(route, opId){
  const hash=route==="operations"&&opId ? `operations/${opId}` : route;
  history.pushState(null,"",`#${hash}`);
  setRoute(route,opId);
}

function renderProgramStrip(){
  const p=state.data.program;
  return `<div class="program-strip" aria-label="Program status">
    <div class="metric-cell"><div class="metric-value">${p.scope_count}</div><div class="metric-label">operations in scope</div></div>
    <div class="metric-cell"><div class="metric-value">${p.runnable_pilots}</div><div class="metric-label">runnable quantitative pilots</div></div>
    <div class="metric-cell"><div class="metric-value">${p.quantification_pending}</div><div class="metric-label">quantification pending / partial</div></div>
    <div class="metric-cell"><div class="metric-value">${p.ranked_gaps}</div><div class="metric-label">ranked program gaps</div></div>
    <div class="metric-cell"><div class="metric-value">${badge("PASS","pass")}</div><div class="metric-label">deployment build gate</div></div>
  </div>`;
}
function renderAttention(){
  const items=state.data.attention.map(a=>`<div class="attention-item">
    <span class="attention-dot ${a.level==="HIGH"?"high":""}"></span>
    <div>
      <div class="attention-title">${esc(a.title)}</div>
      <div class="attention-meta">${esc(a.owner)} · ${badge(a.category,a.category==="FOLLOW-UP"?"follow-up":"ok")}</div>
      <div class="attention-msg">${esc(a.message)}</div>
    </div>
  </div>`).join("");
  return `<section class="section attention-panel">
    <div class="attention-head"><strong>Needs attention now</strong><span class="small muted">Program synthesis — no manual cross-reading required</span></div>
    <div class="attention-list">${items}</div>
  </section>`;
}
function opCard(op){
  const pilot=isPilot(op);
  const quantitative = pilot ? `<div class="op-primary">
      <div><strong>${pct(op.fidelity,2)}</strong><small>${esc(op.kpi_symbol)} · current</small></div>
      <div><strong>${pct(op.total_error,2)}</strong><small>ε = 1 − F</small></div>
      <div><strong>${pct(op.unknown_share,0)}</strong><small>unknown</small></div>
    </div>` : `<div class="op-primary">
      <div><strong>—</strong><small>current quantitative KPI</small></div>
      <div><strong>${esc(op.maturity)}</strong><small>V0 maturity</small></div>
    </div>`;
  return `<article class="op-card ${pilot?"pilot":"pending"}">
    <div class="op-card-head"><div><h3>${esc(op.name)}</h3><div class="op-kpi">KPI · ${esc(op.kpi)}</div></div>${technicalBadge(op.technical_state)}</div>
    ${quantitative}
    <dl class="op-detail-list">
      <dt>Owner</dt><dd>${esc(op.owner)}</dd>
      <dt>Last evidence</dt><dd>${op.last_evidence_date?`${formatDate(op.last_evidence_date)} · ${esc(op.last_evidence)}`:"Not yet recorded"}</dd>
      <dt>Main gap</dt><dd>${esc(op.main_gap)}</dd>
      <dt>Next</dt><dd>${esc(op.next_action)}</dd>
    </dl>
    <button class="card-action" data-open-op="${esc(op.id)}">Open operation →</button>
  </article>`;
}
function renderOverview(){
  const gaps=state.data.top_gaps.slice(0,5).map(g=>`<tr>
    <td class="rank">#${g.rank}</td><td><strong>${esc(g.gap)}</strong><div class="small muted">${esc(g.next_action)}</div></td>
    <td>${esc(g.operation)}</td><td>${severityBadge(g.severity)}</td><td>${esc(g.owner)}</td>
  </tr>`).join("");
  const changes=state.data.activity.slice(0,5).map(a=>`<li><strong>${formatDate(a.date)} · ${esc(a.operation)}</strong><br><span class="muted">${esc(a.actor)} — ${esc(a.action)}</span></li>`).join("");
  return `
    ${renderProgramStrip()}
    ${renderAttention()}
    <section class="section">
      <div class="section-header"><div><h2>Operations</h2><div class="section-kicker">Operation first: KPI → error decomposition → owner → gap → next action</div></div><button class="secondary-button" data-route-link="operations">See all operations</button></div>
      <div class="ops-grid">${state.data.operations.map(opCard).join("")}</div>
    </section>
    <section class="section two-col">
      <div class="panel">
        <div class="panel-head"><h3>Since last review</h3><span class="small muted">Material program records</span></div>
        <div class="panel-body"><ul class="change-list">${changes}</ul></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Top Gaps</h3><span class="small muted">Missing inputs / open questions ≠ biggest contributor</span></div>
        <div class="table-wrap"><table class="gap-table"><thead><tr><th>#</th><th>Gap / next</th><th>Operation</th><th>Impact</th><th>Owner</th></tr></thead><tbody>${gaps}</tbody></table></div>
      </div>
    </section>
    <section class="section panel">
      <div class="panel-head"><h3>How this program is maintained</h3><span>${badge("MONTHLY CYCLE","live")}</span></div>
      <div class="panel-body trust-grid">
        <div><strong class="small">DOMAIN OWNER</strong><p class="small muted">Contributes the local scientific fact: value, uncertainty, operating point, method, evidence and validity date.</p></div>
        <div><strong class="small">REVIEWER</strong><p class="small muted">Checks scientific meaning and provenance before a contribution becomes accepted.</p></div>
        <div><strong class="small">PROGRAM DRI / SYSTEM</strong><p class="small muted">Maintains common contract, cross-operation consistency, explicit gaps, build path and review cadence. The machine regenerates totals and views.</p></div>
      </div>
    </section>`;
}

function operationSelector(){
  return `<div class="section-header">
    <div><h2>Operations</h2><div class="section-kicker">Two quantitative pilots; four contracts deliberately incomplete</div></div>
    <select id="operationSelect" aria-label="Choose operation">${state.data.operations.map(o=>`<option value="${o.id}" ${o.id===state.selectedOperation?"selected":""}>${esc(o.name)} — ${esc(o.maturity)}</option>`).join("")}</select>
  </div>`;
}
function renderOperationHeader(op){
  const pilot=isPilot(op);
  let sentence;
  if(pilot){
    const top=topContributor(op);
    sentence=`Current synthetic ${op.name} state: ${pct(op.fidelity,2)} fidelity (ε = ${pct(op.total_error,2)}). Main attributed contributor: ${top.name} at ${pct(top.share,0)} of total operation error; ${pct(op.unknown_share,0)} remains Unknown / Unassigned.`;
  } else {
    sentence=`${op.name} is intentionally not shown with a fake quantitative budget. The KPI contract exists, but the inputs required for a defensible decomposition are still incomplete.`;
  }
  return `<section class="operation-header">
    <div class="breadcrumb">Error Budgets V0 → Operations → ${esc(op.name)}</div>
    <div class="operation-title-row">
      <div><h2>${esc(op.name)} ${pilot?"Error Budget":""}</h2><p class="operation-kpi-line"><strong>KPI:</strong> ${esc(op.kpi)} ${op.kpi_symbol?`(${esc(op.kpi_symbol)})`:""}</p></div>
      <div>${badge(op.maturity,pilot?"live":"incomplete")} ${technicalBadge(op.technical_state)}</div>
    </div>
    <div class="status-sentence"><strong>What matters here:</strong> ${esc(sentence)}</div>
    <div class="operation-metrics">
      <div class="operation-metric"><strong>${pilot?pct(op.fidelity,2):"—"}</strong><span>Current fidelity F</span></div>
      <div class="operation-metric"><strong>${pilot?pct(op.total_error,2):"—"}</strong><span>Infidelity ε = 1 − F</span></div>
      <div class="operation-metric"><strong>${pilot?`± ${pct(op.uncertainty,3)}`:"—"}</strong><span>Synthetic uncertainty</span></div>
      <div class="operation-metric"><strong>${pilot?pct(op.known_share,0):"—"}</strong><span>Known attribution</span></div>
      <div class="operation-metric"><strong>${pilot?pct(op.unknown_share,0):"—"}</strong><span>Unknown residual</span></div>
      <div class="operation-metric"><strong>${op.future_target==null?"Not defined":pct(op.future_target,2)}</strong><span>Future target</span></div>
    </div>
  </section>`;
}
function renderStack(op){
  const segments=op.contributors.map((c,i)=>{
    const unknown=c.name.startsWith("Unknown");
    return `<div class="stack-segment ${unknown?"unknown-segment":""}" style="height:${c.share*100}%;background:${unknown?"":palette[i%palette.length]}" title="${esc(c.name)} — ${pct(c.share,1)}">${c.share>=.10?pct(c.share,1):""}</div>`;
  }).join("");
  const legend=op.contributors.map((c,i)=>{
    const unknown=c.name.startsWith("Unknown");
    return `<div class="legend-item"><span class="legend-swatch ${unknown?"unknown":""}" ${unknown?"":`style="background:${palette[i%palette.length]}"`}></span><span>${esc(c.name)}</span><span class="legend-share">${pct(c.share,1)}</span></div>`;
  }).join("");
  return `<div class="budget-figure">
    <div class="stack-frame"><span class="stack-axis">Share of total operation infidelity (%)</span><div class="stack">${segments}</div></div>
    <div class="legend"><div class="small muted"><strong>100% decomposition of tracked synthetic error</strong><br>Absolute ε = ${probability(op.total_error)} · F = ${pct(op.fidelity,2)}</div>${legend}</div>
    <div class="figure-caption">Contributor percentages are fractions of the total operation infidelity, not raw characterization values. Unknown / Unassigned is part of the 100% stack by design.</div>
  </div>`;
}
function renderValidity(op){
  const v=validationFor(op);
  const rows=v.checks.map(([name,result,kind])=>`<div class="validity-grid"><span class="validity-label">${esc(name)}</span>${badge(result,kind)}</div>`).join("");
  return `<div class="panel">
    <div class="panel-head"><h3>Validity monitor</h3>${technicalBadge(v.overall)}</div>
    <div class="panel-body">
      ${rows}
      <div class="validity-grid"><span class="validity-label">Operating point</span><strong class="small">${esc(op.operating_point)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Composition method</span><strong class="small">${esc(op.composition_method)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Last evidence</span><strong class="small">${op.last_evidence_date?formatDate(op.last_evidence_date):"—"}</strong></div>
      <div class="validity-grid"><span class="validity-label">Owner</span><strong class="small">${esc(op.owner)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Reviewer</span><strong class="small">${esc(op.reviewer)}</strong></div>
      <p class="validity-note"><strong>DEMO RULE RESULT.</strong> Arithmetic and metadata checks are genuinely computed from this JSON. Scientific acceptance is never inferred by the browser.</p>
    </div>
  </div>`;
}
function renderPipeline(op){
  const nodes=[
    ["Characterization / evidence",op.last_evidence_date?`${op.last_evidence} · ${formatDate(op.last_evidence_date)}`:"Required evidence not yet normalized"],
    ["Low-level model",isPilot(op)?op.operating_point:"Model / operating point pending"],
    ["Error mapping",isPilot(op)?op.composition_method:"Mapping to operation KPI pending"],
    ["Operation Error Budget",isPilot(op)?`${pct(op.total_error,2)} total infidelity · ${pct(op.unknown_share,0)} unknown`:"Quantification pending"],
    ["Improvement target",isPilot(op)?op.next_action:op.main_gap]
  ];
  return `<section class="section">
    <div class="section-header"><div><h2>Evidence → model → budget → improvement</h2><div class="section-kicker">Compact causal chain inspired by the technical workflow, not a decorative process diagram</div></div></div>
    <div class="pipeline">${nodes.map(([a,b])=>`<div class="pipe-node"><strong>${esc(a)}</strong><span>${esc(b)}</span></div>`).join("")}</div>
  </section>`;
}
function renderContributorTable(op){
  const rows=op.contributors.map(c=>`<tr class="${c.name.startsWith("Unknown")?"unknown-row":""}">
    <td><strong>${esc(c.name)}</strong><div class="small mono muted">${esc(c.id)}</div></td>
    <td>${pct(c.share,1)}</td><td class="mono">${probability(c.absolute)}</td><td class="mono">${c.uncertainty==null?"—":`± ${probability(c.uncertainty)}`}</td>
    <td>${esc(c.owner)}</td><td>${confidenceBadge(c.confidence)}</td><td>${evidenceBadge(c.evidence_class)}</td><td>${formatDate(c.evidence_date)}</td>
    <td><button class="click-evidence" data-evidence="${esc(c.id)}">Inspect</button></td>
  </tr>`).join("");
  return `<section class="section panel">
    <div class="panel-head"><h3>Contributors — evidence & accountability ledger</h3><span class="small muted">Probability units; share = fraction of total ε</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Contributor</th><th>Share</th><th>Absolute ε</th><th>Uncertainty</th><th>Owner</th><th>Confidence</th><th>Evidence</th><th>Updated</th><th>Source</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="panel-body action-row">
      <button class="primary-button" data-propose-op="${esc(op.id)}">Contribute update</button>
      <button class="secondary-button" data-review-op="${esc(op.id)}">Review pending change</button>
      <span class="small muted">Prototype simulation only: browser actions never modify the canonical JSON.</span>
    </div>
  </section>`;
}
function renderOperationChanges(op){
  const changes=(op.changes||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  const relatedTargets=state.data.improvement_targets.filter(t=>t.operation.includes(op.name.split(" ")[0]) || (op.id==="1q"&&t.operation.includes("1Q")) || (op.id==="2q"&&t.operation.includes("2Q"))).slice(0,3);
  return `<section class="section two-col">
    <div class="panel"><div class="panel-head"><h3>What changed / what is still open</h3><span class="small muted">No invented numeric trend</span></div><div class="panel-body"><ul class="change-list">${changes}</ul></div></div>
    <div class="panel"><div class="panel-head"><h3>Key improvement targets</h3><span class="small muted">Ranked by actionability, not magnitude alone</span></div><div class="panel-body"><ul class="simple-list">${
      relatedTargets.length?relatedTargets.map(t=>`<li><strong>${esc(t.target)}</strong><br><span class="muted">Owner ${esc(t.owner)} · Gᵢ ${t.achievable_gain==null?"not yet quantified":esc(t.achievable_gain)} · ${esc(t.next_test)}</span></li>`).join(""):`<li>No quantified improvement target yet. Closing the operation contract is the priority.</li>`
    }</ul></div></div>
  </section>`;
}
function renderPendingOperation(op){
  return `${renderOperationHeader(op)}
    <section class="section pending-hero">
      <div class="pending-card"><h3>Why there is no stacked Error Budget yet</h3><p class="small muted">The interface deliberately refuses to turn missing inputs into zeros. A V0 contract can exist before the quantitative budget is closed.</p>
        <dl class="op-detail-list"><dt>Owner</dt><dd>${esc(op.owner)}</dd><dt>Reviewer</dt><dd>${esc(op.reviewer)}</dd><dt>Main gap</dt><dd>${esc(op.main_gap)}</dd><dt>Next action</dt><dd>${esc(op.next_action)}</dd><dt>Last evidence</dt><dd>${op.last_evidence_date?`${formatDate(op.last_evidence_date)} · ${esc(op.last_evidence)}`:"Not recorded"}</dd></dl>
      </div>
      <div class="pending-card"><h3>Required to become a runnable budget</h3>${(op.required_inputs||[]).map(x=>`<div class="required-input">${esc(x)}</div>`).join("")}</div>
    </section>
    ${renderPipeline(op)}
    <section class="section panel"><div class="panel-head"><h3>Technical source / contract state</h3>${technicalBadge("INCOMPLETE")}</div><div class="panel-body"><p class="small">KPI: <strong>${esc(op.kpi)}</strong>. Future target: <strong>Not defined / pending validation.</strong> Composition method: <strong>${esc(op.composition_method)}</strong>.</p><p class="small muted">The canonical prototype keeps null values as null. Missing does not mean zero.</p></div></section>`;
}
function renderPilotOperation(op){
  return `${renderOperationHeader(op)}
    <section class="section budget-layout">
      <div class="panel"><div class="panel-head"><h3>${esc(op.name)} — stacked Error Budget</h3><span class="small muted">Lucas-native decomposition view</span></div><div class="panel-body">${renderStack(op)}</div></div>
      ${renderValidity(op)}
    </section>
    <div class="disclaimer section"><strong>Scientific guardrail.</strong> This synthetic pilot is additive by construction for inspectability. Real neutral-atom mechanisms can interact, correlate and require explicit loss/leakage/coherent channels; the portal must display the declared composition method rather than imply universal additivity.</div>
    ${renderPipeline(op)}
    ${renderContributorTable(op)}
    ${renderOperationChanges(op)}`;
}
function renderOperations(){
  const op=operationById(state.selectedOperation)||state.data.operations[0];
  return `${operationSelector()}${isPilot(op)?renderPilotOperation(op):renderPendingOperation(op)}`;
}
function renderTargets(){
  return `<section class="section">
    <div class="section-header"><div><h2>Improvement Targets</h2><div class="section-kicker">A large contributor is not automatically the best improvement target. Where Gᵢ is unsupported, the portal says “not yet quantified”.</div></div></div>
    <div class="target-list">${state.data.improvement_targets.map(t=>`<article class="target-card">
      <div class="target-rank">#${t.priority}</div>
      <div><h3>${esc(t.target)}</h3><p><strong>${esc(t.operation)}</strong> · Owner ${esc(t.owner)} · ${evidenceBadge(t.evidence.split(" / ")[0])} ${confidenceBadge(t.confidence)}</p><p>${esc(t.why)}</p><p><strong>Next test:</strong> ${esc(t.next_test)}</p></div>
      <div class="target-gain"><strong>${t.achievable_gain==null?"Not quantified":esc(t.achievable_gain)}</strong><span>achievable gain Gᵢ</span></div>
    </article>`).join("")}</div>
  </section>
  <section class="section panel">
    <div class="panel-head"><h3>Decision rule</h3><span>${badge("STATE-OF-ART ALIGNED","live")}</span></div>
    <div class="panel-body small"><p>Prioritization considers technical magnitude, reducibility, uncertainty/confidence, evidence quality and whether missing structure can alter the conclusion. The portal therefore keeps crosstalk/leakage and residual gaps visible even when their current scalar share is not the largest.</p></div>
  </section>`;
}
function renderChanges(){
  return `<section class="section">
    <div class="section-header"><div><h2>Changes & contribution activity</h2><div class="section-kicker">Who contributed what, when, and what state the program record is in</div></div></div>
    <div class="panel"><div class="panel-body"><div class="timeline">${state.data.activity.map(a=>`<div class="timeline-item"><div class="timeline-date">${formatDate(a.date)} · ${badge(a.state,a.state==="LIVE"?"live":"accepted")}</div><div class="timeline-title">${esc(a.operation)} · ${esc(a.actor)}</div><div class="timeline-text">${esc(a.action)}</div></div>`).join("")}</div></div></div>
  </section>
  <section class="section panel"><div class="panel-head"><h3>Temporal contract</h3></div><div class="panel-body trust-grid">
    <div><strong>${badge("LIVE","live")}</strong><p class="small muted">Latest generated state. May include pending proposal metadata in a future implementation.</p></div>
    <div><strong>${badge("ACCEPTED","accepted")}</strong><p class="small muted">Reviewer-approved scientific state. Browser simulation cannot create it.</p></div>
    <div><strong>${badge("CLOSED","closed")}</strong><p class="small muted">Immutable period snapshot for review/audit; future GitLab/SharePoint close.</p></div>
  </div></section>`;
}
function renderTrust(){
  const b=state.build||{};
  return `<section class="section">
    <div class="section-header"><div><h2>Trust & Evidence</h2><div class="section-kicker">Why a displayed number is credible, provisional, stale or incomplete</div></div></div>
    <div class="trust-grid">
      <div class="trust-card"><h3>Build / lineage</h3><p>Data revision</p><div class="code-line">${esc(state.data.meta.data_revision)}</div><p>Schema</p><div class="code-line">${esc(state.data.meta.schema_version)}</div><p>Deployment commit</p><div class="code-line">${esc(b.git_sha||"available after deployed build")}</div><p>Built at</p><div class="code-line">${esc(b.built_at||state.data.meta.generated_at)}</div></div>
      <div class="trust-card"><h3>Evidence vocabulary</h3><p>${evidenceBadge("Measured")} direct/measured-like record</p><p>${evidenceBadge("Simulated")} physics/model simulation</p><p>${evidenceBadge("Estimated")} indirect/provisional estimate</p><p>${evidenceBadge("Literature")} literature-derived input</p><p>${evidenceBadge("Unknown")} unsupported residual</p></div>
      <div class="trust-card"><h3>Lifecycle</h3><p>${badge("LIVE","live")} generated current view</p><p>${badge("ACCEPTED","accepted")} reviewer-approved scientific state</p><p>${badge("CLOSED","closed")} frozen point-in-time snapshot</p><p class="small muted">Presentation never becomes an independent source of truth.</p></div>
    </div>
  </section>
  <section class="section panel"><div class="panel-head"><h3>Cross-layer source chain</h3><span class="small muted">Physical → mechanism → operational → QEC context → system KPI</span></div><div class="panel-body">
    <div class="pipeline">${state.data.source_chain.map(s=>`<div class="pipe-node"><strong>${esc(s.level)}</strong><span>${esc(s.examples)}</span></div>`).join("")}</div>
  </div></section>
  <section class="section"><div class="section-header"><div><h2>Maturity vocabulary</h2><div class="section-kicker">Do not compress “we have a number” into “the mechanism is closed”.</div></div></div><div class="maturity-strip">${state.data.maturity_framework.map(m=>`<div class="maturity-stage"><strong>${esc(m.stage)}</strong><p>${esc(m.question)}</p></div>`).join("")}</div></section>
  <section class="section"><div class="section-header"><div><h2>Common terminology</h2><div class="section-kicker">Minimal shared language across operation budgets</div></div></div><dl class="glossary-grid">${state.data.glossary.map(g=>`<div class="glossary-item"><dt>${esc(g.term)}</dt><dd>${esc(g.definition)}</dd></div>`).join("")}</dl></section>
  <section class="section disclaimer"><strong>Public-prototype boundary.</strong> Names/ownership context and dates shown here are reused from the prior Notion prototype because they help exercise the UX. All performance values, uncertainties, evidence payloads, operating points and calculated Error Budgets are synthetic; this page makes no claim about real QPU performance or internal targets.</section>`;
}
function render(){
  const app=$("#app");
  if(!state.data){ app.innerHTML="<p>Loading Error Budget data…</p>"; return; }
  const views={overview:renderOverview,operations:renderOperations,targets:renderTargets,changes:renderChanges,trust:renderTrust};
  app.innerHTML=(views[state.route]||renderOverview)();
  wireDynamic();
}
function wireDynamic(){
  $$('[data-open-op]').forEach(b=>b.addEventListener("click",()=>pushRoute("operations",b.dataset.openOp)));
  $$('[data-route-link]').forEach(b=>b.addEventListener("click",()=>pushRoute(b.dataset.routeLink)));
  const select=$("#operationSelect");
  if(select) select.addEventListener("change",()=>pushRoute("operations",select.value));
  $$('[data-evidence]').forEach(b=>b.addEventListener("click",()=>openEvidence(b.dataset.evidence)));
  $$('[data-propose-op]').forEach(b=>b.addEventListener("click",()=>openProposal(b.dataset.proposeOp)));
  $$('[data-review-op]').forEach(b=>b.addEventListener("click",()=>openReview(b.dataset.reviewOp)));
}
function findContributor(id){
  for(const op of state.data.operations){
    const c=(op.contributors||[]).find(x=>x.id===id);
    if(c) return {op,c};
  }
  return null;
}
function showModal(html){
  $("#modalContent").innerHTML=html;
  $("#modalBackdrop").classList.remove("hidden");
  $("#modalBackdrop").setAttribute("aria-hidden","false");
}
function closeModal(){
  $("#modalBackdrop").classList.add("hidden");
  $("#modalBackdrop").setAttribute("aria-hidden","true");
}
function openEvidence(id){
  const found=findContributor(id);
  if(!found) return;
  const {op,c}=found;
  showModal(`<h2 id="modalTitle">Contributor provenance</h2>
    <p><strong>${esc(c.name)}</strong> · ${esc(op.name)}</p>
    <div class="trust-grid">
      <div class="trust-card"><h3>Scientific quantity</h3><p>ID</p><div class="code-line">${esc(c.id)}</div><p>Absolute ε</p><div class="code-line">${probability(c.absolute)}</div><p>Share of total ε</p><div class="code-line">${pct(c.share,1)}</div><p>Uncertainty</p><div class="code-line">${c.uncertainty==null?"not assigned":`± ${probability(c.uncertainty)}`}</div></div>
      <div class="trust-card"><h3>Accountability</h3><p>Owner</p><div class="code-line">${esc(c.owner)}</div><p>Evidence class</p><div>${evidenceBadge(c.evidence_class)}</div><p>Confidence</p><div>${confidenceBadge(c.confidence)}</div><p>Valid / observed date</p><div class="code-line">${formatDate(c.evidence_date)}</div></div>
      <div class="trust-card"><h3>Method & gap</h3><p>Method/version</p><div class="code-line">${esc(c.method)}</div><p>Gap</p><p>${esc(c.gap)}</p><p>Next action</p><p><strong>${esc(c.next_action)}</strong></p></div>
    </div>
    <p class="disclaimer"><strong>Synthetic evidence record.</strong> Inspectability is real; the scientific payload is not company performance data.</p>`);
}
function proposalKey(opId){ return `ebv0-proposal-${opId}`; }
function getProposal(opId){
  try{return JSON.parse(localStorage.getItem(proposalKey(opId))||"null");}catch{return null;}
}
function openProposal(opId){
  const op=operationById(opId);
  if(!op || !isPilot(op)) return;
  const contribs=op.contributors.filter(c=>!c.name.startsWith("Unknown"));
  const existing=getProposal(opId);
  const selected=contribs.find(c=>c.id===existing?.contributor_id)||contribs[0];
  showModal(`<h2 id="modalTitle">Contribute update · ${esc(op.name)}</h2>
    <p class="small muted">Owner contract: provide the local fact. Do not edit aggregate ε, plots, gaps or program status.</p>
    <form id="proposalForm" class="form-grid">
      <div class="form-field full"><label>Contributor</label><select name="contributor_id">${contribs.map(c=>`<option value="${esc(c.id)}" ${c.id===selected.id?"selected":""}>${esc(c.name)} · current ${probability(c.absolute)}</option>`).join("")}</select></div>
      <div class="form-field"><label>Proposed absolute contribution ε</label><input name="value" type="number" min="0" step="0.000001" value="${existing?.value ?? selected.absolute}" required></div>
      <div class="form-field"><label>Uncertainty</label><input name="uncertainty" type="number" min="0" step="0.000001" value="${existing?.uncertainty ?? selected.uncertainty ?? ""}" required></div>
      <div class="form-field"><label>Operating point / conditions</label><input name="operating_point" value="${esc(existing?.operating_point ?? op.operating_point)}" required></div>
      <div class="form-field"><label>Method / version</label><input name="method" value="${esc(existing?.method ?? selected.method)}" required></div>
      <div class="form-field"><label>Evidence class</label><select name="evidence_class">${["Measured","Simulated","Estimated","Literature","Unknown"].map(x=>`<option ${x===(existing?.evidence_class??selected.evidence_class)?"selected":""}>${x}</option>`).join("")}</select></div>
      <div class="form-field"><label>Observed / valid date</label><input name="observed_date" type="date" value="${esc(existing?.observed_date ?? "2026-08-26")}" required></div>
      <div class="form-field full"><label>Evidence / explanation</label><textarea name="note" rows="3" required>${esc(existing?.note ?? "Synthetic contribution update for UX review.")}</textarea></div>
      <div class="form-field full"><button class="primary-button" type="submit">Generate review proposal</button></div>
    </form>
    <p class="small muted">Stored only in this browser via localStorage. This is not a write to GitHub or the future canonical GitLab registry.</p>`);
  $("#proposalForm").addEventListener("submit",ev=>{
    ev.preventDefault();
    const f=new FormData(ev.currentTarget);
    const proposal={
      op_id:opId, contributor_id:f.get("contributor_id"), value:Number(f.get("value")),
      uncertainty:Number(f.get("uncertainty")), operating_point:f.get("operating_point").trim(),
      method:f.get("method").trim(), evidence_class:f.get("evidence_class"),
      observed_date:f.get("observed_date"), note:f.get("note").trim(), created_at:new Date().toISOString()
    };
    localStorage.setItem(proposalKey(opId),JSON.stringify(proposal));
    openReview(opId);
  });
}
function proposalValidation(p){
  const allowed=["Measured","Simulated","Estimated","Literature","Unknown"];
  return [
    ["Value ≥ 0",Number.isFinite(p.value)&&p.value>=0],
    ["Uncertainty ≥ 0",Number.isFinite(p.uncertainty)&&p.uncertainty>=0],
    ["Operating point present",Boolean(p.operating_point)],
    ["Method/version present",Boolean(p.method)],
    ["Evidence class controlled",allowed.includes(p.evidence_class)],
    ["Observed date present",Boolean(p.observed_date)],
    ["Explanation present",Boolean(p.note)]
  ];
}
function openReview(opId){
  const op=operationById(opId);
  if(!op || !isPilot(op)) return;
  const p=getProposal(opId);
  if(!p){
    showModal(`<h2 id="modalTitle">Review pending change · ${esc(op.name)}</h2><p>No local proposal exists yet.</p><button class="primary-button" id="startProposal">Create owner proposal</button>`);
    $("#startProposal").addEventListener("click",()=>openProposal(opId));
    return;
  }
  const c=op.contributors.find(x=>x.id===p.contributor_id);
  if(!c) return;
  const projected=op.total_error-c.absolute+p.value;
  const projectedF=1-projected;
  const validators=proposalValidation(p);
  const allPass=validators.every(x=>x[1]);
  const currentRank=[...op.contributors].filter(x=>!x.name.startsWith("Unknown")).sort((a,b)=>b.absolute-a.absolute).findIndex(x=>x.id===c.id)+1;
  const projectedRows=op.contributors.filter(x=>!x.name.startsWith("Unknown")).map(x=>({id:x.id,v:x.id===c.id?p.value:x.absolute})).sort((a,b)=>b.v-a.v);
  const projectedRank=projectedRows.findIndex(x=>x.id===c.id)+1;
  showModal(`<h2 id="modalTitle">Review preview · ${esc(op.name)}</h2>
    <p class="small muted">Before → After with scientific delta, program consequence and provenance. Canonical state remains unchanged.</p>
    <h3>Scientific delta</h3>
    <div class="review-grid">
      <div class="review-box"><strong>BEFORE · ${esc(c.name)}</strong><span>${probability(c.absolute)} ± ${c.uncertainty==null?"—":probability(c.uncertainty)}</span></div>
      <div class="review-box"><strong>PROPOSED</strong><span>${probability(p.value)} ± ${probability(p.uncertainty)}</span></div>
      <div class="review-box"><strong>METHOD</strong><span class="small">${esc(c.method)} → ${esc(p.method)}</span></div>
      <div class="review-box"><strong>OPERATING POINT</strong><span class="small">${esc(p.operating_point)}</span></div>
    </div>
    <h3>Program consequence</h3>
    <div class="review-grid">
      <div class="review-box"><strong>TOTAL ε</strong><span>${probability(op.total_error)} → ${probability(projected)}</span></div>
      <div class="review-box"><strong>FIDELITY F</strong><span>${pct(op.fidelity,3)} → ${pct(projectedF,3)}</span></div>
      <div class="review-box"><strong>CONTRIBUTOR RANK</strong><span>#${currentRank} → #${projectedRank}</span></div>
      <div class="review-box"><strong>CURRENT SPEC / FUTURE TARGET</strong><span class="small">Not defined in source material — no fake PASS/FAIL computed</span></div>
    </div>
    <h3>Validation / provenance</h3>
    <div class="validation-list">${validators.map(([n,ok])=>`<span>${esc(n)}</span>${badge(ok?"PASS":"FAIL",ok?"pass":"fail")}`).join("")}</div>
    <p class="small"><strong>Evidence class:</strong> ${evidenceBadge(p.evidence_class)} · <strong>Observed:</strong> ${formatDate(p.observed_date)}<br><strong>Explanation:</strong> ${esc(p.note)}</p>
    <div class="action-row">
      <button class="primary-button" id="markReviewed" ${allPass?"":"disabled"}>Mark reviewed locally</button>
      <button class="secondary-button" id="requestChanges">Request changes locally</button>
      <button class="danger-button" id="discardProposal">Discard local proposal</button>
    </div>
    <p class="small muted">Local review markers are UX simulation only. They never create an ACCEPTED canonical state.</p>`);
  $("#markReviewed")?.addEventListener("click",()=>{
    localStorage.setItem(`${proposalKey(opId)}-review`,"reviewed-local");
    alert("Marked reviewed locally. Canonical JSON was not changed.");
  });
  $("#requestChanges")?.addEventListener("click",()=>{
    localStorage.setItem(`${proposalKey(opId)}-review`,"changes-requested-local");
    alert("Changes requested locally. Canonical JSON was not changed.");
  });
  $("#discardProposal")?.addEventListener("click",()=>{
    localStorage.removeItem(proposalKey(opId)); localStorage.removeItem(`${proposalKey(opId)}-review`); closeModal();
  });
}
async function load(){
  const [dataRes,buildRes]=await Promise.all([
    fetch("./data.json",{cache:"no-store"}),
    fetch("./build-meta.json",{cache:"no-store"}).catch(()=>null)
  ]);
  if(!dataRes.ok) throw new Error(`data.json ${dataRes.status}`);
  state.data=await dataRes.json();
  if(buildRes && buildRes.ok) state.build=await buildRes.json();
  const chip=$("#buildChip");
  if(state.build){
    chip.innerHTML=`BUILD <strong>${esc((state.build.git_sha||"").slice(0,8))}</strong> · ${esc(state.build.built_at||"")}`;
  }else{
    chip.innerHTML=`DATA <strong>${esc(state.data.meta.data_revision)}</strong> · deploy metadata pending`;
  }
  readHash(); updateNav(); render();
}
$$(".nav-button").forEach(b=>b.addEventListener("click",()=>pushRoute(b.dataset.route)));
window.addEventListener("hashchange",()=>{readHash();updateNav();render();});
$("#modalClose").addEventListener("click",closeModal);
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop") closeModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape") closeModal();});
load().catch(err=>{
  console.error(err);
  $("#app").innerHTML=`<div class="disclaimer"><strong>Portal load failed.</strong> ${esc(err.message)}</div>`;
});
