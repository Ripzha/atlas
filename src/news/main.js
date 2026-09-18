/**
 * SimsWelt News - Kiosk
 * Renders the header stats, the latest issue (hero) and the archive grid.
 */

import { issues } from "./issues.js?v=202609181817";


// Stats
const total = issues.length;
const bald = issues.filter(i => !i.href).length;
document.getElementById('stats').innerHTML = `
  <span class="stat">${total} Ausgaben <span>gesamt</span></span>
  ${bald > 0 ? `<span class="stat">${bald} <span>folgen bald</span></span>` : ''}
`;

// Hero
const l = issues[0];
document.getElementById('hero').innerHTML = `
  <a href="${l.href}" target="_blank" rel="noopener" style="text-decoration:none;display:block;max-width:700px;">
  <div class="hero-card">
    <div class="hero-cover">
      <img src="${l.shot}" alt="Cover Ausgabe ${l.nr}">
    </div>
    <div class="hero-info">
      <span class="hero-badge">● Aktuelle Ausgabe</span>
      <p class="hero-nr">Ausgabe ${l.nr}</p>
      ${l.season ? `<p class="hero-season">${l.season}</p>` : ''}
      <div class="hero-divider"></div>
      <p class="hero-desc">Das Magazin der SimsWelt — Stories, Kolumnen, Lokales und mehr aus allen Ecken von Simswelt.</p>
      <span class="hero-read">Jetzt lesen →</span>
    </div>
  </div>
  </a>`;

// Grid
const grid = document.getElementById('grid');
issues.forEach((issue, i) => {
  const hasLink = !!(issue.href && issue.shot);
  const card = document.createElement('div');
  card.className = 'card' + (i === 0 ? ' is-latest' : '') + (!hasLink ? ' no-link' : '');
  const coverHTML = hasLink
    ? `<img src="${issue.shot}" alt="Cover Ausgabe ${issue.nr}"><div class="card-overlay"><span class="read-lbl">Lesen</span></div>`
    : `<div class="cover-ph"><span class="ph-nr">${issue.nr}</span><span class="ph-lbl">Ausgabe</span></div>`;
  card.innerHTML = `
    ${hasLink ? `<a href="${issue.href}" target="_blank" rel="noopener" style="text-decoration:none;display:block;color:inherit;">` : ''}
    <div class="card-inner">
      <div class="card-cover">${coverHTML}</div>
      <div class="card-meta">
        <p class="card-nr">Ausgabe ${issue.nr}</p>
        ${issue.season ? `<p class="card-season">${issue.season}</p>` : ''}
        ${!hasLink ? `<p class="card-soon">Folgt bald</p>` : ''}
      </div>
    </div>
    ${hasLink ? '</a>' : ''}`;
  grid.appendChild(card);
});
