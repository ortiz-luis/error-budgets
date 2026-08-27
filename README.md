# Error Budgets

Standalone, commit-backed error-budget dashboard for neutral-atom QPU operations.

## Scope

The dashboard currently covers 1Q gates, 2Q gates, movement/shuttling, state preparation, readout/SPAM, addressability, and analog/protocol performance. Prototype values are synthetic and literature-informed unless explicitly stated otherwise.

## Data model

Each operation has an independent `error-budgets-data/*` branch. Commits on those branches are treated as scientific snapshots and are reconstructed into fidelity histories and SourceTree-style provenance views.

## Build

The validation workflow builds the commit-backed dataset and assembles `public/error-budgets/` as the root standalone artifact in `dist/`.

This branch intentionally contains no Rydberg Tweezer Ecosystem Map application or dataset.