# Error Budgets

Standalone, commit-backed Error Budgets dashboard for neutral-atom QPU operations.

Live dashboard: https://ortiz-luis.github.io/error-budgets/

Repository: https://github.com/ortiz-luis/error-budgets

## What this project does

This repository turns per-operation Error Budget JSON files into a public, traceable dashboard. Each operation has its own data branch. Every accepted JSON update becomes a Git commit, and the dashboard reconstructs the operation history from those commits.

The intended operating model is simple:

```text
scientific program or analysis
        ↓
operation JSON
        ↓
validation
        ↓
git commit + push
        ↓
GitHub Actions validation
        ↓
dashboard rebuild
        ↓
GitHub Pages
```

A valid push updates the dashboard automatically. An invalid JSON must not be allowed to publish a broken dashboard.

## Current scope

The dashboard currently supports these operation IDs and canonical data branches:

| Operation | ID | Canonical branch |
| --- | --- | --- |
| 1Q Gates | `1q` | `error-budgets-data/1q` |
| 2Q Gates | `2q` | `error-budgets-data/2q` |
| Movement / Shuttling | `movement` | `error-budgets-data/movement` |
| State Preparation | `initialization` | `error-budgets-data/initialization` |
| Readout / SPAM | `readout` | `error-budgets-data/readout` |
| Addressability | `addressability` | `error-budgets-data/addressability` |
| Analog / Protocol Performance | `analog` | `error-budgets-data/analog` |

Prototype values are synthetic and literature-informed unless explicitly stated otherwise.

## Repository architecture

`main` contains the dashboard application, validation logic, JSON contract and GitHub Actions workflows.

The scientific/data authority for each operation lives on its own `error-budgets-data/<id>` branch. The file path is always:

```text
public/error-budgets/data/operations/<id>.json
```

For example, the current 2Q snapshot lives at:

```text
branch: error-budgets-data/2q
file:   public/error-budgets/data/operations/2q.json
```

The dashboard generator reads the latest valid JSON from each operation branch and also reconstructs historical fidelity points from the Git history of that file.

A commit therefore serves two purposes:

1. it updates the current operation state;
2. it creates a permanently traceable historical snapshot for the dashboard.

## Fidelity convention

The visible dashboard uses fidelity as the primary metric.

The JSON stores the operation error as `current_error_pct`, and the dashboard converts it using:

```text
fidelity_pct = 100 - current_error_pct
```

Example:

```json
"current_error_pct": 0.41
```

corresponds to:

```text
99.59% fidelity
```

The uncertainty field `uncertainty_error_pp` is expressed in percentage points and is propagated directly to the displayed fidelity uncertainty.

## JSON contract

Every operation JSON must use:

```json
"schema_version": "error-budget-operation-1.0"
```

The formal machine-readable contract is stored in:

```text
public/error-budgets/schema/error-budget-operation.schema.json
```

The strict executable validator is:

```text
public/error-budgets/scripts/validate-operation.mjs
```

The validator is intentionally strict. Unknown fields are rejected so that spelling mistakes do not silently enter the data model.

### Required top-level fields

Every operation JSON must contain all of the following fields:

```text
schema_version
id
short_name
title
description
icon
status
source_branch
current_error_pct
uncertainty_error_pp
spec_error_pct
known_attribution_pct
live_at
snapshot_id
protocol
benchmark
metric_convention
measurement_chain
operating_point
target_note
contributors
literature_anchors
```

No additional top-level fields are accepted by the current validator.

### Operation identity

`id` must be one of:

```text
1q
2q
movement
initialization
readout
addressability
analog
```

The JSON must also point to the matching canonical branch. For example:

```json
{
  "id": "2q",
  "source_branch": "error-budgets-data/2q"
}
```

A 2Q JSON pushed as a Movement snapshot is invalid.

### Status

Allowed values are:

```text
ON_TRACK
AT_RISK
OFF_TRACK
UNKNOWN
```

### Dates

`live_at` must use the exact format:

```text
YYYY-MM-DD
```

and must represent a valid calendar date.

### Numeric fields

These fields must be finite numeric values between 0 and 100:

```text
current_error_pct
uncertainty_error_pp
spec_error_pct
known_attribution_pct
```

The same bounded numeric validation applies to contributor percentages and uncertainty values.

## Contributor model

`contributors` must be a non-empty array.

Every contributor must contain exactly these fields:

```text
name
share_pct
share_uncertainty_pct
impact_error_pp
uncertainty_pp
evidence
confidence
owner
```

Example:

```json
{
  "name": "Rydberg lifetime / decay",
  "share_pct": 22,
  "share_uncertainty_pct": 4,
  "impact_error_pp": 0.090,
  "uncertainty_pp": 0.018,
  "evidence": "synthetic model",
  "confidence": "HIGH",
  "owner": "AMO"
}
```

The current contract enforces several consistency rules:

- contributor names must be unique inside one operation snapshot;
- all contributor shares must sum to `100 ± 0.01`;
- contributor `impact_error_pp` values must sum to `current_error_pct ± 0.02`;
- uncertainty fields must be present and numeric;
- `confidence` must be `HIGH`, `MEDIUM` or `LOW`;
- `owner` must be a non-empty string or `null`.

These checks make the JSON not only syntactically valid, but internally coherent as an Error Budget.

## Literature anchors

`literature_anchors` must be an array. Each entry must contain exactly:

```text
title
url
note
```

Example:

```json
{
  "title": "Evered et al., Nature 622 (2023)",
  "url": "https://doi.org/10.1038/s41586-023-06481-y",
  "note": "Used to anchor the expected physical error-source families."
}
```

URLs must use `https://`.

## Validating a JSON manually

From a clone of the repository, run:

```bash
node public/error-budgets/scripts/validate-operation.mjs public/error-budgets/data/operations/2q.json --expected-id 2q --expected-branch error-budgets-data/2q
```

A valid file returns a message such as:

```text
PASS: public/error-budgets/data/operations/2q.json (2q, snapshot SYN-2Q-0004)
```

An invalid file returns a detailed error list and exits with a non-zero status.

Example:

```text
ERROR BUDGET JSON VALIDATION FAILED
 - contributor share_pct values sum to 97, expected 100 ± 0.01
 - source_branch must be 'error-budgets-data/2q'
```

## Local protection: pre-commit and pre-push

The repository includes versioned Git hooks that validate operation JSON before a commit and again before a push.

Install them once in a local clone with:

```bash
bash scripts/install-git-hooks.sh
```

The installer configures the repository to use the versioned hooks shipped with the project.

After installation:

```text
git commit
   ↓
local JSON validation
   ↓
PASS → commit created
FAIL → commit blocked
```

and:

```text
git push
   ↓
local JSON validation
   ↓
PASS → push continues
FAIL → push blocked
```

These hooks are the fastest feedback layer for contributors. They catch mistakes before they leave the developer machine.

Git hooks are local by nature and can technically be bypassed with Git options such as `--no-verify`; therefore they are not the final security boundary.

## Server-side fail-closed protection

GitHub Actions provides the authoritative protection layer.

The workflow:

```text
.github/workflows/request-data-refresh.yml
```

reacts to changes in operation files on branches matching:

```text
error-budgets-data/**
```

The workflow validates the pushed operation JSON before requesting a new Pages build.

The expected behavior is:

```text
valid JSON
   ↓
validation PASS
   ↓
request dashboard rebuild
   ↓
GitHub Pages updated
```

while an invalid snapshot follows:

```text
invalid JSON
   ↓
validation FAIL
   ↓
NO dashboard refresh
   ↓
last valid published dashboard remains available
```

This is the important fail-closed property: malformed data must not replace the currently published valid dashboard.

## Publishing pipeline

The main publisher is:

```text
.github/workflows/deploy.yml
```

It performs the following steps:

1. checks out `main`;
2. fetches every `error-budgets-data/*` branch;
3. builds the commit-backed dataset;
4. strictly validates every current operation snapshot;
5. reconstructs each operation history from Git commits;
6. writes the generated dashboard dataset;
7. assembles the standalone site into `dist/`;
8. validates the deployment artifact;
9. publishes the artifact to GitHub Pages.

The generated dashboard dataset is:

```text
public/error-budgets/data/dashboard.json
```

It is a build artifact. The authority remains the per-operation JSON files and their Git commit histories.

## Updating an operation

A normal contributor workflow is:

### 1. Generate the JSON

The scientific program, notebook or analysis tool should output a complete JSON conforming to `error-budget-operation-1.0`.

### 2. Switch to the operation branch

Example for 2Q:

```bash
git fetch origin && git checkout -B error-budgets-data/2q origin/error-budgets-data/2q
```

### 3. Replace the canonical operation file

```bash
cp /path/to/generated_2q.json public/error-budgets/data/operations/2q.json
```

### 4. Commit

```bash
git add public/error-budgets/data/operations/2q.json && git commit -m "Update 2Q Error Budget"
```

With the hooks installed, the commit is blocked immediately if the JSON violates the contract.

### 5. Push

```bash
git push origin error-budgets-data/2q
```

The push triggers the GitHub validation and publication pipeline automatically.

No manual modification of `dashboard.json` is required or desired.

## Snapshot IDs

`snapshot_id` should identify the scientific state represented by a commit.

A useful convention is:

```text
<dataset-or-environment>-<operation>-<sequence>
```

Examples:

```text
SYN-1Q-0004
SYN-2Q-0006
SYN-MV-0003
```

The Git commit remains the immutable provenance identifier. `snapshot_id` is the human-readable scientific identifier displayed and carried through the dataset.

## Historical plots and provenance

The dashboard does not require a separate time-series database.

For each operation, the generator walks the Git history of:

```text
public/error-budgets/data/operations/<id>.json
```

Each valid historical commit becomes one historical point containing information such as:

```text
fidelity
uncertainty
snapshot ID
commit SHA
author
commit date
commit message
status
```

This is why operation updates should replace the canonical JSON and create a new commit rather than manually editing a generated history file.

## Building locally

From `main`, fetch the data branches first:

```bash
git fetch --prune origin '+refs/heads/error-budgets-data/*:refs/remotes/origin/error-budgets-data/*'
```

Then run:

```bash
node public/error-budgets/scripts/build-dashboard.mjs
```

A successful build prints:

```text
Generated canonical Error Budgets dashboard with 7 validated operation(s).
```

The static application source is currently stored under:

```text
public/error-budgets/
```

The GitHub Pages workflow copies that directory into the root of the deployment artifact, so the public URL is:

```text
https://ortiz-luis.github.io/error-budgets/
```

## Files a new contributor should know

```text
README.md
    This document.

public/error-budgets/data/operations/<id>.json
    Canonical operation snapshot on each operation branch.

public/error-budgets/schema/error-budget-operation.schema.json
    Formal JSON contract.

public/error-budgets/scripts/validate-operation.mjs
    Strict operation validator.

public/error-budgets/scripts/build-dashboard.mjs
    Commit-backed dashboard generator.

scripts/install-git-hooks.sh
    Installs local commit/push validation hooks.

.github/workflows/request-data-refresh.yml
    Validates data-branch pushes and requests a refresh only after PASS.

.github/workflows/deploy.yml
    Builds and publishes the standalone GitHub Pages site.
```

## What contributors should not do

Do not manually edit `dashboard.json` as scientific input.

Do not put one operation's JSON on another operation branch.

Do not add undocumented fields to the JSON.

Do not remove uncertainty information merely to make validation pass.

Do not force contributor shares to 100 by hiding an unexplained remainder; represent unexplained contribution explicitly, for example as `Residual / other`, when scientifically appropriate.

Do not bypass a validation failure without understanding and correcting the cause.

Do not merge the operation data branches into `main`. They are deliberately independent scientific histories consumed by the dashboard generator.

## Design principle

The dashboard is a presentation layer over traceable scientific snapshots, not the source of scientific truth.

The source of truth is:

```text
operation JSON
+
its canonical operation branch
+
its Git commit history
```

The dashboard can therefore be rebuilt from the repository state, every visible historical point can be tied back to a commit, and invalid new data is prevented from replacing the last valid published state.
