# Error Budgets V4

V4 keeps V3 intact and makes the scientific content commit-driven.

## Contract

- No scientific number is authored in `index.html`, `style.css` or `app.js`.
- One authoritative JSON file carries the complete current snapshot for each operation: `data/operations/<operation>.json`.
- Each operation has its own branch: `error-budget/1q`, `error-budget/2q`, `error-budget/initialization`, `error-budget/readout`, `error-budget/movement`, `error-budget/analog`.
- A new valid commit changing an operation JSON is a new scientific snapshot for that operation.
- `scripts/build-dashboard.mjs` reads the latest file from every operation branch and reconstructs the historical series from Git commits affecting that file.
- `data/dashboard.json` is generated at deploy time and is not scientific authority.
- Historical plots show fidelity uncertainty as vertical error bars. Current values and contributor tables show uncertainties explicitly.
- All V4 seed values are **synthetic, literature-informed prototype data**. They are not PASQAL measurements and are not claims about the cited laboratories.

## Updating one operation

Checkout its branch, edit only its authoritative file, keep `snapshot_id` unique, update `live_at`, commit, and push. Example for 2Q: edit `public/error-budgets-v4/data/operations/2q.json` on `error-budget/2q`. The Pages workflow rebuilds the aggregate dashboard and the new commit becomes the next point in the 2Q history plot.

## Validation expectations

Every quantitative snapshot must contain `current_error_pct`, `uncertainty_error_pp`, `spec_error_pct`, a complete contributor list with uncertainty fields, provenance metadata, and literature anchors for synthetic prototype values. Contributor shares should sum to 100% for the additive prototype accounting used by this UI.
