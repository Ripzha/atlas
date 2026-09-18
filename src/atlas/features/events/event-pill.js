/* PROJECT ATLAS - Event pill and event panel. */

(function() {
  // === CONFIGURATION ===========================================================
  // Apps Script URL — only changes when the script is deployed as a new version
  const ATLAS_EVT_API = 'https://script.google.com/macros/s/AKfycbzJ_fMI1LBjmFAQDhjD1sr3hJtdUj4OOor_WiWX3asl_eX0FXDN1wr64cNON3odhHdX/exec';

  // CSS selector of the container the pill lives in.
  // The forum header renders particles via particles.js on <canvas id="particleoverlay">.
  // A canvas cannot have children, so we target its parent container instead.
  // Multiple selectors comma-separated; the first match wins.
  const ATLAS_EVT_ANCHOR = '#center';

  // ============================================================================

  let currentEvents = [];
  let currentEventIdx = 0;

  // ATLAS context: always fetch when events exist.
  // View-specific visibility (map, character view, etc.) is handled in CSS via body:has().
  function shouldShowPillOnThisPage() {
    return true;
  }

  document.addEventListener('DOMContentLoaded', init);
  if (document.readyState === 'interactive' || document.readyState === 'complete') init();

  function init() {
    if (window.__atlasEventInit) return;
    window.__atlasEventInit = true;
    fetchEvents();
  }

  function fetchEvents() {
    fetch(ATLAS_EVT_API + '?action=events', { method: 'GET' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        const allEvents = (data && data.events) || [];
        currentEvents = allEvents.filter(function(e) {
          return e.summaries && e.summaries.all && e.summaries.all.trim().length > 0;
        });
        if (currentEvents.length === 0) return;
        renderPill(currentEvents[0]);
      })
      .catch(function(e) { console.warn('[ATLAS Events] Fetch fehlgeschlagen:', e); });
  }

  function renderPill(evt) {
    // Find anchor
    let anchor = null;
    const selectors = ATLAS_EVT_ANCHOR.split(',').map(function(s) { return s.trim(); });
    for (let i = 0; i < selectors.length; i++) {
      const el = document.querySelector(selectors[i]);
      if (el) { anchor = el; break; }
    }
    // If the anchor element is a <canvas> (e.g. particles.js), it cannot have
    // children — use its parent container instead.
    if (anchor && anchor.tagName === 'CANVAS' && anchor.parentNode) {
      anchor = anchor.parentNode;
    }

    const pill = document.createElement('div');
    pill.id = 'atlasEventPill';
    pill.innerHTML =
      '<span class="atlas-pill-icon">' + (evt.icon || '&#128220;') + '</span>' +
      '<div class="atlas-pill-text">' +
        '<div class="atlas-pill-label">Laufendes Event</div>' +
        '<div class="atlas-pill-name">' + escapeHtml(evt.name) + '</div>' +
      '</div>';

    const hint = document.createElement('div');
    hint.id = 'atlasEventPillHint';
    hint.textContent = '\u26A0\uFE0F Zusammenfassung enthält Spoiler';

    // Mobile: append the pill directly to body so no parent container breaks its size.
    // Desktop: append to the anchor (header) so it sits as part of the header.
    const isMobile = window.innerWidth <= 768 || window.__atlasForceMobile === true;

    if (isMobile) {
      document.body.appendChild(pill);
      document.body.appendChild(hint);
      // Small pill bottom left — nothing else is there on the continent map.
      // On a world map a CSS override (body:has(#world-container.active)) moves it bottom right.
      pill.style.setProperty('position', 'fixed', 'important');
      pill.style.setProperty('top', 'auto', 'important');
      pill.style.setProperty('bottom', 'calc(110px + env(safe-area-inset-bottom))', 'important');
      pill.style.setProperty('left', '8px', 'important');
      pill.style.setProperty('right', 'auto', 'important');
      pill.style.setProperty('transform', 'none', 'important');
      pill.style.setProperty('padding', '5px 12px 5px 8px', 'important');
      pill.style.setProperty('max-width', 'calc(100vw - 16px)', 'important');
      pill.style.setProperty('width', 'auto', 'important');
      pill.style.setProperty('display', 'flex', 'important');
      pill.style.setProperty('justify-content', 'flex-start', 'important');
    } else if (anchor) {
      const cs = window.getComputedStyle(anchor);
      if (cs.position === 'static') anchor.style.position = 'relative';
      anchor.appendChild(pill);
      anchor.appendChild(hint);
    } else {
      pill.classList.add('atlas-fixed');
      hint.classList.add('atlas-fixed');
      document.body.appendChild(pill);
      document.body.appendChild(hint);
    }

    pill.addEventListener('click', openPanel);
  }

  function openPanel() {
    const evt = currentEvents[currentEventIdx];
    if (!evt) return;

    // Build backdrop + panel
    let backdrop = document.getElementById('atlasEventBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'atlasEventBackdrop';
      backdrop.addEventListener('click', closePanel);
      document.body.appendChild(backdrop);
    }

    let panel = document.getElementById('atlasEventPanel');
    if (panel) panel.remove();
    panel = buildPanel(evt);
    document.body.appendChild(panel);

    // Trigger transition
    requestAnimationFrame(function() {
      backdrop.classList.add('open');
      panel.classList.add('open');
      // Hide the pill via a CSS class with !important (overrides mobile visibility)
      const pill = document.getElementById('atlasEventPill');
      if (pill) pill.classList.add('atlas-pill-hidden');
    });
  }

  function closePanel() {
    const panel = document.getElementById('atlasEventPanel');
    const backdrop = document.getElementById('atlasEventBackdrop');
    if (panel) panel.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
    const pill = document.getElementById('atlasEventPill');
    if (pill) pill.classList.remove('atlas-pill-hidden');
  }

  function buildPanel(evt) {
    const panel = document.createElement('div');
    panel.id = 'atlasEventPanel';

    const summaries = evt.summaries || { all: '', byChar: {}, activeChars: [] };
    const activeChars = summaries.activeChars || [];

    // Tabs
    let tabsHtml = '<button class="atlas-tab active" data-tab="all">Übersicht</button>';
    activeChars.forEach(function(c) {
      tabsHtml += '<button class="atlas-tab" data-tab="' + escapeAttr(c) + '">' + escapeHtml(c) + '</button>';
    });

    // Contents
    const overviewText = summaries.all || 'Noch keine Zusammenfassung verfügbar. Wird beim nächsten Update generiert.';
    let contentsHtml = '<div class="atlas-tab-content active" data-content="all">' + escapeHtml(overviewText) + '</div>';
    activeChars.forEach(function(c) {
      const charText = (summaries.byChar && summaries.byChar[c]) || '—';
      contentsHtml += '<div class="atlas-tab-content" data-content="' + escapeAttr(c) + '">' + escapeHtml(charText) + '</div>';
    });

    panel.innerHTML =
      '<div class="atlas-panel-head">' +
        '<div class="atlas-panel-head-row">' +
          '<div>' +
            '<div class="atlas-panel-tag">Laufendes Event</div>' +
            '<div class="atlas-panel-title">' +
              '<span class="atlas-icon">' + (evt.icon || '&#128220;') + '</span>' +
              '<span>' + escapeHtml(evt.name) + '</span>' +
            '</div>' +
          '</div>' +
          '<button class="atlas-panel-close" type="button" aria-label="Schliessen">&#10005;</button>' +
        '</div>' +
        (evt.description ? '<div class="atlas-panel-desc">' + escapeHtml(evt.description) + '</div>' : '') +
        '<div class="atlas-panel-meta">' +
          '<a href="' + escapeAttr(evt.startUrl) + '" target="_blank" rel="noopener">&#8594; Zum Eventstart</a>' +
          (evt.postCount ? '<span>· ' + evt.postCount + ' Posts</span>' : '') +
        '</div>' +
        '<div class="atlas-disclaimer">\u26A0\uFE0F KI-generiert. Kann halluzinieren. Bei Unsicherheit zum Originalpost springen.</div>' +
      '</div>' +
      '<div class="atlas-tabs">' + tabsHtml + '</div>' +
      contentsHtml +
      '<div class="atlas-panel-foot">' +
        '<a class="atlas-last-post" href="' + escapeAttr(evt.lastPostUrl || evt.startUrl) + '" target="_blank" rel="noopener">&#8594; Zum letzten Post</a>' +
        (evt.lastUpdated ? '<span class="atlas-updated">Aktualisiert: ' + escapeHtml(evt.lastUpdated) + '</span>' : '') +
      '</div>';

    // Wire up
    panel.querySelector('.atlas-panel-close').addEventListener('click', closePanel);
    panel.querySelectorAll('.atlas-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        const target = tab.getAttribute('data-tab');
        panel.querySelectorAll('.atlas-tab').forEach(function(t) { t.classList.remove('active'); });
        panel.querySelectorAll('.atlas-tab-content').forEach(function(c) { c.classList.remove('active'); });
        tab.classList.add('active');
        panel.querySelector('[data-content="' + target.replace(/"/g,'\\"') + '"]').classList.add('active');
      });
    });

    return panel;
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function escapeAttr(s) {
    if (s == null) return '';
    return String(s).replace(/"/g, '&quot;');
  }
})();
