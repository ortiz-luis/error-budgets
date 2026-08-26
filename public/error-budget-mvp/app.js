const klass = (s) => (s === 'PASS' || s === 'OK') ? 'good' : (s === 'WATCH' ? 'warn' : 'bad');

fetch('./data.json', {cache: 'no-store'})
  .then((r) => r.json())
  .then((d) => {
    document.querySelector('#budget-name').textContent = d.budget.name;
    document.querySelector('#score').textContent = d.budget.score.toFixed(2) + '%';
    document.querySelector('#target').textContent = 'Target: ' + d.budget.target.toFixed(2) + '%';
    const status = document.querySelector('#budget-status');
    status.textContent = d.budget.status;
    status.className = 'badge ' + klass(d.budget.status);
    const delta = d.budget.delta_from_previous;
    document.querySelector('#delta').textContent = (delta >= 0 ? '+' : '') + delta.toFixed(2) + ' pp';
    document.querySelector('#snapshot').textContent = d.snapshot;
    document.querySelector('#generated').textContent = d.generated_at;

    document.querySelector('#contributors').innerHTML = d.contributors.map((c) => `
      <tr>
        <td><strong>${c.name}</strong></td>
        <td>${c.owner}</td>
        <td>${c.impact_pp.toFixed(2)} ± ${c.uncertainty_pp.toFixed(2)} pp</td>
        <td><span class="badge ${klass(c.status)}">${c.status}</span></td>
      </tr>`).join('');

    document.querySelector('#gates').innerHTML = d.gates.map((g) => `
      <div class="gate">
        <div><strong>${g.name}</strong><div class="muted small">${g.note}</div></div>
        <span class="badge ${klass(g.status)}">${g.status}</span>
      </div>`).join('');
  })
  .catch((err) => {
    document.querySelector('main').insertAdjacentHTML('beforeend', `<section class="card"><strong>Could not load data.json</strong><div class="muted small">${err}</div></section>`);
  });
