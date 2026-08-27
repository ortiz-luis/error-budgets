import fs from 'node:fs';
import cp from 'node:child_process';
import { validatePublication, leakErrors } from './validate-publication.mjs';

const inputPath = 'public/error-budgets/data/dashboard.json';
const outputPath = 'public/error-budgets/data/published_state.json';

const round = value => Math.round(Number(value) * 1e6) / 1e6;
const nonEmpty = value => typeof value === 'string' && value.trim().length > 0;

function gitShortRevision() {
  try {
    const sha = cp.execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    if (/^[0-9a-f]{7,12}$/.test(sha)) return sha;
  } catch {}
  return '0000000';
}

function publicationStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildPublishedState(dashboard, { now = new Date(), sourceRevision = gitShortRevision() } = {}) {
  if (!dashboard || typeof dashboard !== 'object' || Array.isArray(dashboard)) {
    throw new Error('dashboard root must be an object');
  }
  if (!Array.isArray(dashboard.operations) || dashboard.operations.length === 0) {
    throw new Error('dashboard.operations must be a non-empty array');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('now must be a valid Date');
  }
  if (!/^[0-9a-f]{7,12}$/.test(sourceRevision)) {
    throw new Error('sourceRevision must be a 7-12 character lowercase hexadecimal revision');
  }

  const generatedAt = now.toISOString();
  const publicationId = `EBP-${publicationStamp(now)}-${sourceRevision}`;

  const operations = dashboard.operations.map(source => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('each dashboard operation must be an object');
    }

    // Publication allowlist: construct every output property explicitly.
    // Do not spread/copy the source object here.
    const fidelityPct = round(100 - Number(source.current_error_pct));
    const targetFidelityPct = round(100 - Number(source.spec_error_pct));

    return {
      id: source.id,
      short_name: source.short_name,
      title: source.title,
      icon: source.icon,
      status: source.status,
      fidelity_pct: fidelityPct,
      fidelity_uncertainty_pp: round(source.uncertainty_error_pp),
      target_fidelity_pct: targetFidelityPct,
      gap_to_target_pp: round(fidelityPct - targetFidelityPct),
      live_at: source.live_at
    };
  });

  const published = {
    schema_version: 'error-budgets-publication-1.0',
    publication_id: publicationId,
    generated_at: generatedAt,
    operations
  };

  const errors = validatePublication(published);
  errors.push(...leakErrors(published));
  if (errors.length) {
    throw new Error(`publication validation failed:\n - ${errors.join('\n - ')}`);
  }

  return published;
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Missing ${inputPath}. Run build-dashboard.mjs first.`);
    process.exit(2);
  }

  let dashboard;
  try {
    dashboard = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (error) {
    console.error(`Unable to read ${inputPath}: ${error.message}`);
    process.exit(2);
  }

  try {
    const published = buildPublishedState(dashboard);
    fs.writeFileSync(outputPath, JSON.stringify(published, null, 2) + '\n');
    console.log(`Generated ${outputPath} (${published.publication_id}, ${published.operations.length} operation(s)).`);
  } catch (error) {
    console.error(`ERROR BUDGET PUBLICATION GATE FAILED\n${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
