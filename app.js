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

function formatMatchDate(utcDate) {
  const d = new Date(utcDate);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
    + ' · ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

function shortName(fullName) {
  const overrides = {
    'Cape Verde Islands': 'Capo Verde',
    'Korea Republic': 'Corea Sud',
    'South Korea': 'Corea Sud',
    'Saudi Arabia': 'Arabia S.',
    'United States': 'USA',
    'Bosnia-Herzegovina': 'Bosnia',
    'Czechia': 'Rep. Ceca',
    'Netherlands': 'Paesi Bassi',
    'Türkiye': 'Turchia',
  };
  return overrides[fullName] || fullName;
}

function renderMatches(player, data) {
  const container = document.getElementById(player + '-matches');
  if (!data || data.error) {
    container.innerHTML = '<div class="match-empty">Dati non disponibili</div>';
    return;
  }

  const teams  = PLAYER_TEAMS[player];
  const isMyTeam = name => teams.some(t => matchesTeamFE(t, name));

  // tutte le partite del giocatore (live + future) ordinate cronologicamente
  const allMine = [
    ...data.live.filter(m => isMyTeam(m.homeTeam.name) || isMyTeam(m.awayTeam.name)),
    ...data.next.filter(m => teams.includes(m.fantaTeam))
  ].sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  // max 3 slot
  const slots = allMine.slice(0, 3);

  if (!slots.length) {
    container.innerHTML = '<div class="match-empty">Nessuna partita in programma</div>';
    container.className = '';
    return;
  }

  const html = slots.map(m => {
    const isLive = ['IN_PLAY', 'PAUSED', 'LIVE', 'HALFTIME'].includes(m.status);
    const home   = shortName(m.homeTeam.name);
    const away   = shortName(m.awayTeam.name);
    const myHome = isMyTeam(m.homeTeam.name);
    const myAway = isMyTeam(m.awayTeam.name);

    if (isLive) {
      const hs     = m.score.fullTime.home ?? m.score.halfTime.home ?? 0;
      const as     = m.score.fullTime.away ?? m.score.halfTime.away ?? 0;
      const isPause = m.status === 'HALFTIME' || m.status === 'PAUSED';
      const minute  = isPause ? 'INT' : (m.minute ? m.minute + '′' : 'LIVE');
      return `
        <div class="match-card live">
          <div class="match-card-inner">
            <span class="mc-team ${myHome ? 'my-team' : ''}">${home}</span>
            <div class="mc-center">
              <div class="mc-score">${hs} – ${as}</div>
              <div class="mc-time live-pulse">${minute}</div>
            </div>
            <span class="mc-team right ${myAway ? 'my-team' : ''}">${away}</span>
          </div>
        </div>`;
    } else {
      return `
        <div class="match-card">
          <div class="match-card-inner">
            <span class="mc-team ${myHome ? 'my-team' : ''}">${home}</span>
            <div class="mc-center">
              <div class="mc-vs">VS</div>
              <div class="mc-time">${formatMatchDate(m.utcDate)}</div>
            </div>
            <span class="mc-team right ${myAway ? 'my-team' : ''}">${away}</span>
          </div>
        </div>`;
    }
  }).join('');

  container.innerHTML = html;
  container.className = '';
}

// mapping nomi fanta → nomi API (lato frontend per filtrare)
function matchesTeamFE(fantaName, apiName) {
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

const ALL_TEAMS = [...PLAYER_TEAMS.chiara, ...PLAYER_TEAMS.mannu];

async function loadMatches() {
  try {
    const url  = API + '?action=matches&teams=' + encodeURIComponent(ALL_TEAMS.join(','));
    const r    = await fetch(url);
    const data = JSON.parse(await r.text());
    renderMatches('chiara', data);
    renderMatches('mannu', data);
  } catch (e) {
    ['chiara', 'mannu'].forEach(p => renderMatches(p, null));
  }
}

// ─── INIT ────────────────────────────────────────────────
loadState();
loadMatches();
// aggiorna partite ogni 60 secondi
setInterval(loadMatches, 60000);
