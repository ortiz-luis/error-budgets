import assert from 'node:assert/strict';
import { buildPublishedState } from './build-published-state.mjs';
import { validatePublication, leakErrors } from './validate-publication.mjs';

const sentinel = 'PRIVATE_SENTINEL_MUST_NEVER_BE_PUBLISHED';

const dashboard = {
  schema_version: 'error-budgets.1',
  site: {
    repository: 'private/source/that/must/not/be/copied'
  },
  operations: [
    {
      id: '2q',
      short_name: '2Q Gates',
      title: '2Q Gate Fidelity',
      description: `internal description ${sentinel}`,
      icon: '2Q',
      status: 'AT_RISK',
      source_branch: 'error-budgets-data/2q',
      source_commit: '1234567890abcdef',
      current_error_pct: 0.41,
      uncertainty_error_pp: 0.02,
      spec_error_pct: 0.30,
      known_attribution_pct: 100,
      live_at: '2026-08-27',
      snapshot_id: 'PRIVATE-SNAPSHOT',
      protocol: 'private protocol',
      benchmark: 'private benchmark detail',
      metric_convention: 'Fidelity = 1 - error',
      measurement_chain: `/mnt/private/${sentinel}`,
      operating_point: 'private operating point',
      target_note: `private target ${sentinel}`,
      contributors: [
        {
          name: 'Private contributor',
          share_pct: 100,
          evidence: sentinel,
          confidence: 'HIGH',
          owner: 'owner@pasqal.example'
        }
      ],
      literature_anchors: [
        {
          title: 'Public paper',
          url: 'https://example.org/paper',
          note: sentinel
        }
      ],
      history: [
        {
          author: 'Private Author',
          message: sentinel
        }
      ]
    }
  ]
};

const publication = buildPublishedState(dashboard, {
  now: new Date('2026-08-27T22:00:00.000Z'),
  sourceRevision: 'abcdef1'
});

assert.equal(publication.schema_version, 'error-budgets-publication-1.0');
assert.equal(publication.publication_id, 'EBP-20260827T220000Z-abcdef1');
assert.equal(publication.operations.length, 1);
assert.deepEqual(Object.keys(publication.operations[0]), [
  'id',
  'short_name',
  'title',
  'icon',
  'status',
  'fidelity_pct',
  'fidelity_uncertainty_pp',
  'target_fidelity_pct',
  'gap_to_target_pp',
  'live_at'
]);
assert.equal(publication.operations[0].fidelity_pct, 99.59);
assert.equal(publication.operations[0].target_fidelity_pct, 99.7);
assert.equal(publication.operations[0].gap_to_target_pp, -0.11);

const serialized = JSON.stringify(publication);
for (const forbidden of [
  sentinel,
  'measurement_chain',
  'operating_point',
  'target_note',
  'contributors',
  'owner',
  'evidence',
  'source_branch',
  'source_commit',
  'snapshot_id',
  'history',
  'current_error_pct',
  'spec_error_pct'
]) {
  assert.equal(serialized.includes(forbidden), false, `publication leaked '${forbidden}'`);
}

assert.deepEqual(validatePublication(publication), []);
assert.deepEqual(leakErrors(publication), []);

const unexpected = structuredClone(publication);
unexpected.operations[0].owner = 'should fail';
assert.ok(validatePublication(unexpected).some(error => error.includes("unknown field 'owner'")));

const poisoned = structuredClone(publication);
poisoned.operations[0].title = sentinel;
assert.ok(leakErrors(poisoned).some(error => error.includes('sentinel')));

console.log('PASS: publication gate allowlist, derived fidelity fields, unknown-field rejection and sentinel leak protection.');
