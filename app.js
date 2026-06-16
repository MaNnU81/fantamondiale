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

const PHASE_ORDER = [5, 8, 12, 18, 30];

let state      = {};
let editingKey = null;
let activePhases = new Set();

// ─── UTILS ───────────────────────────────────────────────
function calcPts(w, d, phases) {
  return w * 3 + d + [...phases].reduce((sum, p) => sum + p, 0);
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
    const r    = await fetch(API + '?t=' + Date.now());
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
      const pts = calcPts(d.wins, d.draws, new Set(d.phases || []));
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
  const d = state[editingKey] || { wins: 0, draws: 0, phases: [] };
  const n = NATIONS[pl].find(x => x.name === name);

  document.getElementById('modal-title').innerHTML = `<span>${n.flag}</span> ${name}`;
  document.getElementById('inp-wins').value  = d.wins;
  document.getElementById('inp-draws').value = d.draws;
  activePhases = new Set(d.phases || []);
  updatePhaseButtons();
  updatePreview();
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingKey = null;
}

function togglePhase(p) {
  const idx  = PHASE_ORDER.indexOf(p);
  const prev = PHASE_ORDER[idx - 1];

  if (activePhases.has(p)) {
    // deseleziona questa e tutte le successive
    PHASE_ORDER.slice(idx).forEach(ph => activePhases.delete(ph));
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
    const p   = parseInt(b.dataset.phase);
    const idx = PHASE_ORDER.indexOf(p);
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
  document.getElementById('pts-prev').textContent = calcPts(w, d, activePhases);
}

function saveNation() {
  if (!editingKey) return;
  state[editingKey] = {
    wins:   parseInt(document.getElementById('inp-wins').value)  || 0,
    draws:  parseInt(document.getElementById('inp-draws').value) || 0,
    phases: [...activePhases]
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
  // ── CONMEBOL (6) ──
  'Argentina':          { flag: '🇦🇷', tla: 'ARG' },
  'Brazil':             { flag: '🇧🇷', tla: 'BRA' },
  'Colombia':           { flag: '🇨🇴', tla: 'COL' },
  'Ecuador':            { flag: '🇪🇨', tla: 'ECU' },
  'Uruguay':            { flag: '🇺🇾', tla: 'URU' },
  'Venezuela':          { flag: '🇻🇪', tla: 'VEN' },
  // ── CONCACAF (6) ──
  'Canada':             { flag: '🇨🇦', tla: 'CAN' },
  'Costa Rica':         { flag: '🇨🇷', tla: 'CRC' },
  'Honduras':           { flag: '🇭🇳', tla: 'HON' },
  'Jamaica':            { flag: '🇯🇲', tla: 'JAM' },
  'Mexico':             { flag: '🇲🇽', tla: 'MEX' },
  'Panama':             { flag: '🇵🇦', tla: 'PAN' },
  'United States':      { flag: '🇺🇸', tla: 'USA' },
  'USA':                { flag: '🇺🇸', tla: 'USA' },
  // ── UEFA (16) ──
  'Belgium':            { flag: '🇧🇪', tla: 'BEL' },
  'Croatia':            { flag: '🇭🇷', tla: 'CRO' },
  'Czechia':            { flag: '🇨🇿', tla: 'CZE' },
  'Czech Republic':     { flag: '🇨🇿', tla: 'CZE' },
  'England':            { flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', tla: 'ENG' },
  'France':             { flag: '🇫🇷', tla: 'FRA' },
  'Germany':            { flag: '🇩🇪', tla: 'GER' },
  'Netherlands':        { flag: '🇳🇱', tla: 'NED' },
  'Norway':             { flag: '🇳🇴', tla: 'NOR' },
  'Portugal':           { flag: '🇵🇹', tla: 'POR' },
  'Romania':            { flag: '🇷🇴', tla: 'ROU' },
  'Serbia':             { flag: '🇷🇸', tla: 'SRB' },
  'Slovakia':           { flag: '🇸🇰', tla: 'SVK' },
  'Slovenia':           { flag: '🇸🇮', tla: 'SVN' },
  'Spain':              { flag: '🇪🇸', tla: 'ESP' },
  'Switzerland':        { flag: '🇨🇭', tla: 'SUI' },
  'Türkiye':            { flag: '🇹🇷', tla: 'TUR' },
  'Turkey':             { flag: '🇹🇷', tla: 'TUR' },
  'Ukraine':            { flag: '🇺🇦', tla: 'UKR' },
  // ── CAF (9) ──
  'Algeria':            { flag: '🇩🇿', tla: 'ALG' },
  'Cameroon':           { flag: '🇨🇲', tla: 'CMR' },
  'Cape Verde Islands': { flag: '🇨🇻', tla: 'CPV' },
  'Cape Verde':         { flag: '🇨🇻', tla: 'CPV' },
  'Egypt':              { flag: '🇪🇬', tla: 'EGY' },
  'Ghana':              { flag: '🇬🇭', tla: 'GHA' },
  'Mali':               { flag: '🇲🇱', tla: 'MLI' },
  'Morocco':            { flag: '🇲🇦', tla: 'MAR' },
  'Nigeria':            { flag: '🇳🇬', tla: 'NGA' },
  'Senegal':            { flag: '🇸🇳', tla: 'SEN' },
  'South Africa':       { flag: '🇿🇦', tla: 'RSA' },
  'Tanzania':           { flag: '🇹🇿', tla: 'TAN' },
  // ── AFC (8) ──
  'Australia':          { flag: '🇦🇺', tla: 'AUS' },
  'Bahrain':            { flag: '🇧🇭', tla: 'BHR' },
  'Indonesia':          { flag: '🇮🇩', tla: 'IDN' },
  'Iran':               { flag: '🇮🇷', tla: 'IRN' },
  'Iraq':               { flag: '🇮🇶', tla: 'IRQ' },
  'Japan':              { flag: '🇯🇵', tla: 'JPN' },
  'Jordan':             { flag: '🇯🇴', tla: 'JOR' },
  'Korea Republic':     { flag: '🇰🇷', tla: 'KOR' },
  'South Korea':        { flag: '🇰🇷', tla: 'KOR' },
  'Oman':               { flag: '🇴🇲', tla: 'OMA' },
  'Qatar':              { flag: '🇶🇦', tla: 'QAT' },
  'Saudi Arabia':       { flag: '🇸🇦', tla: 'KSA' },
  'Uzbekistan':         { flag: '🇺🇿', tla: 'UZB' },
  // ── OFC (1) ──
  'New Zealand':        { flag: '🇳🇿', tla: 'NZL' },
  // ── Intercontinentale ──
  'Trinidad and Tobago':{ flag: '🇹🇹', tla: 'TRI' },
  'Albania':            { flag: '🇦🇱', tla: 'ALB' },
  'Botswana':           { flag: '🇧🇼', tla: 'BOT' },
  'Chile':              { flag: '🇨🇱', tla: 'CHI' },
  'Bosnia-Herzegovina': { flag: '🇧🇦', tla: 'BIH' },
  'Peru':               { flag: '🇵🇪', tla: 'PER' },
  'Guatemala':          { flag: '🇬🇹', tla: 'GUA' },
  'Paraguay':           { flag: '🇵🇾', tla: 'PAR' },
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

async function loadMatches() {
  try {
    const url  = API + '?action=matches&teams=' + encodeURIComponent(ALL_TEAMS.join(','));
    const r    = await fetch(url);
    const data = JSON.parse(await r.text());
    renderMatches('chiara', data);
    renderMatches('mannu', data);
    renderResults('chiara', data);
    renderResults('mannu', data);
  } catch (e) {
    ['chiara', 'mannu'].forEach(p => {
      renderMatches(p, null);
      renderResults(p, null);
    });
  }
}

// ─── INIT ────────────────────────────────────────────────
loadState();
loadMatches();
// aggiorna partite ogni 60 secondi
setInterval(loadMatches, 60000);
