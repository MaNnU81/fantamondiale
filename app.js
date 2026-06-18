const API = 'https://script.google.com/macros/s/AKfycbzHa5LtE26ccB_h3rCriHNVCitVbK2aBfBo8D_QHd9dT3TwS1HOLKczZogMsakPw2vm/exec';

const NATIONS = {
  chiara: [
    { name: 'Brasile',       flag: '🇧🇷' },
    { name: 'Portogallo',    flag: '🇵🇹' },
    { name: 'Norvegia',      flag: '🇳🇴' },
    { name: 'England',       flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Paesi Bassi',   flag: '🇳🇱' },
    { name: 'Corea del Sud', flag: '🇰🇷' },
    { name: 'Turchia',       flag: '🇹🇷' },
    { name: 'Belgio',        flag: '🇧🇪' },
  ],
  mannu: [
    { name: 'Spagna',    flag: '🇪🇸' },
    { name: 'Francia',   flag: '🇫🇷' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Germania',  flag: '🇩🇪' },
    { name: 'Croazia',   flag: '🇭🇷' },
    { name: 'Marocco',   flag: '🇲🇦' },
    { name: 'Ecuador',   flag: '🇪🇨' },
    { name: 'Giappone',  flag: '🇯🇵' },
  ]
};

const PHASE_ORDER = [5, 6, 8, 12, 18];
const FINAL_TIER   = [10, 30]; // mutuamente esclusivi, richiedono 18 attivo

let state      = {};
let editingKey = null;
let activePhases   = new Set();
let topScorerActive = false;

// ─── UTILS ───────────────────────────────────────────────
function calcPts(w, d, phases, topScorer) {
  const base = w * 3 + d + [...phases].reduce((sum, p) => sum + p, 0);
  return base + (topScorer ? 10 : 0);
}

function setStatus(type, txt) {
  document.getElementById('sdot').className = 'status-dot ' + type;
  document.getElementById('stxt').textContent = txt;
}

function defaultState() {
  const s = {};
  ['chiara', 'mannu'].forEach(pl =>
    NATIONS[pl].forEach(n => { s[pl + '_' + n.name] = { wins: 0, draws: 0, phases: [] }; })
  );
  return s;
}

// ─── API ─────────────────────────────────────────────────
async function loadState() {
  setStatus('', 'caricamento...');
  try {
    const r    = await fetch(API + '?t=' + Date.now(), { redirect: 'follow' });
    const data = JSON.parse(await r.text());
    state = (data && typeof data === 'object' && !data.error) ? data : defaultState();
    setStatus('ok', 'dati caricati');
  } catch (e) {
    state = defaultState();
    setStatus('err', 'offline — modifiche non salvate');
  }
  render();
}

async function saveState() {
  setStatus('', 'salvataggio...');
  try {
    await fetch(API, { method: 'POST', body: JSON.stringify(state), headers: { 'Content-Type': 'text/plain' } });
    setStatus('ok', 'salvato ✓');
  } catch (e) {
    setStatus('err', 'errore salvataggio');
  }
}

// ─── RENDER ──────────────────────────────────────────────
function render() {
  let ct = 0, mt = 0;
  ['chiara', 'mannu'].forEach(pl => {
    const container = document.getElementById(pl + '-nations');
    container.innerHTML = '';
    let tot = 0;

    NATIONS[pl].forEach(n => {
      const key = pl + '_' + n.name;
      const d   = state[key] || { wins: 0, draws: 0, phases: [] };
      const pts = calcPts(d.wins, d.draws, new Set(d.phases || []), d.topScorer);
      tot += pts;

      const row = document.createElement('div');
      row.className = 'nation-row';
      row.innerHTML = `
        <span class="flag">${n.flag}</span>
        <span class="nation-name">${n.name}</span>
        <span class="nation-pts ${pts > 0 ? 'hi' : ''}">${pts}pt</span>
        <button class="edit-btn" onclick="openModal('${pl}','${n.name}')" aria-label="Modifica ${n.name}">✏️</button>
      `;
      container.appendChild(row);
    });

    document.getElementById(pl + '-total').textContent = tot + ' pt';
    if (pl === 'chiara') ct = tot; else mt = tot;
  });

  const b = document.getElementById('leader');
  if (ct === 0 && mt === 0)
    b.innerHTML = '<span style="color:var(--text-muted)">Nessun punto ancora — si parte!</span>';
  else if (ct > mt)
    b.innerHTML = `🏅 In testa <strong class="chiara-color">Chiara</strong> &mdash; +${ct - mt} pt`;
  else if (mt > ct)
    b.innerHTML = `🏅 In testa <strong class="mannu-color">Mannu</strong> &mdash; +${mt - ct} pt`;
  else
    b.innerHTML = `🤝 Pari! <span class="chiara-color">${ct}</span> — <span class="mannu-color">${mt}</span> pt`;
}

// ─── COUNTER ─────────────────────────────────────────────
function changeVal(id, delta) {
  const input  = document.getElementById(id);
  const newVal = Math.max(0, (parseInt(input.value) || 0) + delta);
  input.value  = newVal;
  updatePreview();
}

// ─── MODAL ───────────────────────────────────────────────
function openModal(pl, name) {
  editingKey = pl + '_' + name;
  const d = state[editingKey] || { wins: 0, draws: 0, phases: [], topScorer: false };
  const n = NATIONS[pl].find(x => x.name === name);

  document.getElementById('modal-title').innerHTML = `<span>${n.flag}</span> ${name}`;
  document.getElementById('inp-wins').value  = d.wins;
  document.getElementById('inp-draws').value = d.draws;
  activePhases     = new Set(d.phases || []);
  topScorerActive  = !!d.topScorer;
  maybeShowTopScorerBonus(pl, name);
  const tsBtn = document.getElementById('topscorer-btn');
  if (tsBtn) tsBtn.classList.toggle('active', topScorerActive);
  updatePhaseButtons();
  updatePreview();
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingKey = null;
}

function togglePhase(p) {
  // gestione tier finale (3° posto / Campione) — mutuamente esclusivi
  if (FINAL_TIER.includes(p)) {
    if (!activePhases.has(18)) return; // serve la semifinale prima
    if (activePhases.has(p)) {
      activePhases.delete(p);
    } else {
      FINAL_TIER.forEach(t => activePhases.delete(t)); // rimuovi l'altro
      activePhases.add(p);
    }
    updatePhaseButtons();
    updatePreview();
    return;
  }

  const idx  = PHASE_ORDER.indexOf(p);
  const prev = PHASE_ORDER[idx - 1];

  if (activePhases.has(p)) {
    // deseleziona questa e tutte le successive (incluso il tier finale)
    PHASE_ORDER.slice(idx).forEach(ph => activePhases.delete(ph));
    FINAL_TIER.forEach(t => activePhases.delete(t));
  } else {
    // seleziona solo se la precedente è attiva (o è la prima)
    if (idx === 0 || activePhases.has(prev)) {
      activePhases.add(p);
    }
  }
  updatePhaseButtons();
  updatePreview();
}

function updatePhaseButtons() {
  document.querySelectorAll('.bonus-btn').forEach(b => {
    const p = parseInt(b.dataset.phase);

    if (FINAL_TIER.includes(p)) {
      const isActive   = activePhases.has(p);
      const isDisabled = !activePhases.has(18) && !isActive;
      b.classList.toggle('active', isActive);
      b.classList.toggle('disabled', isDisabled);
      return;
    }

    const idx  = PHASE_ORDER.indexOf(p);
    const prev = PHASE_ORDER[idx - 1];
    const isActive   = activePhases.has(p);
    const isDisabled = idx > 0 && !activePhases.has(prev) && !isActive;
    b.classList.toggle('active', isActive);
    b.classList.toggle('disabled', isDisabled);
  });
}

function updatePreview() {
  const w = parseInt(document.getElementById('inp-wins').value)  || 0;
  const d = parseInt(document.getElementById('inp-draws').value) || 0;
  document.getElementById('pts-prev').textContent = calcPts(w, d, activePhases, topScorerActive);
}

function saveNation() {
  if (!editingKey) return;
  state[editingKey] = {
    wins:      parseInt(document.getElementById('inp-wins').value)  || 0,
    draws:     parseInt(document.getElementById('inp-draws').value) || 0,
    phases:    [...activePhases],
    topScorer: topScorerActive
  };
  render();
  closeModal();
  saveState();
}

// ─── EVENTS ──────────────────────────────────────────────
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Event delegation — funziona su mobile e desktop, non dipende dal DOM timing
document.addEventListener('click', function(e) {
  const counterBtn = e.target.closest('.counter-btn');
  if (counterBtn) {
    e.stopPropagation();
    changeVal(counterBtn.dataset.target, parseInt(counterBtn.dataset.delta));
    return;
  }
  const topscorerBtn = e.target.closest('#topscorer-btn');
  if (topscorerBtn) {
    e.stopPropagation();
    topScorerActive = !topScorerActive;
    topscorerBtn.classList.toggle('active', topScorerActive);
    updatePreview();
    return;
  }
  const bonusBtn = e.target.closest('.bonus-btn');
  if (bonusBtn) {
    e.stopPropagation();
    togglePhase(parseInt(bonusBtn.dataset.phase));
    return;
  }
}, true); // capture phase — intercetta prima di qualsiasi altro handler

// ─── MATCHES ─────────────────────────────────────────────
const PLAYER_TEAMS = {
  chiara: ['Brasile','Portogallo','Norvegia','England','Paesi Bassi','Corea del Sud','Turchia','Belgio'],
  mannu:  ['Spagna','Francia','Argentina','Germania','Croazia','Marocco','Ecuador','Giappone']
};

// mappa nome API → { flag, tla }
const TEAM_META = {
  // ── Gruppo A ──
  'Mexico':             { flag: '🇲🇽', tla: 'MEX' },
  'South Korea':        { flag: '🇰🇷', tla: 'KOR' },
  'Korea Republic':     { flag: '🇰🇷', tla: 'KOR' },
  'Czechia':            { flag: '🇨🇿', tla: 'CZE' },
  'Czech Republic':     { flag: '🇨🇿', tla: 'CZE' },
  'South Africa':       { flag: '🇿🇦', tla: 'RSA' },
  // ── Gruppo B ──
  'Switzerland':        { flag: '🇨🇭', tla: 'SUI' },
  'Canada':             { flag: '🇨🇦', tla: 'CAN' },
  'Qatar':              { flag: '🇶🇦', tla: 'QAT' },
  'Bosnia-Herzegovina': { flag: '🇧🇦', tla: 'BIH' },
  'Bosnia and Herzegovina': { flag: '🇧🇦', tla: 'BIH' },
  // ── Gruppo C ──
  'Scotland':           { flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', tla: 'SCO' },
  'Morocco':            { flag: '🇲🇦', tla: 'MAR' },
  'Brazil':             { flag: '🇧🇷', tla: 'BRA' },
  'Haiti':              { flag: '🇭🇹', tla: 'HAI' },
  // ── Gruppo D ──
  'United States':      { flag: '🇺🇸', tla: 'USA' },
  'USA':                { flag: '🇺🇸', tla: 'USA' },
  'Australia':          { flag: '🇦🇺', tla: 'AUS' },
  'Türkiye':            { flag: '🇹🇷', tla: 'TUR' },
  'Turkey':             { flag: '🇹🇷', tla: 'TUR' },
  'Paraguay':           { flag: '🇵🇾', tla: 'PAR' },
  // ── Gruppo E ──
  'Germany':            { flag: '🇩🇪', tla: 'GER' },
  "Côte d'Ivoire":      { flag: '🇨🇮', tla: 'CIV' },
  'Ivory Coast':        { flag: '🇨🇮', tla: 'CIV' },
  'Ecuador':            { flag: '🇪🇨', tla: 'ECU' },
  'Curaçao':            { flag: '🇨🇼', tla: 'CUW' },
  'Curacao':            { flag: '🇨🇼', tla: 'CUW' },
  // ── Gruppo F ──
  'Sweden':             { flag: '🇸🇪', tla: 'SWE' },
  'Japan':              { flag: '🇯🇵', tla: 'JPN' },
  'Netherlands':        { flag: '🇳🇱', tla: 'NED' },
  'Tunisia':            { flag: '🇹🇳', tla: 'TUN' },
  // ── Gruppo G ──
  'New Zealand':        { flag: '🇳🇿', tla: 'NZL' },
  'Iran':               { flag: '🇮🇷', tla: 'IRN' },
  'Belgium':            { flag: '🇧🇪', tla: 'BEL' },
  'Egypt':              { flag: '🇪🇬', tla: 'EGY' },
  // ── Gruppo H ──
  'Uruguay':            { flag: '🇺🇾', tla: 'URU' },
  'Saudi Arabia':       { flag: '🇸🇦', tla: 'KSA' },
  'Spain':              { flag: '🇪🇸', tla: 'ESP' },
  'Cape Verde Islands': { flag: '🇨🇻', tla: 'CPV' },
  'Cape Verde':         { flag: '🇨🇻', tla: 'CPV' },
  // ── Gruppo I ──
  'Norway':             { flag: '🇳🇴', tla: 'NOR' },
  'France':             { flag: '🇫🇷', tla: 'FRA' },
  'Senegal':            { flag: '🇸🇳', tla: 'SEN' },
  'Iraq':               { flag: '🇮🇶', tla: 'IRQ' },
  // ── Gruppo J ──
  'Argentina':          { flag: '🇦🇷', tla: 'ARG' },
  'Austria':            { flag: '🇦🇹', tla: 'AUT' },
  'Jordan':             { flag: '🇯🇴', tla: 'JOR' },
  'Algeria':            { flag: '🇩🇿', tla: 'ALG' },
  // ── Gruppo K ──
  'Colombia':           { flag: '🇨🇴', tla: 'COL' },
  'DR Congo':           { flag: '🇨🇩', tla: 'COD' },
  'Congo DR':           { flag: '🇨🇩', tla: 'COD' },
  'Democratic Republic of the Congo': { flag: '🇨🇩', tla: 'COD' },
  'Portugal':           { flag: '🇵🇹', tla: 'POR' },
  'Uzbekistan':         { flag: '🇺🇿', tla: 'UZB' },
  // ── Gruppo L ──
  'Croatia':            { flag: '🇭🇷', tla: 'CRO' },
  'England':            { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tla: 'ENG' },
  'Ghana':              { flag: '🇬🇭', tla: 'GHA' },
  'Panama':             { flag: '🇵🇦', tla: 'PAN' },
};

function teamMeta(apiName) {
  return TEAM_META[apiName] || { flag: '🏳️', tla: apiName ? apiName.slice(0,3).toUpperCase() : '???' };
}

function formatMatchDate(utcDate) {
  const d = new Date(utcDate);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    + ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function matchesTeamFE(fantaName, apiName) {
  if (!apiName) return false;
  const map = {
    'Brasile':       ['Brazil'],
    'Portogallo':    ['Portugal'],
    'Norvegia':      ['Norway'],
    'England':       ['England'],
    'Paesi Bassi':   ['Netherlands'],
    'Corea del Sud': ['Korea Republic', 'South Korea'],
    'Turchia':       ['Türkiye', 'Turkey'],
    'Belgio':        ['Belgium'],
    'Spagna':        ['Spain'],
    'Francia':       ['France'],
    'Argentina':     ['Argentina'],
    'Germania':      ['Germany'],
    'Croazia':       ['Croatia'],
    'Marocco':       ['Morocco'],
    'Ecuador':       ['Ecuador'],
    'Giappone':      ['Japan']
  };
  const aliases = map[fantaName] || [];
  return aliases.some(a => apiName.toLowerCase().includes(a.toLowerCase()));
}

function isLiveStatus(status) {
  return ['IN_PLAY', 'PAUSED', 'LIVE', 'HALFTIME'].includes(status);
}

function renderMatches(player, data) {
  const container = document.getElementById(player + '-matches');
  if (!data || data.error) {
    container.className = '';
    container.innerHTML = '<div class="match-empty">Dati non disponibili</div>';
    return;
  }

  const teams    = PLAYER_TEAMS[player];
  const isMyTeam = name => teams.some(t => matchesTeamFE(t, name));

  // raccogli live + future del giocatore, dai alle live utcDate=now per ordinarle prime
  const now = new Date().toISOString();
  const live = data.live
    .filter(m => isMyTeam(m.homeTeam.name) || isMyTeam(m.awayTeam.name))
    .map(m => ({ ...m, _sortDate: now }));
  const next = data.next
    .filter(m => teams.includes(m.fantaTeam))
    .map(m => ({ ...m, _sortDate: m.utcDate }));

  // unisci e ordina cronologicamente, max 3
  const slots = [...live, ...next]
    .sort((a, b) => new Date(a._sortDate) - new Date(b._sortDate))
    .slice(0, 3);

  if (!slots.length) {
    container.className = '';
    container.innerHTML = '<div class="match-empty">Nessuna partita in programma</div>';
    return;
  }

  container.className = '';
  container.innerHTML = slots.map(m => {
    const live     = isLiveStatus(m.status);
    const hm       = teamMeta(m.homeTeam.name);
    const am       = teamMeta(m.awayTeam.name);
    const myHome   = isMyTeam(m.homeTeam.name);
    const myAway   = isMyTeam(m.awayTeam.name);

    if (live) {
      const hs      = m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? 0;
      const as      = m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? 0;
      const isPause = m.status === 'HALFTIME' || m.status === 'PAUSED';
      const minute  = isPause ? 'INT' : (m.minute ? m.minute + '′' : 'LIVE');
      return `
        <div class="mc live">
          <div class="mc-team ${myHome ? 'mine' : ''}">
            <span class="mc-flag">${hm.flag}</span>
            <span class="mc-tla">${hm.tla}</span>
          </div>
          <div class="mc-mid">
            <div class="mc-score">${hs} – ${as}</div>
            <div class="mc-min live-blink">${minute}</div>
          </div>
          <div class="mc-team right ${myAway ? 'mine' : ''}">
            <span class="mc-tla">${am.tla}</span>
            <span class="mc-flag">${am.flag}</span>
          </div>
        </div>`;
    } else {
      return `
        <div class="mc">
          <div class="mc-team ${myHome ? 'mine' : ''}">
            <span class="mc-flag">${hm.flag}</span>
            <span class="mc-tla">${hm.tla}</span>
          </div>
          <div class="mc-mid">
            <div class="mc-vs">VS</div>
            <div class="mc-date">${formatMatchDate(m.utcDate)}</div>
          </div>
          <div class="mc-team right ${myAway ? 'mine' : ''}">
            <span class="mc-tla">${am.tla}</span>
            <span class="mc-flag">${am.flag}</span>
          </div>
        </div>`;
    }
  }).join('');
}

function renderResults(player, data) {
  const container = document.getElementById(player + '-results');
  if (!data || data.error) {
    container.innerHTML = '<div class="match-empty">Dati non disponibili</div>';
    return;
  }

  const teams    = PLAYER_TEAMS[player];
  const isMyTeam = name => teams.some(t => matchesTeamFE(t, name));

  const finished = (data.finished || [])
    .filter(m => isMyTeam(m.homeTeam.name) || isMyTeam(m.awayTeam.name))
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate)); // più recenti prima

  if (!finished.length) {
    container.innerHTML = '<div class="match-empty">Nessuna partita conclusa</div>';
    return;
  }

  container.innerHTML = finished.map(m => {
    const hm     = teamMeta(m.homeTeam.name);
    const am     = teamMeta(m.awayTeam.name);
    const myHome = isMyTeam(m.homeTeam.name);
    const myAway = isMyTeam(m.awayTeam.name);
    const hs     = m.score?.fullTime?.home ?? '?';
    const as     = m.score?.fullTime?.away ?? '?';
    const date   = new Date(m.utcDate).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
    return `
      <div class="mc finished">
        <div class="mc-team ${myHome ? 'mine' : ''}">
          <span class="mc-flag">${hm.flag}</span>
          <span class="mc-tla">${hm.tla}</span>
        </div>
        <div class="mc-mid">
          <div class="mc-score">${hs} – ${as}</div>
          <div class="mc-date">${date}</div>
        </div>
        <div class="mc-team right ${myAway ? 'mine' : ''}">
          <span class="mc-tla">${am.tla}</span>
          <span class="mc-flag">${am.flag}</span>
        </div>
      </div>`;
  }).join('');
}

function toggleAccordion(player) {
  const body  = document.getElementById(player + '-results');
  const arrow = document.getElementById(player + '-arrow');
  body.classList.toggle('open');
  arrow.classList.toggle('open');
}

function toggleCaptainAccordion(player) {
  const body  = document.getElementById(player + '-captain-body');
  const arrow = document.getElementById(player + '-captain-arrow');
  body.classList.toggle('open');
  arrow.classList.toggle('open');
}

// ─── CAPITANO / CAPOCANNONIERE ───────────────────────────
const CAPTAINS = {
  chiara: { name: 'Erling Haaland', team: 'Norway', teamLabel: 'Norvegia' },
  mannu:  { name: 'Kylian Mbappé', team: 'France', teamLabel: 'Francia' }
};

let scorersCache = [];

async function loadScorers() {
  try {
    const r    = await fetch(API + '?action=scorers', { redirect: 'follow' });
    const data = JSON.parse(await r.text());
    scorersCache = (data && data.scorers) ? data.scorers : [];
  } catch (e) {
    console.error('loadScorers failed:', e);
    scorersCache = [];
  }
  renderCaptainBody('chiara');
  renderCaptainBody('mannu');
}

function topScorersGoals() {
  if (!scorersCache.length) return 0;
  return Math.max(...scorersCache.map(s => s.goals));
}

function renderCaptainBody(player) {
  const body = document.getElementById(player + '-captain-body');
  if (!body) return;

  const captain  = CAPTAINS[player];
  const teams    = PLAYER_TEAMS[player];
  const maxGoals = topScorersGoals();

  const myScorer  = scorersCache.find(s => s.name === captain.name);
  const myGoals   = myScorer ? myScorer.goals : 0;
  const isLeading = maxGoals > 0 && myGoals === maxGoals;

  // classifica marcatori solo delle squadre del giocatore
  const myTeamScorers = scorersCache
    .filter(s => teams.some(t => matchesTeamFE(t, s.team)))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 8);

  const scorersHtml = myTeamScorers.length
    ? myTeamScorers.map(s => {
        const isGold = maxGoals > 0 && s.goals === maxGoals;
        const tm = teamMeta(s.team);
        return `
          <div class="scorer-row ${isGold ? 'gold' : ''}">
            <span class="scorer-name">${s.name}</span>
            <span class="scorer-team">${tm.flag} ${tm.tla}</span>
            <span class="scorer-goals">${s.goals}</span>
          </div>`;
      }).join('')
    : '<div class="match-empty">Nessun marcatore ancora</div>';

  body.innerHTML = `
    <div class="captain-card ${isLeading ? 'on-target' : ''}">
      <span class="captain-icon">🎖️</span>
      <div class="captain-info">
        <div class="captain-name">${captain.name}</div>
        <div class="captain-team">${captain.teamLabel} · ${myGoals} gol</div>
      </div>
      <span class="captain-badge ${isLeading ? 'gold' : 'normal'}">
        ${isLeading ? 'IN TARGET +10' : 'in corsa'}
      </span>
    </div>
    <div class="scorers-title">Classifica cannonieri (tue squadre)</div>
    ${scorersHtml}
  `;
}

// mostra/nasconde il bottone bonus capocannoniere nel modal,
// solo per Norvegia (Chiara) e Francia (Mannu)
function maybeShowTopScorerBonus(player, nationName) {
  const row = document.getElementById('topscorer-bonus-row');
  const btn = document.getElementById('topscorer-btn');
  if (!row || !btn) return;

  const eligible =
    (player === 'chiara' && nationName === 'Norvegia') ||
    (player === 'mannu'  && nationName === 'Francia');

  row.style.display = eligible ? 'block' : 'none';
}


const ALL_TEAMS = [...PLAYER_TEAMS.chiara, ...PLAYER_TEAMS.mannu];

async function loadMatches() {
  try {
    const url  = API + '?action=matches&teams=' + encodeURIComponent(ALL_TEAMS.join(','));
    const r    = await fetch(url, { redirect: 'follow' });
    const txt  = await r.text();
    const data = JSON.parse(txt);
    if (data.error) {
      console.error('API error:', data.error);
      ['chiara', 'mannu'].forEach(p => { renderMatches(p, null); renderResults(p, null); });
      return;
    }
    renderMatches('chiara', data);
    renderMatches('mannu', data);
    renderResults('chiara', data);
    renderResults('mannu', data);
  } catch (e) {
    console.error('loadMatches failed:', e);
    ['chiara', 'mannu'].forEach(p => {
      renderMatches(p, null);
      renderResults(p, null);
    });
  }
}

// ─── INIT ────────────────────────────────────────────────
loadState().then(() => {
  loadScorers();
});
loadMatches();
// aggiorna partite ogni 60 secondi
setInterval(loadMatches, 60000);
// aggiorna marcatori ogni 5 minuti
setInterval(loadScorers, 300000);
