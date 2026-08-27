# Error Budgets V3

Interactive static prototype implementing the **Level 1 → Level 2 → Level 3** Error Budgets information architecture.

## Route

This directory lives under `public/`, so Vite copies it unchanged into the existing GitHub Pages build at:

`/error-budgets-v3/`

It does **not** modify the root Rydberg Tweezer Ecosystem Map and does not create a second Pages deployment.

## Structure

- `index.html` — static shell and Level 1/2/3 UI containers
- `style.css` — responsive dashboard styling
- `app.js` — operation routing, Level 1 cards, dedicated pages, accordions
- `data/dashboard.json` — V3 prototype dataset

All runtime references are relative to this directory.

## Data note

V3 is deliberately conservative: it restructures the existing synthetic V2 1Q/2Q data and partial State Prep/Readout entries without asserting new scientific measurements. Movement and Analog/Protocols are explicit placeholders until an approved snapshot is supplied.

The visible layer reports **fidelity**. Error/infidelity is retained in technical details when needed for budget decomposition. The old label `Share` is replaced in the UI by `% del error total`.
