import fs from 'node:fs';

const allowedIds = new Set(['1q','2q','movement','initialization','readout','addressability','analog']);
const allowedStatus = new Set(['ON_TRACK','AT_RISK','OFF_TRACK','UNKNOWN']);
const allowedConfidence = new Set(['HIGH','MEDIUM','LOW']);
const topAllowed = new Set(['schema_version','id','short_name','title','description','icon','status','source_branch','current_error_pct','uncertainty_error_pp','spec_error_pct','known_attribution_pct','live_at','snapshot_id','protocol','benchmark','metric_convention','measurement_chain','operating_point','target_note','contributors','literature_anchors']);
const contributorAllowed = new Set(['name','share_pct','share_uncertainty_pct','impact_error_pp','uncertainty_pp','evidence','confidence','owner']);
const anchorAllowed = new Set(['title','url','note']);
const topRequired = [...topAllowed];
const contributorRequired = [...contributorAllowed];
const anchorRequired = [...anchorAllowed];

function fail(errors) {
  console.error('\nERROR BUDGET JSON VALIDATION FAILED');
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}
function finiteNumber(v){return typeof v === 'number' && Number.isFinite(v)}
function nonEmpty(v){return typeof v === 'string' && v.trim().length > 0}
function range(errors,label,v,min=0,max=100){if(!finiteNumber(v)) errors.push(`${label} must be a finite number`); else if(v<min||v>max) errors.push(`${label} must be between ${min} and ${max}`)}
function unknownKeys(errors,obj,allowed,label){for(const k of Object.keys(obj)) if(!allowed.has(k)) errors.push(`${label} contains unknown field '${k}'`)}
function required(errors,obj,keys,label){for(const k of keys) if(!(k in obj)) errors.push(`${label} missing required field '${k}'`)}

export function validateOperation(op,{expectedId=null,expectedBranch=null}={}){
  const errors=[];
  if(!op || typeof op !== 'object' || Array.isArray(op)) return ['root must be a JSON object'];
  required(errors,op,topRequired,'operation');
  unknownKeys(errors,op,topAllowed,'operation');

  if(op.schema_version !== 'error-budget-operation-1.0') errors.push(`schema_version must equal 'error-budget-operation-1.0'`);
  if(!allowedIds.has(op.id)) errors.push(`id '${op.id}' is not an allowed operation id`);
  if(expectedId && op.id !== expectedId) errors.push(`id '${op.id}' does not match expected id '${expectedId}'`);
  const canonicalBranch = allowedIds.has(op.id) ? `error-budgets-data/${op.id}` : null;
  if(canonicalBranch && op.source_branch !== canonicalBranch) errors.push(`source_branch must be '${canonicalBranch}'`);
  if(expectedBranch && op.source_branch !== expectedBranch) errors.push(`source_branch '${op.source_branch}' does not match pushed branch '${expectedBranch}'`);

  for(const k of ['short_name','title','description','icon','snapshot_id','protocol','benchmark','metric_convention','measurement_chain','operating_point','target_note']) if(!nonEmpty(op[k])) errors.push(`${k} must be a non-empty string`);
  if(!allowedStatus.has(op.status)) errors.push(`status must be one of ${[...allowedStatus].join(', ')}`);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(op.live_at||'')) errors.push(`live_at must use YYYY-MM-DD`); else {
    const d = new Date(`${op.live_at}T00:00:00Z`);
    if(Number.isNaN(d.getTime()) || d.toISOString().slice(0,10)!==op.live_at) errors.push(`live_at is not a valid calendar date`);
  }
  range(errors,'current_error_pct',op.current_error_pct);
  range(errors,'uncertainty_error_pp',op.uncertainty_error_pp);
  range(errors,'spec_error_pct',op.spec_error_pct);
  range(errors,'known_attribution_pct',op.known_attribution_pct);

  if(!Array.isArray(op.contributors) || op.contributors.length===0) errors.push('contributors must be a non-empty array');
  else {
    let shareSum=0, impactSum=0;
    const names=new Set();
    op.contributors.forEach((c,i)=>{
      const label=`contributors[${i}]`;
      if(!c || typeof c!=='object' || Array.isArray(c)){errors.push(`${label} must be an object`);return}
      required(errors,c,contributorRequired,label); unknownKeys(errors,c,contributorAllowed,label);
      if(!nonEmpty(c.name)) errors.push(`${label}.name must be non-empty`); else if(names.has(c.name)) errors.push(`duplicate contributor name '${c.name}'`); else names.add(c.name);
      range(errors,`${label}.share_pct`,c.share_pct); range(errors,`${label}.share_uncertainty_pct`,c.share_uncertainty_pct); range(errors,`${label}.impact_error_pp`,c.impact_error_pp); range(errors,`${label}.uncertainty_pp`,c.uncertainty_pp);
      if(!nonEmpty(c.evidence)) errors.push(`${label}.evidence must be non-empty`);
      if(!allowedConfidence.has(c.confidence)) errors.push(`${label}.confidence must be HIGH, MEDIUM or LOW`);
      if(c.owner!==null && !nonEmpty(c.owner)) errors.push(`${label}.owner must be a non-empty string or null`);
      if(finiteNumber(c.share_pct)) shareSum+=c.share_pct; if(finiteNumber(c.impact_error_pp)) impactSum+=c.impact_error_pp;
    });
    if(Math.abs(shareSum-100)>0.01) errors.push(`contributor share_pct values sum to ${shareSum}, expected 100 ± 0.01`);
    if(finiteNumber(op.current_error_pct) && Math.abs(impactSum-op.current_error_pct)>0.02) errors.push(`contributor impact_error_pp values sum to ${impactSum}, expected current_error_pct ${op.current_error_pct} ± 0.02`);
  }

  if(!Array.isArray(op.literature_anchors)) errors.push('literature_anchors must be an array');
  else op.literature_anchors.forEach((a,i)=>{
    const label=`literature_anchors[${i}]`;
    if(!a || typeof a!=='object' || Array.isArray(a)){errors.push(`${label} must be an object`);return}
    required(errors,a,anchorRequired,label); unknownKeys(errors,a,anchorAllowed,label);
    if(!nonEmpty(a.title)) errors.push(`${label}.title must be non-empty`);
    if(!nonEmpty(a.note)) errors.push(`${label}.note must be non-empty`);
    if(!nonEmpty(a.url) || !/^https:\/\//.test(a.url)) errors.push(`${label}.url must be an https URL`);
  });
  return errors;
}

if(import.meta.url === `file://${process.argv[1]}`){
  const args=process.argv.slice(2); const file=args[0];
  if(!file){console.error('Usage: node validate-operation.mjs <file> [--expected-id ID] [--expected-branch BRANCH]');process.exit(2)}
  const getArg=(name)=>{const i=args.indexOf(name);return i>=0?args[i+1]:null};
  let op; try{op=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){fail([`invalid JSON syntax: ${e.message}`])}
  const errors=validateOperation(op,{expectedId:getArg('--expected-id'),expectedBranch:getArg('--expected-branch')});
  if(errors.length) fail(errors);
  console.log(`PASS: ${file} (${op.id}, snapshot ${op.snapshot_id})`);
}
