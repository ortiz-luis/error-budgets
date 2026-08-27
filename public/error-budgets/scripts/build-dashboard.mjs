import fs from 'node:fs';
import cp from 'node:child_process';
import { validateOperation } from './validate-operation.mjs';

const sourceRoot='public/error-budgets';
const outputRoot='public/error-budgets';
const ids=['1q','2q','movement','initialization','readout','addressability','analog'];
const sh=c=>cp.execSync(c,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
const exists=ref=>{try{sh(`git rev-parse --verify ${ref}`);return true}catch{return false}};
const hasFile=(ref,path)=>{try{sh(`git cat-file -e ${ref}:${path}`);return true}catch{return false}};
function sourceRef(id,path){const remote=`refs/remotes/origin/error-budgets-data/${id}`;return exists(remote)&&hasFile(remote,path)?remote:'HEAD'}
function readAt(ref,path){return JSON.parse(sh(`git show ${ref}:${path}`))}
function validate(op,id,ref){
  const branch=`error-budgets-data/${id}`;
  const errors=validateOperation(op,{expectedId:id,expectedBranch:branch});
  if(errors.length) throw new Error(`${id} strict validation failed at ${ref}:\n - ${errors.join('\n - ')}`);
}
function historyFor(ref,path,id){
  let rows=[];
  try{const raw=sh(`git log --reverse --format='%H%x1f%cI%x1f%an%x1f%s' ${ref} -- ${path}`);rows=raw?raw.split('\n'):[]}catch{}
  const out=[];
  for(const row of rows){
    const [sha,iso,author,...msg]=row.split('\x1f');
    try{
      const j=readAt(sha,path);
      validate(j,id,sha);
      out.push({date:j.live_at||iso.slice(0,10),commit_date:iso,author,message:msg.join(' '),fidelity_pct:100-Number(j.current_error_pct),uncertainty_pct:Number(j.uncertainty_error_pp),snapshot:j.snapshot_id,commit:sha,short_commit:sha.slice(0,7),status:j.status});
    }catch{}
  }
  return out;
}
const operations=ids.map(id=>{
  const path=`${sourceRoot}/data/operations/${id}.json`;
  const ref=sourceRef(id,path);
  const op=readAt(ref,path);
  validate(op,id,ref);
  op.source_ref=ref;
  op.source_commit=sh(`git log -1 --format=%H ${ref} -- ${path}`);
  op.history=historyFor(ref,path,id);
  return op;
});
const dashboard={schema_version:'error-budgets.1',site:{title:'Error Budgets',qpu:'Neutral-atom QPU',data_policy:'synthetic-literature-informed',generated_at:new Date().toISOString(),repository:'ortiz-luis/error-budgets',note:'Generated artifact. Authority remains the per-operation JSON files and their Git commit histories.'},operations};
fs.mkdirSync(`${outputRoot}/data`,{recursive:true});
fs.writeFileSync(`${outputRoot}/data/dashboard.json`,JSON.stringify(dashboard,null,2)+'\n');
console.log(`Generated canonical Error Budgets dashboard with ${operations.length} strictly validated operation(s).`);
