import fs from 'node:fs';

const dashboardPath='public/error-budgets/data/dashboard.json';
const actionsPath='public/error-budgets/data/program_actions.json';
const outputPath='public/error-budgets/data/published_detail_state.json';

const round=value=>Math.round(Number(value)*1e6)/1e6;
const allowedPriority=new Set(['HIGH','MEDIUM','LOW']);
const allowedState=new Set(['PLANNED','IN_PROGRESS','BLOCKED','DONE']);

function fail(message){throw new Error(`detail publication validation failed: ${message}`)}
function str(value,name){if(typeof value!=='string'||!value.trim()) fail(`${name} must be non-empty string`);return value}
function nullableString(value){return value==null?null:String(value)}

function buildOperation(source){
  const fidelity=round(100-Number(source.current_error_pct));
  const target=round(100-Number(source.spec_error_pct));
  const contributors=(source.contributors||[]).map((c,index)=>({
    name:str(c.name,`contributors[${index}].name`),
    share_pct:round(c.share_pct),
    share_uncertainty_pct:round(c.share_uncertainty_pct),
    impact_error_pp:round(c.impact_error_pp),
    uncertainty_pp:round(c.uncertainty_pp),
    evidence:str(c.evidence,`contributors[${index}].evidence`),
    confidence:str(c.confidence,`contributors[${index}].confidence`),
    owner:nullableString(c.owner)
  }));
  const literature=(source.literature_anchors||[]).map((a,index)=>({
    title:str(a.title,`literature[${index}].title`),
    url:str(a.url,`literature[${index}].url`),
    note:str(a.note,`literature[${index}].note`)
  }));
  const history=(source.history||[]).slice(-12).map(h=>({
    date:str(h.date,'history.date'),
    fidelity_pct:round(h.fidelity_pct),
    uncertainty_pp:round(h.uncertainty_pct),
    status:str(h.status,'history.status'),
    snapshot:nullableString(h.snapshot),
    short_commit:nullableString(h.short_commit)
  }));
  return {
    id:str(source.id,'operation.id'),
    short_name:str(source.short_name,'operation.short_name'),
    title:str(source.title,'operation.title'),
    description:str(source.description,'operation.description'),
    status:str(source.status,'operation.status'),
    fidelity_pct:fidelity,
    fidelity_uncertainty_pp:round(source.uncertainty_error_pp),
    target_fidelity_pct:target,
    gap_to_target_pp:round(fidelity-target),
    total_infidelity_pp:round(source.current_error_pct),
    known_attribution_pct:round(source.known_attribution_pct),
    unknown_attribution_pct:round(100-Number(source.known_attribution_pct)),
    live_at:str(source.live_at,'operation.live_at'),
    snapshot_id:str(source.snapshot_id,'operation.snapshot_id'),
    protocol:str(source.protocol,'operation.protocol'),
    benchmark:str(source.benchmark,'operation.benchmark'),
    metric_convention:str(source.metric_convention,'operation.metric_convention'),
    measurement_chain:str(source.measurement_chain,'operation.measurement_chain'),
    operating_point:str(source.operating_point,'operation.operating_point'),
    target_note:str(source.target_note,'operation.target_note'),
    contributors,
    literature_anchors:literature,
    history
  };
}

function build(){
  const dashboard=JSON.parse(fs.readFileSync(dashboardPath,'utf8'));
  const actionsSource=JSON.parse(fs.readFileSync(actionsPath,'utf8'));
  if(!Array.isArray(dashboard.operations)||!dashboard.operations.length) fail('dashboard.operations missing');
  if(actionsSource.schema_version!=='error-budgets-actions-1.0'||!Array.isArray(actionsSource.actions)) fail('invalid action registry');
  const operations=dashboard.operations.map(buildOperation);
  const ids=new Set(operations.map(o=>o.id));
  const actions=actionsSource.actions.map((a,index)=>{
    if(!ids.has(a.operation_id)) fail(`actions[${index}].operation_id unknown`);
    if(!allowedPriority.has(a.priority)) fail(`actions[${index}].priority invalid`);
    if(!allowedState.has(a.state)) fail(`actions[${index}].state invalid`);
    return {
      id:str(a.id,`actions[${index}].id`),
      operation_id:str(a.operation_id,`actions[${index}].operation_id`),
      action:str(a.action,`actions[${index}].action`),
      priority:a.priority,
      state:a.state,
      owner:str(a.owner,`actions[${index}].owner`)
    };
  });
  const detail={
    schema_version:'error-budgets-detail-publication-1.0',
    generated_at:new Date().toISOString(),
    data_policy:'synthetic-literature-informed',
    operations,
    actions
  };
  const serialized=JSON.stringify(detail,null,2)+'\n';
  if(serialized.includes('source_branch')||serialized.includes('source_ref')) fail('source metadata leaked');
  fs.writeFileSync(outputPath,serialized);
  console.log(`Generated ${outputPath} (${operations.length} operations, ${actions.length} actions).`);
}

try{build()}catch(error){console.error(`ERROR BUDGET DETAIL PUBLICATION FAILED\n${error.message}`);process.exit(1)}
