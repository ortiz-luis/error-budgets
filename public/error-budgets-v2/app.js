const $ = (s) => document.querySelector(s);
const fmt = (n, d = 2) => n === null || n === undefined ? 'Not defined' : Number(n).toFixed(d);
const pct = (n, d = 1) => n === null || n === undefined ? '—' : `${Number(n).toFixed(d)}%`;
const esc = (s) => String(s ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let PROGRAM = null;
let OPS = [];
let ACTIVE = null;
let BUILD = null;

function humanDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(d);
}

function relativeAge(iso) {
  if (!iso) return '—';
  const now = new Date();
  const then = new Date(`${iso}T00:00:00`);
  const days = Math.max(0, Math.floor((now - then) / 86400000));
  if (days === 0) return 'updated today';
  if (days === 1) return 'updated 1 day ago';
  return `updated ${days} days ago`;
}

function statusLabel(op) {
  if (op.maturity !== 'PILOT') return '◐ Partial';
  if (op.status === 'AT_RISK') return '⚠ At risk';
  return '✓ Pilot';
}

function statusClass(op) {
  if (op.maturity !== 'PILOT') return 'partial';
  return op.status === 'AT_RISK' ? 'risk' : 'pilot';
}

function pillText(op) {
  if (op.maturity !== 'PILOT') return 'INCOMPLETE';
  return op.status === 'AT_RISK' ? 'AT RISK' : 'ON TRACK';
}

function trustState(op) {
  if (op.maturity !== 'PILOT') return 'WATCH';
  const share = (op.contributors || []).reduce((a,c)=>a+Number(c.share_pct||0),0);
  const impact = (op.contributors || []).reduce((a,c)=>a+Number(c.impact||0),0);
  const closure = Math.abs(share - 100) < 0.05 && Math.abs(impact - Number(op.current_error)) < 0.005;
  if (!closure) return 'FAIL';
  const ev = op.evidence || {};
  const evidenceComplete = Number(ev.complete) >= Number(ev.expected);
  const accepted = op.scientific_acceptance === 'human-reviewed';
  if (!evidenceComplete || op.model_confidence === 'LOW' || !accepted) return 'WATCH';
  return 'PASS';
}

async function load() {
  PROGRAM = await fetch('data/program.json',{cache:'no-store'}).then(r=>r.json());
  try { BUILD = await fetch('build-meta.json',{cache:'no-store'}).then(r=>r.ok?r.json():null); } catch { BUILD = null; }
  OPS = await Promise.all(PROGRAM.operations.map(async ref => {
    const op = await fetch(ref.file,{cache:'no-store'}).then(r=>r.json());
    op.__file = ref.file;
    return op;
  }));
  renderHeader();
  renderProgram();
  renderTabs();
  const defaultOp = OPS.find(o=>o.id===PROGRAM.default_operation) || OPS[0];
  selectOperation(defaultOp.id);
}

function renderHeader() {
  $('#programTitle').textContent = PROGRAM.title;
  $('#programSubtitle').textContent = PROGRAM.subtitle;
  $('#v0Definition').textContent = PROGRAM.v0_definition;
  $('#v0Note').textContent = PROGRAM.v0_note;
  $('#programAccepted').textContent = `Accepted ${humanDate(PROGRAM.accepted_at)}`;
  $('#programFreshness').textContent = relativeAge(PROGRAM.accepted_at);
  $('#programAcceptance').textContent = PROGRAM.scientific_acceptance;
  $('#demoNotice').textContent = PROGRAM.demo_notice;
  if (BUILD?.git_sha) $('#buildChip').textContent = `Build ${BUILD.git_sha.slice(0,8)} · Git`;
  else $('#buildChip').textContent = 'Build source · Git';
}

function renderProgram() {
  const pilots = OPS.filter(o=>o.maturity==='PILOT').length;
  const pending = OPS.length - pilots;
  const tech = OPS.filter(o=>o.main_gap?.severity==='CRITICAL').length;
  const gov = OPS.filter(o=>o.main_gap?.severity==='GOVERNANCE').length;
  const counters = [
    ['scope','◎',OPS.length,'operations','in scope'],
    ['pilots','▶',pilots,'runnable','pilots'],
    ['pending','◴',pending,'pending /','partial'],
    ['tech','△',tech,'critical','technical gaps'],
    ['gov','⬟',gov,'governance','gaps']
  ];
  $('#programCounters').innerHTML = counters.map(c=>`<div class="counter ${c[0]}"><span class="icon">${c[1]}</span><strong>${c[2]}</strong><span>${c[3]}<br>${c[4]}</span></div>`).join('');

  const gaps = OPS.filter(o=>o.main_gap).sort((a,b)=>{
    const w={CRITICAL:0,GOVERNANCE:1}; return (w[a.main_gap.severity]??9)-(w[b.main_gap.severity]??9);
  }).slice(0,4);
  $('#attentionList').innerHTML = gaps.map(op=>{
    const att=(op.main_gap.attention||'FYI').toLowerCase();
    const cls=op.main_gap.severity==='CRITICAL'?'critical':att==='delegate'?'delegate':'fyi';
    return `<div class="attention-item ${cls}"><span class="attention-dot"></span><span><span class="attention-op">${esc(op.short_name)}</span> — ${esc(op.main_gap.text)}</span><span class="attention-action">${esc(op.main_gap.attention)}</span></div>`;
  }).join('');
}

function renderTabs() {
  $('#operationTabs').innerHTML = OPS.map(op=>`<button class="op-tab" data-op="${op.id}">${esc(op.short_name)} <span class="op-state ${statusClass(op)}">${statusLabel(op)}</span></button>`).join('');
  document.querySelectorAll('.op-tab').forEach(b=>b.addEventListener('click',()=>selectOperation(b.dataset.op)));
}

function selectOperation(id) {
  ACTIVE = OPS.find(o=>o.id===id);
  document.querySelectorAll('.op-tab').forEach(b=>b.classList.toggle('active',b.dataset.op===id));
  renderOperation(ACTIVE);
  $('#technicalDetail').hidden = true;
  $('#detailButton').textContent = `Open ${ACTIVE.short_name} technical detail →`;
}

function renderOperation(op) {
  $('#operationTitle').textContent = op.name;
  $('#operationStatus').textContent = pillText(op);
  $('#operationStatus').className = `status-pill ${op.maturity!=='PILOT'?'incomplete':op.status==='AT_RISK'?'at-risk':'on-track'}`;
  const pilot = op.maturity === 'PILOT';
  $('#quantifiedView').hidden = !pilot;
  $('#partialView').hidden = pilot;
  if (pilot) renderQuantified(op); else renderPartial(op);
  renderPipeline(op);
  renderDetail(op);
}

function renderQuantified(op) {
  const classes=['intermediate','dc','ac','other','unknown'];
  const ordered=[...(op.contributors||[])].reverse();
  $('#stackBar').innerHTML = ordered.map((c,idx)=>{
    const originalIndex=(op.contributors.length-1)-idx;
    const cls = c.name.toLowerCase().includes('unknown') ? 'unknown' : classes[originalIndex] || 'other';
    const label = Number(c.share_pct) >= 4 ? `<span>${esc(c.name)}<br>${pct(c.share_pct,1)}</span>` : `<span>${pct(c.share_pct,1)}</span>`;
    return `<div class="segment ${cls}" style="height:${Number(c.share_pct)}%" title="${esc(c.name)} — ${pct(c.share_pct,1)}">${label}</div>`;
  }).join('');
  $('#currentError').textContent = fmt(op.current_error,2);
  $('#currentUncertainty').textContent = `± ${fmt(op.uncertainty,2)}%`;
  $('#specThreshold').textContent = op.spec_threshold==null?'Not defined':`${fmt(op.spec_threshold,2)}%`;
  $('#futureTarget').textContent = op.future_target==null?'Not defined':`${fmt(op.future_target,2)}%`;
  const delta=Number(op.delta_since_accepted_pp||0);
  $('#deltaAccepted').textContent = `${delta>0?'+':''}${fmt(delta,2)} pp`;
  $('#deltaAccepted').className = delta<=0?'good-text':'';
  $('#knownPct').textContent = pct(op.known_attribution_pct,0);
  $('#unknownPct').textContent = pct(op.unknown_pct,0);
  $('#compositionNote').textContent = `Composition: ${op.composition_method.replaceAll('_',' ')}; real models may be non-additive.`;
  const trust=trustState(op);
  $('#trustStatus').textContent=trust;
  $('#evidenceCoverage').textContent=`${op.evidence.complete}/${op.evidence.expected} evidence`;
  $('#modelConfidence').textContent=op.model_confidence;
  $('#scientificAcceptance').textContent=op.scientific_acceptance;
  $('#ownerName').textContent=op.owner||'Unassigned';
  $('#reviewerName').textContent=op.reviewer||'Unassigned';
  $('#acceptedDate').textContent=humanDate(op.accepted_at);
  $('#liveDate').textContent=humanDate(op.live_at);
  $('#mainTarget').textContent=op.main_target||'Not defined';
  $('#priorityBasis').textContent=`Priority based on ${op.priority_basis.toLowerCase()}`;
}

function renderPartial(op) {
  $('#partialName').textContent=op.name;
  $('#partialDescription').textContent=op.description;
  $('#partialKpi').textContent=`${op.kpi.name} (${op.kpi.symbol})`;
  $('#partialKnown').textContent=pct(op.known_attribution_pct,0);
  $('#partialUnknown').textContent=pct(op.unknown_pct,0);
  $('#partialOwner').textContent=op.owner||'Unassigned';
  $('#partialReviewer').textContent=op.reviewer||'Unassigned';
  $('#partialGap').textContent=op.main_gap?.text||'No critical gap recorded';
}

function renderPipeline(op) {
  const labels=PROGRAM.pipeline_labels;
  const icons=['⚛','⌁','⠿','▥','◎'];
  $('#pipeline').innerHTML=labels.map((l,i)=>`${i?'<div class="pipe-arrow">→</div>':''}<div class="pipe-node ${i===3?'active':''}"><span class="pipe-icon">${icons[i]}</span><span>${i===3?esc(op.short_name)+' ':''}${esc(l)}</span></div>`).join('');
}

function renderDetail(op) {
  $('#detailTitle').textContent=op.name;
  $('#sourceContract').textContent=op.__file;
  const rows=op.contributors||[];
  $('#contributorRows').innerHTML = rows.length ? rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${pct(c.share_pct,1)}</td><td>${fmt(c.impact,4)}%</td><td>${c.uncertainty==null?'—':`±${fmt(c.uncertainty,3)}%`}</td><td>${esc(c.owner||'Unassigned')}</td><td>${esc(c.confidence)}</td><td>${humanDate(c.updated_at)}</td></tr>`).join('') : `<tr><td colspan="7">Quantitative contributor decomposition not yet available.</td></tr>`;
  const prov=[
    ['Schema',op.schema_version],['Operating point',op.operating_point],['Composition method',op.composition_method||'Not defined'],['Evidence',`${op.evidence.complete}/${op.evidence.expected}`],['Model confidence',op.model_confidence],['Scientific acceptance',op.scientific_acceptance],['Accepted state',humanDate(op.accepted_at)],['Live state',humanDate(op.live_at)],['Input file',op.__file]
  ];
  $('#provenanceList').innerHTML=prov.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
}

$('#detailButton').addEventListener('click',()=>{
  const panel=$('#technicalDetail');
  panel.hidden=!panel.hidden;
  $('#detailButton').textContent=panel.hidden?`Open ${ACTIVE.short_name} technical detail →`:`Close ${ACTIVE.short_name} technical detail ↑`;
  if(!panel.hidden) panel.scrollIntoView({behavior:'smooth',block:'start'});
});

load().catch(err=>{
  document.body.innerHTML=`<main style="font-family:system-ui;padding:40px"><h1>Error Budgets V0</h1><p>Could not load data contract.</p><pre>${esc(err.message)}</pre></main>`;
});
