// Final Lucas-readable semantic polish.
// Loaded after app.js so the core prototype stays easy to compare with the previous iteration.

renderOperationHeader = function(op){
  const pilot=isPilot(op);
  let sentence;
  if(pilot){
    const top=topContributor(op);
    sentence=`Current synthetic ${op.name} state: ${pct(op.fidelity,2)} fidelity (ε = ${pct(op.total_error,2)}). Main attributed contributor: ${top.name} at ${pct(top.share,0)} of total operation error; ${pct(op.unknown_share,0)} remains Unknown / Unassigned.`;
  } else {
    sentence=`${op.name} is intentionally not shown with a fake quantitative budget. The KPI contract exists, but the inputs required for a defensible decomposition are still incomplete.`;
  }
  const buildShort=(state.build?.git_sha||"").slice(0,8) || "pending";
  const accepted=op.last_accepted ? formatDate(op.last_accepted) : "Not yet accepted";
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
      <div class="operation-metric"><strong>${op.current_spec==null?"Not defined":pct(op.current_spec,2)}</strong><span>Current spec / threshold</span></div>
      <div class="operation-metric"><strong>${op.future_target==null?"Not defined":pct(op.future_target,2)}</strong><span>Future target</span></div>
    </div>
    <div class="action-row operation-source-row">
      <a class="secondary-button" href="./data.json" target="_blank" rel="noopener">Open technical source</a>
      <span class="small muted">Accepted record: ${esc(accepted)} · Live build: <span class="mono">${esc(buildShort)}</span></span>
    </div>
  </section>`;
};

renderValidity = function(op){
  const v=validationFor(op);
  const rows=v.checks.map(([name,result,kind])=>`<div class="validity-grid"><span class="validity-label">${esc(name)}</span>${badge(result,kind)}</div>`).join("");
  const accepted=op.last_accepted ? formatDate(op.last_accepted) : "Not yet accepted";
  const buildShort=(state.build?.git_sha||"").slice(0,8) || "pending";
  return `<div class="panel">
    <div class="panel-head"><h3>Validity monitor</h3>${technicalBadge(v.overall)}</div>
    <div class="panel-body">
      ${rows}
      <div class="validity-grid"><span class="validity-label">Operating point</span><strong class="small">${esc(op.operating_point)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Composition method</span><strong class="small">${esc(op.composition_method)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Last evidence</span><strong class="small">${op.last_evidence_date?formatDate(op.last_evidence_date):"—"}</strong></div>
      <div class="validity-grid"><span class="validity-label">Accepted state</span><strong class="small">${esc(accepted)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Live build</span><strong class="small mono">${esc(buildShort)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Owner</span><strong class="small">${esc(op.owner)}</strong></div>
      <div class="validity-grid"><span class="validity-label">Reviewer</span><strong class="small">${esc(op.reviewer)}</strong></div>
      <p class="validity-note"><strong>DEMO RULE RESULT.</strong> Arithmetic and metadata checks are genuinely computed from this JSON. Scientific acceptance is never inferred by the browser.</p>
    </div>
  </div>`;
};

renderOperationChanges = function(op){
  const changes=(op.changes||[]).map(x=>`<li>${esc(x)}</li>`).join("");
  const relatedTargets=state.data.improvement_targets.filter(t=>t.operation.includes(op.name.split(" ")[0]) || (op.id==="1q"&&t.operation.includes("1Q")) || (op.id==="2q"&&t.operation.includes("2Q"))).slice(0,3);
  const activity=state.data.activity.filter(a=>a.operation===op.name);
  const activityHtml=activity.length
    ? `<h4 class="activity-subhead">Recent contribution activity</h4><ul class="change-list">${activity.map(a=>`<li><strong>${formatDate(a.date)} · ${esc(a.actor)}</strong> ${badge(a.state,a.state==="LIVE"?"live":"accepted")}<br><span class="muted">${esc(a.action)}</span></li>`).join("")}</ul>`
    : `<h4 class="activity-subhead">Recent contribution activity</h4><p class="small muted">No operation-specific accepted activity record is available yet. Missing history is shown as missing, not inferred.</p>`;
  return `<section class="section two-col">
    <div class="panel"><div class="panel-head"><h3>What changed / what is still open</h3><span class="small muted">No invented numeric trend</span></div><div class="panel-body"><ul class="change-list">${changes}</ul>${activityHtml}</div></div>
    <div class="panel"><div class="panel-head"><h3>Key improvement targets</h3><span class="small muted">Ranked by actionability, not magnitude alone</span></div><div class="panel-body"><ul class="simple-list">${
      relatedTargets.length?relatedTargets.map(t=>`<li><strong>${esc(t.target)}</strong><br><span class="muted">Owner ${esc(t.owner)} · Gᵢ ${t.achievable_gain==null?"not yet quantified":esc(t.achievable_gain)} · ${esc(t.next_test)}</span></li>`).join(""):`<li>No quantified improvement target yet. Closing the operation contract is the priority.</li>`
    }</ul></div></div>
  </section>`;
};
