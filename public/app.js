/* Jouw Voorleesboekje — SPA (hash router) */

// ---------- API base: works local + behind deploy proxy ----------
// Bij deploy vervangt deploy_website '__PORT_8000__' overal door 'port/8000'.
// Lokaal is de placeholder nog intact en gebruiken we dezelfde origin.
const API_BASE = '__PORT_8000__'.startsWith('__') ? '' : '__PORT_8000__';

function api(path, options = {}) {
  return fetch(`${API_BASE}${path}`, options);
}

// ---------- Options data ----------
const THEMES = [
  { id: 'dieren', label: 'Dieren', icon: '🐾' },
  { id: 'ruimte', label: 'Ruimte', icon: '🚀' },
  { id: 'ridders', label: 'Ridders', icon: '🛡️' },
  { id: 'eenhoorns', label: 'Eenhoorns', icon: '🦄' },
  { id: 'prinsessen', label: 'Prinsessen', icon: '👑' },
  { id: 'jungle', label: 'Jungle', icon: '🌴' },
  { id: 'piraten', label: 'Piraten', icon: '🏴‍☠️' },
  { id: 'dinos', label: "Dino's", icon: '🦕' },
  { id: 'sport', label: 'Sport', icon: '⚽' },
  { id: 'magie', label: 'Magie', icon: '✨' },
  { id: 'mysterie', label: 'Mysterie', icon: '🔍' },
  { id: 'zee', label: 'Onder water', icon: '🐙' },
];
const TONES = [
  { id: 'lief', label: 'Lief', icon: '💛' },
  { id: 'grappig', label: 'Grappig', icon: '😄' },
  { id: 'spannend_maar_veilig', label: 'Spannend', icon: '🔦' },
  { id: 'avontuurlijk', label: 'Avontuurlijk', icon: '🧭' },
  { id: 'leerzaam', label: 'Leerzaam', icon: '🌱' },
];
const MORALS = [
  { id: 'vriendschap', label: 'Vriendschap' },
  { id: 'moed', label: 'Moed' },
  { id: 'eerlijkheid', label: 'Eerlijkheid' },
  { id: 'doorzettingsvermogen', label: 'Doorzetten' },
  { id: 'samenwerken', label: 'Samenwerken' },
  { id: 'zelfvertrouwen', label: 'Zelfvertrouwen' },
];

const AGES = [
  { seg: '3-5', label: '3 tot 5 jaar', sub: 'Korte zinnen, zacht verhaaltje voor het slapen' },
  { seg: '6-8', label: '6 tot 8 jaar', sub: 'Actieve plot, dialoog, humor mag' },
  { seg: '9-10', label: '9 tot 10 jaar', sub: 'Rijker taalgebruik, subtiele reflectie' },
];

const EXAMPLE_PREVIEWS = [
  { id: 'caseA', age: '5 jaar', tone: 'lief · eenhoorns', title: 'Mila en de Dansende Eenhoorn', meta: '6 pagina\'s', img: 'examples/caseA-cover.png' },
  { id: 'caseB', age: '8 jaar', tone: 'avontuurlijk · jungle', title: 'Daan en het Geheim van de Jungle', meta: '7 pagina\'s', img: 'examples/caseB-cover.png' },
  { id: 'caseC', age: '10 jaar', tone: 'mysterie', title: 'Zoë en het Geheim van de Vos', meta: '8 pagina\'s', img: 'examples/caseC-cover.png' },
];

// ---------- State ----------
const state = {
  purchaseType: 'own_child',
  childFirstName: '',
  childAge: null,
  ageSegment: null,
  theme: null,
  storyTone: null,
  illustrationStyle: 'warme-waterverf',
  favoriteAnimal: '',
  hobby: '',
  friendName: '',
  moral: null,
  senderNote: '',
  parentEmail: '',
  consentPrivacy: false,
  consentDigitalDelivery: false,
};

// Load state from sessionStorage if present
try {
  const saved = JSON.parse(sessionStorage.getItem('jvb_state') || '{}');
  Object.assign(state, saved);
} catch {}
function saveState() {
  try { sessionStorage.setItem('jvb_state', JSON.stringify(state)); } catch {}
}
function clearState() {
  try { sessionStorage.removeItem('jvb_state'); } catch {}
  Object.assign(state, {
    purchaseType: 'own_child', childFirstName: '', childAge: null, ageSegment: null,
    theme: null, storyTone: null, illustrationStyle: 'warme-waterverf',
    favoriteAnimal: '', hobby: '', friendName: '', moral: null, senderNote: '',
    parentEmail: '', consentPrivacy: false, consentDigitalDelivery: false,
  });
}

// ---------- Router ----------
const view = () => document.getElementById('view');
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._to); t._to = setTimeout(() => t.classList.remove('show'), 2800);
}

function go(path) { location.hash = path; }

function currentPath() {
  const h = location.hash.replace(/^#/, '') || '/home';
  return h;
}

function render() {
  const path = currentPath();
  const [root, sub, arg] = path.split('/').filter(Boolean);
  const full = [root, sub, arg].filter(Boolean).join('/');
  const routes = {
    'home': renderHome,
    'voorbeelden': renderVoorbeelden,
    'maak': () => renderFlow(sub),
    'betaling': () => renderBetaling(arg),
    'generatie': () => renderGeneratie(sub),
    'resultaat': () => renderResultaat(sub),
    'bedankt': renderBedankt,
    'privacy': () => renderLegal('privacyverklaring', 'Privacyverklaring'),
    'voorwaarden': () => renderLegal('algemene-voorwaarden', 'Algemene voorwaarden'),
    'admin': renderAdmin,
  };
  const handler = routes[root] || renderHome;
  handler();
  window.scrollTo(0, 0);
  document.querySelectorAll('[data-nav]').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === '#' + currentPath().split('/').slice(0, 2).join('/'));
  });
}
window.addEventListener('hashchange', render);
window.addEventListener('load', render);

// ---------- Helpers ----------
function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
function html(strings, ...values) {
  return strings.reduce((acc, s, i) => acc + s + (i < values.length ? String(values[i] ?? '') : ''), '');
}
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ---------- HOME ----------
function renderHome() {
  view().innerHTML = html`
    <section class="hero">
      <div class="container hero-inner">
        <div>
          <div class="hero-price">
            <span class="price">€4,95</span>
            <span class="suffix">· incl. btw · direct per mail</span>
          </div>
          <h1>Een persoonlijk voorleesboekje<br>waarin jouw kind de held is.</h1>
          <p class="lead">Kies een thema, vertel wie je kind is, en ontvang binnen 5 minuten een warm verhaal in waterverf-stijl. Geen foto's, geen account, geen abonnement — gewoon een klein digitaal cadeau om samen voor te lezen.</p>
          <div style="margin-top: 24px; display: flex; gap: 12px; flex-wrap: wrap;">
            <a href="#/maak/leeftijd" class="btn btn-primary btn-lg">Begin aan jouw boekje</a>
            <a href="#/voorbeelden" class="btn btn-secondary btn-lg">Bekijk voorbeelden</a>
          </div>
          <div class="trust-row">
            <span class="trust-pill">🔒 Privacy-first · geen foto, geen account</span>
            <span class="trust-pill">💳 Veilig betalen met iDEAL</span>
            <span class="trust-pill">⏱️ PDF binnen 5 minuten</span>
          </div>
        </div>
        <div class="hero-visual">
          <img src="examples/caseA-cover.png" alt="Voorbeeldboekje" onerror="this.style.display='none'" />
        </div>
      </div>
    </section>

    <section class="section container">
      <h2 style="text-align:center;">Zo werkt het</h2>
      <div class="examples-grid" style="margin-top: 32px;">
        <div class="card">
          <div style="font-size:32px; margin-bottom:8px;">✨</div>
          <h3>1. Vertel wie je kind is</h3>
          <p>Leeftijd, naam, lievelingsdier, hobby, vriendje. Niets meer dan nodig — en geen foto's.</p>
        </div>
        <div class="card">
          <div style="font-size:32px; margin-bottom:8px;">🎨</div>
          <h3>2. Wij bouwen het boekje</h3>
          <p>Een warm Nederlands verhaal met waterverf-illustraties, automatisch gecontroleerd op kindveiligheid.</p>
        </div>
        <div class="card">
          <div style="font-size:32px; margin-bottom:8px;">📬</div>
          <h3>3. PDF in je mailbox</h3>
          <p>Klaar om samen te openen, voor te lezen, of als klein cadeau te sturen.</p>
        </div>
      </div>
    </section>

    <section class="section container" style="background: var(--cream-2); border-radius: 24px; padding-left: 32px; padding-right: 32px;">
      <h2 style="text-align:center;">3 voorbeeldboekjes</h2>
      <p style="text-align:center; color: var(--ink-soft); margin-bottom: 28px;">Zo ziet een boekje eruit, voor verschillende leeftijden.</p>
      <div class="examples-grid">
        ${EXAMPLE_PREVIEWS.map(ex => html`
          <a href="examples/${ex.id}.pdf" target="_blank" class="example-card" style="text-decoration: none;">
            <div class="example-cover"><img src="${ex.img}" alt="Voorbeeldomslag ${esc(ex.title)}" onerror="this.parentElement.innerHTML='📖'"/></div>
            <div class="example-body">
              <div class="example-tag">${esc(ex.age)} · ${esc(ex.tone)}</div>
              <div class="example-title">${esc(ex.title)}</div>
              <div class="example-meta">${esc(ex.meta)} · klik om PDF te openen</div>
            </div>
          </a>
        `).join('')}
      </div>
    </section>

    <section class="section container" style="text-align:center;">
      <h2>Klaar voor jullie eigen verhaal?</h2>
      <p class="lead" style="margin: 0 auto 24px auto;">Vijf minuten werk, €4,95, direct per mail.</p>
      <a href="#/maak/leeftijd" class="btn btn-primary btn-lg">Begin aan jouw boekje</a>
    </section>
  `;
}

// ---------- VOORBEELDEN ----------
function renderVoorbeelden() {
  view().innerHTML = html`
    <section class="section container">
      <h1 style="text-align:center;">Voorbeeldboekjes</h1>
      <p class="lead" style="text-align:center; margin: 0 auto 36px auto;">Drie echte boekjes die we automatisch gegenereerd hebben, voor verschillende leeftijden.</p>
      <div class="examples-grid">
        ${EXAMPLE_PREVIEWS.map(ex => html`
          <a href="examples/${ex.id}.pdf" target="_blank" class="example-card" style="text-decoration: none;">
            <div class="example-cover"><img src="${ex.img}" alt="" onerror="this.parentElement.innerHTML='📖'"/></div>
            <div class="example-body">
              <div class="example-tag">${esc(ex.age)} · ${esc(ex.tone)}</div>
              <div class="example-title">${esc(ex.title)}</div>
              <div class="example-meta">${esc(ex.meta)} · bekijk PDF</div>
            </div>
          </a>
        `).join('')}
      </div>
      <div style="text-align:center; margin-top: 36px;">
        <a href="#/maak/leeftijd" class="btn btn-primary btn-lg">Maak nu je eigen boekje</a>
      </div>
    </section>
  `;
}

// ---------- FLOW STEPS ----------
function stepper(active) {
  const steps = ['leeftijd', 'thema', 'gegevens', 'controle'];
  return html`<div class="stepper">${steps.map((s, i) => {
    const ai = steps.indexOf(active);
    const cls = i === ai ? 'active' : (i < ai ? 'done' : '');
    return `<span class="step-dot ${cls}" aria-label="Stap ${i+1} ${s}"></span>`;
  }).join('')}</div>`;
}

function renderFlow(step) {
  step = step || 'leeftijd';
  const handlers = {
    leeftijd: renderStepLeeftijd,
    thema: renderStepThema,
    gegevens: renderStepGegevens,
    controle: renderStepControle,
  };
  (handlers[step] || renderStepLeeftijd)();
}

function renderStepLeeftijd() {
  view().innerHTML = html`
    <section class="section">
      ${stepper('leeftijd')}
      <div class="flow-card">
        <h2>Hoe oud is het kindje?</h2>
        <p class="sub">We passen de zinslengte en woordkeus aan op de leeftijd.</p>
        <div class="option-grid cols-2">
          ${AGES.map(a => html`
            <button class="option-tile ${state.ageSegment === a.seg ? 'selected' : ''}" data-seg="${a.seg}">
              <div style="font-weight:700; font-size:16px;">${a.label}</div>
              <div style="font-size:13px; color: var(--ink-soft);">${a.sub}</div>
            </button>
          `).join('')}
        </div>
        <div class="flow-actions">
          <a href="#/home" class="btn btn-ghost">← Terug</a>
          <button class="btn btn-primary" id="nextBtn" ${state.ageSegment ? '' : 'disabled'}>Volgende →</button>
        </div>
      </div>
    </section>
  `;
  view().querySelectorAll('.option-tile').forEach(b => {
    b.addEventListener('click', () => {
      state.ageSegment = b.dataset.seg;
      // Default childAge to midden van segment
      state.childAge = state.ageSegment === '3-5' ? 4 : state.ageSegment === '6-8' ? 7 : 10;
      saveState();
      renderStepLeeftijd();
    });
  });
  view().querySelector('#nextBtn').addEventListener('click', () => {
    if (state.ageSegment) go('/maak/thema');
  });
}

function renderStepThema() {
  view().innerHTML = html`
    <section class="section">
      ${stepper('thema')}
      <div class="flow-card">
        <h2>Kies een thema</h2>
        <p class="sub">Dit bepaalt de wereld van het verhaal.</p>
        <div class="option-grid cols-4">
          ${THEMES.map(t => html`
            <button class="option-tile ${state.theme === t.id ? 'selected' : ''}" data-id="${t.id}">
              <span class="icon">${t.icon}</span>
              <span>${t.label}</span>
            </button>
          `).join('')}
        </div>
        <h3 style="margin-top: 28px; font-size: 18px;">En de sfeer?</h3>
        <div class="option-grid cols-4" style="grid-template-columns: repeat(5, 1fr);">
          ${TONES.map(t => html`
            <button class="option-tile tone-opt ${state.storyTone === t.id ? 'selected' : ''}" data-id="${t.id}">
              <span class="icon">${t.icon}</span>
              <span style="font-size:13px;">${t.label}</span>
            </button>
          `).join('')}
        </div>
        <div class="flow-actions">
          <a href="#/maak/leeftijd" class="btn btn-ghost">← Terug</a>
          <button class="btn btn-primary" id="nextBtn" ${state.theme && state.storyTone ? '' : 'disabled'}>Volgende →</button>
        </div>
      </div>
    </section>
  `;
  view().querySelectorAll('.option-tile:not(.tone-opt)').forEach(b => {
    b.addEventListener('click', () => { state.theme = b.dataset.id; saveState(); renderStepThema(); });
  });
  view().querySelectorAll('.tone-opt').forEach(b => {
    b.addEventListener('click', () => { state.storyTone = b.dataset.id; saveState(); renderStepThema(); });
  });
  view().querySelector('#nextBtn').addEventListener('click', () => {
    if (state.theme && state.storyTone) go('/maak/gegevens');
  });
}

function renderStepGegevens() {
  view().innerHTML = html`
    <section class="section">
      ${stepper('gegevens')}
      <div class="flow-card">
        <h2>Vertel wie het kindje is</h2>
        <p class="sub">We vragen alleen wat nodig is voor het verhaal. Geen foto's, geen account.</p>
        <form id="gForm">
          <div class="form-row">
            <div class="field">
              <label>Voornaam <span class="req">*</span></label>
              <input type="text" name="childFirstName" value="${esc(state.childFirstName)}" maxlength="40" required />
              <div class="help">We gebruiken de naam letterlijk in het verhaal.</div>
            </div>
            <div class="field">
              <label>Leeftijd <span class="req">*</span></label>
              <input type="number" name="childAge" min="3" max="10" value="${state.childAge || ''}" required />
              <div class="help">${state.ageSegment ? `Segment: ${state.ageSegment}` : ''}</div>
            </div>
          </div>
          <div class="field">
            <label>Lievelingsdier <span class="req">*</span></label>
            <input type="text" name="favoriteAnimal" value="${esc(state.favoriteAnimal)}" maxlength="40" required placeholder="bv konijn, vos, olifant" />
            <div class="help">Dit dier wordt de vaste companion in het boekje.</div>
          </div>
          <div class="field">
            <label>Hobby of iets wat ${state.childFirstName || 'je kind'} leuk vindt <span class="req">*</span></label>
            <input type="text" name="hobby" value="${esc(state.hobby)}" maxlength="80" required placeholder="bv dansen, voetbal, tekenen" />
            <div class="help">Deze hobby wordt de sleutel in het verhaal.</div>
          </div>
          <div class="field">
            <label>Naam van een vriendje of zusje/broertje (optioneel)</label>
            <input type="text" name="friendName" value="${esc(state.friendName)}" maxlength="40" placeholder="bv Lotte" />
          </div>
          <div class="field">
            <label>Moraal van het verhaal</label>
            <div class="option-grid cols-3">
              ${MORALS.map(m => html`
                <button type="button" class="option-tile moral-opt ${state.moral === m.id ? 'selected' : ''}" data-id="${m.id}" style="padding:10px; font-size:14px;">${m.label}</button>
              `).join('')}
            </div>
            <div class="help">Optioneel — kies een thema dat subtiel in het verhaal landt.</div>
          </div>
          <div class="field">
            <label>E-mailadres voor de PDF <span class="req">*</span></label>
            <input type="email" name="parentEmail" value="${esc(state.parentEmail)}" maxlength="120" required placeholder="jij@voorbeeld.nl"/>
            <div class="help">We sturen hierheen de PDF. Geen nieuwsbrief.</div>
          </div>
          <div class="field">
            <label>Persoonlijk berichtje (optioneel, verschijnt niet in het boekje)</label>
            <textarea name="senderNote" maxlength="300" placeholder="bv 'Van oma en opa, veel leesplezier!'">${esc(state.senderNote)}</textarea>
          </div>
          <hr style="border:none; border-top:1px solid var(--line); margin: 22px 0;">
          <div class="check-row">
            <input type="checkbox" id="cp" ${state.consentPrivacy ? 'checked' : ''}/>
            <label for="cp">Ik heb de <a href="#/privacy" target="_blank">privacyverklaring</a> gelezen en ga akkoord. Kindgegevens worden binnen 72 uur automatisch verwijderd.</label>
          </div>
          <div class="check-row">
            <input type="checkbox" id="cd" ${state.consentDigitalDelivery ? 'checked' : ''}/>
            <label for="cd">Ik verzoek uitdrukkelijk om directe uitvoering: start meteen met het genereren en leveren van mijn boekje. Ik doe daarmee uitdrukkelijk <strong>afstand van mijn herroepingsrecht</strong> voor digitale inhoud (art. 6:230p sub d BW). Zie <a href="#/voorwaarden" target="_blank">algemene voorwaarden</a>, sectie 4.</label>
          </div>
          <div id="formError" class="error-banner" style="display:none;"></div>
          <div class="flow-actions">
            <a href="#/maak/thema" class="btn btn-ghost">← Terug</a>
            <button type="submit" class="btn btn-primary">Volgende →</button>
          </div>
        </form>
      </div>
    </section>
  `;
  function persistFormFields() {
    const f = view().querySelector('#gForm');
    if (!f) return;
    if (f.childFirstName) state.childFirstName = f.childFirstName.value;
    if (f.childAge && f.childAge.value !== '') state.childAge = Number(f.childAge.value);
    if (f.favoriteAnimal) state.favoriteAnimal = f.favoriteAnimal.value;
    if (f.hobby) state.hobby = f.hobby.value;
    if (f.friendName) state.friendName = f.friendName.value;
    if (f.parentEmail) state.parentEmail = f.parentEmail.value;
    if (f.senderNote) state.senderNote = f.senderNote.value;
    saveState();
  }
  // Live-persist alle tekst/nummer/textarea-velden bij elke wijziging,
  // zodat een re-render (bv. na moraal-klik) de ingevoerde waarden niet wist.
  view().querySelector('#gForm').addEventListener('input', persistFormFields);
  view().querySelectorAll('.moral-opt').forEach(b => {
    b.addEventListener('click', () => {
      persistFormFields();
      state.moral = b.dataset.id;
      saveState();
      renderStepGegevens();
    });
  });
  view().querySelector('#cp').addEventListener('change', e => { persistFormFields(); state.consentPrivacy = e.target.checked; saveState(); });
  view().querySelector('#cd').addEventListener('change', e => { persistFormFields(); state.consentDigitalDelivery = e.target.checked; saveState(); });
  view().querySelector('#gForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    state.childFirstName = f.childFirstName.value.trim();
    state.childAge = Number(f.childAge.value);
    state.favoriteAnimal = f.favoriteAnimal.value.trim();
    state.hobby = f.hobby.value.trim();
    state.friendName = f.friendName.value.trim() || null;
    state.parentEmail = f.parentEmail.value.trim();
    state.senderNote = f.senderNote.value.trim() || null;
    saveState();
    const errBox = view().querySelector('#formError');
    errBox.style.display = 'none';
    const errs = [];
    if (!state.childFirstName) errs.push('Voornaam is verplicht.');
    if (!state.childAge || state.childAge < 3 || state.childAge > 10) errs.push('Leeftijd 3-10.');
    if (!state.favoriteAnimal) errs.push('Lievelingsdier is verplicht.');
    if (!state.hobby) errs.push('Hobby is verplicht.');
    if (!state.parentEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(state.parentEmail)) errs.push('Geldig e-mailadres is verplicht.');
    if (!state.consentPrivacy) errs.push('Toestemming voor privacy is verplicht.');
    if (!state.consentDigitalDelivery) errs.push('Toestemming voor digitale levering is verplicht.');
    if (errs.length) {
      errBox.textContent = errs.join(' ');
      errBox.style.display = 'block';
      return;
    }
    go('/maak/controle');
  });
}

function renderStepControle() {
  const themeLabel = THEMES.find(t => t.id === state.theme)?.label || '—';
  const toneLabel = TONES.find(t => t.id === state.storyTone)?.label || '—';
  const moralLabel = MORALS.find(m => m.id === state.moral)?.label || '—';
  view().innerHTML = html`
    <section class="section">
      ${stepper('controle')}
      <div class="flow-card">
        <h2>Klopt alles?</h2>
        <p class="sub">Even controleren voordat we het boekje gaan maken.</p>
        <div class="card" style="box-shadow:none; background: var(--cream-2); padding: 20px; border-radius: 12px;">
          <div class="review-row"><span class="review-label">Voornaam</span><span class="review-value">${esc(state.childFirstName)}</span></div>
          <div class="review-row"><span class="review-label">Leeftijd</span><span class="review-value">${esc(state.childAge)} jaar</span></div>
          <div class="review-row"><span class="review-label">Thema</span><span class="review-value">${esc(themeLabel)}</span></div>
          <div class="review-row"><span class="review-label">Toon</span><span class="review-value">${esc(toneLabel)}</span></div>
          <div class="review-row"><span class="review-label">Lievelingsdier</span><span class="review-value">${esc(state.favoriteAnimal)}</span></div>
          <div class="review-row"><span class="review-label">Hobby</span><span class="review-value">${esc(state.hobby)}</span></div>
          <div class="review-row"><span class="review-label">Vriendje</span><span class="review-value">${esc(state.friendName || '—')}</span></div>
          <div class="review-row"><span class="review-label">Moraal</span><span class="review-value">${esc(moralLabel)}</span></div>
          <div class="review-row"><span class="review-label">E-mailadres</span><span class="review-value">${esc(state.parentEmail)}</span></div>
        </div>
        <div class="payment-amount">
          <span>Totaal (incl. 21% btw)</span>
          <span class="price">€4,95</span>
        </div>
        <div style="background:#fff7ec; border:1px solid #f4d9a0; border-radius:10px; padding:14px 16px; margin-top:16px; font-size:14px; line-height:1.5;">
          <strong>Bevestiging directe levering</strong><br>
          Door op <em>Betaal €4,95 met iDEAL</em> te klikken, bevestig je nogmaals dat je ons uitdrukkelijk verzoekt om onmiddellijk te starten met het genereren en leveren van je boekje, en dat je daarmee uitdrukkelijk afstand doet van je <a href="#/voorwaarden" target="_blank">herroepingsrecht</a> voor digitale inhoud (art. 6:230p sub d BW).
        </div>
        <div id="submitError" class="error-banner" style="display:none;"></div>
        <div class="flow-actions">
          <a href="#/maak/gegevens" class="btn btn-ghost">← Aanpassen</a>
          <button class="btn btn-primary btn-lg" id="payBtn">Betaal €4,95 met iDEAL →</button>
        </div>
      </div>
    </section>
  `;
  view().querySelector('#payBtn').addEventListener('click', submitOrderAndPay);
}

async function submitOrderAndPay() {
  const btn = view().querySelector('#payBtn');
  const errBox = view().querySelector('#submitError');
  btn.disabled = true; btn.textContent = 'Bestelling voorbereiden…';
  errBox.style.display = 'none';
  try {
    const payload = {
      purchaseType: state.purchaseType,
      childFirstName: state.childFirstName,
      childAge: Number(state.childAge),
      ageSegment: state.ageSegment,
      theme: state.theme,
      storyTone: state.storyTone,
      illustrationStyle: state.illustrationStyle || 'warme-waterverf',
      favoriteAnimal: state.favoriteAnimal,
      hobby: state.hobby,
      friendName: state.friendName || null,
      moral: state.moral,
      senderNote: state.senderNote || null,
      parentEmail: state.parentEmail,
      consentPrivacy: !!state.consentPrivacy,
      consentDigitalDelivery: !!state.consentDigitalDelivery,
    };
    const r = await api('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      let msg = data.message || 'Er ging iets mis bij het aanmaken van de bestelling.';
      if (data.error === 'blocklist') msg = `${data.message} (veld: ${data.field})`;
      if (data.error === 'moderation') msg = data.message || 'Deze invoer kwam niet door de veiligheidscontrole.';
      throw new Error(msg);
    }
    const { orderId } = await r.json();
    // Start payment
    const p = await api(`/api/orders/${orderId}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicBase: location.origin + (API_BASE || '') }),
    });
    if (!p.ok) {
      const d = await p.json().catch(() => ({}));
      throw new Error(d.message || 'Betaling starten mislukte.');
    }
    const pay = await p.json();
    // Redirect naar checkout (Mollie of mock)
    sessionStorage.setItem('jvb_last_order', orderId);
    if (pay.mode === 'mock') {
      // Mock-iDEAL: laat eenvoudige bevestig-pagina zien
      go(`/betaling/${orderId}`);
    } else {
      // Redirect naar Mollie
      location.href = pay.checkoutUrl;
    }
  } catch (err) {
    errBox.textContent = err.message;
    errBox.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Betaal €4,95 met iDEAL →';
  }
}

// ---------- BETALING (mock-iDEAL voor wanneer Mollie mock-mode) ----------
function renderBetaling(orderId) {
  if (!orderId) { go('/home'); return; }
  view().innerHTML = html`
    <section class="section">
      <div class="flow-card">
        <h2>Mock iDEAL (testmodus)</h2>
        <p class="sub">Dit scherm komt alleen in test-modus zonder Mollie-sandbox. In productie ga je direct naar Mollie's checkout.</p>
        <div class="payment-amount">
          <span>Jouw Voorleesboekje</span>
          <span class="price">€4,95</span>
        </div>
        <div class="flow-actions">
          <a href="#/maak/controle" class="btn btn-ghost">← Annuleer</a>
          <button class="btn btn-primary btn-lg" id="mockPayBtn">Bevestig betaling (mock)</button>
        </div>
      </div>
    </section>
  `;
  view().querySelector('#mockPayBtn').addEventListener('click', async () => {
    await api(`/api/orders/${orderId}/mock-confirm`, { method: 'POST' });
    go(`/generatie/${orderId}`);
  });
}

// ---------- GENERATIE (status polling) ----------
const STATUS_LABELS = {
  idle: 'We bereiden je boekje voor…',
  moderating: 'Laatste veiligheidscontrole op de invoer…',
  generating_text: 'We schrijven je verhaal…',
  generating_images: 'De illustraties worden getekend…',
  building_pdf: 'We zetten alles mooi in een PDF…',
  sending_email: 'We sturen het naar je mailbox…',
  completed: 'Klaar! 🎉',
  failed: 'Er ging iets mis.',
};
const STATUS_PROGRESS = {
  idle: 5, moderating: 12, generating_text: 30,
  generating_images: 70, building_pdf: 88, sending_email: 95, completed: 100, failed: 100,
};

function renderGeneratie(orderId) {
  if (!orderId) { go('/home'); return; }
  view().innerHTML = html`
    <section class="section">
      <div class="flow-card">
        <h2 style="text-align:center;">We maken het boekje…</h2>
        <p class="sub" style="text-align:center;">Dit duurt meestal 2 tot 4 minuten. Laat deze pagina gerust open.</p>
        <div class="loader-wrap">
          <div class="loader"></div>
          <div class="loader-status" id="loaderStatus">Je bestelling wordt opgepakt…</div>
          <div class="progress-bar"><div class="progress-fill" id="progressFill" style="width: 5%;"></div></div>
        </div>
        <div id="genError" class="error-banner" style="display:none;"></div>
      </div>
    </section>
  `;
  let tries = 0;
  async function poll() {
    try {
      const r = await api(`/api/orders/${orderId}/status`);
      if (!r.ok) throw new Error('status');
      const s = await r.json();
      const label = STATUS_LABELS[s.generationStatus] || 'Bezig…';
      const pct = STATUS_PROGRESS[s.generationStatus] || 20;
      view().querySelector('#loaderStatus').textContent = label;
      view().querySelector('#progressFill').style.width = pct + '%';
      if (s.generationStatus === 'completed' && s.hasPdf) {
        setTimeout(() => go(`/resultaat/${orderId}`), 600);
        return;
      }
      if (s.generationStatus === 'failed') {
        const eb = view().querySelector('#genError');
        eb.textContent = 'De generatie is mislukt. We hebben het gelogd. Probeer het opnieuw via de admin, of neem contact op.';
        eb.style.display = 'block';
        return;
      }
      tries++;
      // Polling interval: snel in begin, langzamer bij lange ops
      const nextDelay = tries < 5 ? 2000 : 4000;
      setTimeout(poll, nextDelay);
    } catch (err) {
      if (tries < 60) { setTimeout(poll, 4000); tries++; }
    }
  }
  poll();
}

// ---------- RESULTAAT ----------
function renderResultaat(orderId) {
  if (!orderId) { go('/home'); return; }
  view().innerHTML = html`
    <section class="section container">
      <div class="flow-card" style="max-width: 900px;">
        <h2 style="text-align:center;">Je voorleesboekje is klaar! 📖</h2>
        <p class="sub" style="text-align:center;">We hebben de PDF ook verzonden naar je e-mail (als dat lukt — de downloadlink hieronder werkt altijd).</p>
        <div id="resultContent">
          <div class="loader-wrap"><div class="loader"></div></div>
        </div>
      </div>
    </section>
  `;
  (async () => {
    try {
      const r = await api(`/api/orders/${orderId}/status`);
      const s = await r.json();
      const title = s.title || 'Jouw voorleesboekje';
      const pdfUrl = `${API_BASE}/api/orders/${orderId}/pdf`;
      const emailPreviewUrl = `${API_BASE}/api/orders/${orderId}/email-preview`;
      const rc = view().querySelector('#resultContent');
      rc.innerHTML = html`
        <div class="result-preview">
          <div class="result-cover">
            <embed src="${pdfUrl}#view=FitH&toolbar=0" type="application/pdf" />
          </div>
          <div>
            <h3 style="font-size: 24px;">${esc(title)}</h3>
            <p>De PDF staat klaar. Je kunt 'm openen, downloaden, afdrukken of direct voorlezen vanaf je scherm.</p>
            <div style="display:flex; flex-direction: column; gap: 10px; margin-top: 16px;">
              <a href="${pdfUrl}" target="_blank" class="btn btn-primary btn-lg">📥 Download de PDF</a>
              <a href="${emailPreviewUrl}" target="_blank" class="btn btn-secondary">📬 Bekijk de begeleidende e-mail</a>
              <a href="#/bedankt" class="btn btn-ghost">Naar bedankpagina</a>
            </div>
          </div>
        </div>
        <p style="text-align:center; font-size:13px; color: var(--ink-soft); margin-top: 32px;">
          De downloadlink blijft 30 dagen werken. Kindgegevens worden automatisch binnen 72 uur gewist.
        </p>
      `;
      clearState();
    } catch (err) {
      view().querySelector('#resultContent').innerHTML = `<div class="error-banner">Kon de bestelling niet laden: ${esc(err.message)}</div>`;
    }
  })();
}

// ---------- BEDANKT ----------
function renderBedankt() {
  view().innerHTML = html`
    <section class="section container" style="text-align:center;">
      <div style="font-size: 72px; margin-bottom: 16px;">🎉</div>
      <h1>Dankjewel!</h1>
      <p class="lead" style="margin: 0 auto 24px auto;">We hopen dat jullie samen veel voorleesplezier hebben.</p>
      <p style="color: var(--ink-soft);">Heb je opmerkingen of iets niet goed ontvangen? Mail ons op <a href="mailto:hallo@jouwvoorleesboekje.nl">hallo@jouwvoorleesboekje.nl</a>.</p>
      <div style="margin-top: 24px;">
        <a href="#/home" class="btn btn-secondary">Terug naar home</a>
        <a href="#/maak/leeftijd" class="btn btn-primary" style="margin-left: 8px;">Nog een boekje maken</a>
      </div>
    </section>
  `;
}

// ---------- LEGAL ----------
function renderLegal(slug, title) {
  view().innerHTML = html`
    <section class="section container">
      <div class="markdown-body">
        <h1>${title}</h1>
        <div id="md">Laden…</div>
      </div>
    </section>
  `;
  (async () => {
    try {
      const r = await api(`/api/legal/${slug}`);
      const data = await r.json();
      view().querySelector('#md').innerHTML = mdToHtml(data.markdown || '');
    } catch (err) {
      view().querySelector('#md').innerHTML = `<p class="error-banner">Kon ${slug} niet laden.</p>`;
    }
  })();
}

// Simpele markdown renderer (h1/h2/h3, paragraphs, lijsten, links, bold, italic)
function mdToHtml(md) {
  const lines = md.split(/\r?\n/);
  const out = [];
  let inList = false;
  function flushList() { if (inList) { out.push('</ul>'); inList = false; } }
  for (const l of lines) {
    if (/^###\s+/.test(l)) { flushList(); out.push('<h3>' + esc(l.replace(/^###\s+/, '')) + '</h3>'); continue; }
    if (/^##\s+/.test(l)) { flushList(); out.push('<h2>' + esc(l.replace(/^##\s+/, '')) + '</h2>'); continue; }
    if (/^#\s+/.test(l)) { flushList(); out.push('<h1>' + esc(l.replace(/^#\s+/, '')) + '</h1>'); continue; }
    if (/^[-*]\s+/.test(l)) {
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push('<li>' + inlineMd(l.replace(/^[-*]\s+/, '')) + '</li>'); continue;
    }
    flushList();
    if (/^\s*$/.test(l)) continue;
    out.push('<p>' + inlineMd(l) + '</p>');
  }
  flushList();
  return out.join('\n');
}
function inlineMd(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
}

// ---------- ADMIN ----------
function renderAdmin() {
  const storedPw = sessionStorage.getItem('jvb_admin_pw') || '';
  if (!storedPw) {
    view().innerHTML = html`
      <section class="section container">
        <div class="flow-card">
          <h2>Admin login</h2>
          <div class="field">
            <label>Wachtwoord</label>
            <input type="password" id="pw" placeholder="admin-wachtwoord uit ENV" />
          </div>
          <div class="flow-actions">
            <a href="#/home" class="btn btn-ghost">← Terug</a>
            <button class="btn btn-primary" id="loginBtn">Inloggen</button>
          </div>
          <p style="font-size:13px; color: var(--ink-soft); margin-top: 16px;">Default: "testtest" (overschrijfbaar via <code>ADMIN_PASSWORD</code> env)</p>
        </div>
      </section>
    `;
    view().querySelector('#loginBtn').addEventListener('click', async () => {
      const pw = view().querySelector('#pw').value;
      const r = await api(`/api/admin/orders?pw=${encodeURIComponent(pw)}`);
      if (!r.ok) { toast('Ongeldig wachtwoord'); return; }
      sessionStorage.setItem('jvb_admin_pw', pw);
      renderAdmin();
    });
    return;
  }
  view().innerHTML = html`
    <section class="section container">
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom:18px;">
        <h1 style="margin:0;">Admin</h1>
        <div>
          <button class="btn btn-ghost" id="logoutBtn">Uitloggen</button>
          <button class="btn btn-secondary" id="cleanupBtn">Cleanup nu</button>
        </div>
      </div>
      <div id="adminStats" class="admin-stats"></div>
      <div id="testMail" class="card" style="margin-bottom: 18px;">
        <h3 style="margin-top:0;">Test e-mail versturen</h3>
        <div class="form-row">
          <input type="email" id="testEmailAddr" placeholder="test@adres.nl" style="padding:10px; border:1px solid var(--line); border-radius:8px;"/>
          <button class="btn btn-secondary" id="testEmailBtn">Verstuur test</button>
        </div>
        <div id="testEmailResult" style="margin-top:8px; font-size:13px;"></div>
      </div>
      <h3>Recente orders</h3>
      <div id="adminOrders">Laden…</div>
    </section>
  `;
  view().querySelector('#logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('jvb_admin_pw'); renderAdmin();
  });
  view().querySelector('#cleanupBtn').addEventListener('click', async () => {
    const r = await api(`/api/admin/cleanup?pw=${encodeURIComponent(storedPw)}`, { method: 'POST' });
    const d = await r.json();
    toast(`Cleanup: ${d.childDataCleaned} kindgegevens, ${d.pdfsDeleted} pdf's gewist`);
  });
  view().querySelector('#testEmailBtn').addEventListener('click', async () => {
    const addr = view().querySelector('#testEmailAddr').value.trim();
    const resultBox = view().querySelector('#testEmailResult');
    resultBox.textContent = 'Bezig…';
    try {
      const r = await api(`/api/admin/test-email?pw=${encodeURIComponent(storedPw)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: addr }),
      });
      const d = await r.json();
      if (d.mode === 'sent') resultBox.innerHTML = `<span style="color: var(--sage-dark);">✓ Verzonden via ${esc(d.from || '')} (id=${esc(d.id || '')})</span>`;
      else if (d.mode === 'failed') resultBox.innerHTML = `<span style="color: var(--danger);">✗ ${esc(d.error || 'onbekende fout')}</span>`;
      else resultBox.innerHTML = `<span>Modus: ${esc(d.mode)}</span>`;
    } catch (err) {
      resultBox.innerHTML = `<span style="color: var(--danger);">✗ ${esc(err.message)}</span>`;
    }
  });
  loadAdmin();
}

async function loadAdmin() {
  const pw = sessionStorage.getItem('jvb_admin_pw') || '';
  try {
    const [rOrders, rStats] = await Promise.all([
      api(`/api/admin/orders?pw=${encodeURIComponent(pw)}`),
      api(`/api/admin/stats?pw=${encodeURIComponent(pw)}`),
    ]);
    if (!rOrders.ok || !rStats.ok) { sessionStorage.removeItem('jvb_admin_pw'); renderAdmin(); return; }
    const { orders } = await rOrders.json();
    const stats = await rStats.json();
    view().querySelector('#adminStats').innerHTML = html`
      <div class="admin-stat"><div class="n">${stats.total}</div><div class="l">Orders</div></div>
      <div class="admin-stat"><div class="n">${stats.completed}</div><div class="l">Completed</div></div>
      <div class="admin-stat"><div class="n">${stats.failed}</div><div class="l">Failed</div></div>
      <div class="admin-stat"><div class="n">${stats.avgGenerationMs ? Math.round(stats.avgGenerationMs/1000) + 's' : '—'}</div><div class="l">Gemiddelde generatietijd</div></div>
    `;
    if (!orders.length) {
      view().querySelector('#adminOrders').innerHTML = '<div class="card">Nog geen orders.</div>';
      return;
    }
    view().querySelector('#adminOrders').innerHTML = html`
      <table class="admin-table">
        <thead><tr><th>ID</th><th>Aangemaakt</th><th>Segment</th><th>Thema</th><th>Payment</th><th>Gen.</th><th>Titel</th><th>Email</th><th>Acties</th></tr></thead>
        <tbody>
          ${orders.map(o => html`
            <tr>
              <td><code style="font-size:11px;">${esc(o.id.slice(0, 8))}…</code></td>
              <td>${new Date(o.createdAt).toLocaleString('nl-NL')}</td>
              <td>${esc(o.ageSegment || '—')}</td>
              <td>${esc(o.theme || '—')}</td>
              <td><span class="status-pill ${esc(o.paymentStatus)}">${esc(o.paymentStatus)}</span></td>
              <td><span class="status-pill ${esc(o.generationStatus)}">${esc(o.generationStatus)}</span></td>
              <td style="max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(o.title || '—')}</td>
              <td style="font-size:11px;">${esc(o.email || '—')}</td>
              <td style="white-space:nowrap;">
                <button class="btn btn-sm btn-ghost" data-a="pay" data-id="${o.id}">Simuleer paid</button>
                <button class="btn btn-sm btn-ghost" data-a="regen" data-id="${o.id}">Regenereer</button>
                <button class="btn btn-sm btn-ghost" data-a="forcef" data-id="${o.id}">Force fail</button>
                <a class="btn btn-sm btn-ghost" href="#/resultaat/${o.id}">Bekijk</a>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    view().querySelectorAll('[data-a]').forEach(b => {
      b.addEventListener('click', async () => {
        const id = b.dataset.id;
        const a = b.dataset.a;
        const url = a === 'pay' ? `/api/admin/simulate-paid/${id}`
                 : a === 'regen' ? `/api/admin/regenerate/${id}`
                 : `/api/admin/force-error/${id}`;
        const r = await api(`${url}?pw=${encodeURIComponent(pw)}`, { method: 'POST' });
        toast(r.ok ? 'OK' : 'Mislukt');
        setTimeout(loadAdmin, 500);
      });
    });
  } catch (err) {
    view().querySelector('#adminOrders').innerHTML = `<div class="error-banner">Kon admin niet laden.</div>`;
  }
}
