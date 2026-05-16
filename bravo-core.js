// ============================================================
// BRAVO CORE — globals, team, navigation, utils, module loader
// Caricato SEMPRE come primo script in bravo.html
// ============================================================

// ── API URLs ──
var BRAVO_API    = (typeof window !== 'undefined' && window.BRAVO_BACKEND)
  ? window.BRAVO_BACKEND
  : 'https://bravoapp-production.up.railway.app';
var AGENT_API    = BRAVO_API;
var BRIEFING_API = BRAVO_API;

// ── GLOBAL STATE (condiviso tra moduli) ──
var CUENTAS        = [];
var HOY_TAREAS     = {};
var CLIENTS_DATA   = [];
var PERSON_COLORS  = { 'Vicente Palazzolo':'#B8860B', 'Carlos Lage':'#D13B1E', 'Andrea Valdivia':'#2c5f8a', 'Mari Almendros':'#2d7a4f' };
var ESTADO_COLORS  = { crit:'var(--red)', warn:'var(--gold)', good:'var(--green)', idle:'var(--muted2)' };
var CLIENT_COLORS  = ['#D13B1E','#2c5f8a','#2d7a4f','#c8860a','#6d4c8e'];
var _clientesStatusCache = {};
var _studioKPICache      = null;

// ── TEAM MEMBERS — cache globale (caricata dal backend al boot) ──
// Fonte di verità: GET /api/team-options → { humans:[...], agents:[...] }
// Questo array è solo un FALLBACK minimo (4 umani Bravo) usato se l'API è giù.
// Gli agenti veri (5 macro) arrivano sempre dal backend, mai hardcoded.
var _teamMembers = [
  { id:'bb000001-0000-0000-0000-000000000001', name:'Vicente Palazzolo', role:'CEO & Sales',           initials:'VP', color:'#B8860B', status:'on', employment_type:'human' },
  { id:'bb000002-0000-0000-0000-000000000002', name:'Carlos Lage',       role:'Fotógrafo & Filmmaker', initials:'CL', color:'#D13B1E', status:'on', employment_type:'human' },
  { id:'bb000003-0000-0000-0000-000000000003', name:'Andrea Valdivia',   role:'Social Media Manager',  initials:'AV', color:'#2c5f8a', status:'on', employment_type:'human' },
  { id:'bb000004-0000-0000-0000-000000000004', name:'Mari Almendros',    role:'Brand & Diseño',        initials:'MA', color:'#2d7a4f', status:'on', employment_type:'human' },
];

// Colore per ogni macro-agente (la tabella agents non ha colore proprio)
var _AGENT_COLORS = {
  analisis:   '#0F766E',
  calendario: '#1D4ED8',
  contenido:  '#7C3AED',
  estrategia: '#065F46',
  resenas:    '#BE185D',
};

// Sigla agente: "Agente Análisis" → "AN" (toglie "Agente", prime 2 lettere)
function _agentInitials(name) {
  var base = (name || '').replace(/^Agente\s+/i, '').trim() || (name || '');
  return base.slice(0, 2).toUpperCase();
}

// TEAM e TEAM_DATA: array derivati da _teamMembers, usati da chat ed equipo
var TEAM      = [];
var TEAM_DATA = [];

function _teamColorFor(name) {
  if (!name) return '#a09890';
  var m = _teamMembers.find(function(x) { return x.name === name || name.indexOf(x.name.split(' ')[0]) >= 0; });
  return m ? m.color : '#a09890';
}

function _teamInitialsFor(name) {
  if (!name) return '?';
  var m = _teamMembers.find(function(x) { return x.name === name; });
  if (m && m.initials) return m.initials;
  var parts = name.split(' ');
  return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
}

function _rebuildTeamDropdowns() {
  var humans = _teamMembers.filter(function(m) { return m.employment_type !== 'agent'; });
  var agents = _teamMembers.filter(function(m) { return m.employment_type === 'agent'; });

  var optsHumans = '<option value="">— Sin asignar —</option>' +
    humans.map(function(m) {
      return '<option value="' + m.name + '">' + m.name + ' — ' + m.role + '</option>';
    }).join('');
  var panelEl = document.getElementById('panelAssign');
  if (panelEl) { var c = panelEl.value; panelEl.innerHTML = optsHumans; panelEl.value = c; }

  var optsAll = '<option value="">— Sin asignar —</option>' +
    humans.map(function(m) {
      return '<option value="' + m.name + '">' + m.name + ' — ' + m.role + '</option>';
    }).join('') +
    (agents.length ? '<option disabled>── Agentes AI ──</option>' +
      agents.map(function(m) {
        return '<option value="' + m.name + '">🤖 ' + m.name + '</option>';
      }).join('') : '');
  var progEl = document.getElementById('programarAssign');
  if (progEl) { var cv = progEl.value; progEl.innerHTML = optsAll; progEl.value = cv; }
}

function _syncTeamArrays() {
  TEAM.length = 0;
  TEAM_DATA.length = 0;
  _teamMembers.forEach(function(m) {
    TEAM.push({ name: m.name, role: m.role, initials: m.initials, color: m.color, status: m.status || 'on' });
    var detail = (m.responsibilities || []).join(', ') || m.bio_short || m.role || '';
    TEAM_DATA.push({ name: m.name, role: m.role, detail: detail, initials: m.initials, color: m.color });
  });
  _teamMembers.forEach(function(m) { PERSON_COLORS[m.name] = m.color; });
}

async function loadTeamMembers() {
  try {
    var res = await fetch(BRAVO_API + '/api/team-options');
    if (!res.ok) return;
    var data = await res.json();
    var humans = (data.humans || []).map(function(h) {
      return {
        id: h.id,
        name: h.name,
        role: h.role || '',
        initials: h.initials || (h.name || '').slice(0, 2).toUpperCase(),
        color: h.color || '#888',
        status: 'on',
        employment_type: 'human',
      };
    });
    var agents = (data.agents || []).map(function(a) {
      return {
        id: a.id,
        slug: a.slug,
        name: a.name,
        role: a.category || 'Agente',
        bio_short: a.description || '',
        initials: _agentInitials(a.name),
        color: _AGENT_COLORS[a.slug] || '#6B7280',
        status: 'on',
        employment_type: 'agent',
        _agentKey: a.slug,
      };
    });
    if (humans.length || agents.length) {
      _teamMembers = humans.concat(agents);
      _syncTeamArrays();
      _rebuildTeamDropdowns();
    }
  } catch (e) {
    console.warn('[TEAM] Caricamento fallito, uso fallback 4 umani:', e.message);
  }
}

// Popola TEAM e TEAM_DATA dai fallback statici al boot
_syncTeamArrays();
// Poi aggiorna da Supabase (asincrono)
setTimeout(loadTeamMembers, 0);

// ── DATE HELPER ──
function bravoTodayStr() {
  var d    = new Date();
  var days = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  var mons = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + mons[d.getMonth()] + ' ' + d.getFullYear();
}
(function() {
  var chip = document.getElementById('today-date-chip');
  if (chip) chip.textContent = bravoTodayStr();
})();

// ── TOAST ──
var toastTimer;
function showToast(msg) {
  var ex = document.querySelector('.toast');
  if (ex) ex.remove();
  clearTimeout(toastTimer);
  var t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(function() {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(function() { t.remove(); }, 300);
  }, 2800);
}

// ── PROGRESS RING SVG ──
function buildProgRing(pct, color) {
  var r = 22, cx = 27, cy = 27, circ = 2 * Math.PI * r;
  var offset = circ - (pct / 100) * circ;
  return '<svg class="prog-ring-svg" width="54" height="54" viewBox="0 0 54 54">' +
    '<circle class="prog-ring-bg" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>' +
    '<circle class="prog-ring-fill" cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + color +
    '" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"/>' +
    '</svg>';
}

// ── NAVIGAZIONE PRINCIPALE ──
function switchTab(tab, el) {
  var cpEl = document.getElementById('clientePage');
  if (cpEl) cpEl.classList.remove('open');
  if (typeof closeClientesPopup === 'function') closeClientesPopup();

  var dash = document.getElementById('dashboardWrap');
  if (dash) dash.style.display = (tab === 'clientes') ? '' : 'none';

  if (tab === 'clientes') {
    var tabs0 = document.querySelectorAll('.nav-tab');
    for (var i = 0; i < tabs0.length; i++) tabs0[i].classList.remove('active');
    if (el) el.classList.add('active');
    if (typeof openClientesPopup === 'function') openClientesPopup();
    return;
  }

  var views = document.querySelectorAll('.view');
  for (var i = 0; i < views.length; i++) views[i].classList.remove('active');
  var tabs = document.querySelectorAll('.nav-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  var viewEl = document.getElementById('view-' + tab);
  if (viewEl) viewEl.classList.add('active');
  if (el) el.classList.add('active');

  var fb = document.getElementById('filtersBar');
  if (fb) fb.style.display = (tab === 'proyectos') ? 'flex' : 'none';

  // Ogni tab carica il suo modulo in modo lazy, poi esegue il render
  if (tab === 'historial')  { loadModule('historial',  function() { if (typeof renderHistory  === 'function') renderHistory(); }); }
  if (tab === 'calendario') { loadModule('calendar',   function() { if (typeof loadCalendarFromSupabase === 'function') loadCalendarFromSupabase(); }); }
  if (tab === 'tablero')    { loadModule('tablero',    function() { if (typeof buildTbSelector === 'function') { buildTbSelector(); switchTableroMode(window._tableroMode || 'social'); } }); }
  if (tab === 'equipo')     { loadModule('equipo',     function() { if (typeof renderEquipoView === 'function') renderEquipoView(); }); }
  if (tab === 'proyectos')  { loadModule('proyectos',  null); }
}

// ── LAZY MODULE LOADER ──
var _loadedModules = {};
var _moduleCallbacks = {};

function loadModule(name, callback) {
  if (_loadedModules[name]) {
    if (callback) callback();
    return;
  }
  if (_moduleCallbacks[name]) {
    if (callback) _moduleCallbacks[name].push(callback);
    return;
  }
  _moduleCallbacks[name] = callback ? [callback] : [];
  var s = document.createElement('script');
  s.src = 'modules/mod-' + name + '.js?v=' + Date.now();
  s.onload = function() {
    _loadedModules[name] = true;
    var cbs = _moduleCallbacks[name] || [];
    for (var i = 0; i < cbs.length; i++) { try { cbs[i](); } catch(e) { console.warn('[MOD] ' + name, e); } }
    delete _moduleCallbacks[name];
  };
  s.onerror = function() { console.error('[MOD] Impossibile caricare modules/mod-' + name + '.js'); };
  document.head.appendChild(s);
}

// ── STUB: funzioni legacy chiamate da bravo-db.js prima che i moduli carichino ──
// renderClientesView era in bravo.js ma è stata rimossa; lo stub evita il ReferenceError
// che farebbe saltare renderClientesPopupList e gli altri render del .then() in bravo-db.js
function renderClientesView() {
  var grid = document.getElementById('clientesGrid');
  if (!grid || !CLIENTS_DATA || !CLIENTS_DATA.length) return;
  var colors = CLIENT_COLORS;
  grid.innerHTML = CLIENTS_DATA.map(function(c, i) {
    var initials = (c.name || '').split(' ').map(function(w){ return w[0] || ''; }).join('').toUpperCase().slice(0, 2);
    var color = colors[i % colors.length];
    return '<div class="cliente-card" onclick="openClientePage(' + i + ')">' +
      '<div class="cliente-card-accent" style="background:' + color + '"></div>' +
      '<div class="cliente-logo" style="background:' + color + '">' + initials + '</div>' +
      '<div class="cliente-card-name">' + (c.name || '') + '</div>' +
    '</div>';
  }).join('');
}

// Precarica i moduli al boot (in parallelo, non bloccante)
document.addEventListener('DOMContentLoaded', function() {
  loadModule('dashboard', function() {
    if (typeof renderHoyStrip       === 'function') renderHoyStrip();
    if (typeof renderDashboardStats === 'function') renderDashboardStats();
  });
  // Moduli sempre presenti nell'UI
  loadModule('clientes',  null);
  loadModule('proyectos', null);
  loadModule('tablero',   null);
  loadModule('equipo',    null);
  loadModule('historial', null);
  loadModule('calendar',  null);
  // Pagina cliente + sub-moduli (pesanti, ma necessari quando l'utente apre un cliente)
  loadModule('cliente-page', null);
});
