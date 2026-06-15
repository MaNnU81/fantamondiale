const API = 'https://script.google.com/macros/s/AKfycbzHa5LtE26ccB_h3rCriHNVCitVbK2aBfBo8D_QHd9dT3TwS1HOLKczZogMsakPw2vm/exec';

const NATIONS = {
  chiara: [
    { name: 'Brasile',      flag: '🇧🇷' },
    { name: 'Portogallo',   flag: '🇵🇹' },
    { name: 'Norvegia',     flag: '🇳🇴' },
    { name: 'England',      flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { name: 'Paesi Bassi',  flag: '🇳🇱' },
    { name: 'Corea del Sud',flag: '🇰🇷' },
    { name: 'Turchia',      flag: '🇹🇷' },
    { name: 'Belgio',       flag: '🇧🇪' },
  ],
  mannu: [
    { name: 'Spagna',   flag: '🇪🇸' },
    { name: 'Francia',  flag: '🇫🇷' },
    { name: 'Argentina',flag: '🇦🇷' },
    { name: 'Germania', flag: '🇩🇪' },
    { name: 'Croazia',  flag: '🇭🇷' },
    { name: 'Marocco',  flag: '🇲🇦' },
    { name: 'Ecuador',  flag: '🇪🇨' },
    { name: 'Giappone', flag: '🇯🇵' },
  ]
};

let state = {};
let editingKey = null;
let selectedPhase = 0;

// ─── UTILS ───────────────────────────────────────────────
function calcPts(w, d, p) { return w * 3 + d + p; }

function setStatus(type, txt) {
  document.getElementById('sdot').className = 'status-dot ' + type;
  document.getElementById('stxt').textContent = txt;
}

function defaultState() {
  const s = {};
  ['chiara', 'mannu'].forEach(pl =>
    NATIONS[pl].forEach(n => { s[pl + '_' + n.name] = { wins: 0, draws: 0, phase: 0 }; })
  );
  return s;
}

// ─── API ─────────────────────────────────────────────────
async function loadState() {
  setStatus('', 'caricamento...');
  try {
    const r = await fetch(API + '?t=' + Date.now());
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
      const d = state[key] || { wins: 0, draws: 0, phase: 0 };
      const pts = calcPts(d.wins, d.draws, d.phase);
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

// ─── MODAL ───────────────────────────────────────────────
function openModal(pl, name) {
  editingKey = pl + '_' + name;
  const d = state[editingKey] || { wins: 0, draws: 0, phase: 0 };
  const n = NATIONS[pl].find(x => x.name === name);

  document.getElementById('modal-title').innerHTML = `<span>${n.flag}</span> ${name}`;
  document.getElementById('inp-wins').value = d.wins;
  document.getElementById('inp-draws').value = d.draws;
  selectedPhase = d.phase;
  updatePhaseButtons();
  updatePreview();
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingKey = null;
}

function selectPhase(p) {
  selectedPhase = p;
  updatePhaseButtons();
  updatePreview();
}

function updatePhaseButtons() {
  document.querySelectorAll('.bonus-btn').forEach(b =>
    b.classList.toggle('active', parseInt(b.dataset.phase) === selectedPhase)
  );
}

function updatePreview() {
  const w = parseInt(document.getElementById('inp-wins').value) || 0;
  const d = parseInt(document.getElementById('inp-draws').value) || 0;
  document.getElementById('pts-prev').textContent = calcPts(w, d, selectedPhase);
}

function saveNation() {
  if (!editingKey) return;
  state[editingKey] = {
    wins:  parseInt(document.getElementById('inp-wins').value)  || 0,
    draws: parseInt(document.getElementById('inp-draws').value) || 0,
    phase: selectedPhase
  };
  render();
  closeModal();
  saveState();
}

// ─── EVENTS ──────────────────────────────────────────────
document.getElementById('inp-wins').addEventListener('input', updatePreview);
document.getElementById('inp-draws').addEventListener('input', updatePreview);
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// ─── INIT ────────────────────────────────────────────────
loadState();
