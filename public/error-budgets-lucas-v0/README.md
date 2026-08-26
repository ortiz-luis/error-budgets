# Error Budgets V0 — Lucas-readable prototype

Parallel GitHub Pages prototype implementing the Lucas-readable design specification.

## Why this folder exists

The main product question is cognitive, not technological: can a technical program lead open the page and understand what is known, what is incomplete, what drives each quantified operation, who owns the relevant work, what changed, and whether the displayed state can be trusted?

## Data boundary

- First names, ownership context, gap labels and evidence dates are reused from the previous Notion prototype so the UX exercises recognizable program context.
- All performance values, uncertainties, operating points, evidence payloads and computed Error Budgets are synthetic.
- No corporate GitLab URLs, internal evidence documents or real QPU targets are published here.

## Architecture

- `data.json` — canonical demo state.
- `app.js` — derived views, arithmetic checks, owner proposal and reviewer preview simulation.
- `style.css` — technical monitoring visual language.
- `build-meta.json` — overwritten at deploy time with Git SHA and timestamp.
- `index.html` — static shell.

The browser does not write the canonical state. Owner/reviewer actions use localStorage only and are explicitly labelled as simulation.

## Main UX hierarchy

1. Overview — V0 guardrail, program state, Needs attention now, operations, recent changes, Top Gaps.
2. Operations — 1Q and 2Q quantitative pilots; Movement, Initialization, Readout/SPAM and Addressability remain intentionally incomplete.
3. Improvement Targets — actionability / achievable-gain framing without inventing unsupported gains.
4. Changes — contribution/activity ledger and LIVE / ACCEPTED / CLOSED semantics.
5. Trust & Evidence — build lineage, evidence vocabulary, cross-layer source chain, maturity vocabulary and glossary.

## GitLab migration

The folder is intentionally portable. In GitLab Pages the same files can be copied to the Pages publish directory. Replace the GitHub Actions build-metadata step with the equivalent GitLab CI variables (for example commit SHA and pipeline timestamp). Canonical owner writes should eventually happen through the agreed GitLab contribution/review boundary, not from the static page.

## Cold-open acceptance test

A first-time reader should be able to answer in 30–60 seconds:

- what V0 means and what it does not mean;
- how many operations are in scope and how many are quantitatively runnable;
- which gaps need attention and who owns them;
- which operations are deliberately unquantified;
- what drives 1Q/2Q error and what remains Unknown;
- what changed recently;
- where provenance/build state is visible;
- whether a number is computed, provisional or unsupported.
