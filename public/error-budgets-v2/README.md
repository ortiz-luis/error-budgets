# Error Budgets V2 — replaceable data contract

This page is fully data-driven. The HTML does not contain the Error Budget numbers.

## Replaceable inputs

- `data/program.json` — program metadata, V0 definition, operation manifest, accepted date.
- `data/operations/1q.json` — synthetic 1Q pilot.
- `data/operations/2q.json` — synthetic 2Q pilot.
- `data/operations/movement.json` — partial Movement contract.
- `data/operations/state-prep.json` — partial State Preparation contract.
- `data/operations/readout.json` — partial Readout/SPAM contract.
- `data/operations/addressability.json` — partial Addressability contract.

The browser loads these files with `fetch()` and recomputes:

- number of pilots and pending operations;
- technical/governance gap counts;
- `Needs attention now`;
- operation status selectors;
- 100% stacked Error Budget composition;
- arithmetic closure and Trust status;
- owner/reviewer/date metadata;
- technical detail table and provenance.

## MVP owner input concept

For this GitHub laboratory, one operation JSON is the replaceable unit because it keeps the prototype easy to inspect. In a production GitLab implementation, the operation JSON should be generated from smaller owner assertions such as:

```json
{
  "contribution_id": "EB.2Q.DC_INTENSITY",
  "operation": "2q",
  "impact": 0.4122,
  "uncertainty": 0.030,
  "unit": "%",
  "owner": "Selim",
  "operating_point": "OP-RYD-A",
  "method": "dc_intensity_v3",
  "evidence": {
    "url": "...",
    "version": "v3",
    "date": "2026-08-23",
    "hash": "..."
  }
}
```

CI would validate those assertions, generate the operation state, and publish this page.

## Safety boundary

All performance values in this public demo are synthetic. Names are present only to make the workflow realistic; they do not imply that the public numerical values belong to those people or to production QPUs.
