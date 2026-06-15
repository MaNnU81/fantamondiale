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

// counter buttons — touchstart per mobile, click per desktop
document.querySelectorAll('.counter-btn').forEach(btn => {
  btn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    changeVal(this.dataset.target, parseInt(this.dataset.delta));
  }, { passive: false });
});

// bonus buttons — touchstart per mobile, click per desktop
document.querySelectorAll('.bonus-btn').forEach(btn => {
  btn.addEventListener('touchstart', function(e) {
    e.preventDefault();
    togglePhase(parseInt(this.dataset.phase));
  }, { passive: false });
});

// ─── INIT ────────────────────────────────────────────────
loadState();
