import fs from 'node:fs';

const allowedIds = new Set(['1q','2q','movement','initialization','readout','addressability','analog']);
const allowedStatus = new Set(['ON_TRACK','AT_RISK','OFF_TRACK','UNKNOWN']);
const rootAllowed = new Set(['schema_version','publication_id','generated_at','operations']);
const operationAllowed = new Set([
  'id','short_name','title','icon','status','fidelity_pct','fidelity_uncertainty_pp',
  'target_fidelity_pct','gap_to_target_pp','live_at'
]);
const operationRequired = [...operationAllowed];

const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;
const finiteNumber = value => typeof value === 'number' && Number.isFinite(value);

function unknownKeys(errors, object, allowed, label) {
  for (const key of Object.keys(object)) {
    if (!allowed.has(key)) errors.push(`${label} contains unknown field '${key}'`);
  }
}

function required(errors, object, keys, label) {
  for (const key of keys) {
    if (!(key in object)) errors.push(`${label} missing required field '${key}'`);
  }
}

function range(errors, label, value, min, max) {
  if (!finiteNumber(value)) errors.push(`${label} must be a finite number`);
  else if (value < min || value > max) errors.push(`${label} must be between ${min} and ${max}`);
}

function validDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validatePublication(publication) {
  const errors = [];

  if (!publication || typeof publication !== 'object' || Array.isArray(publication)) {
    return ['root must be a JSON object'];
  }

  required(errors, publication, [...rootAllowed], 'publication');
  unknownKeys(errors, publication, rootAllowed, 'publication');

  if (publication.schema_version !== 'error-budgets-publication-1.0') {
    errors.push(`schema_version must equal 'error-budgets-publication-1.0'`);
  }

  if (!/^EBP-\d{8}T\d{6}Z-[0-9a-f]{7,12}$/.test(publication.publication_id || '')) {
    errors.push('publication_id must match EBP-YYYYMMDDTHHMMSSZ-<7-12 hex revision>');
  }

  if (!nonEmpty(publication.generated_at)) {
    errors.push('generated_at must be a non-empty ISO timestamp');
  } else {
    const generated = new Date(publication.generated_at);
    if (Number.isNaN(generated.getTime())) errors.push('generated_at must be a valid ISO timestamp');
  }

  if (!Array.isArray(publication.operations) || publication.operations.length === 0) {
    errors.push('operations must be a non-empty array');
  } else {
    const ids = new Set();
    publication.operations.forEach((operation, index) => {
      const label = `operations[${index}]`;
      if (!operation || typeof operation !== 'object' || Array.isArray(operation)) {
        errors.push(`${label} must be an object`);
        return;
      }

      required(errors, operation, operationRequired, label);
      unknownKeys(errors, operation, operationAllowed, label);

      if (!allowedIds.has(operation.id)) errors.push(`${label}.id '${operation.id}' is not allowed`);
      else if (ids.has(operation.id)) errors.push(`duplicate operation id '${operation.id}'`);
      else ids.add(operation.id);

      for (const key of ['short_name','title','icon']) {
        if (!nonEmpty(operation[key])) errors.push(`${label}.${key} must be a non-empty string`);
      }

      if (!allowedStatus.has(operation.status)) {
        errors.push(`${label}.status must be one of ${[...allowedStatus].join(', ')}`);
      }

      range(errors, `${label}.fidelity_pct`, operation.fidelity_pct, 0, 100);
      range(errors, `${label}.fidelity_uncertainty_pp`, operation.fidelity_uncertainty_pp, 0, 100);
      range(errors, `${label}.target_fidelity_pct`, operation.target_fidelity_pct, 0, 100);
      range(errors, `${label}.gap_to_target_pp`, operation.gap_to_target_pp, -100, 100);

      if (!validDateOnly(operation.live_at)) {
        errors.push(`${label}.live_at must be a valid YYYY-MM-DD calendar date`);
      }

      if (finiteNumber(operation.fidelity_pct) && finiteNumber(operation.target_fidelity_pct) && finiteNumber(operation.gap_to_target_pp)) {
        const expectedGap = Math.round((operation.fidelity_pct - operation.target_fidelity_pct) * 1e6) / 1e6;
        if (Math.abs(operation.gap_to_target_pp - expectedGap) > 1e-6) {
          errors.push(`${label}.gap_to_target_pp must equal fidelity_pct - target_fidelity_pct (${expectedGap})`);
        }
      }
    });
  }

  return errors;
}

export function leakErrors(publication) {
  const errors = [];
  const serialized = JSON.stringify(publication);
  const forbidden = [
    ['sentinel', /PRIVATE_SENTINEL_MUST_NEVER_BE_PUBLISHED/i],
    ['local POSIX path', /\/mnt\//i],
    ['local Windows path', /[A-Z]:\\/i],
    ['file URL', /file:\/\//i],
    ['repository URL', /github\.com\//i],
    ['GitLab URL/name', /gitlab/i],
    ['PASQAL email/domain', /@pasqal\./i]
  ];

  for (const [label, pattern] of forbidden) {
    if (pattern.test(serialized)) errors.push(`publication contains forbidden ${label}`);
  }

  return errors;
}

function fail(errors) {
  console.error('\nERROR BUDGET PUBLICATION VALIDATION FAILED');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node validate-publication.mjs <published_state.json>');
    process.exit(2);
  }

  let publication;
  try {
    publication = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail([`invalid JSON syntax: ${error.message}`]);
  }

  const errors = [...validatePublication(publication), ...leakErrors(publication)];
  if (errors.length) fail(errors);
  console.log(`PASS: ${file} (${publication.publication_id}, ${publication.operations.length} operation(s))`);
}
