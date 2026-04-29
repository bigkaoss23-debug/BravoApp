// ============================================================
// URL backend — sorgente unica (override con window.BRAVO_BACKEND)
// ============================================================
var BRAVO_API = (typeof window !== 'undefined' && window.BRAVO_BACKEND)
  ? window.BRAVO_BACKEND
  : 'https://bravoapp-production.up.railway.app';
var AGENT_API    = BRAVO_API;
var BRIEFING_API = BRAVO_API;

// ============================================================
// TEAM MEMBERS — cache globale (caricata da Supabase al boot)
// ============================================================
var _teamMembers = [
  { name:'Vicente Palazzolo',  role:'CEO & Sales',           initials:'VP', color:'#B8860B', status:'on', employment_type:'partner'  },
  { name:'Carlos Lage',        role:'Fotógrafo & Filmmaker', initials:'CL', color:'#D13B1E', status:'on', employment_type:'employee'  },
  { name:'Andrea Valdivia',    role:'Social Media Manager',  initials:'AV', color:'#2c5f8a', status:'on', employment_type:'employee'  },
  { name:'Mari Almendros',     role:'Brand & Diseño',        initials:'MA', color:'#2d7a4f', status:'on', employment_type:'employee'  },
  { name:'Agente Copywriter',  role:'AI Agent',              initials:'AC', color:'#7C3AED', status:'on', employment_type:'agent'     },
  { name:'Agente Designer',    role:'AI Agent',              initials:'AD', color:'#1D4ED8', status:'on', employment_type:'agent'     },
  { name:'Agente Strategist',  role:'AI Agent',              initials:'AS', color:'#065F46', status:'on', employment_type:'agent'     },
];

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

  // Dropdown panelAssign (Kanban) — solo umani
  var optsHumans = '<option value="">— Sin asignar —</option>' +
    humans.map(function(m) {
      return '<option value="' + m.name + '">' + m.name + ' — ' + m.role + '</option>';
    }).join('');
  var panelEl = document.getElementById('panelAssign');
  if (panelEl) { var c = panelEl.value; panelEl.innerHTML = optsHumans; panelEl.value = c; }

  // Dropdown programarAssign (Proyectos) — umani + separatore + agenti AI
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

async function loadTeamMembers() {
  try {
    var res = await fetch(BRAVO_API + '/api/team/members');
    if (!res.ok) return;
    var data = await res.json();
    if (data.ok && data.members && data.members.length) {
      _teamMembers = data.members;
      // Aggiorna tutti gli array dipendenti
      _syncTeamArrays();
      _rebuildTeamDropdowns();
    }
  } catch (e) {
    console.warn('[TEAM] Caricamento fallito, uso fallback:', e.message);
  }
}

function _syncTeamArrays() {
  // Ricostruisce TEAM (chat) e TEAM_DATA (equipo) dalla cache
  TEAM.length = 0;
  TEAM_DATA.length = 0;
  _teamMembers.forEach(function(m) {
    TEAM.push({ name: m.name, role: m.role, initials: m.initials, color: m.color, status: m.status || 'on' });
    var detail = (m.responsibilities || []).join(', ') || m.bio_short || m.role || '';
    TEAM_DATA.push({ name: m.name, role: m.role, detail: detail, initials: m.initials, color: m.color });
  });
  // Aggiorna PERSON_COLORS
  _teamMembers.forEach(function(m) { PERSON_COLORS[m.name] = m.color; });
}

// Carica subito al boot (asincrono — non blocca il rendering)
setTimeout(loadTeamMembers, 0);

// ── DATE HELPER ──
function bravoTodayStr() {
  var d    = new Date();
  var days = ['Dom','Lun','Mar','Mie','Jue','Vie','Sab'];
  var mons = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return days[d.getDay()] + ' ' + d.getDate() + ' ' + mons[d.getMonth()] + ' ' + d.getFullYear();
}
// Imposta il chip data nell'header appena il tag script viene eseguito
(function() {
  var chip = document.getElementById('today-date-chip');
  if (chip) chip.textContent = bravoTodayStr();
})();

// ── STATE ──
var decisions = [
  { type:'green', action:'Logo Rossi Srl aprobado', detail:'Cliente satisfecho, avance al 78%. Se notifico al equipo.', tags:['Rossi Srl','Lucia F.'], time:'Ayer 14:22' },
  { type:'blue',  action:'Notificacion enviada a Bianchi & Co', detail:'Recordatorio de aprobacion pendiente del brief Q2 v2.', tags:['Bianchi & Co','Sara M.'], time:'Ayer 11:05' },
  { type:'gold',  action:'Revision solicitada — Copy Newsletter', detail:'Tono demasiado formal. Se pidio ajuste al equipo creativo.', tags:['Ferretti SpA'], time:'28 mar 16:40' },
  { type:'red',   action:'Escalacion — Paleta Colores retrasada', detail:'Verde Fashion sin respuesta en 3 dias. Escalado a direccion.', tags:['Verde Fashion','Marco R.'], time:'27 mar 09:15' },
  { type:'green', action:'Brief Campana Q2 aprobado', detail:'Aprobado con observaciones menores. Equipo informado.', tags:['Bianchi & Co','Sara M.'], time:'26 mar 17:30' },
  { type:'blue',  action:'Reunion de kickoff confirmada', detail:'Kickoff Newsletter Abril con Ferretti SpA el 1 de abril.', tags:['Ferretti SpA'], time:'25 mar 10:00' },
  { type:'gold',  action:'Fecha limite desplazada — Social Q2', detail:'Movida de 25 abr a 2 may por peticion del cliente.', tags:['Bianchi & Co'], time:'24 mar 15:20' },
  { type:'green', action:'Moodboard Rossi Srl aprobado', detail:'Primera entrega aprobada sin cambios. Excelente trabajo.', tags:['Rossi Srl','Lucia F.'], time:'18 mar 13:00' },
];

var histFilter = 'all';
var activeFilters = { client: 'todos', resp: 'todos', status: 'todos' };

// ── TABS ──
function switchTab(tab, el) {
  // Chiudi pagina cliente se aperta
  var cpEl = document.getElementById('clientePage');
  if (cpEl) cpEl.classList.remove('open');
  // Chiudi popup clientes se aperto
  closeClientesPopup();

  // Mostra/nasconde dashboard solo su tab clientes
  var dash = document.getElementById('dashboardWrap');
  if (dash) dash.style.display = (tab === 'clientes') ? '' : 'none';

  // Tab clientes → apre popup, non cambia view
  if (tab === 'clientes') {
    var tabs0 = document.querySelectorAll('.nav-tab');
    for (var i = 0; i < tabs0.length; i++) tabs0[i].classList.remove('active');
    if (el) el.classList.add('active');
    openClientesPopup();
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
  if (tab === 'historial') renderHistory();
  if (tab === 'calendario') loadCalendarFromSupabase();
  if (tab === 'tablero') { buildTbSelector(); switchTableroMode(_tableroMode || 'social'); }
  if (tab === 'equipo') renderEquipoView();
}

// ── DISEÑO: upload, copia colores, brand kit ──
var _disenoFiles = [];

function disenoHandleFiles(files) {
  var gallery = document.getElementById('diseno-gallery');
  if (!gallery) return;
  Array.from(files).forEach(function(file) {
    if (!file.type.startsWith('image/')) return;
    var reader = new FileReader();
    reader.onload = function(e) {
      _disenoFiles.push({ name: file.name, url: e.target.result });
      var item = document.createElement('div');
      item.className = 'diseno-gallery-item';
      var idx = _disenoFiles.length - 1;
      item.innerHTML = '<img src="' + e.target.result + '" alt="' + file.name + '">' +
        '<button class="gallery-del" onclick="disenoRemove(' + idx + ',this.closest(\'.diseno-gallery-item\'))">✕</button>';
      gallery.appendChild(item);
    };
    reader.readAsDataURL(file);
  });
}

function disenoRemove(idx, el) {
  _disenoFiles[idx] = null;
  if (el) el.remove();
}

function copyColor(hex, el) {
  navigator.clipboard.writeText(hex).then(function() {
    if (!el) return;
    var orig = el.querySelector('.brand-swatch-name').textContent;
    el.querySelector('.brand-swatch-name').textContent = '¡Copiado!';
    setTimeout(function() { el.querySelector('.brand-swatch-name').textContent = orig; }, 1200);
  });
}

function copyBrandKit() {
  var kit = 'BRAND KIT — DaKady\n\nTagline: "Líderes En Soluciones Agrícolas"\n\nColores:\n· Rojo principal: #C0392B\n· Blanco: #FFFFFF\n· Crema: #F5F0E8\n· Negro: #1A1710\n· Verde: #2D7A4F\n\nTipografía:\n· Títulos: Barlow Condensed Bold/ExtraBold\n· Cuerpo: Figtree Regular/SemiBold\n· Datos: IBM Plex Mono Light\n\nTono: Profesional, técnico, humano, concreto, directo.\n\nSector: Empresa agrícola española, soluciones para invernaderos.\nAudiencia: agricultores, técnicos agrícolas, cooperativas.\n\nFormatos: Instagram Post 1:1 · IG Story 9:16 · LinkedIn 1200×627 · Reel Cover · Facebook Post';
  navigator.clipboard.writeText(kit).then(function() {
    var hint = document.querySelector('.diseno-copy-hint strong');
    if (hint) {
      hint.textContent = '¡Brand Kit copiado!';
      setTimeout(function() { hint.textContent = 'Copiar Brand Kit al portapapeles'; }, 2000);
    }
  });
}

function toggleProj(id) {
  var body = document.getElementById('pb-' + id);
  var chev = document.getElementById('ch-' + id);
  if (!body) return;
  var isOpen = body.classList.contains('open');
  var bodies = document.querySelectorAll('.proj-body');
  var chevs  = document.querySelectorAll('.chev');
  for (var i = 0; i < bodies.length; i++) bodies[i].classList.remove('open');
  for (var i = 0; i < chevs.length; i++)  chevs[i].classList.remove('open');
  if (!isOpen) { body.classList.add('open'); if (chev) chev.classList.add('open'); }
}

function openProject(id) {
  document.querySelectorAll('.nav-tab')[0].click();
  setTimeout(function() { toggleProj(id); }, 100);
  var s = document.getElementById('astrip');
  if (s) s.remove();
}

// ── FILTERS ──
function filterBy(type, val, el) {
  activeFilters[type] = val;
  var fb = document.getElementById('filtersBar');
  var children = fb ? fb.children : [];
  var currentType = null;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.classList.contains('filter-label')) {
      var txt = child.textContent.toLowerCase();
      if (txt.indexOf('cliente') >= 0) currentType = 'client';
      else if (txt.indexOf('respons') >= 0) currentType = 'resp';
      else if (txt.indexOf('estado') >= 0) currentType = 'status';
    } else if (child.classList.contains('filter-chip') && currentType === type) {
      child.classList.remove('active','active-green','active-blue');
    }
  }
  el.classList.add('active');
  applyProjectFilters();
}

function applyProjectFilters() {
  var cards = document.querySelectorAll('.cuenta-card');
  var count = 0;
  for (var i = 0; i < cards.length; i++) {
    var c = CUENTAS[i];
    if (!c) continue;
    var clientMatch = activeFilters.client === 'todos' ||
      (activeFilters.client === 'dakady'  && c.cliente.toLowerCase().indexOf('dakady') >= 0) ||
      (activeFilters.client === 'samanta' && c.cliente.toLowerCase().indexOf('samanta') >= 0) ||
      (activeFilters.client === 'oscar'   && c.cliente.toLowerCase().indexOf('oscar') >= 0) ||
      (activeFilters.client === 'solis'   && c.cliente.toLowerCase().indexOf('solis') >= 0);
    var statusMatch = activeFilters.status === 'todos' ||
      (activeFilters.status === 'crit' && c.estado === 'crit') ||
      (activeFilters.status === 'warn' && c.estado === 'warn') ||
      (activeFilters.status === 'good' && c.estado === 'good');
    var show = clientMatch && statusMatch;
    if (show) { cards[i].classList.remove('hidden'); count++; }
    else cards[i].classList.add('hidden');
  }
  var pc = document.getElementById('projCount');
  if (pc) pc.textContent = count;
}

// ── APPROVALS ──
function approveItem(btn, name) {
  var item = btn.closest('.appr-item');
  item.style.opacity = '0.45'; item.style.pointerEvents = 'none';
  item.querySelector('.appr-name').innerHTML += ' <span style="color:var(--green);font-size:0.7rem">OK</span>';
  item.querySelector('.appr-btns').innerHTML = '';
  logDecision(name + ' aprobado', 'green');
  showToast('Aprobado: ' + name);
}

function rejectItem(btn, name) {
  var item = btn.closest('.appr-item');
  item.style.opacity = '0.45'; item.style.pointerEvents = 'none';
  item.querySelector('.appr-name').innerHTML += ' <span style="color:var(--red);font-size:0.7rem">X</span>';
  item.querySelector('.appr-btns').innerHTML = '';
  logDecision(name + ' bloqueado', 'red');
  showToast('Bloqueado: ' + name);
}

// ── MODAL ──
function openAssign(proj) {
  document.getElementById('mProj').value = proj;
  document.getElementById('assignModal').classList.add('open');
}
function closeModal() { document.getElementById('assignModal').classList.remove('open'); }
function confirmAssign() {
  var p    = document.getElementById('mPerson').value;
  var proj = document.getElementById('mProj').value;
  if (!p) { showToast('Selecciona un responsable'); return; }
  logDecision(proj + ' asignado a ' + p, 'blue');
  closeModal();
  showToast('Asignado: ' + p);
}

// ── HISTORY ──
function logDecision(action, type, detail) {
  var now  = new Date();
  var time = 'Hoy ' + now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  decisions.unshift({ type: type, action: action, detail: detail || 'Accion registrada por BRAVO.', tags: [], time: time });
  updateHistStats();
}

function updateHistStats() {
  var appr = 0, esc = 0, rev = 0, notif = 0;
  for (var i = 0; i < decisions.length; i++) {
    if (decisions[i].type === 'green') appr++;
    else if (decisions[i].type === 'red')  esc++;
    else if (decisions[i].type === 'gold') rev++;
    else if (decisions[i].type === 'blue') notif++;
  }
  document.getElementById('hs-appr').textContent  = appr;
  document.getElementById('hs-esc').textContent   = esc;
  document.getElementById('hs-rev').textContent   = rev;
  document.getElementById('hs-notif').textContent = notif;
}

var typeConfig = {
  red:   { ico:'!', bg:'var(--red-dim)',   col:'var(--red)',   label:'Escalacion' },
  green: { ico:'OK', bg:'var(--green-dim)', col:'var(--green)', label:'Aprobacion' },
  gold:  { ico:'~', bg:'var(--gold-dim)',  col:'var(--gold)',  label:'Revision' },
  blue:  { ico:'@', bg:'var(--blue-dim)',  col:'var(--blue)',  label:'Notificacion' },
};

function renderHistory() {
  var feed = document.getElementById('histFeed');
  if (!feed) return;
  feed.innerHTML = '';
  var list = histFilter === 'all' ? decisions : decisions.filter(function(d) { return d.type === histFilter; });
  document.getElementById('histCount').textContent = list.length + ' registros';
  for (var i = 0; i < list.length; i++) {
    var d   = list[i];
    var cfg = typeConfig[d.type];
    var el  = document.createElement('div');
    el.className = 'hist-item';
    el.style.animationDelay = (i * 0.04) + 's';
    var tagsHtml = '';
    for (var j = 0; j < d.tags.length; j++) {
      tagsHtml += '<span class="hist-tag" style="background:' + cfg.bg + ';color:' + cfg.col + '">' + d.tags[j] + '</span>';
    }
    el.innerHTML = '<div class="hist-ico" style="background:' + cfg.bg + ';color:' + cfg.col + '">' + cfg.ico + '</div>' +
      '<div class="hist-content"><div class="hist-top"><div class="hist-action">' + d.action + '</div><div class="hist-time">' + d.time + '</div></div>' +
      '<div class="hist-detail">' + d.detail + '</div>' +
      (tagsHtml ? '<div class="hist-tags">' + tagsHtml + '</div>' : '') + '</div>';
    feed.appendChild(el);
  }
}

function filterHist(type, el) {
  histFilter = type;
  var chips = document.querySelectorAll('.hist-filters .filter-chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
  el.classList.add('active');
  renderHistory();
}

// ── CALENDAR ──
var calYear = 2026, calMonth = 3;
var calEvents = {};

async function loadCalendarFromSupabase() {
  try {
    var res  = await fetch(BRAVO_API + '/api/plan-tasks');
    var data = await res.json();
    var tasks = data.tasks || [];
    calEvents = {};
    var colorMap = {};
    _teamMembers.forEach(function(m){ colorMap[m.name] = m.employment_type === 'agent' ? 'ce-purple' : (m.color === '#D13B1E' ? 'ce-red' : m.color === '#2c5f8a' ? 'ce-blue' : m.color === '#2d7a4f' ? 'ce-green' : m.color === '#B8860B' ? 'ce-gold' : 'ce-blue'); });
    tasks.forEach(function(t) {
      if (!t.publish_date) return;
      var d = new Date(t.publish_date + 'T12:00:00');
      var key = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
      if (!calEvents[key]) calEvents[key] = [];
      var cls = colorMap[t.assignee] || 'ce-blue';
      calEvents[key].push({ t: t.title || 'Tarea', cls: cls });
    });
    renderCalendar();
  } catch(e) {
    console.warn('[CALENDARIO] Errore caricamento:', e.message);
  }
}
var monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var dayNames   = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];

function renderCalendar() {
  document.getElementById('calTitle').textContent = monthNames[calMonth] + ' ' + calYear;
  var grid = document.getElementById('calGrid');
  if (!grid) return;
  grid.innerHTML = '';
  for (var di = 0; di < dayNames.length; di++) {
    var h = document.createElement('div'); h.className = 'cal-day-head'; h.textContent = dayNames[di]; grid.appendChild(h);
  }
  var firstDay    = new Date(calYear, calMonth, 1).getDay();
  var startOffset = (firstDay === 0 ? 6 : firstDay - 1);
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  var today       = new Date();
  for (var i = startOffset - 1; i >= 0; i--) {
    var d = document.createElement('div'); d.className = 'cal-day other-month';
    d.innerHTML = '<span class="day-num">' + (daysInPrev - i) + '</span>'; grid.appendChild(d);
  }
  for (var day = 1; day <= daysInMonth; day++) {
    var d = document.createElement('div'); d.className = 'cal-day';
    if (today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===day) d.classList.add('today');
    var key = calYear + '-' + (calMonth+1) + '-' + day;
    var evs = calEvents[key] || [];
    var innerHTML = '<span class="day-num">' + day + '</span>';
    for (var ei = 0; ei < evs.length; ei++) {
      innerHTML += '<div class="cal-event ' + evs[ei].cls + '" onclick="showToast(\'' + evs[ei].t + '\')">' + evs[ei].t + '</div>';
    }
    d.innerHTML = innerHTML;
    grid.appendChild(d);
  }
  var total = startOffset + daysInMonth;
  var remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var i = 1; i <= remaining; i++) {
    var d = document.createElement('div'); d.className = 'cal-day other-month';
    d.innerHTML = '<span class="day-num">' + i + '</span>'; grid.appendChild(d);
  }
}
function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}

// ── TOAST ──
var toastTimer;
function showToast(msg) {
  var ex = document.querySelector('.toast');
  if (ex) ex.remove();
  clearTimeout(toastTimer);
  var t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  toastTimer = setTimeout(function() { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(function(){t.remove();},300); }, 2800);
}

// ── CUENTAS DATA ──
// CUENTAS — dati da collegare a client_projects Supabase (Step 2)
var CUENTAS = [];

// HOY_TAREAS — dati da collegare a team_tasks Supabase (Step 2)
var HOY_TAREAS = {};

var PERSON_COLORS = { 'Vicente Palazzolo':'#B8860B', 'Carlos Lage':'#D13B1E', 'Andrea Valdivia':'#2c5f8a', 'Mari Almendros':'#2d7a4f' };
var ESTADO_COLORS = { crit:'var(--red)', warn:'var(--gold)', good:'var(--green)', idle:'var(--muted2)' };

function buildProgRing(pct, color) {
  var r = 22, cx = 27, cy = 27, circ = 2 * Math.PI * r;
  var offset = circ - (pct / 100) * circ;
  return '<svg class="prog-ring-svg" width="54" height="54" viewBox="0 0 54 54">' +
    '<circle class="prog-ring-bg" cx="' + cx + '" cy="' + cy + '" r="' + r + '"/>' +
    '<circle class="prog-ring-fill" cx="' + cx + '" cy="' + cy + '" r="' + r + '" stroke="' + color + '" stroke-dasharray="' + circ + '" stroke-dashoffset="' + offset + '"/>' +
    '</svg>';
}

function renderHoyStrip() {
  var strip = document.getElementById('hoyStrip');
  if (!strip) return;

  var html = '<div class="hoy-header">' +
    '<div class="hoy-title">Hoy toca</div>' +
    '<div class="hoy-sub">' + bravoTodayStr() + ' — equipo</div>' +
  '</div>';

  // Merge team_tasks + plan subtasks di oggi/questa settimana
  var taskData = JSON.parse(JSON.stringify((typeof _equipoTasks !== 'undefined') ? _equipoTasks : {}));
  var today = new Date().toISOString().slice(0,10);
  var inSevenDays = new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10);
  (window._allPlanTasks || []).forEach(function(card) {
    (card.subtasks || []).forEach(function(s) {
      var assignee = s.assignee || '';
      if (!assignee || assignee.toLowerCase().indexOf('agente')>=0) return;
      var taskDate = s.date || card.publish_date || '';
      if (taskDate && taskDate >= today && taskDate <= inSevenDays) {
        if (!taskData[assignee]) taskData[assignee] = [];
        var label = (card.title||'') + ' — ' + (s.name||s.title||'');
        var alreadyIn = taskData[assignee].some(function(t){ return (typeof t==='string'?t:t.t) === label; });
        if (!alreadyIn) taskData[assignee].push({ t: label, date: taskDate, status: s.status||'todo' });
      }
    });
  });
  var nombres = Object.keys(taskData).filter(function(n) { return (taskData[n] || []).length > 0; });

  if (!nombres.length) {
    strip.innerHTML = html +
      '<div style="display:flex;align-items:center;color:rgba(255,255,255,0.3);font-size:0.75rem;padding:0 0.5rem">' +
        'Sin tareas activas — añade tareas desde el tab Equipo' +
      '</div>';
    return;
  }

  nombres.forEach(function(nombre) {
    var tasks = taskData[nombre] || [];
    var color = PERSON_COLORS[nombre] || '#888';
    var initials = nombre.split(' ').map(function(w){ return w[0]; }).join('').slice(0,2).toUpperCase();

    html += '<div class="hoy-person">' +
      '<div class="hoy-person-head">' +
        '<div class="hoy-av" style="background:' + color + '">' + initials + '</div>' +
        '<div>' +
          '<div class="hoy-person-name">' + nombre.split(' ')[0] + '</div>' +
          '<div class="hoy-person-role">' + tasks.length + ' tarea' + (tasks.length !== 1 ? 's' : '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="hoy-tasks">' +
        tasks.slice(0, 3).map(function(t) {
          var text = typeof t === 'string' ? t : (t.t || t.text || JSON.stringify(t));
          return '<div class="hoy-task normal">' +
            '<div class="hoy-task-dot"></div>' +
            '<span>' + text + '</span>' +
          '</div>';
        }).join('') +
        (tasks.length > 3 ? '<div class="hoy-task normal" style="opacity:0.5"><div class="hoy-task-dot"></div><span>+' + (tasks.length - 3) + ' más</span></div>' : '') +
      '</div>' +
    '</div>';
  });

  strip.innerHTML = html;
}

function renderCuentasGrid() {
  var grid = document.getElementById('cuentasGrid');
  if (!grid) return;
  var html = '';
  for (var i = 0; i < CUENTAS.length; i++) {
    var c = CUENTAS[i];
    var badgeClass = c.estado==='crit'?'b-red':c.estado==='warn'?'b-gold':c.estado==='good'?'b-green':'b-muted';
    var progColor  = c.estado==='crit'?'#c0392b':c.estado==='warn'?'#c8860a':c.estado==='good'?'#2d7a4f':'#a09890';
    var avatars = '';
    for (var j = 0; j < c.equipo.length; j++) {
      avatars += '<div class="cuenta-av" style="background:' + c.equipoColors[j] + '">' + c.equipo[j] + '</div>';
    }
    var dlClass = c.deadlineClass === 'dead-late' ? 'dead-late' : c.deadlineClass === 'dead-soon' ? 'dead-soon' : 'dead-ok';
    html += '<div class="cuenta-card ' + c.estado + '" onclick="openDetail(\'' + c.id + '\')">' +
      '<div class="cuenta-top">' +
        '<div class="prog-ring-wrap">' + buildProgRing(c.progreso, progColor) + '<div class="prog-ring-label" style="color:' + progColor + '">' + c.progreso + '%</div></div>' +
        '<div class="cuenta-info">' +
          '<div class="cuenta-nombre">' + c.nombre + '</div>' +
          '<div class="cuenta-cliente">' + c.cliente + '</div>' +
          '<div class="cuenta-badges"><span class="badge ' + badgeClass + '">' + c.estadoLabel + '</span> <span style="font-size:0.65rem;color:var(--muted)">' + c.tareas + ' tasks</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="cuenta-prog-bar"><div class="cuenta-prog-fill" style="width:' + c.progreso + '%;background:' + progColor + '"></div></div>' +
      '<div class="cuenta-footer">' +
        '<div class="cuenta-team">' + avatars + '</div>' +
        '<div class="cuenta-deadline"><div class="dl-date ' + dlClass + '">' + c.deadline + '</div><div class="dl-tag">' + c.deadlineTag + '</div></div>' +
      '</div>' +
    '</div>';
  }
  grid.innerHTML = html;
}

// ── ESTRATEGIA DATA ──
var ESTRATEGIA_BASE = {
  ecom: {
    objMes:  [ { t:'Recuperar retraso y entregar v1 del sitio', done:false }, { t:'Conseguir respuesta de Verde Fashion esta semana', done:false }, { t:'Definir paleta de colores definitiva', done:true } ],
    objTrim: [ { t:'Lanzamiento del e-commerce en Q2', done:false }, { t:'Integrar pasarela de pago y logistica', done:false }, { t:'Campana de lanzamiento coordinada con Social', done:false } ],
    pasos:   [ { t:'Llamada directa con Verde Fashion — urgente', meta:'Esta semana - CEO' }, { t:'Replantear cronograma con el equipo', meta:'Lunes 31 mar - Reunion' }, { t:'Decidir si ampliar equipo para recuperar tiempo', meta:'Decision pendiente' } ],
  },
  social: {
    objMes:  [ { t:'Aprobar brief Q2 con Bianchi & Co', done:false }, { t:'Publicar 12 piezas de contenido en abril', done:false }, { t:'Cerrar propuesta influencer', done:false } ],
    objTrim: [ { t:'Posicionar a Bianchi & Co como referente en IG', done:false }, { t:'Alcanzar 10k seguidores para el cliente', done:false }, { t:'Renovar contrato por segundo semestre', done:false } ],
    pasos:   [ { t:'Presentar propuesta influencer en reunion semanal', meta:'Lun 31 mar - CEO + Andrea' }, { t:'Revisar KPIs de marzo antes del brief Q2', meta:'Esta semana' } ],
  },
  rebrand: {
    objMes:  [ { t:'Entregar brand guidelines completas', done:false }, { t:'Obtener aprobacion final de paleta', done:false }, { t:'Sesion fotografica corporativa completada', done:false } ],
    objTrim: [ { t:'Rebrand completo entregado para 15 abril', done:false }, { t:'Aplicar nueva identidad en todos los materiales', done:false }, { t:'Presentar resultados y proponer siguiente proyecto', done:false } ],
    pasos:   [ { t:'Confirmar fecha sesion fotografica 8 abril', meta:'8 abr - Carlos + cliente' }, { t:'Preparar propuesta de continuidad post-rebrand', meta:'Antes de entrega final' } ],
  },
  news: {
    objMes:  [ { t:'Asignar responsable del proyecto — urgente', done:false }, { t:'Cerrar brief con Ferretti SpA', done:false }, { t:'Disenar plantilla base de newsletter', done:false } ],
    objTrim: [ { t:'Establecer newsletter mensual recurrente', done:false }, { t:'Conseguir 30% de open rate en primeros 3 envios', done:false } ],
    pasos:   [ { t:'Asignar responsable hoy mismo', meta:'Urgente - CEO' }, { t:'Reunion kickoff con Ferretti SpA confirmada', meta:'1 abr 10:00' } ],
  },
};

var estrategiaStore = JSON.parse(JSON.stringify(ESTRATEGIA_BASE));
function getEstrategia(id) { return estrategiaStore[id] || { objMes:[], objTrim:[], pasos:[] }; }

function renderEstrategia(id) {
  var est  = getEstrategia(id);
  var wrap = document.getElementById(id + '-estrategia');
  if (!wrap) return;
  var mesHtml = '';
  for (var i = 0; i < est.objMes.length; i++) {
    var o = est.objMes[i];
    mesHtml += '<div class="est-obj-item ' + (o.done?'done':'') + '" onclick="toggleObj(\'' + id + '\',\'mes\',' + i + ')">' +
      '<div class="est-obj-check">' + (o.done?'OK':'') + '</div><div class="est-obj-text">' + o.t + '</div></div>';
  }
  var trimHtml = '';
  for (var i = 0; i < est.objTrim.length; i++) {
    var o = est.objTrim[i];
    trimHtml += '<div class="est-obj-item ' + (o.done?'done':'') + '" onclick="toggleObj(\'' + id + '\',\'trim\',' + i + ')">' +
      '<div class="est-obj-check">' + (o.done?'OK':'') + '</div><div class="est-obj-text">' + o.t + '</div></div>';
  }
  var pasosHtml = '';
  for (var i = 0; i < est.pasos.length; i++) {
    var p = est.pasos[i];
    pasosHtml += '<div class="est-paso-item"><div class="est-paso-num">' + (i+1) + '</div>' +
      '<div class="est-paso-content"><div class="est-paso-text">' + p.t + '</div><div class="est-paso-meta">' + p.meta + '</div></div>' +
      '<button class="est-paso-del" onclick="deletePaso(\'' + id + '\',' + i + ')">x</button></div>';
  }
  wrap.innerHTML = '<div class="estrategia-panel">' +
    '<div class="est-block"><div class="est-block-head"><div class="est-block-title">Objetivos</div><span class="est-period-badge epb-mes">Este mes</span></div>' +
    '<div class="est-obj-list">' + mesHtml + '</div>' +
    '<div class="est-add-obj"><input class="est-input" id="new-mes-' + id + '" placeholder="Nuevo objetivo del mes..."><button class="est-add-btn" onclick="addObj(\'' + id + '\',\'mes\')">+ Anadir</button></div></div>' +
    '<div class="est-block"><div class="est-block-head"><div class="est-block-title">Objetivos</div><span class="est-period-badge epb-trim">Q2 Trimestre</span></div>' +
    '<div class="est-obj-list">' + trimHtml + '</div>' +
    '<div class="est-add-obj"><input class="est-input" id="new-trim-' + id + '" placeholder="Nuevo objetivo trimestral..."><button class="est-add-btn" onclick="addObj(\'' + id + '\',\'trim\')">+ Anadir</button></div></div>' +
    '<div class="est-block est-block-full"><div class="est-block-head"><div class="est-block-title">Proximos pasos / Decisiones</div><span class="ceo-badge">Solo CEO</span></div>' +
    '<div class="est-obj-list">' + pasosHtml + '</div>' +
    '<div class="est-add-obj" style="flex-wrap:wrap"><input class="est-input" id="new-paso-' + id + '" placeholder="Proximo paso o decision pendiente..." style="min-width:200px"><input class="est-input" id="new-paso-meta-' + id + '" placeholder="Contexto / fecha..." style="max-width:180px"><button class="est-add-btn" onclick="addPaso(\'' + id + '\')">+ Anadir</button></div></div>' +
  '</div>';
}

function toggleObj(id, period, idx) {
  var arr = period==='mes' ? getEstrategia(id).objMes : getEstrategia(id).objTrim;
  arr[idx].done = !arr[idx].done;
  var wrap = document.getElementById(id+'-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast(arr[idx].done ? 'Objetivo completado' : 'Objetivo reabierto');
}

function addObj(id, period) {
  var input = document.getElementById('new-' + period + '-' + id);
  var val   = input.value.trim(); if (!val) return;
  (period==='mes' ? getEstrategia(id).objMes : getEstrategia(id).objTrim).push({ t:val, done:false });
  input.value = '';
  var wrap = document.getElementById(id+'-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast('Objetivo anadido');
}

function addPaso(id) {
  var txt  = document.getElementById('new-paso-' + id).value.trim(); if (!txt) return;
  var meta = document.getElementById('new-paso-meta-' + id).value.trim();
  getEstrategia(id).pasos.push({ t:txt, meta:meta||'Pendiente' });
  document.getElementById('new-paso-' + id).value = '';
  document.getElementById('new-paso-meta-' + id).value = '';
  var wrap = document.getElementById(id+'-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast('Paso anadido');
}

function deletePaso(id, idx) {
  getEstrategia(id).pasos.splice(idx, 1);
  var wrap = document.getElementById(id+'-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast('Paso eliminado');
}

// ── DETAIL ──
var activeDetailId = null;

function openDetail(id) {
  var c = null;
  for (var i = 0; i < CUENTAS.length; i++) { if (CUENTAS[i].id === id) { c = CUENTAS[i]; break; } }
  if (!c) return;
  if (activeDetailId === id) { closeDetail(); return; }
  activeDetailId = id;
  document.getElementById('detailTitle').innerHTML = c.nombre + ' — ' + c.cliente;
  document.getElementById('detailSub').textContent = c.senal;
  var progColor = c.estado==='crit'?'#c0392b':c.estado==='warn'?'#c8860a':c.estado==='good'?'#2d7a4f':'#a09890';
  var body = document.getElementById('detailBody');
  body.innerHTML =
    '<div class="mini-grid" style="margin-bottom:1rem">' +
      '<div class="mini-stat"><div class="mini-val" style="color:' + progColor + '">' + c.progreso + '%</div><div class="mini-lbl">Avance</div></div>' +
      '<div class="mini-stat"><div class="mini-val">' + c.tareas + '</div><div class="mini-lbl">Tasks abiertos</div></div>' +
      '<div class="mini-stat"><div class="mini-val">' + c.deadline + '</div><div class="mini-lbl">Deadline</div></div>' +
    '</div>' +
    '<div class="action-row" style="margin-bottom:1.2rem">' +
      '<button class="btn btn-acc" onclick="logDecision(\'Accion en ' + c.nombre + '\',\'blue\');showToast(\'Accion registrada\')">Accion rapida</button>' +
      '<button class="btn btn-ghost" onclick="openAssign(\'' + c.nombre + '\')">Asignar</button>' +
      '<button class="btn btn-ghost" onclick="logDecision(\'Notificacion — ' + c.nombre + '\',\'blue\');showToast(\'Enviado\')">Contactar</button>' +
      '<button class="btn btn-ghost" onclick="showToast(\'Informe generado\')">Informe</button>' +
    '</div>' +
    '<div class="proj-tabs" style="margin-bottom:0.8rem">' +
      '<div class="proj-tab active" onclick="switchProjTab(\'' + id + '\',\'resumen\',this)">Resumen</div>' +
      '<div class="proj-tab" onclick="switchProjTab(\'' + id + '\',\'kanban\',this)">Tablero Social</div>' +
      '<div class="proj-tab" onclick="switchProjTab(\'' + id + '\',\'estrategia\',this)">Estrategia CEO</div>' +
    '</div>' +
    '<div id="' + id + '-resumen"></div>' +
    '<div id="' + id + '-kanban" style="display:none"></div>' +
    '<div id="' + id + '-estrategia" style="display:none"></div>';
  document.getElementById('cuentaDetail').classList.add('open');
  document.getElementById('cuentaDetail').scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function closeDetail() {
  activeDetailId = null;
  document.getElementById('cuentaDetail').classList.remove('open');
}

function switchProjTab(projId, tab, el) {
  var tabs = el.closest('.proj-tabs').querySelectorAll('.proj-tab');
  for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
  el.classList.add('active');
  var suffixes = ['resumen','kanban','estrategia'];
  for (var i = 0; i < suffixes.length; i++) {
    var el2 = document.getElementById(projId+'-'+suffixes[i]);
    if (el2) el2.style.display = 'none';
  }
  if (tab === 'kanban') {
    var k = document.getElementById(projId+'-kanban');
    k.style.display = 'block';
    if (!k.dataset.built) { k.innerHTML = '<div class="kanban-wrap">' + buildKanban(projId) + '</div>'; k.dataset.built='1'; }
  } else if (tab === 'estrategia') {
    var e = document.getElementById(projId+'-estrategia');
    e.style.display = 'block';
    if (!e.dataset.built) { renderEstrategia(projId); e.dataset.built='1'; }
  } else {
    var r = document.getElementById(projId+'-resumen');
    if (r) r.style.display = 'block';
  }
}

// ── TABLERO ──
var TB_COLS = [
  { id:'info', label:'Info', cls:'tb-info' }, { id:'ideas', label:'Ideas', cls:'tb-ideas' },
  { id:'todo', label:'Por Hacer', cls:'tb-todo' }, { id:'wip', label:'En Proceso', cls:'tb-wip' },
  { id:'done', label:'Hecho', cls:'tb-done' }, { id:'pub', label:'Publicado', cls:'tb-pub' },
  { id:'meet', label:'Reuniones', cls:'tb-meet' }, { id:'shoot', label:'Rodajes', cls:'tb-shoot' },
  { id:'prop', label:'Propuestas', cls:'tb-prop' },
];
var activeTbCuenta = 'ecom';

async function buildTbSelector() {
  var sel = document.getElementById('cuentaSelector');
  if (!sel) return;
  sel.innerHTML = '<span style="font-size:0.75rem;color:#aaa;padding:0.3rem 0.6rem">Cargando…</span>';

  try {
    var res  = await fetch(BRAVO_API + '/api/plan-tasks');
    var data = await res.json();
    var tasks = data.tasks || [];

    if (tasks.length) {
      // Raggruppa per project_id
      var byProject = {};
      tasks.forEach(function(t) {
        var pid = t.project_id || 'sin-proyecto';
        if (!byProject[pid]) byProject[pid] = { title: t.project_title || pid, tasks: [] };
        byProject[pid].tasks.push(t);
      });

      // Popola CUENTAS e KANBAN_DATA
      CUENTAS = [];
      Object.keys(byProject).forEach(function(pid) {
        var grp = byProject[pid];
        CUENTAS.push({ id: pid, nombre: grp.title, cliente: '', estado: 'good', estadoLabel: 'Activo', tareas: grp.tasks.length });
        KANBAN_DATA[pid] = KANBAN_DATA[pid] || { info:[], ideas:[], todo:[], wip:[], done:[], pub:[], meet:[], shoot:[], prop:[] };
        // Carica i task nel colonna giusta
        grp.tasks.forEach(function(t) {
          var col = t.status === 'done' ? 'done' : t.status === 'in_progress' ? 'wip' : 'todo';
          // Evita duplicati
          var exists = KANBAN_DATA[pid][col].some(function(k){ return k._db_id === t.id; });
          if (!exists) {
            KANBAN_DATA[pid][col].push({
              t:        t.title || '',
              m:        (t.assignee || '') + (t.publish_date ? ' · ' + new Date(t.publish_date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : ''),
              desc:     t.creative_note || '',
              assign:   t.assignee || '',
              date:     t.publish_date || '',
              priority: t.priority || 'Normal',
              links:    [],
              comments: '',
              _db_id:   t.id
            });
          }
        });
      });

      if (!CUENTAS.find(function(c){ return c.id === activeTbCuenta; })) {
        activeTbCuenta = CUENTAS[0].id;
      }
    }
  } catch(e) {
    console.warn('[TABLERO] Errore caricamento plan-tasks:', e.message);
  }

  var html = '';
  for (var i = 0; i < CUENTAS.length; i++) {
    var c = CUENTAS[i];
    var stClass = c.estado==='crit'?'st-crit':c.estado==='warn'?'st-warn':c.estado==='good'?'st-good':'';
    var isActive = c.id === activeTbCuenta;
    html += '<button class="cuenta-sel-btn ' + (isActive?'active '+stClass:'') + '" onclick="switchTbCuenta(\'' + c.id + '\',this,\'' + stClass + '\')">' + c.nombre + '</button>';
  }
  sel.innerHTML = html || '<span style="font-size:0.75rem;color:#aaa;padding:0.3rem 0.6rem">Sin planes guardados</span>';
  renderTablero();
}

function switchTbCuenta(id, el, stClass) {
  activeTbCuenta = id;
  var btns = document.querySelectorAll('.cuenta-sel-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active','st-crit','st-warn','st-good');
  el.classList.add('active');
  if (stClass) el.classList.add(stClass);
  renderTablero();
}

function renderTablero() {
  var data = KANBAN_DATA[activeTbCuenta] || {};
  var c = null;
  for (var i = 0; i < CUENTAS.length; i++) { if (CUENTAS[i].id === activeTbCuenta) { c = CUENTAS[i]; break; } }
  var total = 0;
  for (var key in data) { if (data[key]) total += data[key].length; }
  var meta = document.getElementById('tableroMeta');
  if (meta) meta.textContent = (c ? c.cliente : '') + ' - ' + total + ' tarjetas';
  var board = document.getElementById('tableroBoard');
  if (!board) return;
  board.innerHTML = '';
  for (var ci = 0; ci < TB_COLS.length; ci++) {
    var col   = TB_COLS[ci];
    var cards = data[col.id] || [];
    var colEl = document.createElement('div'); colEl.className = 'tb-col';
    var head  = document.createElement('div'); head.className = 'tb-head ' + col.cls;
    head.innerHTML = '<span class="tb-head-label">' + col.label + '</span><span class="tb-head-cnt">' + cards.length + '</span>';
    colEl.appendChild(head);
    var cardsEl = document.createElement('div'); cardsEl.className = 'tb-cards'; cardsEl.id = 'tb-' + activeTbCuenta + '-' + col.id;
    for (var ki = 0; ki < cards.length; ki++) {
      var cd = getCardData(activeTbCuenta, col.id, ki);
      var links = (cd.links && cd.links.length) ? cd.links.length : 0;
      var aInit  = cd.assign ? (cd.assign.split(' ')[0][0] + (cd.assign.split(' ')[1] ? cd.assign.split(' ')[1][0] : '')) : '?';
      var aColor = _teamColorFor(cd.assign ? cd.assign.split(' — ')[0] : '');
      var cardEl = document.createElement('div'); cardEl.className = 'tb-card';
      var assignName = cd.assign ? cd.assign.split(' — ')[0] : 'Sin asignar';
      cardEl.innerHTML = '<div class="tb-card-title">' + cd.t + '</div>' +
        '<div class="tb-card-footer">' +
          '<div class="tb-card-av" style="background:' + aColor + '">' + aInit + '</div>' +
          '<div class="tb-card-meta">' + assignName + '</div>' +
          '<span class="tb-card-links' + (links===0?' none':'') + '">' + (links>0?'link '+links:'—') + '</span>' +
        '</div>';
      (function(pid, cid, idx) { cardEl.onclick = function() { openCardPanel(pid, cid, idx); }; })(activeTbCuenta, col.id, ki);
      cardsEl.appendChild(cardEl);
    }
    colEl.appendChild(cardsEl);
    var addBtn = document.createElement('button'); addBtn.className = 'tb-add'; addBtn.textContent = '+ Anadir tarjeta';
    (function(pid, cid) { addBtn.onclick = function() { addNewCard(pid, cid); setTimeout(renderTablero, 100); }; })(activeTbCuenta, col.id);
    colEl.appendChild(addBtn);
    board.appendChild(colEl);
  }
}

function addTbCard() { addNewCard(activeTbCuenta, 'todo'); setTimeout(renderTablero, 150); }

// ── TABLERO PLAN VIEW ─────────────────────────────────────────────────────────
var _tableroMode = 'social'; // 'social' | 'plan'

function switchTableroMode(mode) {
  _tableroMode = mode;
  // Aggiorna toggle buttons
  ['social','plan'].forEach(function(m) {
    var btn = document.getElementById('tbmode-'+m);
    if (btn) {
      btn.style.background    = m === mode ? '#1F2A24' : 'transparent';
      btn.style.color         = m === mode ? '#C29547' : '#888';
      btn.style.borderColor   = m === mode ? '#1F2A24' : '#e0dbd2';
    }
  });
  if (mode === 'social') {
    renderTablero();
  } else {
    renderPlanTablero();
  }
}

function renderPlanTablero() {
  var board = document.getElementById('tableroBoard');
  var meta  = document.getElementById('tableroMeta');
  if (!board) return;

  var tasks = window._allPlanTasks || [];

  // Prova a caricare da Supabase se non abbiamo dati locali
  if (!tasks.length) {
    board.innerHTML = '<div style="padding:3rem;text-align:center;color:#888;font-size:0.85rem">'+
      '<div style="font-size:2rem;margin-bottom:0.8rem">📋</div>'+
      '<div>Genera y confirma un plan de producción desde un proyecto cliente.</div>'+
      '<div style="font-size:0.75rem;color:#aaa;margin-top:0.5rem">Los planes confirmados aparecerán aquí organizados por estado.</div>'+
    '</div>';
    if (meta) meta.textContent = 'Plan de producción — sin datos';
    return;
  }

  if (meta) meta.textContent = 'Plan de producción — ' + tasks.length + ' tarjetas';

  var cols = [
    { id:'todo',   label:'Pendiente', color:'#e0dbd2', textColor:'#555',    dot:'🟡' },
    { id:'wip',    label:'En curso',  color:'#dbeafe', textColor:'#2563eb', dot:'🔵' },
    { id:'review', label:'Revisión',  color:'#fef3c7', textColor:'#b45309', dot:'🟠' },
    { id:'done',   label:'Publicado', color:'#dcfce7', textColor:'#16a34a', dot:'🟢' },
  ];

  var grouped = { todo:[], wip:[], review:[], done:[] };
  tasks.forEach(function(t) {
    var s = t.status || 'todo';
    if (!grouped[s]) s = 'todo';
    grouped[s].push(t);
  });

  var html = '<div style="display:flex;gap:0.8rem;overflow-x:auto;height:100%;padding:0.2rem 0">';
  cols.forEach(function(col) {
    var colTasks = grouped[col.id] || [];
    html += '<div style="flex:0 0 260px;display:flex;flex-direction:column;gap:0;background:#f9f7f4;border-radius:10px;overflow:hidden">';
    // Header colonna
    html += '<div style="padding:0.7rem 1rem;background:'+col.color+';display:flex;align-items:center;justify-content:space-between">' +
      '<span style="font-size:0.75rem;font-weight:700;color:'+col.textColor+'">'+col.dot+' '+col.label+'</span>' +
      '<span style="font-size:0.72rem;font-weight:700;color:'+col.textColor+';background:rgba(0,0,0,0.08);border-radius:20px;padding:0.1rem 0.5rem">'+colTasks.length+'</span>' +
    '</div>';
    // Cards
    html += '<div style="flex:1;overflow-y:auto;padding:0.6rem;display:flex;flex-direction:column;gap:0.5rem">';
    colTasks.forEach(function(task, ti) {
      var fmt = _FORMAT_LABELS[task.format] || { icon:'📋', label: task.format||'Contenido' };
      var totalSub = (task.subtasks||[]).length;
      var doneSub  = (task.subtasks||[]).filter(function(s){ return s.status==='done'; }).length;
      var progPct  = totalSub ? Math.round(doneSub/totalSub*100) : 0;
      var isAI = (task.assignee||'').toLowerCase().indexOf('agente')>=0;
      var aColor = _teamColorFor(task.assignee||'');
      var initials = (task.assignee||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2).toUpperCase();
      var dateStr = task.publish_date ? new Date(task.publish_date+'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '';
      html += '<div onclick="openPlanTaskDetail(this)" data-taskidx="'+ti+'" data-colid="'+col.id+'" '+
        'style="background:#fff;border-radius:8px;padding:0.7rem 0.85rem;cursor:pointer;border:1px solid #e8e4de;transition:box-shadow 0.15s" '+
        'onmouseover="this.style.boxShadow=\'0 2px 8px rgba(0,0,0,0.08)\'" onmouseout="this.style.boxShadow=\'none\'">' +
        '<div style="font-size:0.68rem;margin-bottom:0.3rem">' +
          '<span style="background:#f0ece5;border-radius:20px;padding:0.1rem 0.45rem;font-weight:700;color:#555">'+fmt.icon+' '+fmt.label+'</span>' +
          (task.project_title ? ' <span style="color:#aaa">'+task.project_title+'</span>' : '') +
        '</div>' +
        '<div style="font-size:0.82rem;font-weight:600;color:#1F2A24;margin-bottom:0.4rem;line-height:1.3">'+(task.title||'')+'</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="display:flex;align-items:center;gap:0.4rem">' +
            '<div style="width:22px;height:22px;border-radius:50%;background:'+(isAI?'#1F2A24':aColor)+';display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:#fff">'+(isAI?'🤖':initials)+'</div>' +
            '<span style="font-size:0.7rem;color:#888">'+(task.assignee||'')+'</span>' +
          '</div>' +
          (dateStr ? '<span style="font-size:0.68rem;color:#aaa">📅 '+dateStr+'</span>' : '') +
        '</div>' +
        (totalSub ? '<div style="margin-top:0.5rem"><div style="height:3px;background:#f0ece5;border-radius:2px;overflow:hidden"><div style="height:100%;width:'+progPct+'%;background:'+(progPct===100?'#16a34a':'#2563eb')+';border-radius:2px"></div></div><div style="font-size:0.65rem;color:#aaa;margin-top:0.2rem">'+doneSub+'/'+totalSub+' sub-tareas</div></div>' : '') +
        '<div style="display:flex;gap:0.3rem;margin-top:0.5rem;flex-wrap:wrap">' +
          cols.filter(function(c){return c.id!==col.id;}).map(function(c){
            return '<button onclick="event.stopPropagation();movePlanTask(\''+col.id+'\','+ti+',\''+c.id+'\')" style="font-size:0.62rem;padding:0.1rem 0.4rem;background:'+c.color+';color:'+c.textColor+';border:none;border-radius:10px;cursor:pointer">→ '+c.label+'</button>';
          }).join('') +
        '</div>' +
      '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  board.innerHTML = html;
}

function movePlanTask(fromCol, taskIdx, toCol) {
  var tasks = window._allPlanTasks || [];
  var colTasks = tasks.filter(function(t){ return (t.status||'todo') === fromCol; });
  var task = colTasks[taskIdx];
  if (!task) return;
  task.status = toCol;
  // PATCH Supabase
  if (task._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + task._db_id, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ status: toCol })
    }).catch(function(){});
  }
  renderPlanTablero();
}

function openPlanTaskDetail(el) {
  // TODO: aprire pannello laterale con subtasks interattive
  // Per ora mostriamo un toast con il titolo
  var taskTitle = el.querySelector('[style*="font-weight:600"]');
  if (taskTitle) showToast('📋 ' + taskTitle.textContent.trim());
}

// ── KANBAN ──
var COLS = TB_COLS; // reuse same column definitions

var cardStore = {};

var KANBAN_DATA = {
  ecom: {
    info:  [ { t:'Brief cliente aprobado', m:'Verde Fashion', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' }, { t:'Guia de marca v2', m:'Referencia', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Reel de producto 15s', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'', priority:'Alta', links:[], comments:'' }, { t:'Stories con countdown', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' } ],
    todo:  [ { t:'Fotografia de producto', m:'Pendiente', desc:'', assign:'', date:'', priority:'Alta', links:[], comments:'' }, { t:'Copy para 5 posts', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' }, { t:'Banner web hero', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:   [ { t:'Video unboxing', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'', priority:'Alta', links:[], comments:'' }, { t:'Carrusel novedades', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    done:  [ { t:'Identidad visual web', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:[], meet:[ { t:'Kickoff Verde Fashion', m:'28 mar 10:00', desc:'', assign:'', date:'2026-03-28', priority:'Normal', links:[], comments:'' } ],
    shoot: [ { t:'Rodaje catalogo primavera', m:'2 abr estudio', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'2026-04-02', priority:'Alta', links:[], comments:'' } ],
    prop:  [ { t:'Propuesta reels mensuales', m:'Enviada', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
  },
  social: {
    info:  [ { t:'Brief Campana Q2', m:'Bianchi & Co', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Serie detras de camara', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' }, { t:'Encuestas interactivas', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Baja', links:[], comments:'' } ],
    todo:  [ { t:'Calendario mayo', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Alta', links:[], comments:'' }, { t:'3 creatividades nuevas', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:   [ { t:'Post lanzamiento coleccion', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Alta', links:[], comments:'' }, { t:'Story secuencia x5', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' }, { t:'Reels testimoniales', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'', priority:'Normal', links:[], comments:'' } ],
    done:  [ { t:'Copy revisado marzo', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' }, { t:'Paleta visual aprobada', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:   [ { t:'Post 28 mar Campana', m:'Publicado', desc:'', assign:'', date:'2026-03-28', priority:'Normal', links:[], comments:'' } ],
    meet:  [ { t:'Revision semanal', m:'Lun 31 mar 09:30', desc:'', assign:'', date:'2026-03-31', priority:'Normal', links:[], comments:'' } ],
    shoot:[], prop: [ { t:'Propuesta influencer', m:'En revision', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
  },
  rebrand: {
    info:  [ { t:'Moodboard aprobado', m:'Rossi Srl', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' }, { t:'Briefing identidad', m:'Referencia', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Motion logo animado', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'', priority:'Normal', links:[], comments:'' } ],
    todo:  [ { t:'Brand guidelines PDF', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'2026-04-10', priority:'Alta', links:[], comments:'' }, { t:'Aplicaciones papeleria', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:   [ { t:'Seleccion paleta final', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Alta', links:[], comments:'' } ],
    done:  [ { t:'Logo v3 aprobado', m:'29 mar', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'2026-03-29', priority:'Normal', links:[], comments:'' }, { t:'Tipografia definida', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:[], meet: [ { t:'Presentacion brand book', m:'10 abr 11:00', desc:'', assign:'', date:'2026-04-10', priority:'Normal', links:[], comments:'' } ],
    shoot: [ { t:'Sesion foto corporativa', m:'8 abr exterior', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'2026-04-08', priority:'Alta', links:[], comments:'' } ],
    prop:[],
  },
  news: {
    info:  [ { t:'Brief Ferretti SpA', m:'Pendiente firma', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Seccion novedades mes', m:'Sin asignar', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    todo:  [ { t:'Estructura newsletter', m:'Sin asignar', desc:'', assign:'', date:'', priority:'Alta', links:[], comments:'' }, { t:'Diseno plantilla', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' }, { t:'Copy principal', m:'Sin asignar', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:[], done:[], pub:[],
    meet: [ { t:'Kickoff Ferretti', m:'1 abr 10:00', desc:'', assign:'', date:'2026-04-01', priority:'Normal', links:[], comments:'' } ],
    shoot:[], prop: [ { t:'Propuesta frecuencia mensual', m:'Borrador', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
  },
};

function getCardKey(projId, colId, idx) { return projId + '__' + colId + '__' + idx; }
function getCardData(projId, colId, idx) {
  var key = getCardKey(projId, colId, idx);
  if (cardStore[key]) return cardStore[key];
  var data = KANBAN_DATA[projId];
  var base = (data && data[colId] && data[colId][idx]) ? data[colId][idx] : { t:'', m:'', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' };
  cardStore[key] = JSON.parse(JSON.stringify(base));
  return cardStore[key];
}

function buildKanban(projId) {
  var data = KANBAN_DATA[projId] || {};
  var html = '<div class="kanban-board">';
  for (var ci = 0; ci < COLS.length; ci++) {
    var col   = COLS[ci];
    var cards = data[col.id] || [];
    html += '<div class="kb-col"><div class="kb-head ' + col.cls + '"><span>' + col.label + '</span><span class="kb-cnt">' + cards.length + '</span></div>';
    html += '<div class="kb-cards" id="kbc-' + projId + '-' + col.id + '">';
    for (var ki = 0; ki < cards.length; ki++) {
      var cd = getCardData(projId, col.id, ki);
      var lc = (cd.links && cd.links.length) ? cd.links.length : 0;
      var prioHtml = (cd.priority && cd.priority !== 'Normal') ? '<span style="font-size:0.58rem;padding:0.08rem 0.3rem;border-radius:3px;background:var(--gold-dim);color:var(--gold);font-weight:700">' + cd.priority + '</span>' : '';
      html += '<div class="kb-card" onclick="openCardPanel(\'' + projId + '\',\'' + col.id + '\',' + ki + ')">' +
        '<div class="kb-card-title">' + cd.t + '</div>' +
        '<div class="kb-card-meta">' + cd.m + '</div>' +
        '<div class="kb-card-footer"><span class="kb-card-links' + (lc===0?' none':'') + '">' + (lc>0?lc+' links':'—') + '</span>' + prioHtml + '</div>' +
      '</div>';
    }
    html += '</div><button class="kb-add" onclick="addNewCard(\'' + projId + '\',\'' + col.id + '\')">+ Anadir</button></div>';
  }
  html += '</div>';
  return html;
}

function refreshCardEl(projId, colId, idx) {
  var container = document.getElementById('kbc-'+projId+'-'+colId);
  if (!container) return;
  var cards = container.querySelectorAll('.kb-card');
  if (!cards[idx]) return;
  var cd = getCardData(projId, colId, idx);
  var lc = (cd.links && cd.links.length) ? cd.links.length : 0;
  cards[idx].innerHTML = '<div class="kb-card-title">' + cd.t + '</div>' +
    '<div class="kb-card-meta">' + cd.m + '</div>' +
    '<div class="kb-card-footer"><span class="kb-card-links' + (lc===0?' none':'') + '">' + (lc>0?lc+' links':'—') + '</span></div>';
}

var activeCard = null;

function openCardPanel(projId, colId, idx) {
  activeCard = { projId: projId, colId: colId, idx: idx };
  var cd  = getCardData(projId, colId, idx);
  var col = null;
  for (var i = 0; i < COLS.length; i++) { if (COLS[i].id === colId) { col = COLS[i]; break; } }
  var badge = document.getElementById('panelColBadge');
  if (badge && col) { badge.textContent = col.label; badge.className = 'panel-col-badge ' + col.cls; }
  var pt = document.getElementById('panelTitle');    if (pt) pt.value    = cd.t;
  var pd = document.getElementById('panelDesc');     if (pd) pd.value    = cd.desc || '';
  var pa = document.getElementById('panelAssign');   if (pa) pa.value    = cd.assign || '';
  var pdt= document.getElementById('panelDate');     if (pdt) pdt.value  = cd.date || '';
  var pp = document.getElementById('panelPriority'); if (pp) pp.value    = cd.priority || 'Normal';
  var pc = document.getElementById('panelComments'); if (pc) pc.value    = cd.comments || '';
  renderDriveLinks(cd.links || []);
  document.getElementById('cardPanelOverlay').classList.add('open');
  document.getElementById('cardPanel').classList.add('open');
}

function closeCardPanel() {
  var o = document.getElementById('cardPanelOverlay');
  var p = document.getElementById('cardPanel');
  if (o) o.classList.remove('open');
  if (p) p.classList.remove('open');
  activeCard = null;
}

function saveCardPanel() {
  if (!activeCard) return;
  var projId = activeCard.projId, colId = activeCard.colId, idx = activeCard.idx;
  var cd = getCardData(projId, colId, idx);
  var pt = document.getElementById('panelTitle');    if (pt) cd.t        = pt.value || cd.t;
  var pd = document.getElementById('panelDesc');     if (pd) cd.desc     = pd.value;
  var pa = document.getElementById('panelAssign');   if (pa) cd.assign   = pa.value;
  var pdt= document.getElementById('panelDate');     if (pdt) cd.date    = pdt.value;
  var pp = document.getElementById('panelPriority'); if (pp) cd.priority = pp.value;
  var pc = document.getElementById('panelComments'); if (pc) cd.comments = pc.value;
  if (cd.assign) cd.m = cd.assign.split(' — ')[0];
  refreshCardEl(projId, colId, idx);
  closeCardPanel();
  showToast('Tarjeta guardada');
}

function renderDriveLinks(links) {
  var list = document.getElementById('driveLinksList');
  if (!list) return;
  list.innerHTML = '';
  for (var i = 0; i < links.length; i++) {
    var lk  = links[i];
    var ico = lk.url.indexOf('drive.google') >= 0 ? 'D' : lk.url.indexOf('docs.google') >= 0 ? 'Doc' : lk.url.indexOf('sheet') >= 0 ? 'Sheet' : 'Link';
    var div = document.createElement('div'); div.className = 'drive-link-item';
    div.innerHTML = '<span class="drive-link-ico">' + ico + '</span>' +
      '<div class="drive-link-info"><div class="drive-link-name">' + (lk.name||'Enlace') + '</div><div class="drive-link-url">' + lk.url + '</div></div>' +
      '<a class="drive-link-open" href="' + lk.url + '" target="_blank" rel="noopener">Abrir</a>' +
      '<button class="drive-link-del" onclick="removeDriveLink(' + i + ')">x</button>';
    list.appendChild(div);
  }
}

function addDriveLink() {
  if (!activeCard) return;
  var nameEl = document.getElementById('newLinkName');
  var urlEl  = document.getElementById('newLinkUrl');
  if (!urlEl || !urlEl.value.trim()) { showToast('Anade una URL'); return; }
  var cd = getCardData(activeCard.projId, activeCard.colId, activeCard.idx);
  cd.links.push({ name: (nameEl ? nameEl.value.trim() : '') || 'Enlace', url: urlEl.value.trim() });
  renderDriveLinks(cd.links);
  if (nameEl) nameEl.value = '';
  urlEl.value = '';
  showToast('Enlace anadido');
}

function removeDriveLink(i) {
  if (!activeCard) return;
  var cd = getCardData(activeCard.projId, activeCard.colId, activeCard.idx);
  cd.links.splice(i, 1);
  renderDriveLinks(cd.links);
}

function addNewCard(projId, colId) {
  var data = KANBAN_DATA[projId];
  if (!data[colId]) data[colId] = [];
  var idx = data[colId].length;
  data[colId].push({ t:'Nueva tarjeta', m:'Sin asignar', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' });
  var container = document.getElementById('kbc-'+projId+'-'+colId);
  if (container) {
    var div = document.createElement('div'); div.className = 'kb-card';
    var pid = projId, cid = colId, eidx = idx;
    div.onclick = function() { openCardPanel(pid, cid, eidx); };
    div.innerHTML = '<div class="kb-card-title">Nueva tarjeta</div><div class="kb-card-meta">Sin asignar</div><div class="kb-card-footer"><span class="kb-card-links none">—</span></div>';
    container.appendChild(div);
    var head = container.closest('.kb-col').querySelector('.kb-cnt');
    if (head) head.textContent = data[colId].length;
  }
  openCardPanel(projId, colId, idx);
}

var cpOverlay = document.getElementById('cardPanelOverlay');
if (cpOverlay) cpOverlay.addEventListener('click', function() { closeCardPanel(); });
var nlUrl = document.getElementById('newLinkUrl');
if (nlUrl) nlUrl.addEventListener('keydown', function(e) { if (e.key==='Enter') addDriveLink(); });
var amModal = document.getElementById('assignModal');
if (amModal) amModal.addEventListener('click', function(e) { if (e.target.id === 'assignModal') closeModal(); });

// ── CHAT ──
var TEAM = [
  { name:'Vicente Palazzolo', role:'CEO & Sales',           initials:'VP', color:'#B8860B', status:'on' },
  { name:'Carlos Lage',       role:'Fotógrafo & Filmmaker', initials:'CL', color:'#D13B1E', status:'on' },
  { name:'Andrea Valdivia',   role:'Social Media Manager',  initials:'AV', color:'#2c5f8a', status:'on' },
  { name:'Mari Almendros',    role:'Brand & Diseño',         initials:'MA', color:'#2d7a4f', status:'on' },
];

var chatOpen = false, currentUrgency = null, pendingDriveLink = null, mentionMode = false;

var SEED_MSGS = [
  { author:'Andrea Valdivia', color:'#2c5f8a', text:'Buenos dias equipo! Acabo de subir el calendario de mayo a Drive.', time:'09:15', drive:{ name:'Calendario Mayo Social', url:'https://drive.google.com/example' } },
  { author:'Carlos Lage',     color:'#D13B1E', text:'Perfecto. El rodaje del catalogo esta confirmado para el 2 de abril.', time:'09:22', urgency:'alta' },
  { author:'Mari Almendros',  color:'#2d7a4f', text:'Ya tengo lista la paleta final de Rossi. Andrea, puedes revisar que encaje con el social?', time:'09:31' },
  { author:'Andrea Valdivia', color:'#2c5f8a', text:'Claro, lo miro ahora mismo.', time:'09:34' },
];

function renderOnlineBar() {
  var avEl   = document.getElementById('onlineAvatars');
  var listEl = document.getElementById('onlineList');
  if (!avEl || !listEl) return;
  avEl.innerHTML = ''; listEl.innerHTML = '';
  for (var i = 0; i < TEAM.length; i++) {
    var m = TEAM[i];
    var pipClass    = m.status==='on'?'pip-on':m.status==='away'?'pip-away':'pip-off';
    var statusLabel = m.status==='on'?'Conectado':m.status==='away'?'Ausente':'Desconectado';
    avEl.innerHTML  += '<div class="online-av" style="background:' + m.color + '" title="' + m.name + '">' + m.initials + '<span class="online-pip ' + pipClass + '"></span></div>';
    listEl.innerHTML += '<div class="online-member"><span class="pip ' + pipClass + '"></span>' + m.name + ' <span style="color:var(--muted2);font-size:0.62rem">- ' + statusLabel + '</span></div>';
  }
}

function renderSeedMessages() {
  var feed = document.getElementById('chatMessages');
  if (!feed) return;
  feed.innerHTML = '<div class="chat-system">Hoy — ' + bravoTodayStr() + '</div>';
  for (var i = 0; i < SEED_MSGS.length; i++) appendMessage(SEED_MSGS[i], false);
}

function appendMessage(msg, scroll) {
  if (scroll === undefined) scroll = true;
  var feed = document.getElementById('chatMessages');
  if (!feed) return;
  var isOwn = msg.own ? true : false;
  var div   = document.createElement('div');
  div.className = 'chat-msg' + (isOwn ? ' own' : '');
  var urgHtml = '';
  if (msg.urgency) {
    var label = msg.urgency==='alta'?'URGENTE':msg.urgency==='media'?'MEDIA':'INFO';
    urgHtml = '<span class="msg-urgency urg-' + msg.urgency + '">' + label + '</span>';
  }
  var textHtml = msg.text || '';
  var driveHtml = '';
  if (msg.drive) {
    driveHtml = '<a class="msg-drive-link" href="' + msg.drive.url + '" target="_blank" rel="noopener">' +
      '<span class="msg-drive-link-ico">D</span>' +
      '<div class="msg-drive-link-info"><div class="msg-drive-link-name">' + msg.drive.name + '</div><div class="msg-drive-link-url">' + msg.drive.url + '</div></div>' +
      '<span style="font-size:0.7rem;color:var(--blue);font-weight:600">Abrir</span></a>';
  }
  var authorColor = isOwn ? 'var(--accent)' : (msg.color || 'var(--muted)');
  var authorName  = isOwn ? 'Tu' : msg.author;
  div.innerHTML = '<div class="msg-header"><span class="msg-author" style="color:' + authorColor + '">' + authorName + '</span><span class="msg-time">' + msg.time + '</span></div>' +
    urgHtml + '<div class="msg-bubble' + (isOwn?' own':'') + '">' + textHtml + driveHtml + '</div>';
  feed.appendChild(div);
  if (scroll) feed.scrollTop = feed.scrollHeight;
}

function toggleChat() {
  chatOpen = !chatOpen;
  var panel = document.getElementById('chatPanel');
  var btn   = document.getElementById('chatToggleBtn');
  if (panel) panel.classList.toggle('open', chatOpen);
  if (chatOpen && btn) btn.classList.remove('has-unread');
  if (chatOpen) { var msgs = document.getElementById('chatMessages'); if (msgs) msgs.scrollTop = 99999; }
}

function sendChatMsg() {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var text = input.value.trim();
  if (!text && !pendingDriveLink) return;
  var now  = new Date();
  var time = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  appendMessage({ own:true, text:text, time:time, urgency:currentUrgency, drive:pendingDriveLink });
  input.value = ''; input.style.height = 'auto';
  currentUrgency = null; pendingDriveLink = null;
  var ub = document.getElementById('urgencyBar');    if(ub) ub.classList.remove('open');
  var dr = document.getElementById('chatDriveRow');  if(dr) dr.classList.remove('open');
  var bu = document.getElementById('btnUrgency');    if(bu) bu.classList.remove('active-tool');
  var bd = document.getElementById('btnDrive');      if(bd) bd.classList.remove('active-tool');
  var md = document.getElementById('mentionDropdown'); if(md) md.classList.remove('open');
  mentionMode = false;
  var bm = document.getElementById('btnMention');    if(bm) bm.classList.remove('active-tool');
  if (Math.random() > 0.4) {
    setTimeout(function() {
      var responder = TEAM[Math.floor(Math.random()*TEAM.length)];
      var replies = ['OK visto','De acuerdo, lo gestiono.','Perfecto, gracias.','En ello ahora mismo.','Recibido'];
      var now2 = new Date();
      var t2   = now2.getHours().toString().padStart(2,'0') + ':' + now2.getMinutes().toString().padStart(2,'0');
      appendMessage({ author:responder.name, color:responder.color, text:replies[Math.floor(Math.random()*replies.length)], time:t2 });
      if (!chatOpen) { var btn2 = document.getElementById('chatToggleBtn'); if(btn2) btn2.classList.add('has-unread'); }
    }, 1400 + Math.random()*800);
  }
}

function toggleMentionMode() {
  mentionMode = !mentionMode;
  var btn = document.getElementById('btnMention');
  if (btn) btn.classList.toggle('active-tool', mentionMode);
  if (mentionMode) { showMentionDropdown(''); var ci = document.getElementById('chatInput'); if(ci) ci.focus(); }
  else { var md = document.getElementById('mentionDropdown'); if(md) md.classList.remove('open'); }
}

function showMentionDropdown(query) {
  var dd = document.getElementById('mentionDropdown');
  if (!dd) return;
  var filtered = [];
  for (var i = 0; i < TEAM.length; i++) {
    if (TEAM[i].name.toLowerCase().indexOf(query.toLowerCase()) >= 0) filtered.push(TEAM[i]);
  }
  if (!filtered.length) { dd.classList.remove('open'); return; }
  var html = '';
  for (var i = 0; i < filtered.length; i++) {
    var m = filtered[i];
    html += '<div class="mention-opt" onclick="insertMention(\'' + m.name + '\')">' +
      '<div style="width:22px;height:22px;border-radius:50%;background:' + m.color + ';display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;flex-shrink:0">' + m.initials + '</div>' +
      '<div><div class="mo-name">' + m.name + '</div><div class="mo-role">' + m.role + '</div></div></div>';
  }
  dd.innerHTML = html;
  dd.classList.add('open');
}

function insertMention(name) {
  var input = document.getElementById('chatInput');
  if (!input) return;
  var val    = input.value;
  var atIdx  = val.lastIndexOf('@');
  input.value = (atIdx >= 0 ? val.substring(0, atIdx) : val) + '@' + name + ' ';
  var dd = document.getElementById('mentionDropdown');
  if (dd) dd.classList.remove('open');
  mentionMode = false;
  var bm = document.getElementById('btnMention');
  if (bm) bm.classList.remove('active-tool');
  input.focus();
}

function toggleUrgencyBar() {
  var bar = document.getElementById('urgencyBar');
  if (!bar) return;
  var isOpen = bar.classList.toggle('open');
  var btn = document.getElementById('btnUrgency');
  if (btn) btn.classList.toggle('active-tool', isOpen);
}

function setUrgency(val) {
  currentUrgency = val;
  var bar = document.getElementById('urgencyBar');
  if (bar) bar.classList.remove('open');
  var btn = document.getElementById('btnUrgency');
  if (btn) {
    if (val) { btn.classList.add('active-tool'); btn.textContent = val==='alta'?'Alta':val==='media'?'Media':'Info'; showToast('Urgencia: ' + val); }
    else { btn.classList.remove('active-tool'); btn.textContent = 'Urgencia'; }
  }
}

function toggleDriveRow() {
  var row = document.getElementById('chatDriveRow');
  if (!row) return;
  var isOpen = row.classList.toggle('open');
  var btn = document.getElementById('btnDrive');
  if (btn) btn.classList.toggle('active-tool', isOpen);
  if (isOpen) { var du = document.getElementById('chatDriveUrl'); if(du) du.focus(); }
}

function attachDriveLink() {
  var nameEl = document.getElementById('chatDriveName');
  var urlEl  = document.getElementById('chatDriveUrl');
  if (!urlEl || !urlEl.value.trim()) { showToast('Anade una URL de Drive'); return; }
  pendingDriveLink = { name:(nameEl?nameEl.value.trim():'')||'Enlace Drive', url:urlEl.value.trim() };
  var dr = document.getElementById('chatDriveRow'); if(dr) dr.classList.remove('open');
  var bd = document.getElementById('btnDrive');     if(bd) bd.classList.remove('active-tool');
  if (nameEl) nameEl.value = '';
  urlEl.value = '';
  showToast('Enlace listo para enviar');
  var ci = document.getElementById('chatInput'); if(ci) ci.focus();
}

var chatInputEl = document.getElementById('chatInput');
if (chatInputEl) {
  chatInputEl.addEventListener('keydown', function(e) { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg(); } });
  chatInputEl.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    var val   = this.value;
    var atIdx = val.lastIndexOf('@');
    if (atIdx >= 0 && (atIdx === 0 || val[atIdx-1] === ' ')) showMentionDropdown(val.substring(atIdx+1));
    else { var md = document.getElementById('mentionDropdown'); if(md) md.classList.remove('open'); }
  });
}

// ── INIT ──
renderHoyStrip();
renderCuentasGrid();
renderOnlineBar();
renderSeedMessages();
updateHistStats();
setTimeout(function() { if (!chatOpen) { var btn = document.getElementById('chatToggleBtn'); if(btn) btn.classList.add('has-unread'); } }, 3000);

// ── CLIENTES VIEW ──
var CLIENTS_DATA = [];

var _clientesStatusCache = {};
var _studioKPICache = null;

function _fetchClientesStatus() {
  var API = (typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : '');
  fetch(API + '/api/clients/status-summary')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data || !data.clients) return;
      data.clients.forEach(function(s) {
        _clientesStatusCache[s.client_id] = s;
      });
      // Aggiorna i badge nelle card già renderizzate
      Object.keys(_clientesStatusCache).forEach(function(cid) {
        var badge = document.getElementById('status-badge-' + cid);
        if (!badge) return;
        var s = _clientesStatusCache[cid];
        var col = s.status === 'ok' ? '#2d7a4f' : s.status === 'warning' ? '#c8860a' : '#aaa';
        var tip = s.status === 'ok' ? s.published + ' pub. esta semana' : s.status === 'warning' ? s.drafts + ' en borrador' : 'Sin actividad';
        badge.style.background = col;
        badge.title = tip;
      });
    })
    .catch(function(){});
}

function _fetchStudioKPI(callback) {
  var API = (typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : '');
  fetch(API + '/api/studio/kpi')
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data) return;
      _studioKPICache = data;
      if (callback) callback(data);
    })
    .catch(function(){});
}

function renderClientesView() {
  var grid = document.getElementById('clientesGrid');
  if (!grid) return;
  if (!CLIENTS_DATA || CLIENTS_DATA.length === 0) {
    grid.innerHTML = '<div style="padding:3rem;text-align:center;color:var(--muted2);font-family:\'IBM Plex Mono\',monospace;font-size:0.8rem;grid-column:1/-1">No hay clientes cargados.</div>';
    return;
  }
  var colors = ['#D13B1E','#2c5f8a','#2d7a4f','#c8860a','#6d4c8e'];
  grid.innerHTML = CLIENTS_DATA.map(function(c, i) {
    var initials = (c.name || '').split(' ').map(function(w){return w[0];}).join('').toUpperCase().slice(0,2);
    var color = colors[i % colors.length];
    var projs = CUENTAS.filter(function(p){ return p.cliente && p.cliente.toLowerCase().indexOf((c.name||'').toLowerCase().split(' ')[0].toLowerCase()) >= 0; });
    // Badge status (aggiornato async da _fetchClientesStatus)
    var s = _clientesStatusCache[c.id];
    var badgeCol = s ? (s.status === 'ok' ? '#2d7a4f' : s.status === 'warning' ? '#c8860a' : '#aaa') : '#ccc';
    var badgeTip = s ? (s.status === 'ok' ? s.published + ' pub. esta semana' : s.status === 'warning' ? s.drafts + ' en borrador' : 'Sin actividad') : 'Cargando…';
    var statusBadge = '<span id="status-badge-' + c.id + '" title="' + badgeTip + '" style="' +
      'display:inline-block;width:8px;height:8px;border-radius:50%;background:' + badgeCol + ';flex-shrink:0"></span>';
    return '<div class="cliente-card" onclick="openClienteDetail(\'' + c.id + '\')">' +
      '<div class="cliente-card-accent" style="background:' + color + '"></div>' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.8rem">' +
        '<div class="cliente-logo" id="cliente-logo-' + c.id + '" style="background:' + color + ';overflow:hidden">' + initials + '</div>' +
        '<div style="display:flex;align-items:center;gap:0.4rem">' + statusBadge + '<span class="cliente-key">' + (c.client_key || '') + '</span></div>' +
      '</div>' +
      '<div class="cliente-nombre">' + (c.name || '') + '</div>' +
      '<div class="cliente-sector">' + (c.sector || '') + '</div>' +
      '<div class="cliente-ciudad">&#128205; ' + (c.city || '') + '</div>' +
      (c.description ? '<div class="cliente-desc">' + c.description + '</div>' : '') +
      '<div class="cliente-footer">' +
        '<span style="font-size:0.72rem;color:var(--muted)">' + projs.length + ' proyecto' + (projs.length !== 1 ? 's' : '') + '</span>' +
        '<span class="cliente-arrow">&#8594;</span>' +
      '</div>' +
    '</div>';
  }).join('');

  // Carica loghi async per ogni cliente
  if (typeof loadBrandKitImagesFromDB === 'function') {
    CLIENTS_DATA.forEach(function(c) {
      loadBrandKitImagesFromDB(c.id).then(function(imgs) {
        if (!imgs || !imgs.logo_b64) return;
        var src = imgB64Src(imgs.logo_b64);
        if (!src) return;
        var el = document.getElementById('cliente-logo-' + c.id);
        if (el) {
          el.style.background = '#fff';
          el.style.padding = '3px';
          el.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">';
        }
      });
    });
  }
}

function openClienteDetail(clientId) {
  var c = CLIENTS_DATA.find(function(x){ return x.id === clientId; });
  if (!c) return;
  var projs = CUENTAS.filter(function(p){ return p.cliente && p.cliente.toLowerCase().indexOf((c.name||'').toLowerCase().split(' ')[0].toLowerCase()) >= 0; });
  var panel = document.getElementById('cuentaDetail');
  var title = document.getElementById('detailTitle');
  var sub   = document.getElementById('detailSub');
  var body  = document.getElementById('detailBody');
  if (!panel) return;
  title.textContent = c.name || '';
  sub.textContent   = (c.sector || '') + (c.city ? ' · ' + c.city : '');
  var projsHtml = projs.length === 0
    ? '<p style="color:var(--muted2);font-size:0.8rem">Sin proyectos activos.</p>'
    : projs.map(function(p) {
        var col = p.estado==='crit'?'var(--red)':p.estado==='warn'?'var(--gold)':p.estado==='good'?'var(--green)':'var(--muted2)';
        return '<div style="display:flex;align-items:center;gap:0.8rem;padding:0.7rem 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="openDetail(\'' + p.id + '\')">' +
          '<div style="width:8px;height:8px;border-radius:50%;background:' + col + ';flex-shrink:0"></div>' +
          '<div style="flex:1"><div style="font-weight:600;font-size:0.88rem">' + p.nombre + '</div>' +
          '<div style="font-size:0.72rem;color:var(--muted)">' + p.estadoLabel + ' · ' + p.deadline + '</div></div>' +
          '<div style="font-size:0.8rem;font-weight:700;color:' + col + '">' + p.progreso + '%</div>' +
        '</div>';
      }).join('');
  var contactHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;font-size:0.78rem;margin-bottom:1rem">' +
    (c.address ? '<div style="color:var(--muted)">&#128205; ' + c.address + '</div>' : '') +
    (c.phone ? '<div style="color:var(--muted)">&#128222; ' + c.phone + '</div>' : '') +
    (c.website ? '<div style="color:var(--accent)">' + c.website + '</div>' : '') +
    (c.instagram ? '<div style="color:var(--muted)">IG ' + c.instagram + '</div>' : '') +
    '</div>';
  body.innerHTML = contactHtml +
    '<div style="font-size:0.8rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted2);margin-bottom:0.7rem">Proyectos</div>' +
    projsHtml;
  panel.classList.add('open');
}

// ── EQUIPO VIEW ──
var TEAM_DATA = [
  { name: 'Vicente Palazzolo', role: 'CEO & Sales',           detail: 'Estrategia, alianzas, comercial, reporting', initials: 'VP', color: '#B8860B' },
  { name: 'Carlos Lage',       role: 'Fotógrafo & Filmmaker', detail: 'Foto, video, rodajes en campo',              initials: 'CL', color: '#D13B1E' },
  { name: 'Andrea Valdivia',   role: 'Social Media Manager',  detail: 'Calendario, publicación, community',         initials: 'AV', color: '#2c5f8a' },
  { name: 'Mari Almendros',    role: 'Brand & Diseño',         detail: 'Brand kit, piezas gráficas, identidad',     initials: 'MA', color: '#2d7a4f' },
];

// Storage tasks in memoria: memberName → [task, ...]
var _equipoTasks = {};
// Storage assegnazioni: memberName → [client_key, ...]
var _equipoAssignments = {};

function renderEquipoView() {
  var grid = document.getElementById('equipoGrid');
  if (!grid) return;
  if (!TEAM_DATA || TEAM_DATA.length === 0) {
    grid.innerHTML = '<div class="equipo-loading">Cargando equipo...</div>';
    return;
  }
  _equipoLoadTasks();
}

async function _equipoLoadTasks() {
  // Carica da localStorage come fallback immediato
  try {
    var saved = localStorage.getItem('bravo_team_tasks');
    if (saved) _equipoTasks = JSON.parse(saved);
    var savedA = localStorage.getItem('bravo_team_assignments');
    if (savedA) _equipoAssignments = JSON.parse(savedA);
  } catch(e) {}

  // Tenta caricamento da Supabase
  try {
    var res = await db.from('team_tasks').select('*');
    if (!res.error && res.data && res.data.length) {
      res.data.forEach(function(row) {
        _equipoTasks[row.member_name] = row.tasks || [];
        if (row.assigned_clients) _equipoAssignments[row.member_name] = row.assigned_clients;
      });
    }
  } catch(e) {}

  // Se nessuna assegnazione salvata, chiedi all'AI di leggere i briefing
  var hasAnyAssignment = Object.keys(_equipoAssignments).some(function(k) {
    return (_equipoAssignments[k] || []).length > 0;
  });
  if (!hasAnyAssignment && (CLIENTS_DATA||[]).length) {
    await _equipoAutoAssignFromBriefings();
  }

  _equipoRenderGrid();
}

function _equipoRenderGrid() {
  var grid = document.getElementById('equipoGrid');
  if (!grid) return;

  grid.innerHTML = TEAM_DATA.map(function(m, idx) {
    var tasks = _equipoTasks[m.name] || [];
    var mKey = encodeURIComponent(m.name);

    var tasksHtml = tasks.length
      ? tasks.map(function(t, ti) {
          return '<div class="equipo-task-item" id="etask-' + mKey + '-' + ti + '">' +
            '<div class="equipo-task-dot" style="background:' + (m.color||'#999') + '"></div>' +
            '<span style="flex:1">' + t + '</span>' +
            '<span onclick="equipoRemoveTask(\'' + mKey + '\',' + ti + ')" ' +
              'style="cursor:pointer;color:#ccc;font-size:0.9rem;padding:0 0.2rem;line-height:1" title="Rimuovi">×</span>' +
          '</div>';
        }).join('')
      : '<div class="equipo-empty-tasks" id="etask-empty-' + mKey + '">Sin tareas asignadas</div>';

    return '<div class="equipo-card">' +
      '<div class="equipo-card-top">' +
        '<div class="equipo-av" style="background:' + (m.color||'#999') + '">' + (m.initials||'') + '</div>' +
        '<div class="equipo-nombre">' + m.name + '</div>' +
        '<div class="equipo-rol">' + m.role + '</div>' +
        (m.detail ? '<div class="equipo-detail">' + m.detail + '</div>' : '') +
      '</div>' +
      '<div class="equipo-card-body">' +
        // — Sezione Proyectos
        '<div class="equipo-section-label">Proyectos asignados</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.8rem">' +
          (CLIENTS_DATA||[]).map(function(c) {
            var ckey = c.client_key || c.id;
            var assigned = (_equipoAssignments[m.name]||[]).indexOf(ckey) !== -1;
            return '<div onclick="equipoToggleClient(\'' + encodeURIComponent(m.name) + '\',\'' + ckey + '\')" ' +
              'style="font-size:0.68rem;padding:0.22rem 0.6rem;border-radius:20px;cursor:pointer;transition:all 0.15s;' +
              (assigned
                ? 'background:' + (m.color||'#999') + ';color:#fff;font-weight:600;border:1px solid ' + (m.color||'#999')
                : 'background:var(--bg);color:var(--muted2);border:1px solid var(--border)') + '">' +
              (c.name || ckey) +
            '</div>';
          }).join('') +
          (!(CLIENTS_DATA||[]).length ? '<div class="equipo-empty-tasks">Sin clientes</div>' : '') +
        '</div>' +

        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
          '<div class="equipo-section-label" style="margin:0;flex:1">Tareas activas</div>' +
        '</div>' +
        '<div id="etasks-' + mKey + '">' + tasksHtml + '</div>' +

        // — Input manuale
        '<div style="display:flex;gap:0.4rem;margin-top:0.7rem">' +
          '<input id="etask-input-' + mKey + '" type="text" placeholder="Escribe una tarea a mano…" ' +
            'style="flex:1;font-size:0.73rem;padding:0.38rem 0.65rem;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);outline:none" ' +
            'onkeydown="if(event.key===\'Enter\')equipoAddTask(\'' + mKey + '\')">' +
          '<button onclick="equipoAddTask(\'' + mKey + '\')" ' +
            'style="font-size:0.82rem;padding:0.3rem 0.7rem;background:var(--accent);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:600">+</button>' +
        '</div>' +

        // — Pulsante AI separato
        '<button onclick="equipoSuggestAI(\'' + mKey + '\',\'' + encodeURIComponent(m.role) + '\',\'' + encodeURIComponent(m.detail||'') + '\')" ' +
          'id="eai-btn-' + mKey + '" ' +
          'style="width:100%;margin-top:0.5rem;font-size:0.7rem;padding:0.38rem 0.6rem;background:none;border:1px dashed var(--border2);border-radius:8px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:0.35rem">' +
          '✦ Suggerir tareas con IA' +
        '</button>' +

        // — Area suggerimenti AI (nascosta fino al click)
        '<div id="eai-suggestions-' + mKey + '" style="display:none;margin-top:0.5rem;display:flex;flex-direction:column;gap:0.3rem"></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function _equipoAutoAssignFromBriefings() {
  for (var i = 0; i < (CLIENTS_DATA||[]).length; i++) {
    var c = CLIENTS_DATA[i];
    var ckey = c.client_key || c.id;
    try {
      var res = await fetch(AGENT_API + '/api/team/auto-assign/' + encodeURIComponent(c.id));
      var data = await res.json();
      if (data.ok && data.assigned_members && data.assigned_members.length) {
        data.assigned_members.forEach(function(memberName) {
          if (!_equipoAssignments[memberName]) _equipoAssignments[memberName] = [];
          if (_equipoAssignments[memberName].indexOf(ckey) === -1) {
            _equipoAssignments[memberName].push(ckey);
          }
          _equipoSave(memberName);
        });
      }
    } catch(e) {}
  }
}

function equipoToggleClient(mKeyEnc, clientKey) {
  var name = decodeURIComponent(mKeyEnc);
  if (!_equipoAssignments[name]) _equipoAssignments[name] = [];
  var idx = _equipoAssignments[name].indexOf(clientKey);
  if (idx === -1) _equipoAssignments[name].push(clientKey);
  else _equipoAssignments[name].splice(idx, 1);
  _equipoSave(name);
  _equipoRenderGrid();
}

function equipoAddTask(mKey) {
  var name = decodeURIComponent(mKey);
  var input = document.getElementById('etask-input-' + mKey);
  var val = (input ? input.value : '').trim();
  if (!val) return;
  if (!_equipoTasks[name]) _equipoTasks[name] = [];
  _equipoTasks[name].push(val);
  if (input) input.value = '';
  _equipoSave(name);
  _equipoRenderGrid();
}

function equipoRemoveTask(mKey, idx) {
  var name = decodeURIComponent(mKey);
  if (!_equipoTasks[name]) return;
  _equipoTasks[name].splice(idx, 1);
  _equipoSave(name);
  _equipoRenderGrid();
}

async function _equipoSave(memberName) {
  try {
    localStorage.setItem('bravo_team_tasks', JSON.stringify(_equipoTasks));
    localStorage.setItem('bravo_team_assignments', JSON.stringify(_equipoAssignments));
  } catch(e) {}

  try {
    await db.from('team_tasks').upsert({
      member_name: memberName,
      tasks: _equipoTasks[memberName] || [],
      assigned_clients: _equipoAssignments[memberName] || [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'member_name' });
  } catch(e) {}
}

async function equipoSuggestAI(mKey, roleEnc, detailEnc) {
  var name = decodeURIComponent(mKey);
  var role = decodeURIComponent(roleEnc);
  var detail = decodeURIComponent(detailEnc);
  var btn = document.getElementById('eai-btn-' + mKey);
  var sugBox = document.getElementById('eai-suggestions-' + mKey);

  if (btn) { btn.innerHTML = '⏳ Pensando…'; btn.disabled = true; }
  if (sugBox) { sugBox.style.display = 'flex'; sugBox.innerHTML = '<div style="font-size:0.7rem;color:var(--muted);padding:0.3rem 0">Cargando sugerencias…</div>'; }

  var clientId = (CLIENTS_DATA && CLIENTS_DATA.length) ? (CLIENTS_DATA[0].client_key || CLIENTS_DATA[0].id) : 'dakady';

  try {
    var res = await fetch(AGENT_API + '/api/team/suggest-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, member_name: name, member_role: role, member_detail: detail })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error IA');

    var suggestions = data.tasks || [];
    if (sugBox) {
      sugBox.style.display = 'flex';
      sugBox.innerHTML =
        '<div style="font-size:0.6rem;color:var(--muted2);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.2rem">Sugerencias IA — haz clic para añadir</div>' +
        suggestions.map(function(t, i) {
          return '<div onclick="equipoAddSuggestion(\'' + mKey + '\',\'' + encodeURIComponent(t) + '\',this)" ' +
            'style="display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;padding:0.35rem 0.65rem;border:1px dashed var(--border2);border-radius:8px;cursor:pointer;color:var(--text2);background:var(--bg);transition:background 0.15s">' +
            '<span style="color:var(--accent);font-weight:700">+</span> ' + t +
          '</div>';
        }).join('');
    }
    if (btn) { btn.innerHTML = '✦ Suggerir tareas con IA'; btn.disabled = false; }
  } catch(e) {
    if (sugBox) sugBox.innerHTML = '<div style="font-size:0.7rem;color:#D13B1E">✕ ' + e.message + '</div>';
    if (btn) { btn.innerHTML = '✦ Suggerir tareas con IA'; btn.disabled = false; }
  }
}

function equipoAddSuggestion(mKey, taskEnc, el) {
  var name = decodeURIComponent(mKey);
  var task = decodeURIComponent(taskEnc);
  if (!_equipoTasks[name]) _equipoTasks[name] = [];
  _equipoTasks[name].push(task);
  _equipoSave(name);
  // Segna come aggiunto visivamente
  if (el) {
    el.style.background = 'var(--green-light, #e8f5e9)';
    el.style.color = 'var(--muted2)';
    el.style.pointerEvents = 'none';
    el.querySelector('span').textContent = '✓';
  }
  _equipoRenderGrid();
}

// ── DASHBOARD STATS ──
function renderDashboardStats() {
  // Stats reali da Supabase
  var activos = (DASH_PROYECTOS || []).filter(function(p) {
    return ['aprobado','planificado','en_progreso','en_revision'].indexOf(p.status) >= 0;
  }).length;

  var today = new Date(); today.setHours(0,0,0,0);
  var in14 = new Date(today); in14.setDate(in14.getDate() + 14);
  var vencimientos = (DASH_PROYECTOS || []).filter(function(p) {
    if (!p.end_date || p.status === 'completado') return false;
    var d = new Date(p.end_date);
    return d >= today && d <= in14;
  }).length;

  // Tareas pianificate (da plan_tasks Supabase)
  var totalTasks = (typeof DASH_PLAN_TASKS !== 'undefined' ? DASH_PLAN_TASKS : []).filter(function(t){
    return t.status !== 'done';
  }).length;

  // Posts questa settimana (da RECENT_CONTENT)
  var contenidos = (typeof RECENT_CONTENT !== 'undefined' ? RECENT_CONTENT : []).length;

  var dOpen = document.getElementById('dash-tasks-open');
  var dDone = document.getElementById('dash-tasks-done');
  var dDl   = document.getElementById('dash-deadlines');
  var dProj = document.getElementById('dash-projects');
  if (dOpen) dOpen.textContent = totalTasks || '—';
  if (dDone) dDone.textContent = contenidos || '—';
  if (dDl)   dDl.textContent   = vencimientos || '0';
  if (dProj) dProj.textContent = activos || '—';

  renderDashSemana();
  renderDashVencimientos();
  renderDashProximas();
  renderDashContenido();
  renderDashAtencion();
}

function renderDashAtencion() {
  var el = document.getElementById('dashAtencion');
  if (!el) return;

  var items = [];

  // Proyectos con deadline scaduta (end_date nel passato, non completati)
  var todayAt = new Date(); todayAt.setHours(0,0,0,0);
  (DASH_PROYECTOS || []).filter(function(p) {
    if (!p.end_date || p.status === 'completado' || p.status === 'rechazado') return false;
    return new Date(p.end_date) < todayAt;
  }).slice(0,3).forEach(function(p) {
    var clientObj = (CLIENTS_DATA||[]).find(function(c){ return c.id === p.client_id; });
    var clientName = clientObj ? clientObj.name : '';
    items.push({ type:'red', icon:'⏰', text: (p.title||'Proyecto') + ' — deadline vencida', action: '', client: clientName });
  });

  // Proyectos sin assigned_to che sono aprobados
  (DASH_PROYECTOS || []).filter(function(p) {
    return !p.assigned_to && ['aprobado','planificado','en_progreso'].indexOf(p.status) >= 0;
  }).slice(0,2).forEach(function(p) {
    var clientObj = (CLIENTS_DATA||[]).find(function(c){ return c.id === p.client_id; });
    var clientName = clientObj ? clientObj.name : '';
    items.push({ type:'gold', icon:'👤', text: (p.title||'Proyecto') + ' — sin responsable asignado', action: '', client: clientName });
  });

  // Contenido generado hoy esperando revisión
  if (typeof todayContentCounts !== 'undefined') {
    var total = Object.values(todayContentCounts).reduce(function(a, b) { return a + b; }, 0);
    if (total > 0) {
      var tabEl = document.querySelector('.nav-tab[onclick*="clientes"]');
      items.push({ type:'green', icon:'★', text: total + ' post' + (total > 1 ? 's' : '') + ' generados hoy — revisa y aprueba', action: tabEl ? "switchTab('clientes'," + "document.querySelector('.nav-tab[onclick*=\"clientes\"]'))" : '', client: '' });
    }
  }

  // Sin tareas hoy
  if (Object.keys(HOY_TAREAS).length === 0) {
    items.push({ type:'blue', icon:'@', text: 'Equipo sin tareas asignadas hoy — planifica el trabajo del día', action: '', client: '' });
  }

  if (items.length === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';

  el.innerHTML =
    '<div class="dash-atencion-wrap">' +
      '<div class="dash-atencion-label">Requiere atención</div>' +
      '<div class="dash-atencion-list">' +
      items.map(function(item) {
        var typeColor = item.type === 'red' ? 'var(--red)' : item.type === 'gold' ? 'var(--gold)' : item.type === 'green' ? 'var(--green)' : 'var(--blue)';
        var typeBg    = item.type === 'red' ? 'rgba(192,57,43,0.18)' : item.type === 'gold' ? 'rgba(200,134,10,0.15)' : item.type === 'green' ? 'rgba(45,122,79,0.15)' : 'rgba(44,95,138,0.15)';
        return '<div class="dash-alert-item" style="border-left-color:' + typeColor + ';cursor:' + (item.action ? 'pointer' : 'default') + '"' +
          (item.action ? ' onclick="' + item.action + '"' : '') + '>' +
          '<div class="dash-alert-ico" style="background:' + typeBg + ';color:' + typeColor + '">' + item.icon + '</div>' +
          '<div class="dash-alert-body">' +
            '<div class="dash-alert-text">' + item.text + '</div>' +
            (item.client ? '<div class="dash-alert-client">' + item.client + '</div>' : '') +
          '</div>' +
          (item.action ? '<div class="dash-alert-arrow" style="color:' + typeColor + '">›</div>' : '') +
        '</div>';
      }).join('') +
      '</div>' +
    '</div>';
}

function renderDashSemana() {
  var el = document.getElementById('dash-semana');
  if (!el) return;

  var projs = (typeof DASH_PROYECTOS !== 'undefined' ? DASH_PROYECTOS : []).filter(function(p) {
    return p.status !== 'propuesto';
  });

  if (!projs.length) {
    el.innerHTML = '<div class="dash-content-empty" style="text-align:center;padding:0.8rem 0;font-size:0.75rem;color:var(--muted2);line-height:1.6">📋 Los proyectos activos<br>de tus clientes aparecerán aquí</div>';
    return;
  }

  // Raggruppa per client_id
  var byClient = {};
  projs.forEach(function(p) {
    if (!byClient[p.client_id]) byClient[p.client_id] = [];
    byClient[p.client_id].push(p);
  });

  el.innerHTML = Object.keys(byClient).map(function(cid) {
    var items = byClient[cid];
    var clientObj = (typeof CLIENTS_DATA !== 'undefined' ? CLIENTS_DATA : []).find(function(c) { return c.id === cid; });
    var clientName = clientObj ? (clientObj.name || cid) : cid;

    var completed  = items.filter(function(p){ return p.status === 'completado'; }).length;
    var inProgress = items.filter(function(p){ return ['en_progreso','en_revision'].indexOf(p.status) >= 0; }).length;
    var approved   = items.filter(function(p){ return ['aprobado','planificado'].indexOf(p.status) >= 0; }).length;
    var total = items.length;
    var pct = total > 0 ? Math.round((completed * 100 + inProgress * 65 + approved * 30) / total) : 0;
    var col = completed === total ? 'var(--green)' : inProgress > 0 ? 'var(--gold)' : '#4e7ca1';

    return '<div class="dash-proj-row">' +
      '<div class="dash-proj-name" title="' + clientName + '">' + clientName + '</div>' +
      '<div class="dash-proj-bar"><div class="dash-proj-fill" style="width:' + pct + '%;background:' + col + '"></div></div>' +
      '<div class="dash-proj-pct">' + pct + '%</div>' +
    '</div>' +
    '<div style="font-size:0.6rem;color:var(--muted2);margin-bottom:0.4rem">' +
      total + ' proyectos · ' + completed + ' completados · ' + inProgress + ' en progreso' +
    '</div>';
  }).join('');
}

function renderDashVencimientos() {
  var el = document.getElementById('dash-vencimientos');
  if (!el) return;

  var today = new Date(); today.setHours(0,0,0,0);
  var in30 = new Date(today); in30.setDate(in30.getDate() + 30);

  var upcoming = (typeof DASH_PROYECTOS !== 'undefined' ? DASH_PROYECTOS : []).filter(function(p) {
    if (!p.end_date || p.status === 'completado') return false;
    var d = new Date(p.end_date);
    return d >= today && d <= in30;
  }).sort(function(a,b){ return new Date(a.end_date) - new Date(b.end_date); }).slice(0, 5);

  if (!upcoming.length) {
    el.innerHTML = '<div class="dash-content-empty" style="text-align:center;padding:0.8rem 0;font-size:0.75rem;color:var(--muted2);line-height:1.6">📅 Sin vencimientos<br>en los próximos 30 días</div>';
    return;
  }

  el.innerHTML = upcoming.map(function(p) {
    var clientObj = (typeof CLIENTS_DATA !== 'undefined' ? CLIENTS_DATA : []).find(function(c){ return c.id === p.client_id; });
    var clientName = clientObj ? (clientObj.name || '—') : '—';
    var d = new Date(p.end_date);
    var diffDays = Math.ceil((d - today) / (1000*60*60*24));
    var col = diffDays <= 7 ? 'var(--red)' : diffDays <= 14 ? 'var(--gold)' : 'var(--green)';
    var dayStr = diffDays === 0 ? 'hoy' : diffDays === 1 ? 'mañana' : 'en ' + diffDays + ' días';
    return '<div class="dash-dead-item">' +
      '<div class="dash-dead-dot" style="background:' + col + '"></div>' +
      '<div class="dash-dead-info">' +
        '<div class="dash-dead-name">' + (p.title || '—') + '</div>' +
        '<div class="dash-dead-date">' + clientName + ' · ' + dayStr + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderDashProximas() {
  var el = document.getElementById('dash-proximas');
  if (!el) return;

  var tasks = (typeof DASH_PLAN_TASKS !== 'undefined' ? DASH_PLAN_TASKS : []);
  var today = new Date(); today.setHours(0,0,0,0);
  var upcoming = tasks.filter(function(t) {
    return t.publish_date && new Date(t.publish_date + 'T12:00:00') >= today;
  }).slice(0, 6);

  if (!upcoming.length) {
    el.innerHTML = '<div class="dash-content-empty" style="text-align:center;padding:0.8rem 0;font-size:0.75rem;color:var(--muted2);line-height:1.6">📋 Sin entregas programadas<br>Confirma un plan de producción</div>';
    return;
  }

  el.innerHTML = upcoming.map(function(t) {
    var d = new Date(t.publish_date + 'T12:00:00');
    var dateStr = d.toLocaleDateString('es-ES', { weekday:'short', day:'2-digit', month:'short' });
    var color = _teamColorFor(t.assignee);
    var initials = _teamInitialsFor(t.assignee);
    var isToday = d.toDateString() === today.toDateString();
    var isTomorrow = d - today === 86400000;
    var badge = isToday ? '<span style="font-size:0.6rem;background:#c0392b;color:#fff;border-radius:4px;padding:0.05rem 0.3rem;margin-left:0.3rem">HOY</span>'
              : isTomorrow ? '<span style="font-size:0.6rem;background:#c29547;color:#fff;border-radius:4px;padding:0.05rem 0.3rem;margin-left:0.3rem">MAÑANA</span>'
              : '';
    return '<div style="display:flex;align-items:center;gap:0.55rem;padding:0.4rem 0;border-bottom:1px solid #f0ece5">' +
      '<div style="width:26px;height:26px;border-radius:50%;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.62rem;font-weight:700;flex-shrink:0">' + initials + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.75rem;font-weight:600;color:#1F2A24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (t.title || '') + badge + '</div>' +
        '<div style="font-size:0.65rem;color:#888">' + dateStr + (t.project_title ? ' · ' + t.project_title : '') + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderDashContenido() {
  var el = document.getElementById('dash-contenido');
  if (!el) return;
  if (!RECENT_CONTENT || !RECENT_CONTENT.length) {
    el.innerHTML = '<div class="dash-content-empty">Sin contenido generado esta semana</div>';
    return;
  }
  // Raggruppa per client_id
  var byClient = {};
  RECENT_CONTENT.forEach(function(c) {
    var cid = c.client_id || 'otro';
    if (!byClient[cid]) byClient[cid] = [];
    byClient[cid].push(c);
  });
  el.innerHTML = Object.keys(byClient).map(function(cid) {
    var items = byClient[cid];
    var clientObj = CLIENTS_DATA.find(function(x){ return x.id === cid || x.client_key === cid; });
    var clientLabel = clientObj ? (clientObj.name || cid) : cid;
    var clientIdx = clientObj ? CLIENTS_DATA.indexOf(clientObj) : -1;
    var navAction = clientIdx >= 0 ? 'openClientePage(' + clientIdx + ')' : '';
    var thumbs = items.slice(0, 10).map(function(c) {
      var clickAction = clientIdx >= 0 ? 'openClientePage(' + clientIdx + ')' : "openContentPreview('" + c.id + "')";
      if (c.img_b64) {
        return '<div class="dash-thumb-wrap" onclick="' + clickAction + '" title="' + (c.headline || clientLabel) + '">' +
          '<img class="dash-thumb" src="' + _bravoImgSrcFromRecord(c) + '">' +
          '<div class="dash-thumb-hover">Ver →</div>' +
        '</div>';
      }
      return '<div class="dash-thumb-wrap dash-thumb-text" onclick="' + clickAction + '" title="' + (c.headline || '') + '">' +
        '<div class="dash-thumb-label">' + ((c.headline || c.pillar || 'POST').substring(0, 22)) + '</div>' +
        '<div class="dash-thumb-hover">Ver →</div>' +
      '</div>';
    }).join('');
    var moreCount = items.length > 10 ? items.length - 10 : 0;
    return '<div class="dash-content-client">' +
      '<div class="dash-content-client-head"' + (navAction ? ' onclick="' + navAction + '" style="cursor:pointer"' : '') + '>' +
        '<span class="dash-content-client-name">' + clientLabel + '</span>' +
        '<span class="dash-content-client-count">' + items.length + ' post esta semana</span>' +
        (navAction ? '<span class="dash-content-client-link">Ver todo →</span>' : '') +
      '</div>' +
      '<div class="dash-content-strip">' + thumbs +
        (moreCount > 0 ? '<div class="dash-thumb-more" onclick="' + navAction + '">+' + moreCount + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('');
}


// ── CLIENTES POPUP ──────────────────────────────────────────────
var CLIENT_COLORS = ['#D13B1E','#2c5f8a','#2d7a4f','#c8860a','#6d4c8e'];

function openClientesPopup() {
  var overlay = document.getElementById('clientesOverlay');
  var popup   = document.getElementById('clientesPopup');
  if (!overlay || !popup) return;
  renderClientesPopupList();
  overlay.classList.add('open');
  popup.classList.add('open');
  // Mantieni tab Clientes attivo visivamente
  var tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(function(t){ t.classList.remove('active'); });
  var ct = document.querySelector('.nav-tab[onclick*="clientes"]');
  if (ct) ct.classList.add('active');
}

function closeClientesPopup() {
  var overlay = document.getElementById('clientesOverlay');
  var popup   = document.getElementById('clientesPopup');
  if (overlay) overlay.classList.remove('open');
  if (popup)   popup.classList.remove('open');
}

function renderClientesPopupList() {
  var list = document.getElementById('clientesPopupList');
  if (!list) return;
  if (!CLIENTS_DATA.length) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted2);font-size:0.8rem">Sin clientes cargados</div>';
    return;
  }
  list.innerHTML = CLIENTS_DATA.map(function(c, i) {
    var initials = (c.name||'').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
    var color = CLIENT_COLORS[i % CLIENT_COLORS.length];
    var projs = CUENTAS.filter(function(p){
      return p.cliente && p.cliente.toLowerCase().indexOf((c.name||'').split(' ')[0].toLowerCase()) >= 0;
    });
    return '<div class="clientes-popup-item" onclick="openClientePage(' + i + ')">' +
      '<div class="clientes-popup-av" style="background:' + color + '">' + initials + '</div>' +
      '<div class="clientes-popup-info">' +
        '<div class="clientes-popup-name">' + (c.name||'') + '</div>' +
        '<div class="clientes-popup-sub">' + (c.sector||'') + ' · ' + projs.length + ' proy.</div>' +
      '</div>' +
      '<div class="clientes-popup-arrow">›</div>' +
    '</div>';
  }).join('') +
  '<div class="clientes-popup-add" onclick="openNuevoClienteModal()">+ Aggiungi cliente</div>';
}

// ── NUOVO CLIENTE ────────────────────────────────────────────────

function openNuevoClienteModal() {
  closeClientesPopup();
  if (document.getElementById('nuevoClienteModal')) return;
  var modal = document.createElement('div');
  modal.id = 'nuevoClienteModal';
  modal.className = 'bk-modal-overlay';
  modal.innerHTML =
    '<div class="bk-modal" style="max-width:480px">' +
      '<div class="bk-modal-head">' +
        '<div class="bk-modal-title">Nuovo cliente</div>' +
        '<button class="bk-modal-close" onclick="closeNuevoClienteModal()">✕</button>' +
      '</div>' +
      '<div class="bk-modal-body" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem">' +
        '<input id="nc-name"     class="bk-modal-input" placeholder="Nome (es. Pizzería Roma)" autocomplete="off">' +
        '<input id="nc-sector"   class="bk-modal-input" placeholder="Settore (es. Restaurazione / Pizzeria)">' +
        '<input id="nc-city"     class="bk-modal-input" placeholder="Città">' +
        '<input id="nc-instagram" class="bk-modal-input" placeholder="Instagram (es. @pizzeriaroma)">' +
        '<input id="nc-key"      class="bk-modal-input" placeholder="ID breve senza spazi (es. pizzeriaroma)">' +
        '<div id="nc-error" style="color:#D13B1E;font-size:0.8rem;min-height:1rem"></div>' +
        '<button class="bk-adopt-btn" onclick="saveNuevoCliente()" style="width:100%;justify-content:center">Crear cliente →</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  setTimeout(function(){ document.getElementById('nc-name').focus(); }, 50);

  // Auto-genera il client_key dal nome
  document.getElementById('nc-name').addEventListener('input', function() {
    var key = this.value.toLowerCase()
      .replace(/[àáâãäå]/g,'a').replace(/[èéêë]/g,'e')
      .replace(/[ìíîï]/g,'i').replace(/[òóôõö]/g,'o')
      .replace(/[ùúûü]/g,'u').replace(/[^a-z0-9]/g,'');
    document.getElementById('nc-key').value = key;
  });
}

function closeNuevoClienteModal() {
  var m = document.getElementById('nuevoClienteModal');
  if (m) m.remove();
}

async function saveNuevoCliente() {
  var name      = (document.getElementById('nc-name').value || '').trim();
  var sector    = (document.getElementById('nc-sector').value || '').trim();
  var city      = (document.getElementById('nc-city').value || '').trim();
  var instagram = (document.getElementById('nc-instagram').value || '').trim();
  var key       = (document.getElementById('nc-key').value || '').trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  var errEl     = document.getElementById('nc-error');

  if (!name)   { errEl.textContent = 'Il nome è obbligatorio.'; return; }
  if (!key)    { errEl.textContent = 'L\'ID breve è obbligatorio (solo lettere/numeri).'; return; }
  errEl.textContent = '';

  var btn = document.querySelector('#nuevoClienteModal .bk-adopt-btn');
  btn.disabled = true;
  btn.textContent = 'Creando…';

  try {
    var res = await fetch(AGENT_API + '/api/clients/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, sector: sector, city: city, instagram: instagram, client_key: key })
    });
    var data = await res.json();
    if (!res.ok) { errEl.textContent = data.detail || 'Error al crear el cliente.'; btn.disabled=false; btn.textContent='Crear cliente →'; return; }

    // Aggiunge il nuovo cliente a CLIENTS_DATA e apre la sua pagina
    CLIENTS_DATA.push(data.client);
    closeNuevoClienteModal();
    openClientePage(CLIENTS_DATA.length - 1);
  } catch(e) {
    errEl.textContent = 'Error de red: ' + e.message;
    btn.disabled = false;
    btn.textContent = 'Crear cliente →';
  }
}

// ── CLIENTE PAGE ────────────────────────────────────────────────
var _currentClienteIdx;

function openClientePage(clientIdx) {
  _currentClienteIdx = clientIdx;
  _clienteActiveTab = 'proyectos';
  closeClientesPopup();
  var c = typeof clientIdx === 'number'
    ? CLIENTS_DATA[clientIdx]
    : CLIENTS_DATA.find(function(x){ return x.id === clientIdx || x.client_key === clientIdx; });
  if (!c) { console.warn('[BRAVO] openClientePage: cliente non trovato idx=', clientIdx, 'data=', CLIENTS_DATA.length); return; }
  var idx = CLIENTS_DATA.indexOf(c);
  var color = CLIENT_COLORS[idx % CLIENT_COLORS.length];
  var initials = (c.name||'').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
  var projs = CUENTAS.filter(function(p){
    return p.cliente && p.cliente.toLowerCase().indexOf((c.name||'').split(' ')[0].toLowerCase()) >= 0;
  });
  var content = (RECENT_CONTENT||[]).filter(function(rc){ return rc.client_id === c.id || rc.client_id === c.client_key; });

  // Topbar
  document.getElementById('clientePageName').textContent = c.name || '';
  document.getElementById('clientePageSector').textContent = (c.sector||'') + (c.city ? ' · ' + c.city : '');

  // Body
  var colorDot = { crit:'var(--red)', warn:'var(--gold)', good:'var(--green)', idle:'var(--muted2)' };

  var projsHtml = projs.length ? projs.map(function(p) {
    var col = colorDot[p.estado] || 'var(--muted2)';
    return '<div class="cliente-proj-item" onclick="switchTab(\'tablero\',document.querySelector(\'[onclick*=tablero]\'));closeClientePage()">' +
      '<div class="cliente-proj-dot" style="background:' + col + '"></div>' +
      '<div class="cliente-proj-name">' + p.nombre + '</div>' +
      '<div class="cliente-proj-meta">' + p.estadoLabel + ' · ' + (p.deadline||'—') + '</div>' +
      '<div class="cliente-proj-pct" style="color:' + col + '">' + p.progreso + '%</div>' +
    '</div>';
  }).join('') : '<div class="cliente-content-empty">Sin proyectos activos</div>';

  // Usa cache se disponibile, altrimenti RECENT_CONTENT (7gg) come stato iniziale
  var initialContent = _clienteContentCache[c.id] || content;
  var contentHtml = buildClienteContentHtml(initialContent);

  var nProjs   = projs.length;
  var nContent = initialContent.length;

  // Render base (senza brand kit)
  _bkCurrentClientId = c.id;
  renderClientePageBody(c, color, initials, projsHtml, contentHtml, null, nProjs, nContent);
  document.getElementById('clientePage').classList.add('open');

  // Carica brand kit async e aggiorna
  if (typeof loadBrandKitFromDB === 'function') {
    loadBrandKitFromDB(c.id).then(function(bk) {
      if (bk) {
        if (!bk._opus && bk.brand_kit_opus) bk._opus = bk.brand_kit_opus;
        bk._clientId = c.id;
      }
      // Usa il content già caricato se disponibile, così il re-render non lo cancella
      var cachedContent = _clienteContentCache[c.id];
      var currentContentHtml = (cachedContent && cachedContent.length)
        ? buildClienteContentHtml(cachedContent, c.id, cachedContent.length >= _CONTENT_PAGE_SIZE)
        : contentHtml;
      var actualCount = (cachedContent && cachedContent.length) ? cachedContent.length : nContent;
      renderClientePageBody(c, color, initials, projsHtml, currentContentHtml, bk, nProjs, actualCount);
      // Se l'utente era già sul tab agenti quando il brand kit è arrivato,
      // il re-render ha azzerato il pannello — ricarica i dati subito
      if (_clienteActiveTab === 'agenti') {
        var agCtx = document.getElementById('agent-client-ctx');
        if (agCtx && agCtx.dataset.clientId) {
          var _w = _nextMonday();
          agentiLoadContext(agCtx.dataset.clientId, _w);
        }
      }
    });
  }

  // Carica logo async e aggiorna l'elemento nel DOM
  if (typeof loadBrandKitImagesFromDB === 'function') {
    loadBrandKitImagesFromDB(c.id).then(function(imgs) {
      if (!imgs || !imgs.logo_b64) return;
      var src = imgB64Src(imgs.logo_b64);
      if (!src) return;
      var el = document.getElementById('cliente-page-logo');
      if (el) {
        el.style.background = '#fff';
        el.style.padding = '3px';
        el.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">';
      }
    });
  }

  // Carica i primi 20 contenuti del cliente
  _clienteContentOffset[c.id] = 0;
  _clienteContentCache[c.id]  = [];
  loadClientAllContent(c.id, 0).then(function(firstPage) {
    var panel = document.querySelector('.ctab-panel[data-tab="contenido"] .cliente-section-body');
    if (panel) {
      panel.innerHTML = buildClienteContentHtml(firstPage, c.id, firstPage.length >= _CONTENT_PAGE_SIZE);
    }
    var realCount = firstPage.length;
    var badge = document.querySelector('.ctab-btn[data-tab="contenido"] .ctab-badge');
    if (badge) badge.textContent = realCount + (realCount >= _CONTENT_PAGE_SIZE ? '+' : '');
    // Aggiorna nContent per renderClientePageBody successivi (brand kit callback)
    nContent = realCount;
  });

  // Carica KPI studio se è cliente self (Bravo stesso)
  if (c.is_self === true) {
    _fetchStudioKPI(function(kpiData) {
      var kpiEl = document.getElementById('studio-kpi-banner');
      if (kpiEl && kpiData) {
        kpiEl.innerHTML = renderStudioKPIBanner(kpiData);
      }
    });
  }
}

function imgB64Src(b64) {
  if (!b64) return '';
  var s = String(b64);
  if (s.startsWith('data:')) return s;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/9j/'))   return 'data:image/jpeg;base64,' + s;
  if (s.startsWith('iVBOR'))  return 'data:image/png;base64,' + s;
  if (s.startsWith('PHN2') || s.startsWith('<svg')) return 'data:image/svg+xml;base64,' + s;
  return 'data:image/jpeg;base64,' + s;
}
function _logoSrc(b64) { return imgB64Src(b64); }

function renderBrandKitSection(bk) {
  if (!bk) return '';
  var colors    = bk.colors    || [];
  var fonts     = bk.fonts     || [];
  var pillars   = bk.pillars   || [];
  var layouts   = bk.layouts   || [];
  var templates = bk.templates || [];
  var igRefs       = bk.ig_refs_b64  || [];
  var contentTypes = bk.content_types || [];

  var logoHtml = bk.logo_b64
    ? '<div class="bk-logo-wrap"><img class="bk-logo" src="' + imgB64Src(bk.logo_b64) + '" alt="Logo"></div>'
    : '';

  var colorsHtml = colors.map(function(col) {
    return '<div class="bk-swatch-wrap" title="' + (col.uso||'') + '">' +
      '<div class="bk-swatch" style="background:' + col.hex + '"></div>' +
      '<div class="bk-swatch-label">' +
        '<span class="bk-swatch-name">' + col.name + '</span>' +
        '<span class="bk-swatch-hex">' + col.hex + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  var fontsHtml = fonts.map(function(f) {
    return '<div class="bk-font-row">' +
      '<span class="bk-font-name">' + f.name + '</span>' +
      '<span class="bk-font-tipo">' + (f.tipo||'') + '</span>' +
      '<span class="bk-font-uso">' + (f.uso||'') + '</span>' +
    '</div>';
  }).join('');

  var pillarsHtml = pillars.map(function(p) {
    return '<div class="bk-pillar-row">' +
      '<span class="bk-pillar-dot" style="background:' + (p.color||'var(--muted2)') + '"></span>' +
      '<span class="bk-pillar-name">' + p.nombre + '</span>' +
      '<span class="bk-pillar-pct">' + (p.pct||'') + '%</span>' +
      (p.descripcion ? '<span class="bk-pillar-desc">' + p.descripcion + '</span>' : '') +
    '</div>';
  }).join('');

  var layoutsHtml = layouts.map(function(l) {
    return '<div class="bk-layout-chip">' +
      '<code>' + l.name + '</code>' +
      (l.descripcion ? '<span>' + l.descripcion + '</span>' : '') +
    '</div>';
  }).join('');

  var templatesHtml = templates.map(function(t) {
    return '<div class="bk-tpl-item">' +
      '<img class="bk-tpl-thumb" src="' + (t.svg_b64||'') + '" alt="' + (t.name||'') + '">' +
      '<div class="bk-tpl-name">' + (t.name||'') + '</div>' +
      (t.descripcion ? '<div class="bk-tpl-desc">' + t.descripcion + '</div>' : '') +
    '</div>';
  }).join('');

  // Slot upload logo (mostra il logo salvato se presente)
  var logoSlotHtml = bk.logo_b64
    ? '<img src="' + imgB64Src(bk.logo_b64) + '" style="width:100%;height:100%;object-fit:contain;padding:4px">'
    : '<div class="bk-slot-empty"><span class="bk-slot-plus">+</span><span class="bk-slot-label">Logo</span></div>';

  // Slot upload 3 post IG di riferimento (mostra quelli salvati se presenti)
  var refSlotsHtml = '';
  for (var si = 0; si < 3; si++) {
    var savedRef = igRefs[si];
    var slotInner = savedRef
      ? '<img src="' + imgB64Src(savedRef) + '" style="width:100%;height:100%;object-fit:cover">'
      : '<div class="bk-slot-empty"><span class="bk-slot-plus">+</span><span class="bk-slot-label">Post ' + (si+1) + '</span></div>';
    refSlotsHtml +=
      '<div class="bk-slot-wrap">' +
        '<div class="bk-slot" id="bk-vis-ref-' + si + '" onclick="document.getElementById(\'bk-vis-ref-input-' + si + '\').click()" title="Post IG ' + (si+1) + '">' +
          slotInner +
        '</div>' +
        '<input type="file" id="bk-vis-ref-input-' + si + '" accept="image/*" style="display:none" onchange="bkVisHandleFile(event,\'ref\',' + si + ')">' +
      '</div>';
  }

  // Galleria dei post IG salvati (su sfondo bianco) — visibile solo se ci sono ref salvate
  var igRefsGalleryHtml = '';
  if (igRefs.length) {
    var refsImgs = igRefs.map(function(r, i) {
      return '<div class="bk-igref-item">' +
        '<img class="bk-igref-img" src="' + imgB64Src(r) + '" alt="Post IG ref ' + (i+1) + '">' +
        '<div class="bk-igref-cap">Post de referencia ' + (i+1) + '</div>' +
      '</div>';
    }).join('');
    igRefsGalleryHtml =
      '<div class="bk-block bk-block-igrefs">' +
        '<div class="bk-block-title">Posts Instagram de referencia</div>' +
        '<div class="bk-block-sub">Esempi del feed reale del cliente — usati da Opus per estrarre lo stile visuale.</div>' +
        '<div class="bk-igrefs-grid">' + refsImgs + '</div>' +
      '</div>';
  }

  var recursosHtml =
    '<div class="bk-block bk-block-recursos">' +
      '<div class="bk-block-title">Recursos visuales</div>' +
      '<div class="bk-recursos-sub">Sube el logo y hasta 3 posts de Instagram de referencia para que Opus aprenda el estilo visual del cliente.</div>' +
      '<div class="bk-recursos-slots">' +
        '<div class="bk-slot-wrap">' +
          '<div class="bk-slot bk-slot-logo" id="bk-vis-logo" onclick="document.getElementById(\'bk-vis-logo-input\').click()" title="Logo">' +
            logoSlotHtml +
          '</div>' +
          '<input type="file" id="bk-vis-logo-input" accept="image/*" style="display:none" onchange="bkVisHandleFile(event,\'logo\')">' +
        '</div>' +
        refSlotsHtml +
      '</div>' +
      '<button class="bk-analyze-vis-btn" id="bk-analyze-vis-btn" onclick="bkVisAnalyze()" disabled>' +
        '★ Analizar con Opus' +
      '</button>' +
    '</div>';

  var kitBodyHtml =
    (logoHtml ? '<div class="bk-block bk-block-logo">' + logoHtml + '</div>' : '') +
    (colors.length ? '<div class="bk-block"><div class="bk-block-title">Colores</div><div class="bk-swatches">' + colorsHtml + '</div></div>' : '') +
    (fonts.length  ? '<div class="bk-block"><div class="bk-block-title">Tipografía</div><div class="bk-fonts">' + fontsHtml + '</div></div>' : '') +
    (bk.tone_of_voice ? '<div class="bk-block"><div class="bk-block-title">Tono de voz</div><div class="bk-tone">' + bk.tone_of_voice + '</div></div>' : '') +
    (pillars.length ? '<div class="bk-block"><div class="bk-block-title">Pilares editoriales</div><div class="bk-pillars">' + pillarsHtml + '</div></div>' : '') +
    (layouts.length ? '<div class="bk-block"><div class="bk-block-title">Layouts preferidos</div><div class="bk-layouts">' + layoutsHtml + '</div></div>' : '') +
    (templates.length ? '<div class="bk-block"><div class="bk-block-title">Templates Story</div><div class="bk-templates">' + templatesHtml + '</div></div>' : '') +
    (bk.notes ? '<div class="bk-block"><div class="bk-block-title">Notas</div><div class="bk-notes">' + bk.notes + '</div></div>' : '') +
    (function() {
      var clientId = bk._clientId || '';
      var ctHtml = contentTypes.length
        ? contentTypes.map(function(ct) {
            return '<div class="bk-ct-item">' +
              '<div class="bk-ct-name">' + ct.name + '</div>' +
              (ct.when_to_use ? '<div class="bk-ct-when">' + ct.when_to_use + '</div>' : '') +
              (ct.example_headline ? '<div class="bk-ct-headline">&ldquo;' + ct.example_headline + '&rdquo;</div>' : '') +
            '</div>';
          }).join('')
        : '<div class="bk-ct-empty">Sin angulos narrativos. Genera los con IA desde el briefing.</div>';
      return '<div class="bk-block" id="bk-block-content-types">' +
        '<div class="bk-block-title" style="display:flex;align-items:center;justify-content:space-between">' +
          'Angulos Narrativos' +
          (clientId ? '<button class="bk-newkit-btn" id="bk-ct-btn" onclick="extractContentTypes(\'' + clientId + '\')" style="font-size:0.7rem">✦ Genera con IA</button>' : '') +
        '</div>' +
        '<div class="bk-ct-list" id="bk-ct-list">' + ctHtml + '</div>' +
      '</div>';
    })() +
    igRefsGalleryHtml +
    recursosHtml;

  var opusHtml = bk._opus
    ? renderBrandKitOpusPanel(bk._opus, bk._clientId)
    : '';

  return '<div class="cliente-section bk-section">' +
    '<div class="cliente-section-head">' +
      '<div class="cliente-section-title">Brand Kit</div>' +
      '<button class="bk-newkit-btn" onclick="openBrandKitModal()">+ Aggiorna Brand Kit</button>' +
    '</div>' +
    '<div class="bk-body" id="bkCurrentBody">' + kitBodyHtml + '</div>' +
  '</div>';
}

function renderIgConnectBlock(clientId) {
  var html =
    '<div class="bk-block" id="ig-connect-block-' + clientId + '" style="margin-top:0.5rem">' +
      '<div class="bk-block-title" style="display:flex;align-items:center;gap:0.5rem">' +
        '📱 Cuenta de Instagram' +
        '<span id="ig-status-badge-' + clientId + '" style="font-size:0.68rem;padding:0.15rem 0.5rem;border-radius:10px;background:#f0ece6;color:#888">Verificando...</span>' +
      '</div>' +
      '<div id="ig-connect-body-' + clientId + '">' +
        '<div style="color:#aaa;font-size:0.78rem">Cargando...</div>' +
      '</div>' +
    '</div>';

  setTimeout(function(){ igLoadStatus(clientId); }, 120);
  return html;
}

function igLoadStatus(clientId) {
  var body  = document.getElementById('ig-connect-body-' + clientId);
  var badge = document.getElementById('ig-status-badge-' + clientId);

  fetch(BRAVO_API + '/api/instagram/token/' + encodeURIComponent(clientId))
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.connected) {
        if (badge) { badge.textContent = '✓ Conectado'; badge.style.background = '#e8fde9'; badge.style.color = '#1a8a1e'; }
        if (body) body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.6rem;padding:0.7rem;background:#f0fdf0;border:1px solid #b6f0b8;border-radius:8px">' +
            '<div>' +
              '<div style="font-size:0.82rem;font-weight:600;color:#1a6b1e">@' + (d.ig_username || 'cuenta conectada') + '</div>' +
              (d.expires_at ? '<div style="font-size:0.7rem;color:#888;margin-top:0.15rem">Token válido hasta ' + new Date(d.expires_at).toLocaleDateString('es-ES') + '</div>' : '') +
            '</div>' +
            '<button onclick="igDisconnect(\'' + clientId + '\')" class="bk-newkit-btn" style="color:#e74c3c;border-color:#e74c3c">Desconectar</button>' +
          '</div>';
      } else {
        // Controlla se il backend IG è configurato
        fetch(BRAVO_API + '/api/instagram/status')
          .then(function(r){ return r.json(); })
          .then(function(s){
            if (badge) { badge.textContent = '○ No conectado'; badge.style.background = '#f0ece6'; badge.style.color = '#888'; }
            if (!body) return;
            if (s.enabled) {
              body.innerHTML =
                '<div style="font-size:0.78rem;color:#666;margin-bottom:0.7rem">Conecta la cuenta Instagram Business del cliente para publicar directamente desde BRAVO.</div>' +
                '<button class="bk-adopt-btn" onclick="igStartOAuth(\'' + clientId + '\')">📱 Conectar Instagram</button>';
            } else {
              body.innerHTML =
                '<div style="padding:0.8rem;background:#fef9f0;border:1px solid #f5d87a;border-radius:8px;font-size:0.78rem;color:#7a5c00">' +
                  '⚙️ <strong>Pending de activación</strong> — El publishing Instagram está listo pero necesita las credenciales Meta.<br>' +
                  '<span style="color:#aaa;font-size:0.7rem;margin-top:0.3rem;display:block">Añade INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET al .env del backend para activar.</span>' +
                '</div>';
            }
          });
      }
    })
    .catch(function(){
      if (badge) { badge.textContent = '⚠ Error'; badge.style.color = '#e74c3c'; }
    });
}

function igStartOAuth(clientId) {
  var redirectUri = window.location.origin + '/ig-callback.html';
  fetch(BRAVO_API + '/api/instagram/auth-url?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri))
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d.ok) { showToast('❌ ' + d.error); return; }
      var popup = window.open(d.url, 'ig_oauth', 'width=600,height=700,scrollbars=yes');
      // Ascolta messaggio dalla popup callback
      window.addEventListener('message', function handler(e) {
        if (e.data && e.data.type === 'ig_oauth_success') {
          window.removeEventListener('message', handler);
          if (popup) popup.close();
          showToast('✅ Instagram conectado: @' + (e.data.ig_username || ''));
          igLoadStatus(clientId);
        }
        if (e.data && e.data.type === 'ig_oauth_error') {
          window.removeEventListener('message', handler);
          if (popup) popup.close();
          showToast('❌ Error al conectar: ' + (e.data.error || 'desconocido'));
        }
      });
    })
    .catch(function(e){ showToast('❌ Error: ' + e.message); });
}

function igDisconnect(clientId) {
  if (!confirm('¿Desconectar la cuenta Instagram de este cliente?')) return;
  fetch(BRAVO_API + '/api/instagram/token/' + encodeURIComponent(clientId), { method: 'DELETE' })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) { showToast('Cuenta Instagram desconectada'); igLoadStatus(clientId); }
      else showToast('❌ Error: ' + (d.error || ''));
    });
}

function renderBrandKitOpusPanel(opus, clientId) {
  // Supporta sia array (vecchio formato) sia oggetto con chiavi (nuovo schema Bravo)
  var colors = Array.isArray(opus.colors)
    ? opus.colors
    : Object.entries(opus.colors || {}).map(function(e) {
        return { name: e[0], hex: e[1].hex || '', uso: e[1].usage || e[1].uso || '' };
      });

  // fonts: array diretto oppure ricavato da typography.styles
  var fonts = Array.isArray(opus.fonts)
    ? opus.fonts
    : (opus.typography && opus.typography.styles
        ? Object.entries(opus.typography.styles).map(function(e) {
            return { name: (opus.typography.font_family || '') + ' ' + (e[1].weight || ''), tipo: e[0], uso: e[1].role || '' };
          })
        : []);

  var pillars  = opus.pillars  || (opus.content_pillars || []);
  var layouts  = Array.isArray(opus.layouts) ? opus.layouts
    : Object.entries(opus.backgrounds || {}).map(function(e) {
        return { name: e[0], descripcion: e[1].when_to_use || '' };
      });

  var swatches = colors.map(function(c) {
    return '<div class="bk-swatch-wrap"><div class="bk-swatch" style="background:' + c.hex + '"></div>' +
      '<div class="bk-swatch-label"><span class="bk-swatch-name">' + c.name + '</span><span class="bk-swatch-hex">' + c.hex + '</span></div></div>';
  }).join('');

  var fontsH = fonts.map(function(f) {
    return '<div class="bk-font-row"><span class="bk-font-name">' + f.name + '</span>' +
      '<span class="bk-font-tipo">' + (f.tipo||'') + '</span>' +
      '<span class="bk-font-uso">' + (f.uso||'') + '</span></div>';
  }).join('');

  var pillarsH = pillars.map(function(p) {
    return '<div class="bk-pillar-row"><span class="bk-pillar-dot" style="background:' + (p.color||'#999') + '"></span>' +
      '<span class="bk-pillar-name">' + p.nombre + '</span>' +
      '<span class="bk-pillar-pct">' + (p.pct||'') + '%</span>' +
      (p.descripcion ? '<span class="bk-pillar-desc">' + p.descripcion + '</span>' : '') + '</div>';
  }).join('');

  var layoutsH = layouts.map(function(l) {
    return '<div class="bk-layout-chip"><code>' + l.name + '</code>' +
      (l.descripcion ? '<span>' + l.descripcion + '</span>' : '') + '</div>';
  }).join('');

  return '<div class="bk-opus-panel">' +
    '<div class="bk-opus-header">' +
      '<span class="bk-opus-badge">★ OPUS</span>' +
      '<span class="bk-opus-title">Analisi Brand Kit — Claude Opus</span>' +
      '<div class="bk-opus-actions">' +
        '<button class="bk-adopt-btn" onclick="adoptOpusBrandKit(\'' + (clientId||'') + '\')">✓ Adotta questo Brand Kit</button>' +
        '<button class="bk-discard-btn" onclick="discardOpusBrandKit()">✕ Scarta</button>' +
      '</div>' +
    '</div>' +
    '<div class="bk-body">' +
      (colors.length  ? '<div class="bk-block"><div class="bk-block-title">Colores</div><div class="bk-swatches">' + swatches + '</div></div>' : '') +
      (fonts.length   ? '<div class="bk-block"><div class="bk-block-title">Tipografía</div><div class="bk-fonts">' + fontsH + '</div></div>' : '') +
      (opus.tone_of_voice ? '<div class="bk-block"><div class="bk-block-title">Tono de voz</div><div class="bk-tone">' + (typeof opus.tone_of_voice === 'object' ? (opus.tone_of_voice.persona || '') + (opus.tone_of_voice.principles ? '<ul style="margin-top:0.5rem;padding-left:1.2rem">' + opus.tone_of_voice.principles.map(function(p){return '<li>'+p+'</li>';}).join('') + '</ul>' : '') : opus.tone_of_voice) + '</div></div>' : '') +
      (pillars.length ? '<div class="bk-block"><div class="bk-block-title">Pilares</div><div class="bk-pillars">' + pillarsH + '</div></div>' : '') +
      (layouts.length ? '<div class="bk-block"><div class="bk-block-title">Layouts</div><div class="bk-layouts">' + layoutsH + '</div></div>' : '') +
      (opus.notes     ? '<div class="bk-block"><div class="bk-block-title">Notas</div><div class="bk-notes">' + opus.notes + '</div></div>' : '') +
    '</div>' +
  '</div>';
}

var _bkCurrentClientId = null;
var _bkPendingFiles = [];
var _bkOpusResult = null;
var _bkVisLogo = null;
var _bkVisRefs = [null, null, null];

// Ridimensiona un File immagine a max maxPx px mantenendo le proporzioni.
// Restituisce una Promise<File> (o il file originale se già piccolo / non immagine).
function _bkResizeImage(file, maxPx) {
  maxPx = maxPx || 1200;
  return new Promise(function(resolve) {
    if (!file || !file.type.startsWith('image/')) return resolve(file);
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function() {
      URL.revokeObjectURL(url);
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w <= maxPx && h <= maxPx) return resolve(file);
      var scale = maxPx / Math.max(w, h);
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function(blob) {
        var resized = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
        resolve(resized);
      }, 'image/jpeg', 0.88);
    };
    img.onerror = function() { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

function bkVisHandleFile(event, type, idx) {
  var file = event.target.files[0];
  if (!file) return;
  var previewUrl = URL.createObjectURL(file);

  // Mostra anteprima immediata
  if (type === 'logo') {
    var slot = document.getElementById('bk-vis-logo');
    if (slot) slot.innerHTML = '<img src="' + previewUrl + '" style="width:100%;height:100%;object-fit:contain;padding:4px">';
  } else {
    var slot2 = document.getElementById('bk-vis-ref-' + idx);
    if (slot2) slot2.innerHTML = '<img src="' + previewUrl + '" style="width:100%;height:100%;object-fit:cover">';
  }

  // Ridimensiona e salva il file compresso
  _bkResizeImage(file, 1200).then(function(resized) {
    if (type === 'logo') {
      _bkVisLogo = resized;
    } else {
      _bkVisRefs[idx] = resized;
    }
    var hasFiles = _bkVisLogo || _bkVisRefs.some(function(f){ return !!f; });
    var btn = document.getElementById('bk-analyze-vis-btn');
    if (btn) btn.disabled = !hasFiles;
  });
}

function bkVisAnalyze() {
  var hasAny = !!_bkVisLogo || _bkVisRefs.some(function(f){ return !!f; });
  if (!hasAny) return;

  // Non mettiamo i file dei "slot" dentro _bkPendingFiles (che è per gli SVG del modal):
  // logo e refs verranno inviati in campi FormData dedicati (logo_file, ref_files).
  _bkPendingFiles = [];
  _bkOpusResult = null;

  // Apre il modal direttamente alla fase di analisi (salta step 1)
  var existing = document.getElementById('bkModal');
  if (existing) existing.remove();
  var modal = document.createElement('div');
  modal.id = 'bkModal';
  modal.className = 'bk-modal-overlay';
  modal.innerHTML =
    '<div class="bk-modal">' +
      '<div class="bk-modal-head">' +
        '<div class="bk-modal-title">Análisis visual con Opus</div>' +
        '<button class="bk-modal-close" onclick="closeBrandKitModal()">✕</button>' +
      '</div>' +
      '<div class="bk-modal-body" id="bkModalBody"></div>' +
    '</div>';
  document.body.appendChild(modal);
  setTimeout(function(){ modal.classList.add('open'); }, 10);
  runBrandKitAnalysis();
}

// ── Apre il modal Brand Kit ──────────────────────────────────────────────────
function openBrandKitModal() {
  _bkPendingFiles = [];
  _bkOpusResult = null;
  var existing = document.getElementById('bkModal');
  if (existing) existing.remove();

  var modal = document.createElement('div');
  modal.id = 'bkModal';
  modal.className = 'bk-modal-overlay';
  modal.innerHTML =
    '<div class="bk-modal">' +
      '<div class="bk-modal-head">' +
        '<div class="bk-modal-title">Aggiorna Brand Kit</div>' +
        '<button class="bk-modal-close" onclick="closeBrandKitModal()">✕</button>' +
      '</div>' +
      '<div class="bk-modal-body" id="bkModalBody">' +
        renderBkModalStep1() +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  setTimeout(function(){ modal.classList.add('open'); }, 10);
}

function closeBrandKitModal() {
  var modal = document.getElementById('bkModal');
  if (modal) { modal.classList.remove('open'); setTimeout(function(){ modal.remove(); }, 200); }
}

function renderBkModalStep1() {
  return '<p class="bk-modal-desc">Carica i file SVG dei layout, il logo e i font del cliente.<br>Claude Opus farà l\'analisi completa del brand.</p>' +
    '<div class="bk-modal-drop" id="bkModalDrop" ' +
      'ondragover="event.preventDefault();this.classList.add(\'drag-over\')" ' +
      'ondragleave="this.classList.remove(\'drag-over\')" ' +
      'ondrop="handleBkModalDrop(event)">' +
      '<div class="bk-modal-drop-icon">⊞</div>' +
      '<div class="bk-modal-drop-label">Trascina qui la cartella o i file</div>' +
      '<div class="bk-modal-drop-sub">SVG · PNG · JPG</div>' +
      '<div id="bkFileList" class="bk-file-list"></div>' +
    '</div>' +
    '<label class="bk-modal-filebtn">' +
      'Scegli file' +
      '<input type="file" multiple accept=".svg,.png,.jpg,.jpeg" style="display:none" onchange="handleBkModalFiles(this.files)">' +
    '</label>' +
    '<button class="bk-modal-analyze-btn" id="bkAnalyzeBtn" onclick="runBrandKitAnalysis()" disabled>★ Analiza con Opus</button>';
}

function renderBkModalProgress(count) {
  return '<div class="bk-modal-progress">' +
    '<div class="bk-modal-progress-icon">◎</div>' +
    '<div class="bk-modal-progress-title">Opus sta analizzando ' + count + ' file…</div>' +
    '<div class="bk-modal-progress-sub">Potrebbe richiedere qualche minuto — non chiudere la finestra</div>' +
    '<div class="bk-progress-bar" style="margin-top:1rem"><div class="bk-progress-fill" id="bkModalFill"></div></div>' +
  '</div>';
}

function renderBkModalResult(kit, meta) {
  meta = meta || {};

  // ── Resoconto di ciò che è stato analizzato ──────────────────
  var analysisBullets = [];
  if (meta.logoSaved)  analysisBullets.push('<li>Logo del brand salvato</li>');
  if (meta.refsSaved)  analysisBullets.push('<li>' + meta.refsSaved + ' post Instagram di riferimento salvati</li>');
  var nColors  = (kit.colors   || []).length;
  var nFonts   = (kit.fonts    || []).length;
  var nPillars = (kit.pillars  || []).length;
  var nLayouts = (kit.layouts  || []).length;
  if (nColors)  analysisBullets.push('<li>' + nColors  + ' colori del brand identificati</li>');
  if (nFonts)   analysisBullets.push('<li>' + nFonts   + ' font identificati</li>');
  if (kit.tone_of_voice) analysisBullets.push('<li>Tono di voce estratto</li>');
  if (nPillars) analysisBullets.push('<li>' + nPillars + ' pilastri editoriali rilevati</li>');
  if (nLayouts) analysisBullets.push('<li>' + nLayouts + ' layout / composizioni identificati</li>');
  if (kit.notes) analysisBullets.push('<li>Note brand aggiunte</li>');

  var resumeHtml = analysisBullets.length
    ? '<div class="bk-res-resume"><div class="bk-res-resume-title">Ecco cosa ha estratto Opus:</div><ul class="bk-res-bullets">' + analysisBullets.join('') + '</ul></div>'
    : '';

  // ── Dettaglio colori ─────────────────────────────────────────
  var colorsHtml = (kit.colors||[]).map(function(c){
    return '<div class="bk-res-color-item">' +
      '<span class="bk-res-swatch" style="background:' + c.hex + '"></span>' +
      '<span class="bk-res-color-name">' + c.name + '</span>' +
      '<span class="bk-res-color-hex">' + c.hex + '</span>' +
      (c.uso ? '<span class="bk-res-color-uso">' + c.uso + '</span>' : '') +
    '</div>';
  }).join('');

  // ── Dettaglio font ───────────────────────────────────────────
  var fontsHtml = (kit.fonts||[]).map(function(f){
    return '<div class="bk-res-font-item">' +
      '<span class="bk-res-font-name">' + f.name + '</span>' +
      (f.tipo ? '<span class="bk-res-tag">' + f.tipo + '</span>' : '') +
      (f.uso  ? '<span class="bk-res-color-uso">' + f.uso  + '</span>' : '') +
    '</div>';
  }).join('');

  // ── Dettaglio pilastri ───────────────────────────────────────
  var pillarsHtml = (kit.pillars||[]).map(function(p){
    return '<div class="bk-res-pillar-item">' +
      '<span class="bk-res-pillar-dot" style="background:' + (p.color||'#999') + '"></span>' +
      '<span class="bk-res-font-name">' + p.nombre + '</span>' +
      '<span class="bk-res-tag">' + (p.pct||0) + '%</span>' +
      (p.descripcion ? '<span class="bk-res-color-uso">' + p.descripcion + '</span>' : '') +
    '</div>';
  }).join('');

  // ── Dettaglio layouts ────────────────────────────────────────
  var layoutsHtml = (kit.layouts||[]).map(function(l){
    return '<div class="bk-res-font-item">' +
      '<span class="bk-res-font-name"><code>' + l.name + '</code></span>' +
      (l.descripcion ? '<span class="bk-res-color-uso">' + l.descripcion + '</span>' : '') +
    '</div>';
  }).join('');

  return '<div class="bk-modal-result">' +
    '<div class="bk-modal-result-badge">★ OPUS — Análisis completado</div>' +
    resumeHtml +
    (colorsHtml  ? '<div class="bk-res-section"><div class="bk-res-section-title">Colores</div><div class="bk-res-colors">' + colorsHtml + '</div></div>' : '') +
    (fontsHtml   ? '<div class="bk-res-section"><div class="bk-res-section-title">Tipografía</div><div class="bk-res-fonts">'  + fontsHtml  + '</div></div>' : '') +
    (kit.tone_of_voice ? '<div class="bk-res-section"><div class="bk-res-section-title">Tono de voz</div><div class="bk-res-tone-full">' + kit.tone_of_voice + '</div></div>' : '') +
    (pillarsHtml ? '<div class="bk-res-section"><div class="bk-res-section-title">Pilares editoriales</div><div class="bk-res-fonts">' + pillarsHtml + '</div></div>' : '') +
    (layoutsHtml ? '<div class="bk-res-section"><div class="bk-res-section-title">Layouts identificados</div><div class="bk-res-fonts">' + layoutsHtml + '</div></div>' : '') +
    (kit.notes   ? '<div class="bk-res-section"><div class="bk-res-section-title">Notas del brand</div><div class="bk-res-tone-full">' + kit.notes + '</div></div>' : '') +
  '</div>' +
  '<div class="bk-modal-result-actions">' +
    '<button class="bk-modal-save-btn" onclick="saveBrandKitOpus()">✓ Guardar este Brand Kit</button>' +
    '<button class="bk-modal-keep-btn" onclick="closeBrandKitModal()">Descartar</button>' +
  '</div>';
}

function handleBkModalDrop(event) {
  event.preventDefault();
  document.getElementById('bkModalDrop').classList.remove('drag-over');
  var items = event.dataTransfer.items;
  var pending = 0;

  function tryRead(entry) {
    if (entry.isFile) {
      pending++;
      entry.file(function(file) {
        addBkFile(file);
        pending--;
        if (pending === 0) updateBkFileList();
      });
    } else if (entry.isDirectory) {
      var reader = entry.createReader();
      reader.readEntries(function(entries) {
        entries.forEach(function(e) { tryRead(e); });
      });
    }
  }
  for (var i = 0; i < items.length; i++) {
    var entry = items[i].webkitGetAsEntry();
    if (entry) tryRead(entry);
  }
}

function handleBkModalFiles(fileList) {
  Array.from(fileList).forEach(addBkFile);
  updateBkFileList();
}

function addBkFile(file) {
  var validExt = ['.svg','.png','.jpg','.jpeg'];
  var ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (validExt.indexOf(ext) >= 0) _bkPendingFiles.push(file);
}

function updateBkFileList() {
  var el = document.getElementById('bkFileList');
  var btn = document.getElementById('bkAnalyzeBtn');
  if (!el) return;
  var svgs = _bkPendingFiles.filter(function(f){ return f.name.endsWith('.svg'); }).length;
  var imgs = _bkPendingFiles.filter(function(f){ return !f.name.endsWith('.svg'); }).length;
  el.innerHTML = _bkPendingFiles.length
    ? '<div class="bk-file-count">✓ ' + _bkPendingFiles.length + ' file caricati (' + svgs + ' SVG' + (imgs ? ', ' + imgs + ' immagini' : '') + ')</div>'
    : '';
  if (btn) btn.disabled = _bkPendingFiles.length === 0;
}

function runBrandKitAnalysis() {
  var body = document.getElementById('bkModalBody');
  if (!body) return;
  // Conta: SVG nel modal + logo slot + ref slots
  var count = _bkPendingFiles.length +
    (_bkVisLogo ? 1 : 0) +
    _bkVisRefs.filter(function(f){ return !!f; }).length;
  body.innerHTML = renderBkModalProgress(count);
  setTimeout(function(){
    var fill = document.getElementById('bkModalFill');
    if (fill) fill.style.width = '55%';
  }, 200);

  var clientId = _bkCurrentClientId || '';
  var clientName = '';
  var cData = (CLIENTS_DATA||[]).find(function(x){ return x.id === clientId; });
  if (cData) clientName = cData.name || '';

  // Controlla se c'è già un logo
  var hasExistingLogo = false;

  function _proceedWithBrandAnalysis() {
    var form = new FormData();
    form.append('client_id', clientId);
    form.append('client_name', clientName);
    form.append('has_existing_logo', hasExistingLogo ? '1' : '0');

    _bkPendingFiles.forEach(function(f){ form.append('files', f); });
    if (_bkVisLogo) form.append('logo_file', _bkVisLogo);
    _bkVisRefs.forEach(function(f){ if (f) form.append('ref_files', f); });

    fetch(BRAVO_API + '/api/brand/analyze', { method: 'POST', body: form })
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!data.success) throw new Error(data.detail || 'Error de análisis');
      _bkOpusResult = data.brand_kit;
      var meta = { logoSaved: data.logo_saved || false, refsSaved: data.refs_saved || 0 };
      var fill = document.getElementById('bkModalFill');
      if (fill) fill.style.width = '100%';
      setTimeout(function(){
        var b = document.getElementById('bkModalBody');
        if (b) b.innerHTML = renderBkModalResult(_bkOpusResult, meta);
      }, 400);
    })
    .catch(function(err){
      var b = document.getElementById('bkModalBody');
      if (b) b.innerHTML = '<div class="bk-modal-error">✕ Error: ' + err.message + '</div>' +
        '<button class="bk-modal-keep-btn" style="margin-top:1rem" onclick="closeBrandKitModal()">Cerrar</button>';
    });
  }

  if (typeof db !== 'undefined' && db && dbConnected) {
    db.from('client_brand').select('logo_b64').eq('client_id', clientId)
      .then(function(res){
        hasExistingLogo = !!(res.data && res.data[0] && res.data[0].logo_b64);
        _proceedWithBrandAnalysis();
      })
      .catch(function(){ _proceedWithBrandAnalysis(); });
  } else {
    _proceedWithBrandAnalysis();
  }
}

function _bkFileToB64(file) {
  return new Promise(function(resolve) {
    if (!file) return resolve(null);
    var reader = new FileReader();
    reader.onload = function(e) { resolve(e.target.result.split(',')[1]); };
    reader.onerror = function() { resolve(null); };
    reader.readAsDataURL(file);
  });
}

function saveBrandKitOpus() {
  if (!_bkOpusResult) return;
  var clientId = _bkCurrentClientId || '';

  function doSave(logoB64, refsB64) {
    if (typeof db === 'undefined' || !db || !dbConnected) {
      alert('Error: base de datos no conectada. Recarga la página e intenta de nuevo.');
      return;
    }
    var payload = {
      client_id:      clientId,
      colors:         _bkOpusResult.colors        || [],
      fonts:          _bkOpusResult.fonts         || [],
      tone_of_voice:  _bkOpusResult.tone_of_voice || '',
      pillars:        _bkOpusResult.pillars       || [],
      layouts:        _bkOpusResult.layouts       || [],
      templates:      _bkOpusResult.templates     || [],
      notes:          _bkOpusResult.notes         || '',
      brand_kit_opus: _bkOpusResult
    };
    if (logoB64) payload.logo_b64 = logoB64;
    if (refsB64 && refsB64.length) payload.ig_refs_b64 = refsB64;

    db.from('client_brand').upsert(payload)
    .then(function(res) {
      if (res.error) throw new Error(res.error.message);
      var b = document.getElementById('bkModalBody');
      if (b) b.innerHTML = '<div class="bk-modal-success">✓ Brand Kit salvato!</div>';
      setTimeout(function() {
        closeBrandKitModal();
        // Invalida le cache per forzare il reload da Supabase
        if (typeof BRAND_KITS !== 'undefined' && clientId) {
          try { delete BRAND_KITS[clientId]; } catch(e) {}
        }
        if (typeof _bkImagesLoaded !== 'undefined' && clientId) {
          try { delete _bkImagesLoaded[clientId]; } catch(e) {}
        }
        if (typeof loadBrandKitFromDB === 'function' && clientId) {
          loadBrandKitFromDB(clientId).then(function(bk) {
            if (!bk) return;
            if (!bk._opus && bk.brand_kit_opus) bk._opus = bk.brand_kit_opus;
            bk._clientId = clientId;
            var sidebarEl = document.querySelector('.cliente-info-logo, .cliente-sidebar-logo-wrap');
            if (sidebarEl && bk.logo_b64) {
              sidebarEl.outerHTML = '<div class="cliente-sidebar-logo-wrap"><img class="cliente-sidebar-logo" src="' + imgB64Src(bk.logo_b64) + '" alt="Logo"></div>';
            }
            var bkPanel = document.querySelector('.ctab-panel[data-tab="brandkit"]');
            if (bkPanel && typeof renderBrandKitSection === 'function') {
              bkPanel.innerHTML = renderBrandKitSection(bk) || '';
            }
            _bkVisLogo = null;
            _bkVisRefs = [null, null, null];
          });
        }
      }, 1000);
    })
    .catch(function(err) { alert('Error al guardar: ' + (err && err.message ? err.message : err)); });
  }

  // Converte logo + refs in base64 in parallelo, poi salva
  Promise.all([
    _bkFileToB64(_bkVisLogo),
    Promise.all(_bkVisRefs.map(_bkFileToB64))
  ]).then(function(out) {
    var logoB64 = out[0];
    var refsB64 = (out[1] || []).filter(function(x){ return !!x; });
    doSave(logoB64, refsB64);
  });
}

var _clienteActiveTab = 'proyectos';
var _clientProjects = {};   // clientId → array | null | undefined

function switchClienteTab(tabName) {
  _clienteActiveTab = tabName;
  var tabs = document.querySelectorAll('.ctab-btn');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].dataset.tab === tabName);
  }
  var panels = document.querySelectorAll('.ctab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].style.display = panels[j].dataset.tab === tabName ? '' : 'none';
  }
  // Quando si apre il Calendario, carica le tareas se non già in cache
  if (tabName === 'calendario') {
    var calPanel = document.querySelector('.ctab-panel[data-tab="calendario"]');
    if (calPanel) {
      var cid = calPanel.dataset.clientId;
      if (cid && !_clientTasksCache.hasOwnProperty(cid)) {
        _loadClientTasks(cid);
      }
    }
  }
  // Quando si apre il Brand Kit, carica logo e refs (lazy — sono pesanti)
  if (tabName === 'brandkit') {
    _loadBrandKitImages();
  }
  // Quando si apre Agenti, ricarica i dati — necessario perché renderClientePageBody
  // viene chiamato due volte (base + brand kit) e la seconda chiamata resetta il DOM
  if (tabName === 'agenti') {
    var agCtx = document.getElementById('agent-client-ctx');
    if (agCtx && agCtx.dataset.clientId) {
      var agCid = agCtx.dataset.clientId;
      var agWeek = _nextMonday();
      agentiLoadContext(agCid, agWeek);
      if (window._pendingDesignerStep) {
        setTimeout(_injectPendingDesignerStep, 300);
      } else if (window._pendingPlanCardLaunch) {
        setTimeout(_injectPlanCardContext, 300);
      }
    }
  }
}

var _bkImagesLoaded = {};  // clientId → true

function _loadBrandKitImages() {
  var clientId = _bkCurrentClientId;
  if (!clientId || _bkImagesLoaded[clientId]) return;
  if (typeof loadBrandKitImagesFromDB !== 'function') return;
  loadBrandKitImagesFromDB(clientId).then(function(imgs) {
    if (!imgs || (!imgs.logo_b64 && !(imgs.ig_refs_b64 && imgs.ig_refs_b64.length))) return;
    _bkImagesLoaded[clientId] = true;
    // Aggiorna slot logo
    var logoSlot = document.getElementById('bk-vis-logo');
    if (logoSlot && imgs.logo_b64) {
      logoSlot.innerHTML = '<img src="' + imgB64Src(imgs.logo_b64) + '" style="width:100%;height:100%;object-fit:contain;padding:4px">';
    }
    // Aggiorna sidebar logo
    var sidebarEl = document.querySelector('.cliente-info-logo, .cliente-sidebar-logo-wrap');
    if (sidebarEl && imgs.logo_b64) {
      sidebarEl.outerHTML = '<div class="cliente-sidebar-logo-wrap"><img class="cliente-sidebar-logo" src="' + imgB64Src(imgs.logo_b64) + '" alt="Logo"></div>';
    }
    // Aggiorna galleria refs
    var grid = document.querySelector('.bk-igrefs-grid');
    if (grid && imgs.ig_refs_b64 && imgs.ig_refs_b64.length) {
      grid.innerHTML = imgs.ig_refs_b64.map(function(r, i) {
        return '<div class="bk-igref-item"><img class="bk-igref-img" src="' + imgB64Src(r) + '" alt="Post IG ref ' + (i+1) + '"><div class="bk-igref-cap">Post de referencia ' + (i+1) + '</div></div>';
      }).join('');
      // Mostra il blocco se era nascosto
      var block = document.querySelector('.bk-block-igrefs');
      if (block) block.style.display = '';
    }
    // Aggiorna slot refs
    imgs.ig_refs_b64.forEach(function(r, i) {
      var slot = document.getElementById('bk-vis-ref-' + i);
      if (slot) slot.innerHTML = '<img src="' + imgB64Src(r) + '" style="width:100%;height:100%;object-fit:cover">';
    });
  });
}

function renderStudioKPIBanner(kpiData) {
  if (!kpiData) return '';
  var ac = kpiData.active_clients || 0;
  var pm = kpiData.published_month || 0;
  var ae = (kpiData.avg_engagement || 0).toFixed(1);
  var pa = kpiData.pending_approval || 0;
  return '<div class="studio-kpi-banner" style="background:#1a1a1a;color:#fff;padding:1.5rem;border-radius:6px;margin:0 0 1rem 0">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1rem">' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + ac + '</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Clientes activos</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + pm + '</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Publicados este mes</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + ae + '%</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Engagement promedio</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + pa + '</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Pendientes de aprobación</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderClientePageBody(c, color, initials, projsHtml, contentHtml, bk, projsCount, contentCount) {
  var logoSidebar = '<div id="cliente-page-logo" class="cliente-info-logo" style="background:' + color + ';overflow:hidden">' + initials + '</div>';

  var brandKitHtml = renderBrandKitSection(bk);
  var placeholder = function(icon, label) {
    return '<div class="ctab-placeholder">' + icon + ' <strong>' + label + '</strong> — próximamente</div>';
  };

  var tab = _clienteActiveTab || 'proyectos';

  var tabs8 = [
    { id:'briefing',   label:'📄 Briefing',  badge: 0 },
    { id:'proyectos',  label:'▦ Proyectos',  badge: projsCount||0 },
    { id:'estrategia', label:'◎ Estrategia', badge: 0 },
    { id:'agenti',     label:'🤖 Agenti',    badge: 0 },
    { id:'contenido',  label:'★ Contenido',  badge: contentCount||0 },
    { id:'calendario', label:'◷ Calendario', badge: 0 },
    { id:'brandkit',   label:'◈ Brand Kit',  badge: 0 },
    { id:'perfil',     label:'◈ Perfil',     badge: 0 },
    { id:'equipo',     label:'◉ Equipo',     badge: 0 },
    { id:'assets',     label:'🖼️ Assets',    badge: 0 },
    { id:'metricas',   label:'▲ Métricas',   badge: 0 },
    { id:'social',     label:'📡 Social',    badge: 0 }
  ];

  var tabBtns = tabs8.map(function(t) {
    var badgeHtml = t.badge ? ' <span class="ctab-badge">' + t.badge + '</span>' : '';
    return '<button class="ctab-btn' + (tab===t.id?' active':'') + '" data-tab="' + t.id + '" onclick="switchClienteTab(\'' + t.id + '\')">' + t.label + badgeHtml + '</button>';
  }).join('');

  var panels = {
    proyectos:  renderProyectosSection(c && c.id),
    contenido:  '<div class="cliente-section"><div class="cliente-section-body">' + contentHtml + '</div></div>',
    brandkit:   brandKitHtml || '<div class="ctab-placeholder">⏳ Cargando Brand Kit…</div>',
    briefing:   renderBriefingSection(c && c.id),
    agenti:     renderAgentiSection(c && c.id, c && c.client_key, c && c.name),
    estrategia: renderEstrategiaSection(c && c.id),
    perfil:     renderPerfilSection(c && c.id),
    calendario: renderCalendarioSection(c && c.id),
    equipo:     renderClienteEquipoSection(c && c.id, c && c.client_key),
    assets:     renderAssetsSection(c && c.id),
    metricas:   renderMetricasSection(c && c.id),
    social:     renderSocialSection(c && c.id)
  };

  var clientId = c && c.id;
  var panelsHtml = tabs8.map(function(t) {
    var extraAttr = (t.id === 'calendario' && clientId) ? ' data-client-id="' + clientId + '"' : '';
    return '<div class="ctab-panel" data-tab="' + t.id + '"' + extraAttr + ' style="' + (tab===t.id?'':'display:none') + '">' + panels[t.id] + '</div>';
  }).join('');

  var kpiBanner = (c.is_self === true)
    ? '<div id="studio-kpi-banner" style="padding:0 1rem;margin-bottom:1rem">⏳ Cargando KPI…</div>'
    : '';

  document.getElementById('clientePageBody').innerHTML =
    '<div class="cliente-info-card">' +
      logoSidebar +
      '<div class="cliente-info-name">' + (c.name||'') + '</div>' +
      '<div class="cliente-info-sector">' + (c.sector||'') + '</div>' +
      (c.city     ? '<div class="cliente-info-row">&#128205; ' + c.city + '</div>' : '') +
      (c.address  ? '<div class="cliente-info-row">&#127968; ' + c.address + '</div>' : '') +
      (c.phone    ? '<div class="cliente-info-row">&#128222; ' + c.phone + '</div>' : '') +
      (c.website  ? '<div class="cliente-info-row">&#127760; <a href="https://' + c.website + '" target="_blank" style="color:var(--accent)">' + c.website + '</a></div>' : '') +
      (c.instagram? '<div class="cliente-info-row">&#64; ' + c.instagram + '</div>' : '') +
      (c.description ? '<div class="cliente-info-desc">' + c.description + '</div>' : '') +
      '<div class="ctab-bar">' + tabBtns + '</div>' +
    '</div>' +
    '<div class="cliente-main-col">' +
      kpiBanner +
      panelsHtml +
    '</div>';
}

// ── PROYECTOS PROPUESTOS ──────────────────────────────────────────
var _cprojFilter     = 'todos';
var _cprojMonthFilter= 'todos';   // filtro mese target
var _cprojSort       = 'default'; // 'default' | 'priority' | 'month' | 'category'
var _cprojSelected   = {};        // { projectId: true } — checkbox selezione
var _programarState  = { clientId: null, projectId: null, category: null, title: '' };
var _programarTasks       = [];   // tareas del breakdown en edición
var _programarExpandedIdx = null; // índice tarea expandida (-1 = ninguna)
var _clientTasksCache     = {};   // { clientId: [task, ...] } — cargadas para Gantt
var _editingProjId   = null;

function renderProyectosSection(clientId) {
  if (!clientId) return '<div class="cproj-empty">Sin cliente</div>';

  var projects = _clientProjects[clientId];

  // No cargados aún → disparar carga
  if (projects === undefined) {
    _loadClientProjects(clientId);
    return '<div class="cproj-loading">⏳ Cargando proyectos…</div>';
  }

  // null → no hay datos en Supabase aún
  if (projects === null || projects.length === 0) {
    return '<div class="cproj-empty">' +
      '◈ No hay proyectos propuestos para este cliente.<br>' +
      '<span style="font-size:0.72rem;color:var(--muted2)">Sube el briefing y extrae los proyectos automáticamente.</span><br><br>' +
      '<button class="cproj-extract-btn" onclick="extractClientProjects(\'' + clientId + '\')">🧠 Regenerar con Opus</button>' +
    '</div>';
  }

  var cats = ['todos','CONTENIDO','PUBLICIDAD','ALIANZAS','SEO_LOCAL','CONVERSION','CAMPANA'];
  var catLabels = { todos:'Todos', CONTENIDO:'Contenido', PUBLICIDAD:'Publicidad', ALIANZAS:'Alianzas', SEO_LOCAL:'SEO Local', CONVERSION:'Conversión', CAMPANA:'Campaña' };

  // ── KPI Banner ──────────────────────────────────────────────────────────────
  var totalCount     = projects.length;
  var approvedCount  = projects.filter(function(p){ return p.status !== 'rechazado' && p.status !== 'propuesto'; }).length;
  var sinAsignar     = projects.filter(function(p){ return !p.assigned_to && p.status !== 'rechazado'; }).length;
  var enProgreso     = projects.filter(function(p){ return p.status === 'en_progreso'; }).length;
  var completados    = projects.filter(function(p){ return p.status === 'completado'; }).length;
  var kpiBanner =
    '<div class="cproj-kpi-bar">' +
      '<span class="cproj-kpi-chip">📋 <strong>' + totalCount + '</strong> proyectos</span>' +
      '<span class="cproj-kpi-chip cproj-kpi-green">✓ <strong>' + approvedCount + '</strong> activos</span>' +
      (sinAsignar > 0 ? '<span class="cproj-kpi-chip cproj-kpi-warn">⚠ <strong>' + sinAsignar + '</strong> sin asignar</span>' : '') +
      (enProgreso > 0 ? '<span class="cproj-kpi-chip cproj-kpi-blue">▶ <strong>' + enProgreso + '</strong> en progreso</span>' : '') +
      (completados > 0 ? '<span class="cproj-kpi-chip cproj-kpi-muted">✔ <strong>' + completados + '</strong> completados</span>' : '') +
      '<button class="cproj-extract-btn" style="margin-left:auto;font-size:0.7rem;padding:0.3rem 0.8rem" onclick="extractClientProjects(\'' + clientId + '\')" title="Regenerar proyectos desde el briefing">🧠 Regenerar con Opus</button>' +
    '</div>';

  // ── Filtro mesi disponibili ─────────────────────────────────────────────────
  var months = ['todos'];
  projects.forEach(function(p){ if(p.month_target && months.indexOf(p.month_target)===-1) months.push(p.month_target); });

  // ── Filter bar categoria ────────────────────────────────────────────────────
  var filterBar =
    '<div class="cproj-filter-bar">' +
      cats.map(function(c) {
        var count = c === 'todos' ? projects.length : projects.filter(function(p){ return p.category === c; }).length;
        if (c !== 'todos' && count === 0) return '';
        return '<button class="cproj-filter-btn' + (_cprojFilter===c?' active':'') + '" onclick="cprojSetFilter(\'' + clientId + '\',\'' + c + '\')">' + catLabels[c] + (count?' ('+count+')':'') + '</button>';
      }).join('') +
    '</div>' +

    // Filtro mese + sort + select-all
    '<div class="cproj-toolbar">' +
      '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">' +
        '<span style="font-size:0.7rem;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Mes:</span>' +
        months.map(function(m){
          return '<button class="cproj-filter-btn' + (_cprojMonthFilter===m?' active':'') + '" style="font-size:0.7rem" onclick="cprojSetMonthFilter(\'' + clientId + '\',\'' + m + '\')">' + (m==='todos'?'Todos':m) + '</button>';
        }).join('') +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;align-items:center">' +
        '<span style="font-size:0.7rem;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Orden:</span>' +
        '<select class="cproj-sort-select" onchange="cprojSetSort(\'' + clientId + '\',this.value)">' +
          '<option value="default"' + (_cprojSort==='default'?' selected':'') + '>Por defecto</option>' +
          '<option value="priority"' + (_cprojSort==='priority'?' selected':'') + '>Prioridad</option>' +
          '<option value="month"'   + (_cprojSort==='month'   ?' selected':'') + '>Mes objetivo</option>' +
          '<option value="category"'+(_cprojSort==='category'?' selected':'') + '>Categoría</option>' +
        '</select>' +
        '<button class="cproj-filter-btn" style="font-size:0.7rem" onclick="cprojSelectAll(\'' + clientId + '\')">' +
          (Object.keys(_cprojSelected).length > 0 ? '☑ Deseleccionar todo' : '☐ Seleccionar todo') +
        '</button>' +
      '</div>' +
    '</div>';

  // ── Filtra e ordina visible ─────────────────────────────────────────────────
  var visible = projects.filter(function(p){
    var catOk   = _cprojFilter      === 'todos' || p.category    === _cprojFilter;
    var monthOk = _cprojMonthFilter === 'todos' || p.month_target === _cprojMonthFilter;
    return catOk && monthOk;
  });

  var PRIORITY_ORDER = { alta:0, media:1, baja:2 };
  if (_cprojSort === 'priority') {
    visible = visible.slice().sort(function(a,b){ return (PRIORITY_ORDER[a.priority]||1)-(PRIORITY_ORDER[b.priority]||1); });
  } else if (_cprojSort === 'month') {
    visible = visible.slice().sort(function(a,b){ return (a.month_target||'zzz').localeCompare(b.month_target||'zzz'); });
  } else if (_cprojSort === 'category') {
    visible = visible.slice().sort(function(a,b){ return (a.category||'').localeCompare(b.category||''); });
  }

  // ── Toolbar acciones masivas (appare solo se ci sono selezioni) ─────────────
  var selIds = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  var bulkBar = selIds.length > 0
    ? '<div class="cproj-bulk-bar">' +
        '<span class="cproj-bulk-count">' + selIds.length + ' seleccionado' + (selIds.length!==1?'s':'') + '</span>' +
        '<button class="cproj-bulk-btn cproj-bulk-approve" onclick="bulkApprove(\'' + clientId + '\')">✓ Aprobar seleccionados</button>' +
        '<button class="cproj-bulk-btn cproj-bulk-reject"  onclick="bulkReject(\'' + clientId + '\')">✗ Rechazar seleccionados</button>' +
        '<button class="cproj-bulk-btn" onclick="bulkClear(\'' + clientId + '\')">Limpiar selección</button>' +
      '</div>'
    : '';

  var approvedForPDF = projects.filter(function(p){ return p.status !== 'rechazado'; }).length;
  var header = '<div class="cproj-header">' +
    kpiBanner +
    '<div style="display:flex;gap:0.4rem;flex-shrink:0">' +
      (approvedForPDF > 0
        ? '<button class="cproj-extract-btn" style="background:#1a1a2e;color:#a78bfa;border-color:#4c1d95" onclick="exportProyectosPDF(\'' + clientId + '\')">📄 Exportar PDF</button>'
        : '') +
      '<button class="cproj-extract-btn" onclick="extractClientProjects(\'' + clientId + '\')">↺ Re-extraer</button>' +
    '</div>' +
  '</div>';

  // Workflow stati in ordine
  var ESTADO_FLOW = ['propuesto','aprobado','planificado','en_progreso','en_revision','completado'];
  var ESTADO_LABELS = {
    propuesto:   'Propuesto',
    aprobado:    '✓ Aprobado',
    planificado: '📅 Planificado',
    en_progreso: '▶ En progreso',
    en_revision: '👁 En revisión',
    completado:  '✔ Completado',
    rechazado:   '✗ Rechazado'
  };
  var ESTADO_COLORS = {
    propuesto:   '#888',
    aprobado:    '#1a8a1e',
    planificado: '#1a6fa8',
    en_progreso: '#d97706',
    en_revision: '#7c3aed',
    completado:  '#374151',
    rechazado:   '#cc2222'
  };
  var ESTADO_BG = {
    propuesto:   '#f0f0f0',
    aprobado:    '#e8fde9',
    planificado: '#e8f4fd',
    en_progreso: '#fef3c7',
    en_revision: '#ede9fe',
    completado:  '#f3f4f6',
    rechazado:   '#fde8e8'
  };
  // Progress % per la barra
  var ESTADO_PCT = { propuesto:0, aprobado:10, planificado:30, en_progreso:60, en_revision:85, completado:100, rechazado:0 };

  var CAT_OPTIONS = ['CONTENIDO','PUBLICIDAD','ALIANZAS','SEO_LOCAL','CONVERSION','CAMPANA'];

  var cards = visible.map(function(p) {
    var status    = p.status || 'propuesto';
    var isRejected  = status === 'rechazado';
    var isCompleted = status === 'completado';
    var isApproved  = !isRejected && status !== 'propuesto';
    var catCls = 'cproj-cat-' + (p.category || 'CONTENIDO');
    var priCls = 'cproj-priority-' + (p.priority || 'media');

    // ── MODALITÀ EDIT INLINE ──────────────────────────────────────────────────
    if (_editingProjId === p.id) {
      var catOpts = CAT_OPTIONS.map(function(c) {
        return '<option value="' + c + '"' + (p.category===c?' selected':'') + '>' + (catLabels[c]||c) + '</option>';
      }).join('');
      return '<div class="cproj-card cproj-card-editing ' + priCls + '">' +
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin-bottom:0.75rem">✏️ Editando proyecto</div>' +
        '<div class="cproj-edit-group">' +
          '<label class="cproj-edit-label">Título</label>' +
          '<input class="cproj-edit-input" id="edit-title-' + p.id + '" value="' + (p.title||'').replace(/"/g,'&quot;') + '">' +
        '</div>' +
        '<div class="cproj-edit-group">' +
          '<label class="cproj-edit-label">Descripción</label>' +
          '<textarea class="cproj-edit-textarea" id="edit-desc-' + p.id + '">' + (p.description||'') + '</textarea>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Categoría</label>' +
            '<select class="cproj-edit-select" id="edit-cat-' + p.id + '">' + catOpts + '</select>' +
          '</div>' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Mes objetivo</label>' +
            '<input class="cproj-edit-input" id="edit-month-' + p.id + '" value="' + (p.month_target||'') + '" placeholder="ej: Mayo 2026">' +
          '</div>' +
        '</div>' +
        '<div class="cproj-edit-group">' +
          '<label class="cproj-edit-label">Entregable</label>' +
          '<input class="cproj-edit-input" id="edit-deliverable-' + p.id + '" value="' + (p.deliverable||'').replace(/"/g,'&quot;') + '">' +
        '</div>' +
        '<div class="cproj-actions" style="margin-top:0.75rem">' +
          '<button class="cproj-btn cproj-btn-approve" onclick="saveEditProject(\'' + clientId + '\',\'' + p.id + '\')">💾 Guardar</button>' +
          '<button class="cproj-btn cproj-btn-undo" onclick="cancelEditProject(\'' + clientId + '\')">Cancelar</button>' +
        '</div>' +
      '</div>';
    }
    // ─────────────────────────────────────────────────────────────────────────

    var isProgrammed = isApproved && p.start_date;
    var programBadge = '';
    if (isProgrammed) {
      var fmt = function(d) { var x = new Date(d); return x.getDate()+'/'+(x.getMonth()+1)+'/'+x.getFullYear(); };
      var assignBadge = p.assigned_to ? ' · <span style="font-weight:700">'+p.assigned_to.split(' ')[0]+'</span>' : '';
      programBadge = '<div class="cproj-schedule-badge">📅 ' + fmt(p.start_date) + ' → ' + fmt(p.end_date||p.start_date) + assignBadge + '</div>';
    }

    // Badge stato + progress bar
    var stCol = ESTADO_COLORS[status] || '#888';
    var stBg  = ESTADO_BG[status]    || '#f0f0f0';
    var pct   = ESTADO_PCT[status]   || 0;
    var estadoBadge = '<div class="cproj-estado-badge" style="color:'+stCol+';background:'+stBg+'">' + (ESTADO_LABELS[status]||status) + '</div>';
    var progressBar = !isRejected
      ? '<div class="cproj-progress-track"><div class="cproj-progress-fill" style="width:'+pct+'%;background:'+stCol+'"></div></div>'
      : '';

    // Bottone avanza stato (→ prossimo step)
    var curIdx  = ESTADO_FLOW.indexOf(status);
    var nextSt  = (curIdx >= 0 && curIdx < ESTADO_FLOW.length - 1) ? ESTADO_FLOW[curIdx + 1] : null;
    var advBtn  = (nextSt && !isRejected)
      ? '<button class="cproj-btn cproj-btn-advance" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'' + nextSt + '\')" title="Avanzar a: ' + (ESTADO_LABELS[nextSt]||nextSt) + '">→</button>'
      : '';

    var isContentCat = CAT_CONTENT.indexOf(p.category) !== -1;

    var actions = isRejected
      ? '<button class="cproj-btn cproj-btn-undo" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'propuesto\')">Recuperar</button>'
      : status === 'propuesto'
        ? '<button class="cproj-btn cproj-btn-approve" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'aprobado\')">✓ Aprobar</button>' +
          '<button class="cproj-btn cproj-btn-reject"  onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'rechazado\')">✗ Rechazar</button>' +
          '<button class="cproj-btn cproj-btn-edit" onclick="startEditProject(\'' + clientId + '\',\'' + p.id + '\')" title="Editar antes de aprobar">✏️</button>'
        : estadoBadge +
          (isApproved && !isCompleted
            ? '<button class="cproj-btn cproj-btn-program" onclick="openProgramarModal(\'' + clientId + '\',\'' + p.id + '\',\'' + (p.category||'') + '\')">' +
                (isProgrammed ? '✏️ Editar fecha' : '📅 Programar') +
              '</button>'
            : '') +
          (isContentCat && !isCompleted
            ? '<button class="cproj-btn" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;font-weight:700" onclick="event.stopPropagation();openPlanSuggest(\'' + clientId + '\',\'' + p.id + '\')" title="Generar plan con Opus">✦ Plan</button>'
            : '') +
          advBtn +
          '<button class="cproj-btn cproj-btn-edit" onclick="startEditProject(\'' + clientId + '\',\'' + p.id + '\')" title="Editar proyecto">✏️</button>' +
          '<button class="cproj-btn cproj-btn-undo" style="font-size:0.65rem" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'propuesto\')">↩</button>';

    // Avatar responsabile (angolo in alto a destra)
    var aInfo = p.assigned_to ? { i: _teamInitialsFor(p.assigned_to), c: _teamColorFor(p.assigned_to) } : null;
    var avatarEl = aInfo
      ? '<div class="cproj-avatar" style="background:'+aInfo.c+'" title="'+p.assigned_to+'">'+aInfo.i+'</div>'
      : (isApproved && !isCompleted && !isRejected
          ? '<button class="cproj-avatar cproj-avatar-empty" onclick="openProgramarModal(\''+clientId+'\',\''+p.id+'\',\''+(p.category||'')+'\''+')" title="Asignar responsable">+</button>'
          : '');

    var isSel = !!_cprojSelected[p.id];
    var checkboxEl = !isRejected
      ? '<input type="checkbox" class="cproj-checkbox"' + (isSel?' checked':'') +
          ' onchange="cprojToggleSelect(\'' + p.id + '\',\'' + clientId + '\')">'
      : '';

    return '<div class="cproj-card ' + priCls + (isRejected?' rechazado':'') + (isProgrammed?' programado':'') + (isCompleted?' completado':'') + (isSel?' selected':'') + '" onclick="cprojToggleExpand(this)" style="cursor:pointer">' +
      '<div class="cproj-card-top">' +
        checkboxEl +
        '<span class="cproj-cat-badge ' + catCls + '">' + (catLabels[p.category] || p.category) + '</span>' +
        '<div class="cproj-title">' + (p.title||'') + '</div>' +
        avatarEl +
      '</div>' +
      progressBar +
      '<div class="cproj-desc">' + (p.description||'') + '</div>' +
      '<div class="cproj-meta-row">' +
        (p.month_target ? '<span>📅 ' + p.month_target + '</span>' : '') +
        (p.deliverable  ? '<span>📦 ' + p.deliverable + '</span>' : '') +
      '</div>' +
      (p.why ? '<div class="cproj-why">💬 ' + p.why + '</div>' : '') +
      programBadge +
      '<div class="cproj-actions">' + actions + '</div>' +
      (_sprintPickerOpen === p.id ? _renderSprintPicker(clientId, p) : '') +
    '</div>';
  }).join('');

  // ── Inline Programar Panel 2.0 ───────────────────────────────────────────────
  var inlinePanel = '';
  if (_programarState.projectId && _programarState.clientId === clientId) {
    var ps = _programarState;
    var psArr = _clientProjects[clientId];
    var psProj = psArr ? psArr.find(function(x){ return x.id === ps.projectId; }) : null;
    var psSugg = (_catDefaultAssign && _catDefaultAssign[ps.category]) || '';
    var psStart = psProj && psProj.start_date  ? psProj.start_date  : '';
    var psEnd   = psProj && psProj.end_date    ? psProj.end_date    : '';
    var psAss   = psProj && psProj.assigned_to ? psProj.assigned_to : psSugg;
    var psBudg  = psProj && psProj.budget_eur  ? psProj.budget_eur  : '';
    var psShowBudget = ps.category === 'PUBLICIDAD';

    var roleEmoji = { estrategia:'🧠', copy:'✍️', diseño:'🎨', video:'🎬', ads:'📣', publicación:'📤', reporting:'📊', gestión:'📋' };
    var tasksHtml = _programarTasks.length
      ? _programarTasks.map(function(t, i) {
          var col = _teamColorFor(t.assigned_to);
          return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.6rem;background:var(--bg);border-radius:8px;border:1px solid var(--border)">' +
            '<span style="font-size:0.85rem">' + (roleEmoji[t.role] || '📌') + '</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:0.75rem;font-weight:600;color:var(--text)">' + t.title + '</div>' +
              '<div style="font-size:0.68rem;color:' + col + ';margin-top:0.1rem">' + (t.assigned_to || 'Sin asignar') + ' · ' + (t.role || '') + '</div>' +
            '</div>' +
            '<div style="font-size:0.65rem;color:var(--muted2);white-space:nowrap">' + (t.start_date || '') + (t.end_date && t.end_date !== t.start_date ? ' → ' + t.end_date : '') + '</div>' +
            '<button onclick="programarRemoveTask(' + i + ')" style="background:none;border:none;cursor:pointer;color:var(--muted2);font-size:1rem;padding:0 0.2rem;flex-shrink:0">×</button>' +
          '</div>';
        }).join('')
      : '<div style="font-size:0.73rem;color:var(--muted2);text-align:center;padding:0.8rem">Sin tareas asignadas — usa "Sugerir con IA" o añade manualmente</div>';

    inlinePanel =
      '<div class="cproj-inline-panel">' +
        '<div class="cproj-inline-panel-head">' +
          '<span>📅 Programar: <strong>' + (ps.title || 'Proyecto') + '</strong></span>' +
          '<button onclick="closeProgramarModal()" style="background:none;border:none;font-size:1.4rem;line-height:1;cursor:pointer;color:var(--muted2);padding:0">×</button>' +
        '</div>' +
        '<div class="cproj-inline-panel-body">' +

          // ── Bloque 1: Fechas y responsable principal
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem">' +
            '<div class="cproj-edit-group" style="margin:0">' +
              '<label class="cproj-edit-label">Fecha inicio *</label>' +
              '<input type="date" class="cproj-edit-input" id="progInlineStart" value="' + psStart + '">' +
            '</div>' +
            '<div class="cproj-edit-group" style="margin:0">' +
              '<label class="cproj-edit-label">Fecha fin</label>' +
              '<input type="date" class="cproj-edit-input" id="progInlineEnd" value="' + psEnd + '">' +
            '</div>' +
          '</div>' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Responsable principal (project owner)</label>' +
            '<select class="cproj-edit-input" id="progInlineAssign">' +
              '<option value="">Sin asignar</option>' +
              _teamMembers.filter(function(m){ return m.employment_type !== 'agent'; }).map(function(m){
                return '<option value="' + m.name + '"' + (psAss===m.name?' selected':'') + '>' + m.name + ' — ' + m.role + '</option>';
              }).join('') +
              '<optgroup label="Agentes AI">' +
              _teamMembers.filter(function(m){ return m.employment_type === 'agent'; }).map(function(m){
                return '<option value="' + m.name + '"' + (psAss===m.name?' selected':'') + '>🤖 ' + m.name + '</option>';
              }).join('') +
              '</optgroup>' +
            '</select>' +
          '</div>' +
          (psShowBudget
            ? '<div class="cproj-edit-group">' +
                '<label class="cproj-edit-label">Presupuesto (€)</label>' +
                '<input type="number" class="cproj-edit-input" id="progInlineBudget" value="' + psBudg + '" min="0" step="100">' +
              '</div>'
            : '<input type="hidden" id="progInlineBudget" value="">') +

          // ── Bloque 2: Tareas del equipo
          '<div style="margin-top:1rem">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">' +
              '<label class="cproj-edit-label" style="margin:0">Tareas del equipo</label>' +
              '<div style="display:flex;gap:0.4rem">' +
                '<button id="progAiBtn" onclick="programarSuggestAI()" style="font-size:0.68rem;padding:0.28rem 0.65rem;background:none;border:1px dashed var(--border2);border-radius:6px;cursor:pointer;color:var(--muted);display:flex;align-items:center;gap:0.3rem">✦ Sugerir con IA</button>' +
                '<button onclick="programarAddTaskRow()" style="font-size:0.68rem;padding:0.28rem 0.65rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text)">+ Añadir</button>' +
              '</div>' +
            '</div>' +
            '<div id="progTasksList" style="display:flex;flex-direction:column;gap:0.35rem">' + tasksHtml + '</div>' +
          '</div>' +

        '</div>' +
        '<div class="cproj-inline-panel-foot">' +
          '<button class="btn btn-ghost" onclick="closeProgramarModal()">Cancelar</button>' +
          '<button class="btn btn-acc" onclick="saveProgramar()">💾 Guardar</button>' +
        '</div>' +
      '</div>';
  }

  return header + inlinePanel + filterBar + bulkBar + '<div class="cproj-grid">' + cards + '</div>';
}

function cprojSetFilter(clientId, filter) {
  _cprojFilter = filter;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojSetMonthFilter(clientId, month) {
  _cprojMonthFilter = month;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojSetSort(clientId, sort) {
  _cprojSort = sort;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojToggleExpand(cardEl) {
  // Ignora click su bottoni e input dentro la card
  if (event && event.target && (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT')) return;
  cardEl.classList.toggle('cproj-card-expanded');
}

function cprojToggleSelect(projectId, clientId) {
  _cprojSelected[projectId] = !_cprojSelected[projectId];
  if (!_cprojSelected[projectId]) delete _cprojSelected[projectId];
  // Aggiorna solo la bulk bar e i checkbox senza re-render completo
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojSelectAll(clientId) {
  var projects = _clientProjects[clientId] || [];
  var selIds = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  if (selIds.length > 0) {
    // Deseleziona tutto
    _cprojSelected = {};
  } else {
    // Seleziona tutti non rifiutati
    projects.forEach(function(p){
      if (p.status !== 'rechazado') _cprojSelected[p.id] = true;
    });
  }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function bulkApprove(clientId) {
  var ids = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  if (!ids.length) return;
  var arr = _clientProjects[clientId] || [];
  await Promise.all(ids.map(function(id) {
    var proj = arr.find(function(x){ return x.id === id; });
    if (proj && proj.status === 'propuesto') {
      proj.status = 'aprobado';
      return fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(id), {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status: 'aprobado' })
      });
    }
    return Promise.resolve();
  }));
  _cprojSelected = {};
  showToast('✅ ' + ids.length + ' proyectos aprobados');
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function bulkReject(clientId) {
  var ids = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  if (!ids.length) return;
  var arr = _clientProjects[clientId] || [];
  await Promise.all(ids.map(function(id) {
    var proj = arr.find(function(x){ return x.id === id; });
    if (proj) {
      proj.status = 'rechazado';
      return fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(id), {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status: 'rechazado' })
      });
    }
    return Promise.resolve();
  }));
  _cprojSelected = {};
  showToast('✗ ' + ids.length + ' proyectos rechazados');
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function bulkClear(clientId) {
  _cprojSelected = {};
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

// ── EXPORT PROPUESTA PDF ──────────────────────────────────────────────────────

function exportProyectosPDF(clientId) {
  var projects = (_clientProjects[clientId] || []).filter(function(p){ return p.status !== 'rechazado'; });
  if (!projects.length) { showToast('No hay proyectos para exportar'); return; }

  // Dati cliente
  var c = CLIENTS_DATA.find(function(x){ return x.id === clientId; }) || {};
  var clientName   = c.name   || 'Cliente';
  var clientSector = c.sector || '';
  var today = new Date();
  var dateStr = today.getDate() + '/' + (today.getMonth()+1) + '/' + today.getFullYear();

  var CAT_COLORS_PDF = {
    CONTENIDO:'#1a6fa8', PUBLICIDAD:'#a81a6f', ALIANZAS:'#1a8a1e',
    SEO_LOCAL:'#a87c1a', CONVERSION:'#6f1aa8', CAMPANA:'#a81a1a'
  };
  var CAT_LABELS_PDF = {
    CONTENIDO:'Contenido', PUBLICIDAD:'Publicidad', ALIANZAS:'Alianzas',
    SEO_LOCAL:'SEO Local', CONVERSION:'Conversión', CAMPANA:'Campaña'
  };
  var STATUS_LABELS_PDF = {
    propuesto:'Propuesto', aprobado:'Aprobado', planificado:'Planificado',
    en_progreso:'En progreso', en_revision:'En revisión', completado:'Completado'
  };

  // Raggruppa per categoria
  var byCategory = {};
  projects.forEach(function(p){
    var cat = p.category || 'CONTENIDO';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });

  var categorySections = Object.keys(byCategory).map(function(cat) {
    var col = CAT_COLORS_PDF[cat] || '#555';
    var lbl = CAT_LABELS_PDF[cat] || cat;
    var rows = byCategory[cat].map(function(p, i) {
      var bgRow = i % 2 === 0 ? '#fff' : '#f9f8f6';
      var statusLabel = STATUS_LABELS_PDF[p.status] || p.status || '';
      return '<tr style="background:' + bgRow + '">' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;color:#1a1a1a">' + (p.title||'') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;line-height:1.5">' + (p.description||'—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;white-space:nowrap">' + (p.deliverable||'—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;white-space:nowrap">' + (p.month_target||'—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888;white-space:nowrap">' + statusLabel + '</td>' +
        (p.budget_eur ? '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;white-space:nowrap">€' + p.budget_eur + '</td>' : '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#ccc">—</td>') +
      '</tr>';
    }).join('');

    return '<div style="margin-bottom:28px">' +
      '<div style="background:' + col + ';color:#fff;padding:7px 14px;border-radius:6px 6px 0 0;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase">' + lbl + ' — ' + byCategory[cat].length + ' proyecto' + (byCategory[cat].length!==1?'s':'') + '</div>' +
      '<table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">' +
        '<thead>' +
          '<tr style="background:#f5f3ef">' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Proyecto</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Descripción</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Entregable</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Mes</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Estado</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Presup.</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  }).join('');

  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<title>Propuesta — ' + clientName + '</title>' +
    '<style>' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin:0; padding:0; color:#1a1a1a; background:#fff; }' +
      '.page { max-width:900px; margin:0 auto; padding:40px 48px; }' +
      '.header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #C0392B; margin-bottom:32px; }' +
      '.brand { font-size:22px; font-weight:900; letter-spacing:0.08em; color:#1a1a1a; }' +
      '.brand span { color:#C0392B; }' +
      '.brand-sub { font-size:11px; color:#888; margin-top:3px; letter-spacing:0.06em; }' +
      '.client-block { text-align:right; }' +
      '.client-name { font-size:20px; font-weight:800; color:#1a1a1a; }' +
      '.client-sector { font-size:12px; color:#888; margin-top:2px; }' +
      '.client-date { font-size:11px; color:#aaa; margin-top:4px; }' +
      '.intro { background:#f5f3ef; border-radius:8px; padding:16px 20px; margin-bottom:32px; font-size:13px; color:#555; line-height:1.6; }' +
      '.intro strong { color:#1a1a1a; }' +
      '.summary { display:flex; gap:12px; margin-bottom:32px; }' +
      '.summary-chip { flex:1; background:#f5f3ef; border-radius:8px; padding:12px 16px; text-align:center; }' +
      '.summary-chip .num { font-size:24px; font-weight:900; color:#C0392B; }' +
      '.summary-chip .lbl { font-size:11px; color:#888; margin-top:2px; text-transform:uppercase; letter-spacing:0.06em; }' +
      '.footer { margin-top:40px; padding-top:20px; border-top:1px solid #eee; display:flex; justify-content:space-between; align-items:center; }' +
      '.footer-brand { font-size:12px; font-weight:800; color:#C0392B; letter-spacing:0.08em; }' +
      '.footer-note { font-size:11px; color:#aaa; }' +
      '.print-btn { position:fixed; bottom:24px; right:24px; background:#C0392B; color:#fff; border:none; border-radius:10px; padding:12px 24px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 4px 20px rgba(192,57,43,0.4); z-index:9999; }' +
      '.print-btn:hover { background:#a93226; }' +
      '@media print { .print-btn { display:none; } body { padding:0; } .page { padding:20px 28px; } }' +
    '</style></head><body>' +
    '<button class="print-btn" onclick="window.print()">🖨 Exportar PDF</button>' +
    '<div class="page">' +
      '<div class="header">' +
        '<div>' +
          '<div class="brand">BRAVO<span>!</span>COMUNICA</div>' +
          '<div class="brand-sub">Propuesta de proyectos</div>' +
        '</div>' +
        '<div class="client-block">' +
          '<div class="client-name">' + clientName + '</div>' +
          (clientSector ? '<div class="client-sector">' + clientSector + '</div>' : '') +
          '<div class="client-date">Fecha: ' + dateStr + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="intro">Este documento recoge los <strong>' + projects.length + ' proyectos</strong> propuestos por BRAVO!COMUNICA para <strong>' + clientName + '</strong>. Cada proyecto incluye descripción, entregable y mes objetivo estimado. Queda pendiente de revisión y aprobación por parte del cliente.</div>' +
      '<div class="summary">' +
        '<div class="summary-chip"><div class="num">' + projects.length + '</div><div class="lbl">Total proyectos</div></div>' +
        '<div class="summary-chip"><div class="num">' + projects.filter(function(p){return p.status==='aprobado'||p.status==='planificado'||p.status==='en_progreso';}).length + '</div><div class="lbl">En ejecución</div></div>' +
        '<div class="summary-chip"><div class="num">' + Object.keys(byCategory).length + '</div><div class="lbl">Áreas de trabajo</div></div>' +
        '<div class="summary-chip"><div class="num">' + projects.filter(function(p){return p.budget_eur;}).reduce(function(s,p){return s+(p.budget_eur||0);},0) + '€</div><div class="lbl">Presupuesto total</div></div>' +
      '</div>' +
      categorySections +
      '<div class="footer">' +
        '<div class="footer-brand">BRAVO!COMUNICA</div>' +
        '<div class="footer-note">Documento generado el ' + dateStr + ' · Confidencial</div>' +
      '</div>' +
    '</div>' +
    '<script>setTimeout(function(){ window.print(); }, 600);<\/script>' +
  '</body></html>';

  var win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('⚠ Activa las ventanas emergentes para exportar el PDF');
  }
}

async function _loadClientProjects(clientId) {
  try {
    var res = await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(clientId));
    var data = await res.json();
    _clientProjects[clientId] = (data.projects && data.projects.length) ? data.projects : null;
  } catch(e) {
    _clientProjects[clientId] = null;
  }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function extractClientProjects(clientId) {
  if (!confirm('¿Regenerar los proyectos con Opus?\nOpus leerá el briefing completo y tardará ~60 segundos.')) return;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = '<div class="cproj-loading">🧠 Opus está analizando el briefing… (~60 seg)<br><span style="font-size:0.75rem;color:#aaa">La página se actualizará automáticamente</span></div>';
  try {
    await fetch(AGENT_API + '/api/briefing/extract-projects/' + encodeURIComponent(clientId), { method: 'POST' });
  } catch(e) { /* backend risponde subito, errori di rete sono rari */ }
  // Attende che Opus finisca in background, poi ricarica
  setTimeout(function() {
    _clientProjects[clientId] = undefined;
    _loadClientProjects(clientId);
  }, 65000);
}

async function advanceProjectStatus(clientId, projectId, newStatus) {
  await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(projectId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  var arr = _clientProjects[clientId];
  if (arr) { var p = arr.find(function(x){ return x.id === projectId; }); if(p) p.status = newStatus; }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
  var panelCal = document.querySelector('.ctab-panel[data-tab="calendario"]');
  if (panelCal) panelCal.innerHTML = renderCalendarioSection(clientId);
}

// Alias retrocompatibilità
function approveClientProject(clientId, projectId) { return advanceProjectStatus(clientId, projectId, 'aprobado'); }
function rejectClientProject(clientId, projectId)  { return advanceProjectStatus(clientId, projectId, 'rechazado'); }

// ── EDIT INLINE ──────────────────────────────────────────────────────────────

function startEditProject(clientId, projectId) {
  _editingProjId = projectId;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cancelEditProject(clientId) {
  _editingProjId = null;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function saveEditProject(clientId, projectId) {
  var title       = document.getElementById('edit-title-'       + projectId);
  var desc        = document.getElementById('edit-desc-'        + projectId);
  var cat         = document.getElementById('edit-cat-'         + projectId);
  var month       = document.getElementById('edit-month-'       + projectId);
  var deliverable = document.getElementById('edit-deliverable-' + projectId);

  if (!title || !title.value.trim()) { showToast('El título no puede estar vacío'); return; }

  var body = {
    title:        title.value.trim(),
    description:  desc        ? desc.value.trim()        : undefined,
    category:     cat         ? cat.value                : undefined,
    month_target: month       ? month.value.trim()       : undefined,
    deliverable:  deliverable ? deliverable.value.trim() : undefined
  };

  try {
    await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(projectId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    // Aggiorna cache locale
    var arr = _clientProjects[clientId];
    if (arr) {
      var proj = arr.find(function(x){ return x.id === projectId; });
      if (proj) {
        proj.title        = body.title;
        proj.description  = body.description;
        proj.category     = body.category;
        proj.month_target = body.month_target;
        proj.deliverable  = body.deliverable;
      }
    }
    _editingProjId = null;
    showToast('✅ Proyecto actualizado');
  } catch(e) {
    showToast('Error al guardar. Intenta de nuevo.');
    return;
  }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

// ── AUTO-LINK Proyectos → Agentes ────────────────────────────────────────────
var CAT_CONTENT = ['CONTENIDO','CAMPANA','ALIANZAS','SEO_LOCAL','CONVERSION'];

// ── SISTEMA SPRINT ──────────────────────────────────────────────────────────
// Un "sprint" è una sessione focalizzata su un solo deliverable:
// es. "12 feed posts" o "16 stories". Tiene traccia dell'avanzamento
// e pre-carica il contesto giusto nel form Agenti.

var _activeSprint = null; // { clientId, projectId, format, label, total, icon, fmtVal, done }
var _sprintPickerOpen = null; // projectId con picker aperto

// Parsa il testo del progetto e rileva i deliverable (feed/stories/reels)
function _parseDeliverables(text) {
  var t = (text || '').toLowerCase();
  var deliverables = [];
  var feedM  = t.match(/(\d+)\s*posts?\s*de\s*feed/);
  var storyM = t.match(/(\d+)\s*stories/);
  var reelM  = t.match(/(\d+)\s*reels?/);
  if (feedM)  deliverables.push({ format:'feed',  label:'Feed',    count:parseInt(feedM[1]),  icon:'📷', fmtVal:'post_instagram' });
  if (storyM) deliverables.push({ format:'story', label:'Stories', count:parseInt(storyM[1]), icon:'📲', fmtVal:'story_instagram' });
  if (reelM)  deliverables.push({ format:'reel',  label:'Reels',   count:parseInt(reelM[1]),  icon:'🎬', fmtVal:'reel_instagram'  });
  return deliverables;
}

// Rileva il formato di produzione corretto dal titolo/categoria/descrizione del progetto
function _detectProjectFormat(proj) {
  var t = ((proj.title || '') + ' ' + (proj.description || '') + ' ' + (proj.deliverable || '')).toLowerCase();
  var cat = (proj.category || '').toUpperCase();

  // Lavori di design / brand
  if (t.match(/brand\s*kit|kit\s*de\s*marca|identidad.*visual|manual.*marca/)) return { format:'brand_kit',  label:'Brand Kit',   count:1, icon:'🎨' };
  if (t.match(/logo|logotipo|isologo/))                                          return { format:'logo',       label:'Logotipo',    count:1, icon:'✏️' };
  if (t.match(/tipograf/))                                                        return { format:'tipografia', label:'Tipografía',  count:1, icon:'🔤' };
  if (t.match(/paleta|color.*corpora|colores/))                                  return { format:'paleta',     label:'Paleta',      count:1, icon:'🎨' };
  if (t.match(/manual|guía.*estilo|style.*guide/))                               return { format:'manual',     label:'Manual',      count:1, icon:'📖' };
  // Publicidad / SEO
  if (t.match(/google\s*ads|meta\s*ads|publicidad|campaña\s*ads/) || cat === 'PUBLICIDAD') return { format:'ads',    label:'Ads',        count:1, icon:'📣' };
  if (t.match(/seo|google\s*business|tripadvisor/) || cat === 'SEO_LOCAL')       return { format:'seo',        label:'SEO',         count:1, icon:'🔍' };
  // Newsletter / email
  if (t.match(/newsletter|email\s*marketing|mailing/))                           return { format:'newsletter', label:'Newsletter',  count:1, icon:'✉️' };
  // Fallback social
  return null; // usa _parseDeliverables
}

// Apre il selettore sprint nella card del progetto
function openSprintSelector(clientId, projectId) {
  var arr  = _clientProjects[clientId];
  var proj = arr ? arr.find(function(x){ return x.id === projectId; }) : null;
  if (!proj) { showToast('Proyecto no encontrado'); return; }

  var deliverables = _parseDeliverables((proj.description || '') + ' ' + (proj.deliverable || ''));

  // Nessun deliverable rilevabile → fallback al vecchio comportamento
  if (!deliverables.length) {
    _sendProyectoToAgentesFallback(clientId, proj);
    return;
  }

  // Se c'è solo un deliverable, avvia subito senza picker
  if (deliverables.length === 1) {
    startSprint(clientId, proj, deliverables[0]);
    return;
  }

  // Apre/chiude il picker inline
  if (_sprintPickerOpen === projectId) {
    _sprintPickerOpen = null;
  } else {
    _sprintPickerOpen = projectId;
  }
  // Rende la sezione Proyectos per aggiornare il DOM
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

// Avvia il sprint: imposta stato, cambia tab, inietta banner e contesto
function startSprint(clientId, proj, deliverable) {
  _sprintPickerOpen = null;
  _activeSprint = {
    clientId:  clientId,
    projectId: proj.id,
    projTitle: proj.title || '',
    format:    deliverable.format,
    label:     deliverable.label,
    total:     deliverable.count,
    icon:      deliverable.icon,
    fmtVal:    deliverable.fmtVal,
    done:      0
  };

  switchClienteTab('agenti');

  setTimeout(function() {
    // Pre-seleziona il formato nel selettore
    var fmtSel = document.getElementById('ag-format-' + clientId);
    if (fmtSel) { fmtSel.value = deliverable.fmtVal; fmtSel.dispatchEvent(new Event('change')); }

    // Inietta il contesto del sprint nella textarea "Instrucciones Bravo"
    var ta = document.getElementById('ag-bravo-textarea');
    if (ta) {
      var ctx = '🎯 Sprint: ' + deliverable.icon + ' ' + deliverable.count + ' ' + deliverable.label + '\n' +
        '📌 Proyecto: ' + (proj.title || '') + '\n' +
        (proj.description ? '\n' + proj.description : '') +
        (proj.deliverable  ? '\n\n📦 ' + proj.deliverable : '') +
        '\n\n—\nGenera el contenido respetando el brand kit del cliente. Cada pieza debe seguir las reglas visuales y de copy indicadas.';
      ta.value = ctx;
      ta.dispatchEvent(new Event('input'));
    }

    // Inietta il banner in cima alla sezione Agenti
    _agentiInjectSprintBanner(clientId);

    showToast(deliverable.icon + ' Sprint ' + deliverable.label + ' iniciado — ' + deliverable.count + ' piezas');
  }, 150);
}

// Inietta / aggiorna il banner sprint nel DOM del tab Agenti
function _agentiInjectSprintBanner(clientId) {
  var sp = _activeSprint;
  if (!sp || sp.clientId !== clientId) return;

  var pct  = sp.total > 0 ? Math.round((sp.done / sp.total) * 100) : 0;
  var done = sp.done;
  var tot  = sp.total;
  var isComplete = done >= tot;

  var banner = document.getElementById('sprint-banner-' + clientId);
  if (!banner) {
    // Crea il banner e inserisce prima del primo figlio della sezione Agenti
    var section = document.querySelector('.ctab-panel[data-tab="agenti"] .cliente-section');
    if (!section) return;
    banner = document.createElement('div');
    banner.id = 'sprint-banner-' + clientId;
    section.insertBefore(banner, section.firstChild);
  }

  banner.style.cssText = 'background:' + (isComplete ? '#e8fde9' : '#f0f8ff') +
    ';border:1.5px solid ' + (isComplete ? '#2d7a4f' : '#2980b9') +
    ';border-radius:10px;padding:0.9rem 1.1rem;margin-bottom:1rem';

  banner.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">' +
      '<div>' +
        '<div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:' + (isComplete?'#2d7a4f':'#1a6fa8') + ';margin-bottom:0.25rem">' +
          '🎯 Sprint activo' +
        '</div>' +
        '<div style="font-size:0.92rem;font-weight:600;color:#1a1a1a">' +
          sp.icon + ' ' + sp.label + ' · ' + sp.projTitle +
        '</div>' +
        '<div style="font-size:0.78rem;color:#555;margin-top:0.2rem">' +
          (isComplete
            ? '✅ Sprint completado — ' + done + '/' + tot + ' piezas generadas'
            : done + ' / ' + tot + ' piezas completadas') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;align-items:center">' +
        (isComplete
          ? '<button onclick="closeActiveSprint(\'' + clientId + '\')" style="background:#2d7a4f;color:#fff;border:none;border-radius:6px;padding:0.4rem 0.9rem;font-size:0.78rem;cursor:pointer;font-weight:600">✓ Cerrar sprint</button>'
          : '<button onclick="closeActiveSprint(\'' + clientId + '\')" style="background:#f0f0f0;border:1px solid #ccc;border-radius:6px;padding:0.35rem 0.75rem;font-size:0.73rem;cursor:pointer;color:#555">✕ Cerrar</button>') +
      '</div>' +
    '</div>' +
    '<div style="margin-top:0.65rem;background:#e0e0e0;border-radius:99px;height:6px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + (isComplete ? '#2d7a4f' : '#2980b9') + ';border-radius:99px;transition:width 0.4s ease"></div>' +
    '</div>';
}

// Chiude il sprint attivo
function closeActiveSprint(clientId) {
  _activeSprint = null;
  var banner = document.getElementById('sprint-banner-' + clientId);
  if (banner) banner.remove();
  showToast('Sprint cerrado');
}

// Incrementa il contatore sprint quando un post viene approvato
function sprintIncrementDone(clientId) {
  if (!_activeSprint || _activeSprint.clientId !== clientId) return;
  _activeSprint.done = (_activeSprint.done || 0) + 1;
  _agentiInjectSprintBanner(clientId);
}

// Fallback: comportamento precedente per progetti senza deliverable strutturati
function _sendProyectoToAgentesFallback(clientId, proj) {
  var brief = '📌 Proyecto: ' + (proj.title || '') + '\n' +
    (proj.description ? '\n📝 Descripción:\n' + proj.description : '') +
    (proj.deliverable ? '\n\n📦 Entregable: ' + proj.deliverable : '') +
    (proj.month_target ? '\n📅 Mes objetivo: ' + proj.month_target : '') +
    '\n\n—\nGenera el contenido para este proyecto siguiendo el briefing y el contexto de marca del cliente.';
  switchClienteTab('agenti');
  setTimeout(function() {
    var ta = document.getElementById('ag-bravo-textarea');
    if (ta) { ta.value = brief; ta.focus(); ta.dispatchEvent(new Event('input')); ta.scrollIntoView({ behavior:'smooth', block:'center' }); }
  }, 80);
  showToast('⚡ Brief del proyecto cargado en Agentes');
}

// Mantiene retrocompatibilità con eventuali chiamate residue
function sendProyectoToAgentes(clientId, projectId) {
  openSprintSelector(clientId, projectId);
}

// ── RENDER DEL PICKER SPRINT (inline nella card progetto) ───────────────────
function _renderSprintPicker(clientId, proj) {
  var deliverables = _parseDeliverables((proj.description || '') + ' ' + (proj.deliverable || ''));
  if (!deliverables.length) return '';

  return '<div style="margin-top:0.75rem;padding:0.75rem;background:#f8f8f8;border:1px solid #e0dbd2;border-radius:8px">' +
    '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:0.6rem">🎯 Selecciona el formato del sprint</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">' +
    deliverables.map(function(d) {
      var isActive = _activeSprint && _activeSprint.projectId === proj.id && _activeSprint.format === d.format;
      var done = isActive ? (_activeSprint.done || 0) : 0;
      var pct  = isActive ? Math.round((done / d.count) * 100) : 0;
      return '<button onclick="startSprint(\'' + clientId + '\',' + JSON.stringify(proj).replace(/'/g,"\\'") + ',' + JSON.stringify(d).replace(/'/g,"\\'") + ')" ' +
        'style="flex:1;min-width:90px;padding:0.6rem 0.8rem;border:1.5px solid ' + (isActive ? '#2980b9' : '#d0ccc5') + ';' +
        'border-radius:8px;background:' + (isActive ? '#e8f4fd' : '#fff') + ';cursor:pointer;text-align:left">' +
        '<div style="font-size:1rem;margin-bottom:0.15rem">' + d.icon + '</div>' +
        '<div style="font-size:0.8rem;font-weight:600;color:#1a1a1a">' + d.count + ' ' + d.label + '</div>' +
        (isActive ? '<div style="font-size:0.68rem;color:#2980b9;margin-top:0.2rem">' + done + '/' + d.count + ' · ' + pct + '%</div>' : '') +
      '</button>';
    }).join('') +
    '</div>' +
  '</div>';
}

// ── MODAL PROGRAMAR ──────────────────────────────────────────────────────────

// Auto-suggerimento responsabile per categoria
var _catDefaultAssign = {
  CONTENIDO:  'Andrea Valdivia',
  CAMPANA:    'Andrea Valdivia',
  PUBLICIDAD: 'Carlos Lage',
  ALIANZAS:   'Andrea Valdivia',
  SEO_LOCAL:  'Andrea Valdivia',
  CONVERSION: 'Carlos Lage'
};

async function openProgramarModal(clientId, projectId, category) {
  var arr  = _clientProjects[clientId];
  var proj = arr ? arr.find(function(x){ return x.id === projectId; }) : null;
  var title = proj ? (proj.title || 'Programar proyecto') : 'Programar proyecto';
  _programarState = { clientId: clientId, projectId: projectId, category: category, title: title };
  // Carica tareas esistenti per questo progetto
  _programarTasks = [];
  try {
    var r = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/tasks');
    var d = await r.json();
    if (d.ok && d.tasks) _programarTasks = d.tasks;
  } catch(e) {}
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
  var inlPanel = document.querySelector('.cproj-inline-panel');
  if (inlPanel) inlPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeProgramarModal() {
  var cid = _programarState.clientId;
  _programarState = { clientId: null, projectId: null, category: null, title: '' };
  _programarExpandedIdx = null;
  if (cid) {
    var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
    if (panel) panel.innerHTML = renderProyectosSection(cid);
  }
}

// ── MODAL PLAN OPUS ────────────────────────────────────────────────────────
var _DEFAULT_TEAM = [
  { name: 'Carlos Lage',       role: 'Filmmaker',           mode: 'human' },
  { name: 'Andrea Valdivia',   role: 'Social Media Manager', mode: 'human' },
  { name: 'Mari Almendros',    role: 'Brand Designer',       mode: 'human' },
  { name: 'Vicente Palazzolo', role: 'CEO & Sales',          mode: 'human' },
];

var _AI_AGENTS = [
  { key: 'copywriter', name: 'Agente Copywriter', role: 'Redacción y contenido',  icon: '✍️', desc: 'Genera posts, captions y copy para redes sociales', format: 'post_instagram' },
  { key: 'designer',   name: 'Agente Diseñador',  role: 'Diseño y creatividad',   icon: '🎨', desc: 'Aplica el layout de marca sobre la foto del rodaje',  format: 'feed' },
];

var _planSuggestState = { clientId: null, projectId: null, proj: null, cards: [], team: [], step: 1 };

// ============================================================
// FLUJO DE PRODUCCIÓN — Pre-rodaje · Rodaje · Post-rodaje
// ============================================================

function _addDays(dateStr, days) {
  var d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function _fmtDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

// 6 pasos comunes a todo el proyecto (se hacen una sola vez para todos los contenidos)
function _buildSharedSubtasks(shootingDate, team) {
  team = team || [];
  function ra(name) {
    var m = team.find(function(t){ return t.name === name; });
    if (!m || m._disabled) return 'Por asignar';
    return m.mode === 'ai' ? '🤖 Agente AI (' + m.role + ')' : name;
  }
  return [
    { phase:'pre',    name:'Script y guión',           assignee:ra('Andrea Valdivia'),   date:_addDays(shootingDate,-7), status:'todo', tip:'Definir mensajes clave y hilo narrativo de los contenidos. Compartir con Carlos antes del rodaje.' },
    { phase:'pre',    name:'Brief para el filmmaker',  assignee:ra('Carlos Lage'),       date:_addDays(shootingDate,-5), status:'todo', tip:'Lista de planos, recursos técnicos y material a llevar el día del rodaje.' },
    { phase:'pre',    name:'Confirmación logística',   assignee:ra('Vicente Palazzolo'), date:_addDays(shootingDate,-2), status:'todo', tip:'Confirmar fecha, hora, lugar y personas presentes con el cliente.' },
    { phase:'rodaje', name:'🎬 Día de rodaje',          assignee:ra('Carlos Lage'),       date:shootingDate,              status:'todo', tip:'Grabar todo el material previsto. Vicente acompaña al cliente.' },
    { phase:'post',   name:'Edición y montaje',        assignee:ra('Carlos Lage'),       date:_addDays(shootingDate,7),  status:'todo', tip:'Selección de material, corte, música y color para todas las piezas del mes.' },
    { phase:'post',   name:'Revisión del cliente',     assignee:ra('Vicente Palazzolo'), date:_addDays(shootingDate,12), status:'todo', tip:'Presentar el material editado y recoger aprobación o feedback.' },
  ];
}

// 2 pasos individuales por cada contenido (uno por card)
function _buildIndividualSubtasks(shootingDate, publishDate, team) {
  team = team || [];
  function ra(name) {
    var m = team.find(function(t){ return t.name === name; });
    if (!m || m._disabled) return 'Por asignar';
    return m.mode === 'ai' ? '🤖 Agente AI (' + m.role + ')' : name;
  }
  var captionDate = _addDays(shootingDate, 9);
  var designDate  = _addDays(shootingDate, 11);
  var pubDate     = publishDate || _addDays(shootingDate, 14);
  return [
    { phase:'post', name:'Redacción de caption',    assignee:'Agente Copywriter', date:captionDate, status:'todo', tip:'Usar el briefing de marca y el guión como base. Incluir CTA y hashtags.' },
    { phase:'post', name:'Diseño del post',          assignee:'Agente Designer',  date:designDate,  status:'todo', tip:'Tomar la foto sugerida del rodaje + caption del Copywriter + brand kit del cliente → diseñar el post final.' },
    { phase:'pub',  name:'Preparar para publicación', assignee:'Agente Publicador', date:pubDate,   status:'todo', tip:'Ensamblar imagen final + caption + hashtags. Dejar todo listo para publicación manual.' },
  ];
}

// Identifica la card "Producción compartida" entre las cards del piano
function _findSharedCard(cards) {
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].format === 'shared') return { card: cards[i], index: i };
  }
  return null;
}

function _isSharedDone(cards) {
  var s = _findSharedCard(cards);
  if (!s) return false;
  var subs = s.card.subtasks || [];
  if (!subs.length) return false;
  return subs.every(function(x){ return x.status === 'done'; });
}

// Carga / guarda fecha de rodaje en localStorage (no toca el schema)
function _loadRodajeMeta(projectId) {
  try {
    var raw = localStorage.getItem('bravo_rodaje_' + projectId);
    if (!raw) return { date: '', approx: false };
    var p = JSON.parse(raw);
    return { date: p.date || '', approx: !!p.approx };
  } catch (e) { return { date: '', approx: false }; }
}

function _saveRodajeMeta(projectId, date, approx) {
  try {
    localStorage.setItem('bravo_rodaje_' + projectId, JSON.stringify({ date: date, approx: !!approx }));
  } catch (e) {}
}

// Genera el flujo completo: una card compartida + las individuales con sólo caption y programación
async function generateAllWorkflowPlans() {
  var dateInput = document.getElementById('rodaje-date-input');
  var approxCb  = document.getElementById('rodaje-approx');
  var isApprox  = !!(approxCb && approxCb.checked);
  var sd        = dateInput ? dateInput.value : '';

  if (!sd && !isApprox) {
    showToast('⚠️ Introduce la fecha de rodaje (o marca "Por confirmar")');
    return;
  }
  if (!sd && isApprox) {
    var d = new Date(); d.setDate(d.getDate() + 21);
    sd = d.toISOString().slice(0, 10);
  }

  _planSuggestState.shooting_date        = sd;
  _planSuggestState.shooting_date_approx = isApprox;
  _saveRodajeMeta(_planSuggestState.projectId, sd, isApprox);

  var cards = _planSuggestState.cards;
  var sharedExists = _findSharedCard(cards);
  var team = _planSuggestState.team || [];
  var sharedSubs = _buildSharedSubtasks(sd, team);
  var st = _planSuggestState;

  // Actualiza subtasks en memoria para todas las cards
  cards.forEach(function(card) {
    if (card.format === 'shared') {
      card.subtasks = sharedSubs;
    } else {
      card.subtasks = _buildIndividualSubtasks(sd, card.publish_date, team);
    }
    card.status = 'todo';
  });

  if (sharedExists) {
    // Caso A: ya existe la card compartida → sólo patch a cada una (todas tienen _db_id)
    cards.forEach(function(card){ if (card._db_id) _patchPlanCard(card); });
    document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(cards);
    showToast('✦ Plan recalculado con la nueva fecha');
    return;
  }

  // Caso B: primera vez → patch a las que tengan _db_id + POST de la nueva shared, luego reload
  var newShared = {
    title:        'Producción compartida',
    format:       'shared',
    publish_date: sd,
    assignee:     'Equipo Bravo',
    creative_note:'Pasos comunes a todos los contenidos del proyecto. Hasta que no estén completados, las publicaciones individuales quedan en espera.',
    subtasks:     sharedSubs,
    status:       'todo',
  };

  var individualsWithoutDbId = cards.filter(function(c){ return c.format !== 'shared' && !c._db_id; });

  // Patch a las que ya están en DB
  cards.forEach(function(card){ if (card._db_id && card.format !== 'shared') _patchPlanCard(card); });

  // Guarda en Supabase: la nueva shared + las individuales sin _db_id (caso plan recién generado por Opus)
  var toSave = [newShared].concat(individualsWithoutDbId);
  showToast('Generando plan completo…');
  await _savePlanTasksToSupabase(st.clientId, st.projectId, st.proj, toSave);
  // Reload para coger los _db_id
  openPlanSuggest(st.clientId, st.projectId);
}

// Render del panel "Organizar producción" en la cabecera
function _renderRodajeOrganizer(cards) {
  var sd       = _planSuggestState.shooting_date || '';
  var approx   = !!_planSuggestState.shooting_date_approx;
  var hasShared= !!_findSharedCard(cards);

  // Si ya está montado todo el flujo, sólo un resumen colapsado
  if (hasShared && sd) {
    var label = _fmtDateShort(sd) + (approx ? ' (aprox.)' : '');
    var sharedDone = _isSharedDone(cards);
    var statusBg   = sharedDone ? '#f0fdf4' : '#fff8e7';
    var statusBd   = sharedDone ? '#bbf7d0' : '#fde68a';
    var statusCol  = sharedDone ? '#15803d' : '#92400e';
    var statusTxt  = sharedDone ? '✅ Producción compartida lista — publicaciones desbloqueadas' : '⏳ Producción compartida en curso — publicaciones en espera';
    return '<div style="background:'+statusBg+';border:1.5px solid '+statusBd+';border-radius:10px;padding:0.7rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap">' +
      '<span style="font-size:1.1rem">🎬</span>' +
      '<div style="flex:1;min-width:180px;font-size:0.75rem;color:'+statusCol+'"><strong>Rodaje:</strong> '+label+' · '+statusTxt+'</div>' +
      '<button onclick="openRodajePhotos()" style="font-size:0.68rem;padding:0.25rem 0.7rem;background:#2563eb;border:none;border-radius:6px;cursor:pointer;color:#fff;font-weight:700">📁 Material</button>' +
      '<button onclick="_showRodajeEditor()" style="font-size:0.68rem;padding:0.25rem 0.7rem;background:#fff;border:1px solid '+statusBd+';border-radius:6px;cursor:pointer;color:'+statusCol+'">✏️ Cambiar fecha</button>' +
    '</div>';
  }

  // Setup inicial
  var todayPlus21 = new Date(); todayPlus21.setDate(todayPlus21.getDate() + 21);
  var defaultDate = sd || todayPlus21.toISOString().slice(0, 10);
  var nCards = cards.filter(function(c){ return c.format !== 'shared'; }).length;

  return '<div id="rodaje-organizer" style="background:#fff;border:2px solid #C29547;border-radius:12px;padding:1rem 1.1rem;margin-bottom:1.2rem">' +
    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
      '<span style="font-size:1.1rem">🎬</span>' +
      '<div style="font-size:0.85rem;font-weight:700;color:#1F2A24">Organizar la producción</div>' +
    '</div>' +
    '<div style="font-size:0.73rem;color:#666;margin-bottom:0.9rem;line-height:1.5">Para crear los <strong>'+nCards+' contenidos</strong> hace falta un día de rodaje. A partir de esa fecha el sistema organiza al equipo: pre-rodaje (script, brief, logística), día de rodaje, edición, revisión del cliente y publicación.</div>' +
    '<div style="font-size:0.7rem;font-weight:600;color:#555;margin-bottom:0.35rem;text-transform:uppercase;letter-spacing:0.05em">📅 Fecha de rodaje</div>' +
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.8rem;flex-wrap:wrap;align-items:center">' +
      '<input type="date" id="rodaje-date-input" value="'+defaultDate+'" style="flex:1;min-width:150px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:7px;font-size:0.82rem;background:#fff">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:#888;cursor:pointer;white-space:nowrap;user-select:none">' +
        '<input type="checkbox" id="rodaje-approx" '+(approx?'checked':'')+'> Aún por confirmar' +
      '</label>' +
    '</div>' +
    '<button onclick="generateAllWorkflowPlans()" style="width:100%;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:9px;padding:0.65rem 1rem;font-size:0.82rem;font-weight:700;cursor:pointer">✦ Generar plan completo para el equipo</button>' +
  '</div>';
}

function _showRodajeEditor() {
  // Re-abre el editor borrando provisionalmente la marca de "ya organizado"
  var sd = _planSuggestState.shooting_date;
  var approx = _planSuggestState.shooting_date_approx;
  var body = document.getElementById('planSuggestBody');
  if (!body) return;
  // Forzamos render del organizer en modo setup mostrando un mini-form encima de las cards
  var nCards = _planSuggestState.cards.filter(function(c){ return c.format !== 'shared'; }).length;
  body.querySelector('#rodaje-organizer-edit') && body.querySelector('#rodaje-organizer-edit').remove();
  var editor = document.createElement('div');
  editor.id = 'rodaje-organizer-edit';
  editor.style.cssText = 'background:#fff;border:2px solid #C29547;border-radius:12px;padding:1rem 1.1rem;margin-bottom:1rem';
  editor.innerHTML =
    '<div style="font-size:0.82rem;font-weight:700;color:#1F2A24;margin-bottom:0.7rem">🎬 Cambiar fecha de rodaje</div>' +
    '<div style="font-size:0.7rem;color:#888;margin-bottom:0.6rem">Al confirmar se recalcularán las fechas del flujo compartido y de las '+nCards+' card individuales.</div>' +
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.7rem;flex-wrap:wrap;align-items:center">' +
      '<input type="date" id="rodaje-date-input" value="'+(sd||'')+'" style="flex:1;min-width:150px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:7px;font-size:0.82rem">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:#888;cursor:pointer;white-space:nowrap"><input type="checkbox" id="rodaje-approx" '+(approx?'checked':'')+'> Aún por confirmar</label>' +
    '</div>' +
    '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
      '<button onclick="this.closest(\'#rodaje-organizer-edit\').remove()" style="font-size:0.72rem;padding:0.35rem 0.8rem;background:none;border:1px solid #e0dbd2;border-radius:6px;cursor:pointer;color:#888">Cancelar</button>' +
      '<button onclick="generateAllWorkflowPlans()" style="font-size:0.72rem;padding:0.4rem 1rem;background:#1F2A24;color:#C29547;border:none;border-radius:6px;cursor:pointer;font-weight:700">✓ Recalcular</button>' +
    '</div>';
  body.insertBefore(editor, body.firstChild);
}

async function openPlanSuggest(clientId, projectId) {
  var projects = _clientProjects[clientId] || [];
  var proj = projects.find(function(p){ return p.id === projectId; });
  if (!proj) { showToast('Proyecto no encontrado'); return; }

  var overlay  = document.getElementById('planSuggestOverlay');
  var subtitle = document.getElementById('planSuggestSubtitle');
  var body     = document.getElementById('planSuggestBody');
  var footer   = document.getElementById('planSuggestFooter');

  // Team: personas reales + agentes AI
  var team = _DEFAULT_TEAM.map(function(m){ return { name: m.name, role: m.role, mode: 'human' }; })
    .concat(_AI_AGENTS.map(function(ag){ return { name: ag.name, role: ag.role, mode: 'ai', _agentIcon: ag.icon, _agentKey: ag.key }; }));
  _planSuggestState = { clientId: clientId, projectId: projectId, proj: proj, cards: [], team: team, step: 1, shooting_date: '' };
  if (subtitle) subtitle.textContent = proj.title || '';
  overlay.style.display = '';

  // Controlla se esiste già un piano salvato per questo progetto
  body.innerHTML = '<div style="text-align:center;padding:2rem;color:#888;font-size:0.82rem">Cargando…</div>';
  footer.style.display = 'none';

  try {
    var res  = await fetch(BRAVO_API + '/api/plan-tasks?project_id=' + encodeURIComponent(projectId));
    var data = await res.json();
    var saved = (data.tasks || []).filter(function(t){ return t.project_id === projectId; });

    if (saved.length > 0) {
      // Piano già salvato → mostra direttamente le card esistenti
      _planSuggestState.cards = saved.map(function(t) {
        return {
          title:        t.title || '',
          publish_date: t.publish_date || '',
          assignee:     t.assignee || '',
          format:       t.format || '',
          pillar:       t.pillar || '',
          creative_note:t.creative_note || '',
          status:       t.status || 'todo',
          subtasks:     typeof t.subtasks === 'string' ? JSON.parse(t.subtasks || '[]') : (t.subtasks || []),
          _db_id:       t.id,
          _db_id_confirmed: true
        };
      });
      // Carga fecha de rodaje guardada en localStorage para este proyecto
      var rmeta = _loadRodajeMeta(projectId);
      _planSuggestState.shooting_date        = rmeta.date;
      _planSuggestState.shooting_date_approx = rmeta.approx;
      body.innerHTML = _renderPlanCards(_planSuggestState.cards);
      footer.style.display = 'flex';
      footer.innerHTML =
        '<button onclick="_renderPlanStep1()" style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.55rem 1.2rem;cursor:pointer;font-size:0.82rem;color:#555">🧠 Regenerar con Opus</button>' +
        '<div style="display:flex;gap:0.5rem">' +
          '<button onclick="openRodajePhotos()" style="background:#f5f3ef;border:1.5px solid #2563eb;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#2563eb;font-weight:600">📁 Material</button>' +
          '<button onclick="openBriefingRodaje()" style="background:#f5f3ef;border:1.5px solid #C29547;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#C29547;font-weight:600">📋 Briefing</button>' +
          '<button onclick="confirmPlan()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.55rem 1.4rem;cursor:pointer;font-size:0.82rem;font-weight:700">✦ Confirmar cambios</button>' +
        '</div>';
    } else {
      // Nessun piano → inizia dal passo 1 (selezione team)
      _renderPlanStep1();
    }
  } catch(e) {
    console.warn('[PLAN] Error al cargar plan:', e.message);
    showToast('⚠️ Error al cargar plan: ' + (e.message || 'error de conexión'));
    _renderPlanStep1();
  }
}

function _renderPlanStep1() {
  var body   = document.getElementById('planSuggestBody');
  var footer = document.getElementById('planSuggestFooter');
  var team   = _planSuggestState.team;

  // Trova Andrea e controlla se è in modalità AI
  var andrea = team.find(function(m){ return m.name === 'Andrea Valdivia'; });
  var andreaIsAI = andrea && andrea.mode === 'ai';

  // Righe del team — esclude gli agenti puri (li gestiamo separatamente)
  var rows = team.map(function(m, i) {
    if (m._agentKey) return ''; // gli agenti puri si mostrano nel blocco separato

    var isAI    = m.mode === 'ai';
    var isExtra = m._extra;
    var isAndrea = m.name === 'Andrea Valdivia';

    var avatar = '<div style="width:34px;height:34px;border-radius:50%;background:' + _teamColorFor(m.name) + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;font-weight:700;flex-shrink:0">' +
      (isAI ? '🤖' : _teamInitialsFor(m.name)) +
    '</div>';

    var controls =
      '<button onclick="setPlanTeamMode(' + i + ',\'human\')" style="padding:0.25rem 0.6rem;border-radius:6px;font-size:0.7rem;font-weight:600;cursor:pointer;border:1.5px solid ' + (!isAI?'#1F2A24':'#e0dbd2') + ';background:' + (!isAI?'#1F2A24':'#fff') + ';color:' + (!isAI?'#C29547':'#888') + '">👤 Persona</button>' +
      '<button onclick="setPlanTeamMode(' + i + ',\'ai\')" style="padding:0.25rem 0.6rem;border-radius:6px;font-size:0.7rem;font-weight:600;cursor:pointer;border:1.5px solid ' + (isAI?'#C29547':'#e0dbd2') + ';background:' + (isAI?'#1F2A24':'#fff') + ';color:' + (isAI?'#C29547':'#888') + '">🤖 Agente AI</button>';

    // Blocco agenti sotto Andrea quando è in modalità AI
    var agentsBlock = '';
    if (isAndrea && isAI) {
      var agents = team.filter(function(m){ return m._agentKey; });
      agentsBlock = '<div style="margin:0.5rem 0 0.2rem 3rem;padding:0.6rem 0.8rem;background:#f0f8f0;border-radius:8px;border-left:3px solid #C29547">' +
        '<div style="font-size:0.68rem;font-weight:700;color:#C29547;letter-spacing:0.08em;margin-bottom:0.4rem">AGENTES ACTIVOS — cubren todo el trabajo social</div>' +
        agents.map(function(ag){
          return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.2rem 0;font-size:0.75rem;color:#1F2A24">' +
            '<span style="font-size:0.9rem">' + ag._agentIcon + '</span>' +
            '<span style="font-weight:600">' + ag.name + '</span>' +
            '<span style="color:#888">— ' + ag.role + '</span>' +
          '</div>';
        }).join('') +
      '</div>';
    }

    return '<div>' +
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.7rem 0;border-bottom:1px solid #f0ece5">' +
        avatar +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:0.82rem;color:#1F2A24">' + m.name + '</div>' +
          '<div style="font-size:0.7rem;color:#888">' + m.role + (isAndrea ? ' — copy, estrategia y publicación' : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:0.3rem">' + controls + '</div>' +
        (isExtra ? '<button onclick="removePlanTeamMember(' + i + ')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:0.9rem;padding:0 0.2rem">✕</button>' : '') +
      '</div>' +
      agentsBlock +
    '</div>';
  }).join('');

  body.innerHTML =
    '<div style="font-size:0.75rem;color:#888;margin-bottom:0.7rem;padding:0.6rem 0.8rem;background:#fef9f0;border-radius:8px;border-left:3px solid #C29547">' +
      '¿Quién trabaja en este proyecto? Si eliges <strong>Agente AI</strong> para Andrea, los 3 agentes cubrirán todo su trabajo automáticamente.' +
    '</div>' +
    '<button onclick="setTodoAutomatico()" style="width:100%;margin-bottom:0.9rem;padding:0.55rem 1rem;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer">⚡ Todo automático — todo el equipo AI</button>' +
    rows +
    '<button onclick="addPlanTeamMember()" style="margin-top:0.8rem;width:100%;padding:0.55rem;border:1.5px dashed #e0dbd2;border-radius:8px;background:#fafaf8;color:#888;cursor:pointer;font-size:0.8rem">+ Añadir miembro al proyecto</button>' +
    '<div id="planAddMemberForm" style="display:none;margin-top:0.6rem;gap:0.5rem;flex-wrap:wrap">' +
      '<input id="planNewName" placeholder="Nombre" style="flex:1;min-width:120px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:8px;font-size:0.8rem">' +
      '<input id="planNewRole" placeholder="Rol (ej. Fotógrafo)" style="flex:1;min-width:120px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:8px;font-size:0.8rem">' +
      '<button onclick="confirmAddPlanMember()" style="padding:0.45rem 0.9rem;background:#1F2A24;color:#C29547;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer">Añadir</button>' +
    '</div>' +
    '<div style="margin-top:1.2rem;padding:0.9rem 1rem;background:#fafaf8;border:1.5px solid #e0dbd2;border-radius:10px">' +
      '<div style="font-size:0.75rem;font-weight:700;color:#1F2A24;margin-bottom:0.5rem">📷 Día de rodaje con el cliente</div>' +
      '<div style="font-size:0.72rem;color:#888;margin-bottom:0.6rem">Fecha en que el equipo va a rodar con el cliente. Opus organizará todo el plan alrededor de este día.</div>' +
      '<input type="date" id="planShootingDate" value="' + (_planSuggestState.shooting_date || '') + '" style="width:100%;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:8px;font-size:0.82rem;background:#fff;color:#1F2A24" onchange="_planSuggestState.shooting_date=this.value">' +
      '<div style="font-size:0.68rem;color:#aaa;margin-top:0.3rem">Opcional — si no lo sabes todavía, déjalo vacío</div>' +
    '</div>';

  footer.style.display = 'flex';
  footer.innerHTML =
    '<button onclick="closePlanSuggest()" style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.55rem 1.2rem;cursor:pointer;font-size:0.82rem;color:#555">Cancelar</button>' +
    '<button onclick="runPlanGeneration()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.55rem 1.4rem;cursor:pointer;font-size:0.82rem;font-weight:700">✦ Generar plan con Opus →</button>';
}

function setTodoAutomatico() {
  _planSuggestState.team.forEach(function(m, i) {
    if (!m._agentKey) {
      _planSuggestState.team[i].mode = 'ai';
    }
  });
  // Attiva tutti gli agenti puri
  _planSuggestState.team.forEach(function(t) {
    if (t._agentKey) t._disabled = false;
  });
  _renderPlanStep1();
}

function setPlanTeamMode(idx, mode) {
  _planSuggestState.team[idx].mode = mode;
  // Se stiamo cambiando Andrea → sincronizza gli agenti puri
  var m = _planSuggestState.team[idx];
  if (m.name === 'Andrea Valdivia') {
    _planSuggestState.team.forEach(function(t) {
      if (t._agentKey) t._disabled = (mode === 'human'); // AI attivi solo se Andrea è AI
    });
  }
  _renderPlanStep1();
}

function togglePlanAgent(idx) {
  _planSuggestState.team[idx]._disabled = !_planSuggestState.team[idx]._disabled;
  _renderPlanStep1();
}

function addPlanTeamMember() {
  var form = document.getElementById('planAddMemberForm');
  if (form) form.style.display = form.style.display === 'none' ? 'flex' : 'none';
}

function confirmAddPlanMember() {
  var name = (document.getElementById('planNewName') || {}).value || '';
  var role = (document.getElementById('planNewRole') || {}).value || '';
  if (!name.trim()) return;
  _planSuggestState.team.push({ name: name.trim(), role: role.trim() || 'Colaborador', mode: 'human', _extra: true });
  _renderPlanStep1();
}

function removePlanTeamMember(idx) {
  _planSuggestState.team.splice(idx, 1);
  _renderPlanStep1();
}

async function runPlanGeneration() {
  var body   = document.getElementById('planSuggestBody');
  var footer = document.getElementById('planSuggestFooter');
  var state  = _planSuggestState;
  var proj   = state.proj;

  // Se esiste già un piano salvato, chiede conferma prima di sovrascrivere
  if (state.cards && state.cards.length > 0) {
    var ok = confirm('⚠️ Ya existe un plan para este proyecto.\n\n¿Eliminar el plan actual y generar uno nuevo con Opus?');
    if (!ok) return;
    state.cards = [];
  }

  body.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2rem;margin-bottom:1rem">✦</div><div style="color:#888;font-size:0.85rem">Opus construyendo el plan con el briefing guardado…<br><span style="font-size:0.75rem;color:#bbb;margin-top:0.5rem;display:block">15-30 segundos</span></div></div>';
  footer.style.display = 'none';

  var deliverables = _parseDeliverables((proj.description || '') + ' ' + (proj.deliverable || '') + ' ' + (proj.title || ''));
  var del = deliverables[0] || _detectProjectFormat(proj) || { format: 'feed', label: 'Feed', count: 4, fmtVal: 'post_instagram' };
  var startDate = new Date().toISOString().slice(0, 10);

  // Prepara team per il backend
  var teamForApi = state.team.map(function(m) {
    return { name: m.mode === 'ai' ? '🤖 Agente AI (' + m.role + ')' : m.name, role: m.role, mode: m.mode };
  });

  try {
    var res = await fetch(AGENT_API + '/api/projects/suggest-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:           state.clientId,
        project_id:          state.projectId || null,
        project_title:       proj.title || '',
        project_description: proj.description || '',
        deliverable_format:  del.format,
        deliverable_count:   del.count,
        start_date:          startDate,
        shooting_date:       state.shooting_date || null,
        publish_days:        ['monday', 'wednesday', 'friday'],
        team:                teamForApi
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.detail || 'Error');
    // Assegna UUID stabile a ogni card generata da Opus (serve per UPSERT lato backend)
    state.cards = (data.plan.cards || []).map(function(c) {
      if (!c._db_id) c._db_id = crypto.randomUUID();
      return c;
    });
    state.briefing_rodaje = null;
    var bSrc = data.briefing_source || 'none';
    var bLabel = bSrc === 'distilled' ? '📄 Briefing: cargado desde Supabase' :
                 bSrc === 'full_truncated' ? '📄 Briefing: texto guardado (sin distilado)' :
                 '⚠️ Briefing: no disponible — sube el briefing del cliente';
    var bColor = bSrc === 'none' ? '#c0392b' : '#2d7a4f';
    var dbg = data._debug ? ' | uuid:' + (data._debug.client_uuid||'?') + ' brand:' + data._debug.brand_found + ' brief:' + data._debug.briefing_found : '';
    body.innerHTML = '<div style="font-size:0.72rem;color:' + bColor + ';padding:0.4rem 0.8rem;margin-bottom:0.5rem;background:' + (bSrc === 'none' ? '#fdf2f2' : '#f2faf5') + ';border-radius:6px;border:1px solid ' + (bSrc === 'none' ? '#f5c6c6' : '#c3e8d0') + '">' + bLabel + dbg + '</div>' + _renderPlanCards(state.cards);
    footer.style.display = 'flex';
    footer.innerHTML = _planFooterWithBriefing();
    // NON auto-salvare qui — il salvataggio avviene solo in confirmPlan() per evitare race condition
  } catch(e) {
    body.innerHTML = '<div style="color:#c0392b;padding:1.5rem;text-align:center">❌ ' + (e.message || e) + '</div>';
    footer.style.display = 'flex';
  }
}

function _planFooterWithBriefing() {
  return '<button onclick="_renderPlanStep1()" style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.55rem 1.2rem;cursor:pointer;font-size:0.82rem;color:#555">← Modificar equipo</button>' +
    '<div style="display:flex;gap:0.5rem">' +
      '<button onclick="openRodajePhotos()" style="background:#f5f3ef;border:1.5px solid #2563eb;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#2563eb;font-weight:600">📁 Material</button>' +
      '<button onclick="openBriefingRodaje()" style="background:#f5f3ef;border:1.5px solid #C29547;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#C29547;font-weight:600">📋 Briefing</button>' +
      '<button onclick="confirmPlan()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.55rem 1.4rem;cursor:pointer;font-size:0.82rem;font-weight:700">✦ Confirmar plan</button>' +
    '</div>';
}

// ── BRIEFING DE RODAJE ─────────────────────────────────────────────────────

async function openRodajePhotos() {
  var state = _planSuggestState;
  if (!state.projectId) { showToast('Confirma primero el plan'); return; }

  var existing = document.getElementById('rodajePhotosOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'rodajePhotosOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1300;display:flex;align-items:center;justify-content:center;padding:1rem';

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:680px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.18)">' +
      '<div style="padding:1.1rem 1.4rem;background:linear-gradient(135deg,#1a4fa8,#2563eb);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">' +
        '<div>' +
          '<div style="font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:0.2rem">Material del rodaje</div>' +
          '<div style="font-weight:700;font-size:1rem;color:#fff">📁 Fotos del proyecto</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'rodajePhotosOverlay\').remove()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:0.4rem 0.7rem;cursor:pointer;color:#fff;font-size:0.85rem">✕</button>' +
      '</div>' +
      '<div style="padding:1rem 1.4rem;border-bottom:1px solid #e0dbd2;flex-shrink:0">' +
        '<div style="font-size:0.78rem;color:#555;margin-bottom:0.8rem">Sube todas las fotos del rodaje. Claude Vision analizará cada una y creará un mini briefing para que los agentes puedan generar captions sin verlas.</div>' +
        '<label style="display:flex;align-items:center;gap:0.7rem;padding:0.7rem 1rem;background:#f0f4ff;border:2px dashed #2563eb;border-radius:10px;cursor:pointer">' +
          '<span style="font-size:1.3rem">📸</span>' +
          '<span style="font-size:0.82rem;color:#2563eb;font-weight:600">Seleccionar fotos (múltiple)</span>' +
          '<input type="file" id="rodajeFileInput" multiple accept="image/*" style="display:none" onchange="uploadRodajePhotos(this)">' +
        '</label>' +
      '</div>' +
      '<div id="rodajeUploadProgress" style="display:none;padding:0.7rem 1.4rem;background:#f0f4ff;border-bottom:1px solid #e0dbd2;font-size:0.78rem;color:#2563eb;flex-shrink:0"></div>' +
      '<div id="rodajePhotosGrid" style="flex:1;overflow-y:auto;padding:1rem 1.4rem">' +
        '<div style="text-align:center;color:#aaa;padding:2rem;font-size:0.82rem">Cargando fotos guardadas…</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  _loadRodajePhotosGrid(state.clientId, state.projectId);
}

async function _loadRodajePhotosGrid(clientId, projectId) {
  var grid = document.getElementById('rodajePhotosGrid');
  if (!grid) return;
  console.log('[RODAJE] caricamento foto — clientId:', clientId, 'projectId:', projectId);
  try {
    var res  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/rodaje-photos?client_id=' + encodeURIComponent(clientId));
    var data = await res.json();
    console.log('[RODAJE] risposta backend:', data);
    var photos = data.photos || [];
    if (!photos.length) {
      grid.innerHTML = '<div style="text-align:center;color:#aaa;padding:2rem;font-size:0.82rem">Sin fotos aún — sube el material del rodaje.</div>';
      return;
    }
    grid.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.8rem">' +
      photos.map(function(p) {
        return '<div style="border:1.5px solid #e0dbd2;border-radius:10px;overflow:hidden;background:#fafaf8">' +
          '<div style="position:relative;padding-top:66%;background:#f0ece5">' +
            '<img src="' + p.url + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" loading="lazy">' +
          '</div>' +
          '<div style="padding:0.55rem 0.6rem">' +
            '<div style="font-size:0.62rem;font-weight:700;color:#1F2A24;margin-bottom:0.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + (p.filename||'') + '">' + (p.filename||'foto') + '</div>' +
            '<div style="font-size:0.68rem;color:#555;line-height:1.45">' + (p.scene_description || '<em style="color:#aaa">Sin análisis</em>') + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  } catch(e) {
    grid.innerHTML = '<div style="color:#c0392b;padding:1rem;font-size:0.8rem">Error al cargar fotos: ' + (e.message||'') + '</div>';
  }
}

async function uploadRodajePhotos(input) {
  var state = _planSuggestState;
  var files = Array.from(input.files || []);
  if (!files.length) return;

  var progress = document.getElementById('rodajeUploadProgress');
  if (progress) progress.style.display = '';

  var ok = 0, fail = 0, lastError = '';
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (progress) progress.textContent = '⏳ Analizando foto ' + (i+1) + ' de ' + files.length + ': ' + f.name + '…';
    try {
      var fd = new FormData();
      fd.append('file', f);
      fd.append('client_id', state.clientId);
      var res  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(state.projectId) + '/upload-media', { method:'POST', body:fd });
      var data = await res.json();
      if (data.ok) {
        ok++;
      } else {
        fail++;
        lastError = 'Error en ' + f.name + ': ' + (data.error || data.detail || JSON.stringify(data));
        console.error('[RODAJE UPLOAD] Error response:', data);
      }
    } catch(e) {
      fail++;
      lastError = 'Error de red: ' + e.message;
      console.error('[RODAJE UPLOAD] Excepción:', e);
    }
  }
  if (fail > 0) {
    if (progress) progress.textContent = '❌ ' + lastError + (files.length > 1 ? ' (' + fail + '/' + files.length + ' fallidas)' : '');
  } else {
    if (progress) progress.textContent = '✓ ' + ok + ' fotos analizadas — guardadas en Supabase';
  }
  input.value = '';
  _loadRodajePhotosGrid(state.clientId, state.projectId);
}

async function openBriefingRodaje() {
  var state = _planSuggestState;
  if (!state.cards || !state.cards.length) { showToast('Genera primero el plan'); return; }

  // Crea overlay del briefing
  var existing = document.getElementById('briefingRodajeOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'briefingRodajeOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1200;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:100%;max-width:680px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);padding:1.2rem 1.4rem;display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div style="color:#C29547;font-size:1rem;font-weight:700">📋 Briefing de rodaje</div>' +
          '<div style="color:#aaa;font-size:0.75rem;margin-top:0.2rem">Preparación para la visita al cliente — todo en una sesión</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'briefingRodajeOverlay\').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1rem">✕</button>' +
      '</div>' +
      '<div id="briefingRodajeBody" style="flex:1;overflow-y:auto;padding:1.4rem">' +
        '<div style="text-align:center;padding:3rem 1rem">' +
          '<div style="font-size:2rem;margin-bottom:0.8rem">📋</div>' +
          '<div style="color:#888;font-size:0.85rem;margin-bottom:1.2rem">Opus analizará las ' + state.cards.length + ' cards del plan y preparará la hoja de rodaje completa para el equipo.</div>' +
          '<button onclick="_generateBriefingRodaje()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.7rem 1.6rem;cursor:pointer;font-size:0.85rem;font-weight:700">✦ Generar briefing con Opus</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // Se c'è già un briefing generato, mostralo subito
  if (state.briefing_rodaje) {
    _renderBriefingRodaje(state.briefing_rodaje);
  }
}

async function _generateBriefingRodaje() {
  var state = _planSuggestState;
  var body = document.getElementById('briefingRodajeBody');
  if (!body) return;

  body.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2rem;margin-bottom:0.8rem">✦</div><div style="color:#888;font-size:0.85rem">Opus sta preparando il briefing di rodaje…<br><span style="color:#bbb;font-size:0.75rem">20-30 secondi</span></div></div>';

  // Trova il responsabile del shooting e dell'intervista dal team
  var shootPerson = 'Carlos Lage';
  var interviewPerson = 'Vicente Palazzolo';
  state.team.forEach(function(m) {
    if (!m._agentKey && m.mode === 'human') {
      if (/filmmaker|fotógrafo|carlos/i.test(m.name + m.role)) shootPerson = m.name;
      if (/ceo|sales|vicente/i.test(m.name + m.role)) interviewPerson = m.name;
    }
  });

  try {
    var res = await fetch(AGENT_API + '/api/projects/briefing-rodaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:            state.clientId,
        project_title:        state.proj ? state.proj.title : '',
        cards:                state.cards,
        team:                 state.team,
        shoot_assignee:       shootPerson,
        interviewer_assignee: interviewPerson
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.detail || 'Error al generar briefing');
    state.briefing_rodaje = data.briefing_rodaje;
    _renderBriefingRodaje(data.briefing_rodaje);
  } catch(e) {
    body.innerHTML = '<div style="color:#c0392b;padding:1.5rem;text-align:center">❌ ' + (e.message || e) + '</div>';
  }
}

function _renderBriefingRodaje(br) {
  var body = document.getElementById('briefingRodajeBody');
  if (!body || !br) return;

  var _angleColor = { técnico:'#2980b9', provocador:'#c0392b', humano:'#27ae60', aspiracional:'#8e44ad', seguimiento:'#888' };
  var _angleIcon  = { técnico:'⚙️', provocador:'💥', humano:'❤️', aspiracional:'🚀', seguimiento:'↩️' };

  // Header info
  var header = '<div style="display:flex;gap:1rem;margin-bottom:1.2rem;flex-wrap:wrap">' +
    (br.fecha_sugerida ? '<div style="background:#f5f3ef;border-radius:8px;padding:0.5rem 0.9rem;font-size:0.78rem"><strong>📅 Fecha sugerida</strong><br>' + br.fecha_sugerida + '</div>' : '') +
    (br.duracion_estimada ? '<div style="background:#f5f3ef;border-radius:8px;padding:0.5rem 0.9rem;font-size:0.78rem"><strong>⏱ Duración</strong><br>' + br.duracion_estimada + '</div>' : '') +
    (br.lugar ? '<div style="background:#f5f3ef;border-radius:8px;padding:0.5rem 0.9rem;font-size:0.78rem"><strong>📍 Lugar</strong><br>' + br.lugar + '</div>' : '') +
  '</div>';

  // Sezione filmmaker
  var filmSection = '';
  if (br.filmmaker && br.filmmaker.length) {
    var filmRows = br.filmmaker.map(function(item) {
      var tipoIcon = item.tipo === 'foto' ? '📸' : item.tipo === 'broll' ? '🎬' : '🎥';
      var para = Array.isArray(item.sirve_para) ? item.sirve_para.join(', ') : (item.sirve_para || '');
      return '<div style="padding:0.8rem;border:1px solid #e0dbd2;border-radius:8px;margin-bottom:0.6rem">' +
        '<div style="display:flex;align-items:flex-start;gap:0.6rem">' +
          '<span style="font-size:1rem;flex-shrink:0">' + tipoIcon + '</span>' +
          '<div style="flex:1">' +
            '<div style="font-weight:600;font-size:0.83rem;color:#1F2A24">' + (item.descripcion || '') + '</div>' +
            (para ? '<div style="font-size:0.72rem;color:#C29547;margin-top:0.2rem">→ sirve para: ' + para + '</div>' : '') +
            (item.notas ? '<div style="font-size:0.72rem;color:#888;margin-top:0.3rem;font-style:italic">💡 ' + item.notas + '</div>' : '') +
          '</div>' +
          '<input type="checkbox" style="width:16px;height:16px;accent-color:#1F2A24;flex-shrink:0;margin-top:2px">' +
        '</div>' +
      '</div>';
    }).join('');
    filmSection = '<div style="margin-bottom:1.4rem">' +
      '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;color:#888;margin-bottom:0.6rem;text-transform:uppercase">🎥 Para el Filmmaker / Fotógrafo</div>' +
      filmRows +
    '</div>';
  }

  // Sezione entrevistador
  var interviewSection = '';
  if (br.entrevistador) {
    var introHtml = br.entrevistador.intro
      ? '<div style="background:#fef9f0;border-left:3px solid #C29547;border-radius:0 8px 8px 0;padding:0.7rem 0.9rem;margin-bottom:0.8rem;font-size:0.78rem;color:#555">' + br.entrevistador.intro + '</div>'
      : '';

    var preguntas = (br.entrevistador.preguntas || []).map(function(q) {
      var angulo = (q.angulo || 'técnico').toLowerCase();
      var color = _angleColor[angulo] || '#888';
      var icon = _angleIcon[angulo] || '❓';
      return '<div style="padding:0.8rem;border:1px solid #e0dbd2;border-radius:8px;margin-bottom:0.6rem;border-left:3px solid ' + color + '">' +
        '<div style="display:flex;align-items:flex-start;gap:0.6rem">' +
          '<span style="font-size:0.9rem;flex-shrink:0">' + icon + '</span>' +
          '<div style="flex:1">' +
            '<div style="font-size:0.65rem;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.25rem">' + angulo + '</div>' +
            '<div style="font-weight:600;font-size:0.83rem;color:#1F2A24">' + (q.pregunta || '') + '</div>' +
            (q.sirve_para && q.sirve_para !== 'general' ? '<div style="font-size:0.72rem;color:#C29547;margin-top:0.2rem">→ ' + q.sirve_para + '</div>' : '') +
            (q.objetivo ? '<div style="font-size:0.71rem;color:#888;margin-top:0.25rem;font-style:italic">' + q.objetivo + '</div>' : '') +
          '</div>' +
          '<input type="checkbox" style="width:16px;height:16px;accent-color:#1F2A24;flex-shrink:0;margin-top:2px">' +
        '</div>' +
      '</div>';
    }).join('');

    interviewSection = '<div>' +
      '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;color:#888;margin-bottom:0.6rem;text-transform:uppercase">🎙️ Para el Entrevistador (Vicente)</div>' +
      introHtml +
      preguntas +
    '</div>';
  }

  body.innerHTML = header + filmSection + interviewSection;
}

// ── STATI PLAN TASK ──────────────────────────────────────────────────────────
var _PSTAT = {
  todo:   { label:'Pendiente', bg:'#f0ece5', color:'#888',    dot:'🟡' },
  wip:    { label:'En curso',  bg:'#dbeafe', color:'#2563eb', dot:'🔵' },
  review: { label:'Revisión',  bg:'#fef3c7', color:'#b45309', dot:'🟠' },
  done:   { label:'Listo',     bg:'#dcfce7', color:'#16a34a', dot:'🟢' },
};
var _PSTAT_CYCLE = ['todo','wip','review','done'];

function _nextPstat(cur) {
  var i = _PSTAT_CYCLE.indexOf(cur || 'todo');
  return _PSTAT_CYCLE[(i+1) % _PSTAT_CYCLE.length];
}

function planSubtaskCycle(ci, si) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  sub.status = _nextPstat(sub.status);
  // Aggiorna stato card in base alle subtask
  var allDone = card.subtasks.every(function(s){ return s.status==='done'; });
  var anyWip  = card.subtasks.some(function(s){ return s.status==='wip'||s.status==='review'; });
  card.status = allDone ? 'done' : anyWip ? 'wip' : 'todo';
  if (card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ subtasks: card.subtasks, status: card.status })
    }).catch(function(){});
  }
  // Aggiorna solo la sezione detail senza re-render completo
  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  var pill = document.getElementById('plan-card-status-'+ci);
  if (pill) {
    var st = _PSTAT[card.status||'todo'];
    pill.textContent = st.dot+' '+st.label;
    pill.style.background = st.bg; pill.style.color = st.color;
  }
}

function _renderPlanDetail(card, ci) {
  var subs = card.subtasks || [];
  // Trova il primo subtask non completato (quello attivo)
  var firstActive = -1;
  for (var k = 0; k < subs.length; k++) {
    if ((subs[k].status||'todo') !== 'done') { firstActive = k; break; }
  }

  var subtasksHtml = subs.map(function(s, si) {
    // Sezione speciale per varianti caption (Bellavista / upload materiale)
    if (s.phase === 'captions') return _renderCaptionSubtask(s, ci);

    // Risolvi assignee: se è un nome umano non più nel team attivo → sostituisci
    var rawAssignee = s.assignee || '';
    var resolvedAssignee = (function(name) {
      if (!name) return '—';
      var lower = name.toLowerCase();
      if (lower.indexOf('agente') >= 0) return name; // è già un agente AI, ok
      // "Revisión del cliente" → sempre "Tú — Revisor"
      if ((s.name || '').toLowerCase().indexOf('revisión') >= 0 || (s.name || '').toLowerCase().indexOf('revision') >= 0) return 'Tú — Revisor';
      // Cerca nel team attivo
      var activeTeam = (_planSuggestState && _planSuggestState.team) ? _planSuggestState.team : [];
      var member = activeTeam.find(function(m){ return m.name === name; });
      if (!member || member._disabled) return 'Por asignar';
      if (member.mode === 'ai') return '🤖 Agente AI (' + member.role + ')';
      return name;
    })(rawAssignee);

    var isAI    = resolvedAssignee.toLowerCase().indexOf('agente') >= 0 || resolvedAssignee.toLowerCase().indexOf('🤖') >= 0;
    var status  = s.status || 'todo';
    var isDone  = status === 'done';
    var isActive = si === firstActive;
    var isPast  = si < firstActive;
    var isFuture = !isDone && !isActive && si > firstActive;

    // Colori riga
    var rowBg    = isDone ? '#f0fdf4' : isActive ? '#fff' : '#fafaf8';
    var rowBorder= isDone ? '1px solid #bbf7d0' : isActive ? '2px solid #1F2A24' : '1px solid #f0ece5';
    var opacity  = isFuture ? '0.5' : '1';

    // Numero step
    var stepColor  = isDone ? '#16a34a' : isActive ? '#1F2A24' : '#ddd';
    var stepLabel  = isDone ? '✓' : (si+1);
    var stepNum = '<div style="width:26px;height:26px;border-radius:50%;background:'+stepColor+';color:'+(isDone?'#fff':isActive?'#C29547':'#aaa')+';display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">'+stepLabel+'</div>';

    // Bottone azione
    var actionBtn = '';
    if (isDone) {
      actionBtn = '<span style="font-size:0.72rem;color:#16a34a;font-weight:700">✓ Listo</span>';
    } else if (isActive) {
      if (status === 'wip') {
        actionBtn = '<button onclick="planSubtaskConfirm('+ci+','+si+')" style="background:#16a34a;color:#fff;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">✓ Confirmar</button>';
      } else if (isDesignerStep) {
        actionBtn = '<button onclick="launchDesignerStep('+ci+','+si+')" style="background:#2563eb;color:#fff;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">🎨 Abrir en Agentes</button>';
      } else {
        actionBtn = '<button onclick="planSubtaskStart('+ci+','+si+')" style="background:#1F2A24;color:#C29547;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">▶ Iniciar</button>';
      }
    } else if (!isDone && !isFuture) {
      actionBtn = '<button onclick="planSubtaskStart('+ci+','+si+')" style="background:transparent;color:#888;border:1px solid #e0dbd2;border-radius:7px;padding:0.3rem 0.7rem;font-size:0.72rem;cursor:pointer">▶ Iniciar</button>';
    }

    // Badge tu turno
    var turnoHtml = isActive && status === 'todo'
      ? '<div style="font-size:0.65rem;font-weight:700;color:#b45309;background:#fef3c7;border-radius:20px;padding:0.1rem 0.5rem;display:inline-block;margin-bottom:0.25rem">👉 Siguiente paso</div>'
      : '';

    var isRevisor = resolvedAssignee.indexOf('Revisor') >= 0;
    var isDesignerStep = rawAssignee.toLowerCase().indexOf('designer') >= 0;
    var badgeColor = isAI ? '#C29547' : isRevisor ? '#7c3aed' : '#555';
    var badgeBg    = isAI ? '#1F2A24' : isRevisor ? '#faf5ff' : '#f0ece5';
    var badgeIcon  = isAI ? '🤖 ' : isRevisor ? '👁 ' : '👤 ';
    var assigneeBadge = '<span style="font-size:0.67rem;font-weight:600;color:'+badgeColor+';background:'+badgeBg+';border-radius:10px;padding:0.15rem 0.5rem">'+badgeIcon+resolvedAssignee+'</span>';

    // Badge fase (PRE / RODAJE / POST / PUB)
    var phaseBadge = '';
    if (s.phase === 'pre')         phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#eff6ff;color:#2563eb;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">PRE</span>';
    else if (s.phase === 'rodaje') phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#fef3c7;color:#b45309;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">🎬 RODAJE</span>';
    else if (s.phase === 'post')   phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#f0fdf4;color:#16a34a;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">POST</span>';
    else if (s.phase === 'pub')    phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#faf5ff;color:#7c3aed;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">PUB</span>';

    return '<div style="display:flex;gap:0.7rem;align-items:flex-start;padding:0.7rem 0.8rem;margin-bottom:0.4rem;border-radius:9px;border:'+rowBorder+';background:'+rowBg+';opacity:'+opacity+';transition:all 0.2s">' +
      stepNum +
      '<div style="flex:1;min-width:0">' +
        turnoHtml +
        '<div style="font-size:0.8rem;font-weight:600;color:#1F2A24;margin-bottom:0.2rem">'+phaseBadge+(s.name||s.title||'')+'</div>' +
        '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:'+(s.tip?'0.3rem':'0')+'">' +
          assigneeBadge +
          (s.date ? '<span style="font-size:0.65rem;color:#aaa">📅 '+s.date+'</span>' : '') +
        '</div>' +
        (s.tip && !isFuture ? '<div style="font-size:0.7rem;color:#888;font-style:italic;line-height:1.4;border-top:1px solid #f0ece5;padding-top:0.3rem">💡 '+s.tip+'</div>' : '') +
        (isDone && s.output ? (function(){
          var firstLine = s.output.split('\n').find(function(l){ return l.trim().length>0; }) || '';
          firstLine = firstLine.replace(/^[#\*\-\s]+/,'').substring(0,90);
          var thumb = s.suggested_photo && s.suggested_photo.url
            ? '<img src="'+s.suggested_photo.url+'" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0">'
            : '';
          return '<div style="margin-top:0.4rem;padding:0.35rem 0.5rem;background:#f0fdf4;border-radius:6px;border-left:2px solid #16a34a;display:flex;gap:0.5rem;align-items:center">'+thumb+'<span style="font-size:0.67rem;color:#555;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+firstLine+'</span></div>';
        })() : '') +
      '</div>' +
      '<div style="flex-shrink:0;display:flex;align-items:center">'+actionBtn+'</div>' +
    '</div>';
  }).join('');

  var materialHtml = (card.material_needed && !card.material_needed.toLowerCase().includes('digital'))
    ? '<div style="display:flex;align-items:center;gap:0.5rem;background:#fef9f0;border:1px solid #fde68a;border-radius:7px;padding:0.5rem 0.8rem;margin-bottom:0.8rem;font-size:0.75rem;color:#92400e"><span>📦</span><span><strong>Material necesario:</strong> '+card.material_needed+'</span></div>'
    : '';
  var noteHtml = card.creative_note
    ? '<div style="font-size:0.75rem;color:#555;font-style:italic;margin-bottom:0.8rem;padding:0.5rem 0.8rem;background:#f9f6f0;border-radius:6px;border-left:3px solid #C29547">'+card.creative_note+'</div>'
    : '';

  // Sezione upload foto + varianti caption (quando la card non ha ancora subtask)
  var uploadHtml = '';
  if (!subs.length) {
    uploadHtml =
      '<div style="background:#f9f6f0;border:1.5px dashed #C29547;border-radius:9px;padding:0.9rem 1rem;text-align:center">' +
        '<div style="font-size:0.78rem;color:#888;margin-bottom:0.7rem">Esta card aún no tiene flujo de trabajo</div>' +
        '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap">' +
          '<button onclick="planUploadPhoto(' + ci + ')" style="background:#1F2A24;color:#C29547;border:none;border-radius:7px;padding:0.45rem 1rem;font-size:0.75rem;font-weight:700;cursor:pointer">📸 Subir foto + Vision</button>' +
          '<button onclick="showGenSubtasksForm(' + ci + ')" style="background:#f5f3ef;color:#555;border:1.5px solid #e0dbd2;border-radius:7px;padding:0.45rem 1rem;font-size:0.75rem;cursor:pointer">📋 Generar flujo estándar</button>' +
        '</div>' +
      '</div>';
  }

  return noteHtml + materialHtml +
    (subtasksHtml
      ? '<div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Flujo de trabajo</div>' + subtasksHtml
      : uploadHtml);
}

// ─── UPLOAD FOTO + VISION + CAPTION VARIANTS ───────────────────────────────

function planUploadPhoto(ci) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    if (!input.files || !input.files[0]) return;
    _doUploadAndAnalyze(ci, input.files[0]);
  };
  input.click();
}

async function _doUploadAndAnalyze(ci, file) {
  var det = document.getElementById('plan-card-detail-' + ci);
  if (!det) return;
  var card = _planSuggestState.cards[ci];
  var state = _planSuggestState;

  // Mostra stato caricamento
  det.innerHTML =
    '<div style="padding:1rem;text-align:center;color:#888;font-size:0.8rem">' +
      '<div style="font-size:1.4rem;margin-bottom:0.5rem">📸</div>' +
      '<div>Subiendo foto y analizando con Vision…</div>' +
      '<div style="margin-top:0.4rem;font-size:0.7rem;color:#bbb">Esto tarda unos segundos</div>' +
    '</div>';

  try {
    var fd = new FormData();
    fd.append('client_id', state.clientId);
    fd.append('file', file);

    var res  = await fetch(BRAVO_API + '/api/projects/' + encodeURIComponent(state.projectId) + '/upload-media', { method: 'POST', body: fd });
    var data = await res.json();

    if (!data.ok) { showToast('⚠️ Error al subir: ' + (data.error || 'desconocido')); return; }

    // Guarda en la card como subtask speciale "captions"
    var captionSub = {
      phase: 'captions',
      name:  'Variantes de caption',
      status: 'todo',
      media_url: data.photo_url,
      scene_description: data.scene_description || '',
      variants: [],
      selected_variant: null,
      date: '',
      assignee: 'Agente Copywriter'
    };

    card.subtasks = [captionSub];
    _patchPlanCard(card);

    // Aggiorna view
    det.innerHTML = _renderPlanDetail(card, ci);
    _updatePlanCardHeader(card, ci);
    showToast('✅ Foto analizada — ' + (data.scene_description ? 'descripción lista' : 'sin Vision'));

  } catch(e) {
    showToast('⚠️ Error de conexión al subir foto');
    det.innerHTML = _renderPlanDetail(card, ci);
  }
}

async function planGenerateCaptions(ci) {
  var card = _planSuggestState.cards[ci];
  var capSub = (card.subtasks || []).find(function(s){ return s.phase === 'captions'; });
  if (!capSub) { showToast('⚠️ Sube primero una foto'); return; }

  var det = document.getElementById('plan-card-detail-' + ci);
  if (det) det.innerHTML =
    '<div style="padding:1rem;text-align:center;color:#888;font-size:0.8rem">' +
      '<div style="font-size:1.4rem;margin-bottom:0.5rem">🤖</div>' +
      '<div>Generando variantes de caption…</div>' +
    '</div>';

  try {
    var numVariants = window._orgVariants || 3;
    var res  = await fetch(BRAVO_API + '/api/projects/' + encodeURIComponent(_planSuggestState.projectId) + '/generate-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:         _planSuggestState.clientId,
        scene_description: capSub.scene_description,
        num_variants:      numVariants
      })
    });
    var data = await res.json();
    if (!data.ok || !data.variants) { showToast('⚠️ Error al generar captions'); return; }

    capSub.variants = data.variants;
    capSub.status   = 'wip';
    _patchPlanCard(card);

    if (det) det.innerHTML = _renderPlanDetail(card, ci);
    showToast('✦ ' + data.variants.length + ' variantes generadas — elige la mejor');

  } catch(e) {
    showToast('⚠️ Error de conexión al generar captions');
    if (det) det.innerHTML = _renderPlanDetail(card, ci);
  }
}

function planSelectCaption(ci, variantIdx) {
  var card   = _planSuggestState.cards[ci];
  var capSub = (card.subtasks || []).find(function(s){ return s.phase === 'captions'; });
  if (!capSub) return;
  capSub.selected_variant = variantIdx;
  capSub.status = 'done';
  card.status = card.subtasks.every(function(s){ return s.status === 'done'; }) ? 'done' : 'wip';
  _patchPlanCard(card);
  var det = document.getElementById('plan-card-detail-' + ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  showToast('✅ Caption seleccionada — lista para publicar');
}

function showGenSubtasksForm(ci) {
  var card = _planSuggestState.cards[ci];
  var sd   = _planSuggestState.shooting_date || '';
  var noteHtml = card.creative_note
    ? '<div style="font-size:0.75rem;color:#555;font-style:italic;margin-bottom:0.8rem;padding:0.5rem 0.8rem;background:#f9f6f0;border-radius:6px;border-left:3px solid #C29547">'+card.creative_note+'</div>'
    : '';
  var det = document.getElementById('plan-card-detail-' + ci);
  if (!det) return;
  det.innerHTML = noteHtml +
    '<div style="background:#f9f6f0;border:1.5px solid #C29547;border-radius:9px;padding:0.9rem 1rem">' +
      '<div style="font-size:0.75rem;font-weight:700;color:#1F2A24;margin-bottom:0.5rem">📋 Generar flujo de trabajo estándar</div>' +
      '<div style="font-size:0.7rem;color:#888;margin-bottom:0.7rem;line-height:1.5">Se crearán los pasos de producción (script, rodaje, edición, caption, revisión, publicación) con fechas calculadas desde la fecha de rodaje.</div>' +
      '<label style="font-size:0.72rem;font-weight:600;color:#555;display:block;margin-bottom:0.3rem">📅 Fecha de rodaje</label>' +
      '<input type="date" id="gsf-sd-'+ci+'" value="'+sd+'" style="padding:0.35rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem;width:100%;margin-bottom:0.8rem;box-sizing:border-box">' +
      '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
        '<button onclick="var det=document.getElementById(\'plan-card-detail-'+ci+'\');if(det)det.innerHTML=_renderPlanDetail(_planSuggestState.cards['+ci+'],'+ci+')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:none;border:1px solid #e0dbd2;border-radius:6px;cursor:pointer;color:#888">Cancelar</button>' +
        '<button onclick="_genStandardSubtasks('+ci+')" style="font-size:0.72rem;padding:0.35rem 1rem;background:#1F2A24;color:#C29547;border:none;border-radius:7px;cursor:pointer;font-weight:700">✓ Generar pasos</button>' +
      '</div>' +
    '</div>';
}

function _genStandardSubtasks(ci) {
  var sdInput = document.getElementById('gsf-sd-' + ci);
  var sd = sdInput ? sdInput.value : (_planSuggestState.shooting_date || '');
  if (!sd) { showToast('⚠️ Introduce la fecha de rodaje'); return; }
  var card = _planSuggestState.cards[ci];
  card.subtasks = _buildIndividualSubtasks(sd, card.publish_date);
  _patchPlanCard(card);
  var det = document.getElementById('plan-card-detail-' + ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  showToast('✓ Flujo de trabajo generado');
}

// ─── RENDER speciale per la sezione "captions" dentro _renderPlanDetail ───
// (inserito dinamicamente nel mapping subs della funzione sopra)

function _renderCaptionSubtask(s, ci) {
  var variants  = s.variants || [];
  var hasPic    = !!s.media_url;
  var hasDesc   = !!s.scene_description;
  var hasVars   = variants.length > 0;
  var selected  = s.selected_variant;
  var isDone    = s.status === 'done';

  var photoHtml = hasPic
    ? '<div style="margin-bottom:0.7rem"><img src="'+s.media_url+'" alt="foto" style="width:100%;max-height:160px;object-fit:cover;border-radius:7px;border:1px solid #e0dbd2"></div>'
    : '';

  var descHtml = hasDesc
    ? '<div style="font-size:0.7rem;color:#555;font-style:italic;background:#f9f6f0;border-left:3px solid #C29547;padding:0.4rem 0.7rem;border-radius:0 6px 6px 0;margin-bottom:0.7rem;line-height:1.5">🧠 <strong>Análisis Vision:</strong> '+s.scene_description+'</div>'
    : '';

  var genBtn = !hasVars && !isDone
    ? '<button onclick="planGenerateCaptions('+ci+')" style="width:100%;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:7px;padding:0.5rem;font-size:0.75rem;font-weight:700;cursor:pointer;margin-top:0.3rem">🤖 Generar '+(window._orgVariants||3)+' variantes de caption</button>'
    : '';

  var varsHtml = '';
  if (hasVars) {
    varsHtml = '<div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Variantes de caption</div>';
    variants.forEach(function(v, idx) {
      var isSelected = selected === idx;
      var bg    = isSelected ? '#f0fdf4' : '#fff';
      var bd    = isSelected ? '2px solid #16a34a' : '1px solid #e0dbd2';
      var check = isSelected ? '<span style="color:#16a34a;font-weight:700;font-size:0.72rem">✅ Seleccionada</span>' : '';
      varsHtml +=
        '<div style="border:'+bd+';background:'+bg+';border-radius:8px;padding:0.7rem 0.8rem;margin-bottom:0.5rem">' +
          '<div style="font-size:0.65rem;font-weight:700;color:#C29547;margin-bottom:0.3rem;text-transform:uppercase">'+
            'Variante '+(idx+1)+' · '+(v.persona||'')+'</div>' +
          '<div style="font-size:0.75rem;color:#1F2A24;line-height:1.55;white-space:pre-wrap">'+v.caption+'</div>' +
          (!isDone
            ? '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;justify-content:flex-end">' +
                check +
                '<button onclick="planSelectCaption('+ci+','+idx+')" style="font-size:0.7rem;padding:0.25rem 0.7rem;background:#16a34a;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700">✓ Aprobar</button>' +
              '</div>'
            : '<div style="margin-top:0.4rem">'+check+'</div>') +
        '</div>';
    });
    if (!isDone) {
      varsHtml += '<button onclick="planGenerateCaptions('+ci+')" style="font-size:0.7rem;padding:0.3rem 0.8rem;background:none;border:1px solid #e0dbd2;border-radius:6px;cursor:pointer;color:#888;margin-top:0.2rem">🔄 Regenerar variantes</button>';
    }
  }

  return '<div style="border:1.5px solid #e0dbd2;border-radius:9px;padding:0.8rem;margin-bottom:0.5rem;background:#fff">' +
    '<div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem">📸 Contenido visual + Caption</div>' +
    photoHtml + descHtml + genBtn + varsHtml +
  '</div>';
}

function planSubtaskStart(ci, si) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  var isAI = (sub.assignee||'').toLowerCase().indexOf('agente') >= 0;

  if (isAI) {
    openAiStepPopup(ci, si);
    return;
  }

  sub.status = 'wip';
  card.status = 'wip';
  _patchPlanCard(card);
  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  showToast('▶ ' + (sub.assignee||'Equipo') + ' — tarea iniciada');
}

// Prompt specifico per ogni tipo di step AI

async function openAiStepPopup(ci, si) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  var proj = _planSuggestState.proj;

  var existing = document.getElementById('ai-step-popup-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'ai-step-popup-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1300;display:flex;align-items:center;justify-content:center;padding:1rem';

  var phaseBadgeColor = sub.phase==='pre'?'#2563eb': sub.phase==='post'?'#16a34a': sub.phase==='pub'?'#7c3aed':'#b45309';
  var phaseLabel      = sub.phase==='pre'?'PRE': sub.phase==='post'?'POST': sub.phase==='pub'?'PUB':'RODAJE';

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.28)">' +
      '<div style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);padding:1.1rem 1.4rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem">' +
            '<span style="font-size:0.62rem;font-weight:700;background:'+phaseBadgeColor+';color:#fff;border-radius:4px;padding:0.1rem 0.4rem">'+phaseLabel+'</span>' +
            '<span style="color:#C29547;font-size:0.95rem;font-weight:700">'+(sub.name||'')+'</span>' +
          '</div>' +
          '<div style="color:#aaa;font-size:0.72rem">🤖 '+(sub.assignee||'Agente AI')+' — generando output…</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'ai-step-popup-overlay\').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0">✕</button>' +
      '</div>' +
      '<div id="ai-step-popup-body" style="flex:1;overflow-y:auto;padding:1.3rem;min-height:200px">' +
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1rem;gap:1rem">' +
          '<div style="font-size:2rem;animation:spin 1s linear infinite">✦</div>' +
          '<div style="color:#888;font-size:0.85rem">El agente está trabajando…</div>' +
        '</div>' +
      '</div>' +
      '<div id="ai-step-popup-footer" style="display:none;padding:1rem 1.4rem;border-top:1.5px solid #f0ece5;display:flex;gap:0.6rem;flex-shrink:0">' +
        '<button onclick="document.getElementById(\'ai-step-popup-overlay\').remove()" style="flex:1;padding:0.6rem;border:1.5px solid #e0dbd2;border-radius:10px;background:#f5f3ef;color:#555;cursor:pointer;font-size:0.85rem">Cancelar</button>' +
        '<button onclick="confirmAiStep('+ci+','+si+')" style="flex:2;padding:0.6rem;border:none;border-radius:10px;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;font-weight:700;cursor:pointer;font-size:0.85rem">✓ Confirmar y continuar</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Chiama il nuovo endpoint dedicato execute-step
  try {
    // Raccoglie output dei passi precedenti già confermati
    var previousOutputs = (card.subtasks || []).slice(0, si)
      .filter(function(s){ return s.status === 'done' && s.output; })
      .map(function(s){ return { step_name: s.name || '', output: s.output }; });

    // Carica foto rodaje del progetto (per passi POST/caption)
    var rodajePhotos = [];
    var projectId = _planSuggestState.projectId;
    if (projectId) {
      try {
        var pRes  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/rodaje-photos?client_id=' + encodeURIComponent(_planSuggestState.clientId));
        var pData = await pRes.json();
        rodajePhotos = (pData.photos || []).map(function(p) {
          return { filename: p.filename, scene_description: p.scene_description, url: p.url };
        });
      } catch(e) { /* non bloccante */ }
    }

    var res = await fetch(AGENT_API + '/api/projects/execute-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:        _planSuggestState.clientId,
        project_title:    proj ? (proj.title||'') : (card.title||''),
        card_title:       card.title || '',
        card_format:      card.format || '',
        step_name:        sub.name || '',
        step_phase:       sub.phase || '',
        agent_type:       sub.agent_type || '',
        previous_outputs: previousOutputs,
        team:             _planSuggestState.team || [],
        rodaje_photos:    rodajePhotos
      })
    });
    var data = await res.json();

    var output = '';
    if (data && data.output)   output = data.output;
    else if (data && data.text) output = data.text;
    else output = JSON.stringify(data, null, 2);

    sub.output = output;
    if (data.suggested_photo) sub.suggested_photo = data.suggested_photo;

    var suggestedPhotoHtml = '';
    if (data.suggested_photo && data.suggested_photo.url) {
      suggestedPhotoHtml =
        '<div style="margin-bottom:0.9rem;border:2px solid #2563eb;border-radius:10px;overflow:hidden">' +
          '<div style="background:#eff6ff;padding:0.4rem 0.7rem;font-size:0.65rem;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.08em">📸 Foto sugerida por el agente — preview Instagram</div>' +
          '<div style="width:100%;aspect-ratio:4/5;overflow:hidden;background:#000">' +
            '<img src="' + data.suggested_photo.url + '" style="width:100%;height:100%;object-fit:contain;display:block">' +
          '</div>' +
          '<div style="padding:0.45rem 0.7rem;font-size:0.68rem;color:#555;font-style:italic;background:#f8faff;line-height:1.45">' + (data.suggested_photo.scene_description || '') + '</div>' +
        '</div>';
    }

    var body = document.getElementById('ai-step-popup-body');
    if (body) body.innerHTML =
      '<div style="font-size:0.72rem;font-weight:700;color:#16a34a;margin-bottom:0.8rem;display:flex;align-items:center;gap:0.4rem">✅ Output generado — revisa y edita si necesitas</div>' +
      suggestedPhotoHtml +
      '<textarea id="ai-step-output-area" style="width:100%;min-height:220px;border:1.5px solid #e0dbd2;border-radius:10px;padding:0.8rem;font-size:0.82rem;line-height:1.6;resize:vertical;font-family:inherit;color:#1F2A24;background:#fff;box-sizing:border-box">' + output.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</textarea>';

    var footer = document.getElementById('ai-step-popup-footer');
    if (footer) footer.style.display = 'flex';

  } catch(e) {
    var body = document.getElementById('ai-step-popup-body');
    if (body) body.innerHTML = '<div style="color:#c0392b;padding:1.5rem;text-align:center">❌ Error: ' + (e.message||e) + '</div>';
    var footer = document.getElementById('ai-step-popup-footer');
    if (footer) footer.style.display = 'flex';
  }
}

function confirmAiStep(ci, si) {
  var card    = _planSuggestState.cards[ci];
  var sub     = card.subtasks[si];
  var area    = document.getElementById('ai-step-output-area');
  if (area) sub.output = area.value;

  sub.status  = 'done';
  var allDone = card.subtasks.every(function(s){ return s.status==='done'; });
  card.status = allDone ? 'done' : 'wip';
  _patchPlanCard(card);

  // Salva in generated_content con status 'en_revision' se è uno step caption/copywriter
  var stepName = (sub.name || '').toLowerCase();
  if (sub.output && (stepName.indexOf('caption') >= 0 || stepName.indexOf('redacc') >= 0 || stepName.indexOf('copywriter') >= 0)) {
    _saveStepToGeneratedContent(card, sub);
  }

  var overlay = document.getElementById('ai-step-popup-overlay');
  if (overlay) overlay.remove();

  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);

  var nextSub = card.subtasks[si+1];
  if (allDone) showToast('🟢 ¡Todos los pasos completados!');
  else if (nextSub) showToast('✓ Confirmado — siguiente: ' + (nextSub.assignee||'equipo'));
  else showToast('✓ Paso completado');
}

function planSubtaskConfirm(ci, si) {
  var card = _planSuggestState.cards[ci];
  card.subtasks[si].status = 'done';
  // Activa siguiente subtask (si existe)
  var nextSub = card.subtasks[si+1];
  var nextName = nextSub ? nextSub.assignee : null;
  // Recalcula estado card
  var allDone = card.subtasks.every(function(s){ return s.status==='done'; });
  card.status = allDone ? 'done' : 'wip';
  _patchPlanCard(card);
  // Aggiorna anche in _allPlanTasks
  if (window._allPlanTasks) {
    var pt = window._allPlanTasks.find(function(t){ return t.title===card.title && t.client_id===_planSuggestState.clientId; });
    if (pt) { pt.subtasks = card.subtasks; pt.status = card.status; }
  }
  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  if (allDone) {
    showToast('🟢 ¡Publicación completada! Todo listo.');
  } else if (nextName) {
    showToast('✓ Confirmado — siguiente: ' + nextName);
  } else {
    showToast('✓ Paso completado');
  }
}

function _patchPlanCard(card) {
  if (card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ subtasks: card.subtasks, status: card.status })
    }).catch(function(){});
  }
}

function _saveStepToGeneratedContent(card, sub) {
  if (typeof db === 'undefined' || !dbConnected) return;
  var caption = sub.output || '';
  var headline = caption.split('\n').find(function(l){ return l.trim().length > 0; }) || '';
  headline = headline.replace(/^[#\*\-\s]+/, '').substring(0, 120);
  var photo = sub.suggested_photo || null;
  var clientUUID = _planSuggestState.clientId;
  // Se è una chiave breve (es. 'bellavista'), la risolve in UUID
  if (clientUUID && clientUUID.indexOf('-') === -1) {
    try {
      if (typeof clientUUIDFromKey === 'function') {
        clientUUID = clientUUIDFromKey(clientUUID) || clientUUID;
      }
    } catch(e) {}
  }
  console.log('[PLAN] client UUID per generated_content:', clientUUID);

  var payload = {
    client_id:    clientUUID,
    platform:     'Instagram',
    pillar:       card.pillar || '',
    format:       card.format || '',
    content_type: card.title || '',
    headline:     headline,
    caption:      caption,
    agent_notes:  'Piano: ' + (card.title || ''),
    img_b64:      photo ? photo.url : null,
    generated_by: 'plan',
    status:       'en_revision'
  };

  db.from('generated_content').insert(payload).then(function(res) {
    if (res.error) { console.warn('[PLAN] Errore save generated_content:', res.error.message); return; }
    console.log('[PLAN] ✓ Salvato en_revision:', headline);
    if (typeof loadRecentContentFromDB === 'function') loadRecentContentFromDB();
  });
}

function _updatePlanCardHeader(card, ci) {
  var st = _PSTAT[card.status||'todo'];
  var pill = document.getElementById('plan-card-status-'+ci);
  if (pill) { pill.textContent = st.dot+' '+st.label; pill.style.background=st.bg; pill.style.color=st.color; }
  var totalSub = (card.subtasks||[]).length;
  var doneSub  = (card.subtasks||[]).filter(function(s){return s.status==='done';}).length;
  var progPct  = totalSub ? Math.round(doneSub/totalSub*100) : 0;
  var progBar = document.querySelector('#plan-card-'+ci+' .plan-prog-bar');
  if (progBar) { progBar.style.width = progPct+'%'; progBar.style.background = progPct===100?'#16a34a':'#2563eb'; }
}

// Mappa formato → icona e label
var _FORMAT_LABELS = {
  feed:      { icon: '📸', label: 'Feed' },
  story:     { icon: '📱', label: 'Story' },
  reel:      { icon: '▶️', label: 'Reel' },
  carousel:  { icon: '📖', label: 'Carousel' },
  brand_kit: { icon: '🎨', label: 'Brand Kit' },
  logo:      { icon: '✦',  label: 'Logo' },
  tipografia:{ icon: '🔤', label: 'Tipografía' },
  paleta:    { icon: '🎨', label: 'Paleta' },
  manual:    { icon: '📄', label: 'Manual' },
  ads:       { icon: '📣', label: 'Ads' },
  seo:       { icon: '🔍', label: 'SEO' },
};

// Restituisce il numero di settimana del mese (1-4) da una data YYYY-MM-DD
function _weekOfMonth(dateStr) {
  if (!dateStr) return 1;
  var d = new Date(dateStr + 'T12:00:00');
  return Math.ceil(d.getDate() / 7);
}

function _renderPlanCards(cards) {
  // Render organizer header siempre (incluso si no hay cards aún)
  var organizer = _renderRodajeOrganizer(cards);

  if (!cards.length) return organizer + '<div style="color:#888;padding:1rem;text-align:center;font-size:0.85rem">No hay cards generadas</div>';

  var teamOpts = _teamMembers.map(function(m){
    return '<option value="' + m.name + '">' + (m.employment_type === 'agent' ? '🤖 ' : '') + m.name + '</option>';
  }).join('');

  var sharedRef = _findSharedCard(cards);
  var sharedExists = !!sharedRef;
  var sharedDone = _isSharedDone(cards);

  // Render shared card primero (si existe), luego las individuales agrupadas por semana
  var sharedHtml = '';
  cards.forEach(function(card, i) {
    if (card.format !== 'shared') return;
    sharedHtml += _renderSharedCardRow(card, i);
  });

  // Raggruppa solo le card non-shared per settimana
  var weeks = {};
  cards.forEach(function(card, i) {
    if (card.format === 'shared') return;
    var w = _weekOfMonth(card.publish_date);
    if (!weeks[w]) weeks[w] = [];
    weeks[w].push({ card: card, i: i });
  });

  var html = sharedHtml;
  [1,2,3,4].forEach(function(w) {
    if (!weeks[w] || !weeks[w].length) return;
    html += '<div style="margin-bottom:0.4rem;margin-top:' + (w > 1 ? '1.2rem' : '0.8rem') + '">' +
      '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C29547;padding:0.3rem 0;border-bottom:1.5px solid #f0ece5;margin-bottom:0.6rem">Semana ' + w + '</div>' +
    '</div>';

    weeks[w].forEach(function(item) {
      var card = item.card;
      var i    = item.i;

      var fmt   = _FORMAT_LABELS[card.format] || { icon: '📋', label: card.format || 'Contenido' };
      var badge = '<span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.65rem;font-weight:700;background:#f0ece5;color:#555;border-radius:20px;padding:0.15rem 0.55rem;margin-right:0.4rem">' + fmt.icon + ' ' + fmt.label + '</span>';

      var dateFormatted = card.publish_date
        ? new Date(card.publish_date + 'T12:00:00').toLocaleDateString('es-ES', {weekday:'short', day:'2-digit', month:'short'})
        : '';

      var isEditing = card._editing;
      var cardSt  = _PSTAT[card.status || 'todo'];
      // Barra progresso subtask
      var totalSub = (card.subtasks||[]).length;
      var doneSub  = (card.subtasks||[]).filter(function(s){ return s.status==='done'; }).length;
      var progPct  = totalSub ? Math.round(doneSub/totalSub*100) : 0;

      // Lock visivo: bloccato finché la shared non è finita (solo si la shared existe)
      var isLocked = totalSub > 0 && sharedExists && !sharedDone;
      var lockBadge = isLocked
        ? '<span style="font-size:0.6rem;font-weight:700;background:#f3f4f6;color:#888;border-radius:4px;padding:0.1rem 0.4rem;margin-left:0.3rem" title="Esperando que termine la producción compartida">🔒</span>'
        : '';
      var cardOpacity = isLocked ? '0.78' : '1';

      var viewMode =
        '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;background:#fafaf8;cursor:pointer;opacity:'+cardOpacity+'" onclick="togglePlanCard(' + i + ')">' +
          '<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0">' + (i+1) + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:0.85rem;color:#1F2A24;margin-bottom:0.15rem">' + badge + (card.title || '') + lockBadge + '</div>' +
            '<div style="font-size:0.72rem;color:#888">' + dateFormatted + ' · ' + (card.assignee || '') + (totalSub ? ' · '+doneSub+'/'+totalSub+' tareas' : '') + '</div>' +
            (totalSub ? '<div style="height:3px;background:#f0ece5;border-radius:2px;margin-top:0.3rem;overflow:hidden"><div class="plan-prog-bar" style="height:100%;width:'+progPct+'%;background:'+(progPct===100?'#16a34a':'#2563eb')+';border-radius:2px;transition:width 0.3s"></div></div>' : '') +
          '</div>' +
          '<div style="display:flex;gap:0.35rem;align-items:center;flex-shrink:0">' +
            '<span id="plan-card-status-'+i+'" onclick="event.stopPropagation()" style="font-size:0.67rem;font-weight:700;background:'+cardSt.bg+';color:'+cardSt.color+';border-radius:20px;padding:0.15rem 0.55rem;white-space:nowrap">'+cardSt.dot+' '+cardSt.label+'</span>' +
            (!isLocked && card.status !== 'done' ? '<button onclick="event.stopPropagation();launchPlanCardInAgentes('+i+')" style="font-size:0.68rem;padding:0.2rem 0.6rem;background:linear-gradient(135deg,#1F2A24,#2d4a3e);border:none;border-radius:5px;cursor:pointer;color:#C29547;font-weight:700;white-space:nowrap">▶ Genera</button>' : '') +
            '<button onclick="event.stopPropagation();planCardEdit('+i+')" style="font-size:0.68rem;padding:0.2rem 0.5rem;background:none;border:1px solid #e0dbd2;border-radius:5px;cursor:pointer;color:#888">✏️</button>' +
            '<button onclick="event.stopPropagation();planCardDelete('+i+')" style="font-size:0.68rem;padding:0.2rem 0.5rem;background:none;border:1px solid #f3c0b8;border-radius:5px;cursor:pointer;color:#c0392b">🗑</button>' +
            '<span style="color:#bbb;font-size:0.75rem">▾</span>' +
          '</div>' +
        '</div>' +
        '<div id="plan-card-detail-' + i + '" style="display:none;padding:0.85rem 1rem;border-top:1px solid #f0ece5">' +
          _renderPlanDetail(card, i) +
        '</div>';

      var editMode =
        '<div style="padding:0.85rem 1rem;background:#fafaf8;display:flex;gap:0.5rem;align-items:center">' +
          '<div style="width:36px;height:36px;border-radius:8px;background:#e0dbd2;color:#888;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0">' + (i+1) + '</div>' +
          '<div style="flex:1;display:flex;flex-direction:column;gap:0.4rem">' +
            '<input id="pce-title-' + i + '" value="' + (card.title||'').replace(/"/g,'&quot;') + '" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
            '<div style="display:flex;gap:0.5rem">' +
              '<input type="date" id="pce-date-' + i + '" value="' + (card.publish_date||'') + '" style="flex:1;padding:0.3rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem">' +
              '<select id="pce-assign-' + i + '" style="flex:1;padding:0.3rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem">' + teamOpts + '</select>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:0.3rem">' +
            '<button onclick="planCardSaveEdit(' + i + ')" style="font-size:0.7rem;padding:0.25rem 0.6rem;background:#1F2A24;color:#C29547;border:none;border-radius:5px;cursor:pointer">✓</button>' +
            '<button onclick="planCardCancelEdit(' + i + ')" style="font-size:0.7rem;padding:0.25rem 0.6rem;background:none;border:1px solid #e0dbd2;border-radius:5px;cursor:pointer;color:#888">✕</button>' +
          '</div>' +
        '</div>';

      html += '<div id="plan-card-' + i + '" style="border:1.5px solid #e0dbd2;border-radius:10px;margin-bottom:0.6rem;overflow:hidden">' +
        (isEditing ? editMode : viewMode) +
      '</div>';
    });
  });

  return organizer + html +
  '<button onclick="planCardAdd()" style="width:100%;margin-top:0.5rem;padding:0.6rem;background:none;border:1.5px dashed #e0dbd2;border-radius:8px;cursor:pointer;font-size:0.78rem;color:#888">+ Añadir card</button>';
}

// Render della card "Producción compartida" (formato visivo distinto)
function _renderSharedCardRow(card, i) {
  var subs = card.subtasks || [];
  var totalSub = subs.length;
  var doneSub  = subs.filter(function(s){ return s.status==='done'; }).length;
  var progPct  = totalSub ? Math.round(doneSub/totalSub*100) : 0;
  var done = totalSub > 0 && doneSub === totalSub;
  var cardSt = _PSTAT[done ? 'done' : (doneSub > 0 ? 'wip' : 'todo')];

  var rodajeSub = subs.find(function(s){ return s.phase==='rodaje'; });
  var rodajeLabel = rodajeSub && rodajeSub.date ? _fmtDateShort(rodajeSub.date) : '';

  var headerBg = done
    ? 'linear-gradient(135deg,#16a34a,#15803d)'
    : 'linear-gradient(135deg,#1F2A24,#2d4a3e)';

  return '<div id="plan-card-' + i + '" style="border:2px solid #C29547;border-radius:12px;margin-bottom:1rem;overflow:hidden;box-shadow:0 2px 8px rgba(31,42,36,0.08)">' +
    '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.95rem 1rem;background:'+headerBg+';color:#C29547;cursor:pointer" onclick="togglePlanCard(' + i + ')">' +
      '<div style="font-size:1.4rem;flex-shrink:0">🎬</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C29547;opacity:0.85;margin-bottom:0.1rem">Flujo compartido</div>' +
        '<div style="font-weight:700;font-size:0.95rem;color:#fff;margin-bottom:0.15rem">'+(card.title||'Producción compartida')+'</div>' +
        '<div style="font-size:0.72rem;color:#C29547;opacity:0.95">'+(rodajeLabel?'🎬 Rodaje '+rodajeLabel+' · ':'')+ doneSub+'/'+totalSub+' pasos completados</div>' +
        (totalSub ? '<div style="height:4px;background:rgba(194,149,71,0.25);border-radius:2px;margin-top:0.4rem;overflow:hidden"><div class="plan-prog-bar" style="height:100%;width:'+progPct+'%;background:#C29547;border-radius:2px;transition:width 0.3s"></div></div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:0.35rem;align-items:center;flex-shrink:0">' +
        '<span id="plan-card-status-'+i+'" onclick="event.stopPropagation()" style="font-size:0.67rem;font-weight:700;background:'+cardSt.bg+';color:'+cardSt.color+';border-radius:20px;padding:0.15rem 0.55rem;white-space:nowrap">'+cardSt.dot+' '+cardSt.label+'</span>' +
        '<button onclick="event.stopPropagation();planCardDelete('+i+')" style="font-size:0.7rem;padding:0.2rem 0.45rem;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:5px;cursor:pointer;color:#fff;font-weight:700" title="Eliminar de Supabase">✕</button>' +
        '<span style="color:#C29547;font-size:0.85rem">▾</span>' +
      '</div>' +
    '</div>' +
    '<div id="plan-card-detail-' + i + '" style="display:none;padding:0.95rem 1rem;background:#fafaf8;border-top:1px solid #C29547">' +
      _renderPlanDetail(card, i) +
    '</div>' +
  '</div>';
}

function togglePlanCard(i) {
  var detail = document.getElementById('plan-card-detail-' + i);
  if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
}

function planCardDelete(i) {
  var card = _planSuggestState.cards[i];
  var label = card ? (card.title || 'esta tarjeta') : 'esta tarjeta';
  var ok = confirm('¿Eliminar "' + label + '"?\n\nSe borrará definitivamente de Supabase.');
  if (!ok) return;
  // Se ha _db_id, elimina direttamente la riga da Supabase
  if (card && card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, { method: 'DELETE' })
      .catch(function(){});
  }
  _planSuggestState.cards.splice(i, 1);
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  showToast('🗑 "' + label + '" eliminada de Supabase');
}

function planCardEdit(i) {
  _planSuggestState.cards[i]._editing = true;
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  // Pre-seleziona il responsabile nel select
  var sel = document.getElementById('pce-assign-' + i);
  if (sel) sel.value = _planSuggestState.cards[i].assignee || '';
}

function planCardCancelEdit(i) {
  _planSuggestState.cards[i]._editing = false;
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
}

function planCardSaveEdit(i) {
  var card = _planSuggestState.cards[i];
  var titleEl  = document.getElementById('pce-title-' + i);
  var dateEl   = document.getElementById('pce-date-' + i);
  var assignEl = document.getElementById('pce-assign-' + i);
  if (titleEl)  card.title        = titleEl.value.trim();
  if (dateEl)   card.publish_date = dateEl.value;
  if (assignEl) card.assignee     = assignEl.value;
  card._editing = false;
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  // Auto-guarda la card modificada en Supabase
  if (card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: card.title, publish_date: card.publish_date, assignee: card.assignee })
    }).catch(function(e){ console.warn('[PLAN] Error al guardar card:', e.message); });
  } else {
    // Card nueva sin _db_id: re-salva todo el plan
    var state = _planSuggestState;
    _savePlanTasksToSupabase(state.clientId, state.projectId, state.proj, state.cards);
  }
}

function planCardAdd() {
  var today = new Date().toISOString().slice(0,10);
  _planSuggestState.cards.push({ title:'Nueva tarea', publish_date: today, assignee:'', format:'', subtasks:[], _editing: true });
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  var i = _planSuggestState.cards.length - 1;
  var sel = document.getElementById('pce-assign-' + i);
  if (sel) sel.value = '';
}

function closePlanSuggest() {
  document.getElementById('planSuggestOverlay').style.display = 'none';
  _planSuggestState = { clientId: null, projectId: null, cards: [] };
}

function confirmPlan() {
  var cards = _planSuggestState.cards;
  var clientId = _planSuggestState.clientId;
  var projectId = _planSuggestState.projectId;
  var proj = _planSuggestState.proj;
  if (!cards.length || !projectId) return;

  if (!KANBAN_DATA[projectId]) {
    KANBAN_DATA[projectId] = { info:[], ideas:[], todo:[], wip:[], done:[], pub:[], meet:[], shoot:[], prop:[] };
  }

  cards.forEach(function(card) {
    var dateFormatted = card.publish_date
      ? new Date(card.publish_date + 'T12:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'short'})
      : '';
    KANBAN_DATA[projectId]['todo'].push({
      t:        card.title || 'Post',
      m:        (card.assignee || '') + (dateFormatted ? ' · ' + dateFormatted : ''),
      desc:     (card.creative_note || '') + '\n\n' + (card.subtasks||[]).map(function(s){ return '• ' + s.name + ' (' + (s.date||'') + ') — ' + (s.assignee||''); }).join('\n'),
      assign:   card.assignee || '',
      date:     card.publish_date || '',
      priority: 'Normal',
      links:    [],
      comments: ''
    });
  });

  // Salva anche su Supabase
  _savePlanTasksToSupabase(clientId, projectId, proj, cards);

  // Bridge → Hoy toca: aggiungi subtask umane a _equipoTasks
  if (typeof _equipoTasks === 'undefined') window._equipoTasks = {};
  cards.forEach(function(card) {
    (card.subtasks || []).forEach(function(s) {
      var assignee = s.assignee || '';
      if (!assignee || assignee.toLowerCase().indexOf('agente') >= 0) return;
      if (!_equipoTasks[assignee]) _equipoTasks[assignee] = [];
      // Evita duplicati
      var taskLabel = card.title + ' — ' + (s.name || s.title || '');
      var alreadyIn = _equipoTasks[assignee].some(function(t){
        return (typeof t === 'string' ? t : t.t) === taskLabel;
      });
      if (!alreadyIn) _equipoTasks[assignee].push({ t: taskLabel, date: s.date || card.publish_date, status: s.status || 'todo', source: 'plan' });
    });
  });
  if (typeof renderHoyStrip === 'function') renderHoyStrip();

  // Aggiorna cache globale plan tasks per il Tablero Plan
  window._allPlanTasks = (window._allPlanTasks || []).filter(function(t){ return t.project_id !== projectId; });
  cards.forEach(function(card) {
    window._allPlanTasks.push(Object.assign({}, card, { client_id: clientId, project_id: projectId, project_title: proj ? proj.title : '' }));
  });

  showToast('✦ ' + cards.length + ' tarjetas añadidas al plan');
  closePlanSuggest();

  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function _savePlanTasksToSupabase(clientId, projectId, proj, cards) {
  try {
    // Deduplicazione: se ci sono più card "shared", tiene solo la prima
    var seenShared = false;
    cards = cards.filter(function(c) {
      if (c.format === 'shared') {
        if (seenShared) return false;
        seenShared = true;
      }
      return true;
    });
    var tasks = cards.map(function(card) {
      // Genera UUID stabile se la card non ne ha ancora uno
      if (!card._db_id) card._db_id = crypto.randomUUID();
      return {
        id:            card._db_id,       // UUID stabile → UPSERT in-place
        client_id:     clientId,
        project_id:    projectId,
        project_title: proj ? (proj.title || '') : '',
        title:         card.title || 'Tarea',
        assignee:      card.assignee || '',
        publish_date:  card.publish_date || null,
        status:        card.status || 'todo',  // preserva stato reale
        priority:      'Normal',
        format:        card.format || '',
        creative_note: card.creative_note || '',
        subtasks:      card.subtasks || []
      };
    });
    var res = await fetch(BRAVO_API + '/api/plan-tasks/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: tasks })
    });
    var data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.detail || 'Error al guardar');

    // Aggiorna _db_id in-memory dai task restituiti dal server (già stabili per UPSERT,
    // ma garantisce allineamento se il backend ha generato un id diverso)
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach(function(saved) {
        var match = cards.find(function(c){ return c.title === saved.title && !c._db_id_confirmed; });
        if (match && saved.id) { match._db_id = saved.id; match._db_id_confirmed = true; }
      });
    }

    showToast('✓ Plan guardado en Supabase (' + tasks.length + ' tareas)');
  } catch(e) {
    console.warn('[PLAN TASKS] Salvataggio fallito:', e.message);
    showToast('⚠️ Plan no guardado en Supabase: ' + (e.message || 'error desconocido'));
  }
}

async function saveProgramar() {
  var startEl  = document.getElementById('progInlineStart');
  var endEl    = document.getElementById('progInlineEnd');
  var assignEl = document.getElementById('progInlineAssign');
  var budgetEl = document.getElementById('progInlineBudget');

  var startVal  = startEl  ? startEl.value  : '';
  var endVal    = endEl    ? endEl.value    : '';
  var assignVal = assignEl ? assignEl.value : '';
  var budgetVal = budgetEl ? budgetEl.value : '';

  if (!startVal) { showToast('Selecciona la fecha de inicio'); return; }
  if (!endVal)   { endVal = startVal; }

  var saveBtn = document.querySelector('.cproj-inline-panel .btn-acc');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }

  try {
    // 1. Salva dati progetto (come prima)
    await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(_programarState.projectId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        status:      'aprobado',
        start_date:  startVal,
        end_date:    endVal,
        assigned_to: assignVal || null,
        budget_eur:  budgetVal ? parseInt(budgetVal) : null
      })
    });

    // 2. Salva tareas — prima elimina quelle vecchie (senza id = nuove), poi crea tutte
    var pId = _programarState.projectId;
    var cId = _programarState.clientId;
    // Elimina le tareas con id (già salvate in precedenza) che non sono più presenti
    var existingIds = _programarTasks.filter(function(t){ return t.id; }).map(function(t){ return t.id; });
    // Crea le nuove (senza id)
    var newTasks = _programarTasks.filter(function(t){ return !t.id; });
    await Promise.all(newTasks.map(function(t, i) {
      return fetch(AGENT_API + '/api/projects/' + encodeURIComponent(pId) + '/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          client_id:       cId,
          title:           t.title,
          description:     t.description || '',
          role:            t.role || null,
          assigned_to:     t.assigned_to || null,
          start_date:      t.start_date || null,
          end_date:        t.end_date || null,
          priority:        t.priority || 'normal',
          order_index:     i
        })
      });
    }));

    // 3. Aggiorna cache locale progetto
    var arr = _clientProjects[cId];
    if (arr) {
      var proj = arr.find(function(x){ return x.id === pId; });
      if (proj) {
        proj.status      = 'aprobado';
        proj.start_date  = startVal;
        proj.end_date    = endVal;
        proj.assigned_to = assignVal || null;
        proj.budget_eur  = budgetVal ? parseInt(budgetVal) : null;
      }
    }

    // 4. Invalida cache tareas cliente e ricarica
    delete _clientTasksCache[cId];
    _loadClientTasks(cId);

    var savedClientId = cId;
    _programarTasks = [];
    closeProgramarModal();
    var panelCal = document.querySelector('.ctab-panel[data-tab="calendario"]');
    if (panelCal) panelCal.innerHTML = renderCalendarioSection(savedClientId);
    showToast('✅ Proyecto programado con ' + (_programarTasks.length || newTasks.length) + ' tareas');
  } catch(e) {
    showToast('Error al guardar. Intenta de nuevo.');
  }
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar'; }
}

// ── PROGRAMAR — HELPERS TAREAS ───────────────────────────────────────────────

function programarRemoveTask(idx) {
  _programarTasks.splice(idx, 1);
  if (_programarExpandedIdx === idx) _programarExpandedIdx = null;
  else if (_programarExpandedIdx > idx) _programarExpandedIdx--;
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarAddTaskRow() {
  var t = { title: 'Nueva tarea', role: 'copy', assigned_to: '', start_date: '', end_date: '', priority: 'normal', _confirmed: false };
  _programarTasks.push(t);
  _programarExpandedIdx = _programarTasks.length - 1; // apre subito il form
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarToggleTask(idx) {
  _programarExpandedIdx = (_programarExpandedIdx === idx) ? null : idx;
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarSetPriority(idx, value) {
  _programarTasks[idx].priority = value;
  var el = document.getElementById('ptask-priority-' + idx);
  if (el) el.value = value;
  // Ricolora i bottoni senza re-render completo
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarConfirmTask(idx) {
  // Legge i valori dal form espanso e li salva nel task
  var t = _programarTasks[idx];
  if (!t) return;
  var get = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
  t.title       = get('ptask-title-'    + idx) || t.title;
  t.description = get('ptask-desc-'     + idx);
  t.role        = get('ptask-role-'     + idx);
  t.assigned_to = get('ptask-assign-'   + idx);
  t.start_date  = get('ptask-start-'    + idx);
  t.end_date    = get('ptask-end-'      + idx);
  t.priority    = get('ptask-priority-' + idx);
  t._confirmed  = true;
  _programarExpandedIdx = null;
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

async function programarSuggestAI() {
  var ps = _programarState;
  var arr = _clientProjects[ps.clientId];
  var proj = arr ? arr.find(function(x){ return x.id === ps.projectId; }) : null;
  if (!proj) return;
  var btn = document.getElementById('progAiBtn');
  if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }
  try {
    // Recupera snippet briefing per contesto più preciso
    var briefingSnippet = '';
    try {
      var br = await fetch(AGENT_API + '/api/briefing/' + encodeURIComponent(ps.clientId));
      var bd = await br.json();
      if (bd.briefing_text) briefingSnippet = bd.briefing_text.slice(0, 1200);
    } catch(e) {}

    var r = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(ps.projectId) + '/suggest-tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:            proj.title || '',
        description:      proj.description || '',
        category:         proj.category || '',
        client_id:        ps.clientId,
        briefing_snippet: briefingSnippet
      })
    });
    var d = await r.json();
    if (d.ok && d.tasks && d.tasks.length) {
      var startBase = new Date();
      d.tasks.forEach(function(t) {
        var s = new Date(startBase);
        s.setDate(s.getDate() + (t.start_offset || 0));
        var e = new Date(s);
        e.setDate(e.getDate() + (t.duration_days || 3));
        _programarTasks.push({
          title:       t.title,
          description: t.description || '',
          role:        t.role || 'gestión',
          assigned_to: t.assigned_to || '',
          start_date:  s.toISOString().slice(0,10),
          end_date:    e.toISOString().slice(0,10),
          priority:    t.priority || 'normal',
          _confirmed:  false
        });
      });
      _programarExpandedIdx = null;
      var listEl = document.getElementById('progTasksList');
      if (listEl) _renderProgramarTasksList(listEl);
      showToast('✦ ' + d.tasks.length + ' tareas sugeridas — revísalas una por una');
    }
  } catch(e) { showToast('Error al contactar IA'); }
  if (btn) { btn.textContent = '✦ Sugerir con IA'; btn.disabled = false; }
}

function _renderProgramarTasksList(listEl) {
  var roleEmoji    = { estrategia:'🧠', copy:'✍️', diseño:'🎨', video:'🎬', ads:'📣', publicación:'📤', reporting:'📊', gestión:'📋' };
  var memberColors = {}; _teamMembers.forEach(function(m){ memberColors[m.name] = m.color; });
  var TEAM_NAMES   = _teamMembers.map(function(m){ return m.name; });
  var ROLES        = ['estrategia','copy','diseño','video','ads','publicación','reporting','gestión'];

  if (!_programarTasks.length) {
    listEl.innerHTML = '<div style="font-size:0.73rem;color:var(--muted2);text-align:center;padding:1rem">' +
      'Sin tareas — usa <strong>✦ Sugerir con IA</strong> o <strong>+ Añadir</strong></div>';
    return;
  }

  var pending   = _programarTasks.filter(function(t){ return !t._confirmed; }).length;
  var confirmed = _programarTasks.length - pending;
  var banner = pending
    ? '<div style="font-size:0.7rem;padding:0.45rem 0.7rem;background:#fff8e1;border:1px solid #ffe082;border-radius:7px;color:#795548;margin-bottom:0.5rem">' +
        '📋 <strong>' + _programarTasks.length + '</strong> tareas — ' +
        '<strong style="color:#C0392B">' + pending + ' por revisar</strong>' +
        (confirmed ? ' · <strong style="color:#2e7d32">' + confirmed + ' confirmadas ✓</strong>' : '') +
        ' — Clica cada tarea para revisarla' +
      '</div>'
    : '<div style="font-size:0.7rem;padding:0.45rem 0.7rem;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:7px;color:#2e7d32;margin-bottom:0.5rem">' +
        '✅ Todas las tareas revisadas y confirmadas — listo para guardar' +
      '</div>';

  var rows = _programarTasks.map(function(t, i) {
    var isExpanded = _programarExpandedIdx === i;
    var col    = memberColors[t.assigned_to] || '#888';
    var emoji  = roleEmoji[t.role] || '📌';
    var isAI   = !t._confirmed;
    var borderColor = t._confirmed ? '#a5d6a7' : (isExpanded ? '#C0392B' : 'var(--border)');
    var bgColor     = t._confirmed ? '#f1f8f1' : (isExpanded ? '#fff8f8' : 'var(--bg)');

    // ── Riga collassata
    var collapsed =
      '<div onclick="programarToggleTask(' + i + ')" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">' +
        '<span style="font-size:0.9rem;flex-shrink:0">' + emoji + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.75rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            (t._confirmed ? '<span style="color:#2e7d32">✓ </span>' : '<span style="color:#e65100;font-size:0.65rem">IA · </span>') +
            t.title +
          '</div>' +
          '<div style="font-size:0.67rem;margin-top:0.1rem;color:' + col + '">' +
            (t.assigned_to || '<span style="color:#e65100">Sin asignar</span>') + ' · ' + (t.role || '') +
          '</div>' +
        '</div>' +
        '<div style="font-size:0.62rem;color:var(--muted2);white-space:nowrap;flex-shrink:0">' +
          (t.start_date ? t.start_date.slice(5) : '') + (t.end_date && t.end_date !== t.start_date ? '→' + t.end_date.slice(5) : '') +
        '</div>' +
        '<span style="color:var(--muted2);font-size:0.7rem;flex-shrink:0;padding:0 0.2rem">' + (isExpanded ? '▲' : '▼') + '</span>' +
        '<button onclick="event.stopPropagation();programarRemoveTask(' + i + ')" ' +
          'style="background:none;border:none;cursor:pointer;color:var(--muted2);font-size:1rem;padding:0;flex-shrink:0;line-height:1">×</button>' +
      '</div>';

    // ── Form espanso
    var expanded = !isExpanded ? '' :
      '<div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border)">' +
        // Titolo
        '<div style="margin-bottom:0.45rem">' +
          '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">TÍTULO</label>' +
          '<input id="ptask-title-' + i + '" type="text" value="' + (t.title||'').replace(/"/g,'&quot;') + '" ' +
            'style="width:100%;font-size:0.75rem;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:6px;background:#fff;box-sizing:border-box">' +
        '</div>' +
        // Descripción
        '<div style="margin-bottom:0.45rem">' +
          '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">DESCRIPCIÓN</label>' +
          '<textarea id="ptask-desc-' + i + '" rows="2" ' +
            'style="width:100%;font-size:0.73rem;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:6px;background:#fff;resize:vertical;box-sizing:border-box">' +
            (t.description||'') +
          '</textarea>' +
        '</div>' +
        // Rol + Responsable
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.45rem">' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">ROL</label>' +
            '<select id="ptask-role-' + i + '" style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff">' +
              ROLES.map(function(r){ return '<option value="' + r + '"' + (t.role===r?' selected':'') + '>' + (roleEmoji[r]||'') + ' ' + r + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">RESPONSABLE</label>' +
            '<select id="ptask-assign-' + i + '" style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff">' +
              '<option value="">Sin asignar</option>' +
              TEAM_NAMES.map(function(n){ return '<option value="' + n + '"' + (t.assigned_to===n?' selected':'') + '>' + n.split(' ')[0] + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        // Fechas
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.45rem">' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">FECHA INICIO</label>' +
            '<input id="ptask-start-' + i + '" type="date" value="' + (t.start_date||'') + '" ' +
              'style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff;box-sizing:border-box">' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">FECHA FIN</label>' +
            '<input id="ptask-end-' + i + '" type="date" value="' + (t.end_date||'') + '" ' +
              'style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff;box-sizing:border-box">' +
          '</div>' +
        '</div>' +
        // Prioridad
        '<div style="margin-bottom:0.6rem">' +
          '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">PRIORIDAD</label>' +
          '<div style="display:flex;gap:0.4rem">' +
            ['alta','normal','baja'].map(function(p){
              var colors = { alta:'#C0392B', normal:'#2980b9', baja:'#7f8c8d' };
              var sel = t.priority === p;
              return '<button type="button" onclick="programarSetPriority(' + i + ',\'' + p + '\')" ' +
                'style="font-size:0.7rem;padding:0.22rem 0.65rem;border-radius:20px;cursor:pointer;border:1px solid ' +
                (sel ? colors[p] : 'var(--border)') + ';background:' + (sel ? colors[p] : 'transparent') + ';' +
                'color:' + (sel ? '#fff' : 'var(--muted2)') + ';font-weight:' + (sel?'700':'400') + '">' + p + '</button>';
            }).join('') +
          '</div>' +
          '<input type="hidden" id="ptask-priority-' + i + '" value="' + (t.priority||'normal') + '">' +
        '</div>' +
        // Bottone Confirmar
        '<button onclick="programarConfirmTask(' + i + ')" ' +
          'style="width:100%;padding:0.45rem;background:#2e7d32;color:#fff;border:none;border-radius:8px;' +
          'font-size:0.75rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem">' +
          '✓ Confirmar tarea' +
        '</button>' +
      '</div>';

    return '<div style="padding:0.5rem 0.65rem;background:' + bgColor + ';border-radius:9px;border:1px solid ' + borderColor + ';transition:border-color 0.15s">' +
      collapsed + expanded +
    '</div>';
  }).join('');

  listEl.innerHTML = banner + rows;
}

// ── CARGA TAREAS CLIENTE (para Gantt) ────────────────────────────────────────

async function _loadClientTasks(clientId) {
  try {
    var r = await fetch(AGENT_API + '/api/clients/' + encodeURIComponent(clientId) + '/tasks');
    var d = await r.json();
    if (d.ok) {
      _clientTasksCache[clientId] = d.tasks || [];
      var panelCal = document.querySelector('.ctab-panel[data-tab="calendario"]');
      if (panelCal && panelCal.dataset && panelCal.dataset.clientId === clientId) {
        panelCal.innerHTML = renderCalendarioSection(clientId);
      }
    }
  } catch(e) {}
}

// ── SECCIÓN CALENDARIO (GANTT) ────────────────────────────────────────────────

function renderCalendarioSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">Sin cliente</div>';

  var mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var TEAM   = _teamMembers.map(function(m){ return { name: m.name, initials: m.initials, color: m.color }; });
  var catColors = {
    CONTENIDO:'#1a6fa8', PUBLICIDAD:'#a81a6f', ALIANZAS:'#1a8a1e',
    'SEO LOCAL':'#a87c1a', CONVERSIÓN:'#6f1aa8', CAMPAÑA:'#a81a1a'
  };
  var catBg = {
    CONTENIDO:'#e8f4fd', PUBLICIDAD:'#fde8f4', ALIANZAS:'#e8fde9',
    'SEO LOCAL':'#fdf5e8', CONVERSIÓN:'#f0e8fd', CAMPAÑA:'#fde8e8'
  };

  // Tareas cargadas
  var tasks = _clientTasksCache[clientId] || [];

  // Si no hay tareas en cache, dispara la carga y muestra estado de espera
  if (!_clientTasksCache.hasOwnProperty(clientId)) {
    _loadClientTasks(clientId);
    return '<div class="ctab-placeholder" style="padding:3rem 1rem;text-align:center">' +
      '<div style="font-size:1.4rem;margin-bottom:0.5rem">⏳</div>' +
      '<strong>Cargando calendario…</strong>' +
    '</div>';
  }

  // Fallback: si no hay tareas, usa fechas de proyectos como antes
  var tasksWithDates = tasks.filter(function(t){ return t.start_date; });
  var allProjects    = _clientProjects[clientId] || [];
  var programmed     = allProjects.filter(function(p){ return p.start_date && p.status !== 'rechazado'; });

  if (!tasksWithDates.length && !programmed.length) {
    return '<div class="ctab-placeholder" style="padding:3rem 1rem;text-align:center">' +
      '<div style="font-size:1.8rem;margin-bottom:0.5rem">📅</div>' +
      '<strong>Sin tareas programadas</strong><br>' +
      '<span style="font-size:0.78rem;color:var(--muted2)">Usa "📅 Programar" en los proyectos aprobados y añade tareas al equipo.</span>' +
    '</div>';
  }

  // Calcola range mesi da tutte le date disponibili (tareas + proyectos)
  var allDates = tasksWithDates.map(function(t){ return new Date(t.start_date); })
    .concat(tasksWithDates.map(function(t){ return new Date(t.end_date || t.start_date); }))
    .concat(programmed.map(function(p){ return new Date(p.start_date); }))
    .concat(programmed.map(function(p){ return new Date(p.end_date || p.start_date); }));
  var minDate = allDates.reduce(function(a,b){ return b < a ? b : a; }, allDates[0]);
  var maxDate = allDates.reduce(function(a,b){ return b > a ? b : a; }, allDates[0]);

  var months = [];
  var cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  var endM = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (cur <= endM) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth(), label: mNames[cur.getMonth()] + ' ' + cur.getFullYear() });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  while (months.length < 4) {
    var last = months[months.length - 1];
    var nm = new Date(last.year, last.month + 1, 1);
    months.push({ year: nm.getFullYear(), month: nm.getMonth(), label: mNames[nm.getMonth()] + ' ' + nm.getFullYear() });
  }
  var nCols = months.length;

  function monthIdx(dateStr) {
    if (!dateStr) return 0;
    var d = new Date(dateStr);
    var i = months.findIndex(function(m){ return m.year === d.getFullYear() && m.month === d.getMonth(); });
    return i < 0 ? 0 : i;
  }

  function makeBar(label, startStr, endStr, bgColor, borderColor, textColor, tooltip) {
    var sIdx = monthIdx(startStr);
    var eIdx = monthIdx(endStr || startStr);
    if (eIdx < sIdx) eIdx = sIdx;
    var span = eIdx - sIdx + 1;
    var cells = '';
    if (sIdx > 0) cells += '<div style="grid-column:span ' + sIdx + '"></div>';
    cells += '<div title="' + (tooltip||label) + '" style="grid-column:span ' + span + ';' +
      'background:' + bgColor + ';border-left:3px solid ' + borderColor + ';' +
      'color:' + textColor + ';border-radius:4px;padding:0.18rem 0.5rem;' +
      'font-size:0.68rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      label +
    '</div>';
    var after = nCols - sIdx - span;
    if (after > 0) cells += '<div style="grid-column:span ' + after + '"></div>';
    return '<div style="display:grid;grid-template-columns:repeat(' + nCols + ',1fr);gap:2px;margin-bottom:2px">' + cells + '</div>';
  }

  // Intestazione mesi
  var now = new Date();
  var headerCells = months.map(function(m) {
    var isNow = m.year === now.getFullYear() && m.month === now.getMonth();
    return '<div class="gantt-month-head' + (isNow?' gantt-month-now':'') + '">' + m.label + '</div>';
  }).join('');
  var header = '<div class="gantt-header" style="grid-template-columns:repeat(' + nCols + ',1fr)">' + headerCells + '</div>';

  // KPI rapido
  var totalTasks = tasksWithDates.length;
  var doneCount  = tasks.filter(function(t){ return t.status === 'completado'; }).length;
  var kpi = '<div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">' +
    '<div style="font-size:0.72rem;color:var(--muted2)">📋 <strong>' + totalTasks + '</strong> tareas programadas</div>' +
    '<div style="font-size:0.72rem;color:var(--muted2)">✅ <strong>' + doneCount + '</strong> completadas</div>' +
    '<div style="font-size:0.72rem;color:var(--muted2)">👥 <strong>' + TEAM.length + '</strong> miembros</div>' +
  '</div>';

  // Una sezione per ogni membro del team
  var sections = TEAM.map(function(member) {
    var memberTasks = tasksWithDates.filter(function(t){ return t.assigned_to === member.name; });
    // Aggiungi anche progetto-livello se assigned_to batte
    var memberProjs = programmed.filter(function(p){ return p.assigned_to === member.name && !memberTasks.find(function(t){ return t.project_id === p.id; }); });

    var taskCount  = memberTasks.length + memberProjs.length;
    var inProgress = memberTasks.filter(function(t){ return t.status === 'en_progreso'; }).length;
    var overloaded = taskCount >= 5;

    var bars = memberTasks.map(function(t) {
      var proj = allProjects.find(function(p){ return p.id === t.project_id; });
      var cat  = proj ? (proj.category || 'CONTENIDO') : 'CONTENIDO';
      var bg   = catBg[cat]    || '#f0f0f0';
      var col  = catColors[cat] || '#888';
      var statusDot = t.status === 'completado' ? '✅ ' : t.status === 'en_progreso' ? '🔄 ' : '⏳ ';
      return makeBar(statusDot + t.title, t.start_date, t.end_date, bg, col, col, (proj ? proj.title + ' — ' : '') + t.title);
    }).join('');

    // Fallback: barre progetto se nessuna task specifica
    bars += memberProjs.map(function(p) {
      var bg  = catBg[p.category]    || '#f0f0f0';
      var col = catColors[p.category] || '#888';
      return makeBar('📁 ' + p.title, p.start_date, p.end_date, bg, col, col, p.title + ' (proyecto)');
    }).join('');

    return '<div style="margin-bottom:1.2rem">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.4rem">' +
        '<div style="width:26px;height:26px;border-radius:50%;background:' + member.color + ';color:#fff;' +
          'font-size:0.62rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          member.initials +
        '</div>' +
        '<div style="font-size:0.78rem;font-weight:700;color:var(--text)">' + member.name + '</div>' +
        '<div style="font-size:0.67rem;color:var(--muted2)">' + taskCount + ' tareas' + (inProgress ? ' · ' + inProgress + ' en progreso' : '') + '</div>' +
        (overloaded ? '<div style="font-size:0.62rem;background:#fff3cd;color:#856404;padding:0.1rem 0.45rem;border-radius:10px;font-weight:600">⚠️ Carga alta</div>' : '') +
      '</div>' +
      (bars || '<div style="font-size:0.7rem;color:var(--muted2);padding:0.3rem 0;font-style:italic">Sin tareas asignadas este período</div>') +
    '</div>';
  }).join('');

  return '<div class="gantt-wrap">' +
    kpi +
    header +
    '<div style="margin-top:0.6rem">' + sections + '</div>' +
  '</div>';
}

function renderClienteEquipoSection(clientId, clientKey) {
  var ckey = clientKey || clientId;

  var assigned = TEAM_DATA.filter(function(m) {
    var a = _equipoAssignments[m.name] || [];
    return a.indexOf(ckey) !== -1 || a.indexOf(clientId) !== -1;
  });

  if (!assigned.length) {
    return '<div style="padding:2rem;text-align:center;color:var(--muted2);font-size:0.8rem;line-height:1.7">' +
      '◉ Ningún miembro asignado a este cliente.<br>' +
      '<span style="font-size:0.72rem">Ve a la pestaña <strong>Equipo</strong> del menú principal y asigna los miembros.</span>' +
    '</div>';
  }

  // Conta progetti attivi per membro (da cache _clientProjects)
  var allProjs = _clientProjects[clientId] || [];
  var projCountByMember = {};
  allProjs.forEach(function(p) {
    if (p.assigned_to && p.status !== 'rechazado' && p.status !== 'completado') {
      projCountByMember[p.assigned_to] = (projCountByMember[p.assigned_to] || 0) + 1;
    }
  });
  // Progetti assegnati al membro (per mostrarli come lista)
  var projsByMember = {};
  allProjs.forEach(function(p) {
    if (p.assigned_to && p.status !== 'rechazado') {
      if (!projsByMember[p.assigned_to]) projsByMember[p.assigned_to] = [];
      projsByMember[p.assigned_to].push(p);
    }
  });

  var ESTADO_LABELS_SHORT = {
    propuesto:'propuesto', aprobado:'aprobado', planificado:'planif.',
    en_progreso:'en curso', en_revision:'revisión', completado:'✔'
  };

  return '<div class="cequipo-list">' +
    assigned.map(function(m) {
      var tasks = _equipoTasks[m.name] || [];
      var tasksHtml = tasks.length
        ? tasks.map(function(t) {
            return '<div class="cequipo-task-row">' +
              '<div class="cequipo-task-dot" style="background:' + m.color + '"></div>' +
              '<span>' + t + '</span>' +
            '</div>';
          }).join('')
        : '<div class="cequipo-empty">Sin tareas asignadas</div>';

      var mProjs = projsByMember[m.name] || [];
      var projsHtml = mProjs.length
        ? '<div class="cequipo-section-label" style="margin-top:0.75rem">Proyectos asignados</div>' +
          mProjs.map(function(p) {
            return '<div class="cequipo-proj-row">' +
              '<span class="cequipo-proj-dot" style="background:' + m.color + '"></span>' +
              '<span class="cequipo-proj-title">' + (p.title||'') + '</span>' +
              '<span class="cequipo-proj-estado">' + (ESTADO_LABELS_SHORT[p.status]||p.status) + '</span>' +
            '</div>';
          }).join('')
        : '';

      var projCount = projCountByMember[m.name] || 0;
      var loadBadge = projCount > 0
        ? '<span class="cequipo-load-badge" style="background:'+m.color+'">' + projCount + ' proyecto' + (projCount!==1?'s':'') + '</span>'
        : '<span class="cequipo-load-badge cequipo-load-free">Disponible</span>';

      return '<div class="cequipo-card">' +
        '<div class="cequipo-header">' +
          '<div class="cequipo-av" style="background:' + m.color + '">' + m.initials + '</div>' +
          '<div class="cequipo-meta">' +
            '<div class="cequipo-name">' + m.name + ' ' + loadBadge + '</div>' +
            '<div class="cequipo-role">' + m.role + ' · ' + m.detail + '</div>' +
          '</div>' +
        '</div>' +
        projsHtml +
        '<div class="cequipo-tasks">' + tasksHtml + '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

// ── PROFILE CACHE: clientId → profile data ──────────────────
var _clientProfiles = {};

function _profileLoading(clientId) {
  return '<div style="padding:2rem;text-align:center;color:var(--muted2);font-size:0.8rem">⏳ Cargando datos del briefing…</div>';
}

function _profileEmpty(clientId) {
  return '<div style="padding:2rem;text-align:center;color:var(--muted2);font-size:0.8rem;line-height:1.7">' +
    'Sin perfil extraído todavía.<br>' +
    '<button onclick="extractClientProfile(\'' + clientId + '\')" class="bk-adopt-btn" style="margin-top:1rem;font-size:0.78rem">✦ Extraer del briefing con IA</button>' +
  '</div>';
}

function renderEstrategiaSection(clientId) {
  if (!clientId) return _profileEmpty('');
  var p = _clientProfiles[clientId];
  if (p === undefined) { _loadClientProfile(clientId, 'estrategia'); return _profileLoading(clientId); }
  if (p === null) return _profileEmpty(clientId);

  var objectives = (p.objectives||[]).map(function(o) {
    return '<div class="cp-list-item"><span class="cp-dot" style="background:#27ae60"></span>' + o + '</div>';
  }).join('') || '<div class="cp-empty">Sin objetivos definidos</div>';

  var scope = (p.scope||[]).map(function(s) {
    return '<div class="cp-list-item"><span class="cp-dot" style="background:#2980b9"></span>' + s + '</div>';
  }).join('') || '<div class="cp-empty">—</div>';

  var outOfScope = (p.out_of_scope||[]).map(function(s) {
    return '<div class="cp-list-item"><span class="cp-dot" style="background:#e74c3c"></span>' + s + '</div>';
  }).join('') || '<div class="cp-empty">—</div>';

  var pillars = (p.editorial_pillars||[]).map(function(pl) {
    return '<div class="cp-pillar">' +
      '<div class="cp-pillar-name">' + pl.name + (pl.percentage ? ' <span style="color:var(--muted2)">· ' + pl.percentage + '%</span>' : '') + '</div>' +
      '<div class="cp-pillar-desc">' + (pl.description||'') + '</div>' +
    '</div>';
  }).join('') || '<div class="cp-empty">—</div>';

  return '<div class="cp-view">' +
    '<div class="cp-topbar">' +
      '<div class="cp-title">◎ Estrategia</div>' +
      '<button onclick="extractClientProfile(\'' + clientId + '\')" class="bk-newkit-btn" style="font-size:0.7rem">↺ Regenerar</button>' +
    '</div>' +

    '<div class="cp-section"><div class="cp-section-label">Obiettivi</div>' + objectives + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Strategia editoriale</div>' +
      '<div class="cp-narrative">' + (p.strategy||'—') + '</div>' +
    '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Pilastri editoriali</div>' + pillars + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Scope BRAVO — Cosa facciamo</div>' + scope + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Fuori scope — Cosa non facciamo</div>' + outOfScope + '</div>' +
  '</div>';
}

function renderPerfilSection(clientId) {
  if (!clientId) return _profileEmpty('');
  var p = _clientProfiles[clientId];
  if (p === undefined) { _loadClientProfile(clientId, 'perfil'); return _profileLoading(clientId); }
  if (p === null) return _profileEmpty(clientId);

  var contacts = (p.key_contacts||[]).map(function(k) {
    return '<div class="cp-contact">' +
      '<div class="cp-contact-av">' + (k.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2) + '</div>' +
      '<div><div class="cp-contact-name">' + (k.name||'') + '</div>' +
        '<div class="cp-contact-role">' + (k.role||'') + '</div>' +
        (k.description ? '<div class="cp-contact-desc">' + k.description + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('') || '<div class="cp-empty">Sin contactos definidos</div>';

  var partners = (p.partners||[]).map(function(pr) {
    return '<div class="cp-partner">' +
      '<div class="cp-partner-name">' + (pr.name||'') +
        (pr.category ? '<span class="cp-partner-cat">' + pr.category + '</span>' : '') +
      '</div>' +
      '<div class="cp-partner-desc">' + (pr.description||'') + '</div>' +
    '</div>';
  }).join('') || '<div class="cp-empty">Sin partners definidos</div>';

  return '<div class="cp-view">' +
    '<div class="cp-topbar">' +
      '<div class="cp-title">◈ Perfil del cliente</div>' +
      '<button onclick="extractClientProfile(\'' + clientId + '\')" class="bk-newkit-btn" style="font-size:0.7rem">↺ Regenerar</button>' +
    '</div>' +

    '<div class="cp-section"><div class="cp-section-label">Storico</div>' +
      '<div class="cp-narrative">' + (p.history||'—') + '</div>' +
    '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Persone chiave del cliente</div>' + contacts + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Partner & Marchi</div>' + partners + '</div>' +
  '</div>';
}

async function _loadClientProfile(clientId, rerender) {
  try {
    var res = await fetch(AGENT_API + '/api/briefing/profile/' + clientId);
    var data = await res.json();
    _clientProfiles[clientId] = (data.exists && data.profile) ? data.profile : null;
  } catch(e) {
    _clientProfiles[clientId] = null;
  }
  // Aggiorna direttamente il panel già nel DOM
  var tabName = rerender || 'estrategia';
  var panel = document.querySelector('.ctab-panel[data-tab="' + tabName + '"]');
  if (panel) {
    panel.innerHTML = tabName === 'estrategia'
      ? renderEstrategiaSection(clientId)
      : renderPerfilSection(clientId);
  }
}

async function extractClientProfile(clientId) {
  var btn = event && event.target;
  if (btn) { btn.textContent = '⏳ Estrazione…'; btn.disabled = true; }

  try {
    var res = await fetch(AGENT_API + '/api/briefing/extract-profile/' + clientId, { method: 'POST' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error de extracción');
    _clientProfiles[clientId] = data.profile;

    // Aggiorna anche le assegnazioni team
    var teamBravo = (data.profile.team_bravo || []);
    var cObj = CLIENTS_DATA.find(function(c){ return c.id === clientId; });
    var ckey = cObj ? (cObj.client_key || cObj.id) : clientId;
    teamBravo.forEach(function(m) {
      if (!_equipoAssignments[m.name]) _equipoAssignments[m.name] = [];
      if (_equipoAssignments[m.name].indexOf(ckey) === -1) {
        _equipoAssignments[m.name].push(ckey);
        _equipoSave(m.name);
      }
    });

    if (_currentClienteIdx !== undefined) openClientePage(_currentClienteIdx);
  } catch(e) {
    if (btn) { btn.textContent = '✦ Extraer del briefing con IA'; btn.disabled = false; }
    alert('Error: ' + e.message);
  }
}

async function extractContentTypes(clientId) {
  var btn = document.getElementById('bk-ct-btn');
  if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }
  var listEl = document.getElementById('bk-ct-list');
  if (listEl) listEl.innerHTML = '<div style="color:var(--muted2);font-size:0.8rem;padding:0.5rem">Chiedo a Claude di analizzare il briefing…</div>';

  try {
    var res = await fetch(AGENT_API + '/api/briefing/extract-content-types/' + encodeURIComponent(clientId), { method: 'POST' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error de extracción');

    var cts = data.content_types || [];
    if (listEl) {
      listEl.innerHTML = cts.length
        ? cts.map(function(ct) {
            return '<div class="bk-ct-item">' +
              '<div class="bk-ct-name">' + ct.name + '</div>' +
              (ct.when_to_use ? '<div class="bk-ct-when">' + ct.when_to_use + '</div>' : '') +
              (ct.example_headline ? '<div class="bk-ct-headline">&ldquo;' + ct.example_headline + '&rdquo;</div>' : '') +
            '</div>';
          }).join('')
        : '<div class="bk-ct-empty">Nessun angolo generato.</div>';
    }
    if (btn) { btn.textContent = '✓ Generato'; btn.disabled = false; }
  } catch(e) {
    if (listEl) listEl.innerHTML = '<div style="color:var(--danger);font-size:0.8rem;padding:0.5rem">Errore: ' + e.message + '</div>';
    if (btn) { btn.textContent = '✦ Genera con IA'; btn.disabled = false; }
  }
}

function closeClientePage() {
  document.getElementById('clientePage').classList.remove('open');
  openClientesPopup();
}

// ── ARCHIVIO CONTENUTI CLIENTE ─────────────────────────────────
var _clienteContentCache  = {};  // clientId → array caricati finora
var _clienteContentOffset = {};  // clientId → offset corrente
var _CONTENT_PAGE_SIZE    = 20;

async function loadClientAllContent(clientId, offset) {
  if (typeof db === 'undefined' || !dbConnected) return [];
  offset = offset || 0;
  var res = await db
    .from('generated_content')
    .select('id,client_id,platform,pillar,headline,img_b64,caption,status,created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .range(offset, offset + _CONTENT_PAGE_SIZE - 1);
  if (res.error) { console.warn('[BRAVO] loadClientAllContent:', res.error.message); return []; }
  var data = res.data || [];
  if (offset === 0) {
    _clienteContentCache[clientId] = data;
  } else {
    _clienteContentCache[clientId] = (_clienteContentCache[clientId] || []).concat(data);
  }
  _clienteContentOffset[clientId] = offset + data.length;
  return data;
}

function loadMoreClientContent(clientId) {
  var btn = document.getElementById('content-load-more-' + clientId);
  if (btn) btn.textContent = 'Cargando...';
  var offset = _clienteContentOffset[clientId] || 0;
  loadClientAllContent(clientId, offset).then(function(newRows) {
    var grid = document.querySelector('.ctab-panel[data-tab="contenido"] .cliente-content-grid');
    if (grid && newRows.length) {
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = buildClienteContentHtml(newRows, clientId, false);
      var newGrid = tempDiv.querySelector('.cliente-content-grid');
      if (newGrid) {
        Array.from(newGrid.children).forEach(function(card) { grid.appendChild(card); });
      }
    }
    var loadMoreWrap = document.getElementById('content-load-more-wrap-' + clientId);
    if (loadMoreWrap) {
      loadMoreWrap.style.display = newRows.length < _CONTENT_PAGE_SIZE ? 'none' : '';
      if (btn) btn.textContent = 'Cargar 20 más';
    }
  });
}

function _bravoImgSrcFromRecord(rc) {
  if (rc.image_url && rc.image_url.startsWith('http')) return rc.image_url;
  var ref = rc.img_b64 || '';
  if (!ref) return '';
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) return ref;
  if (ref.startsWith('/9j/') || ref.startsWith('iVBOR')) return 'data:image/jpeg;base64,' + ref;
  return 'data:image/jpeg;base64,' + ref;
}

// ── Helper: parse carosello salvato nel campo caption ──────────
function _parseCarouselCaption(caption) {
  // Formato: __CAROUSEL__[{...}]__||testo_instagram
  if (!caption || !caption.startsWith('__CAROUSEL__')) return null;
  try {
    var inner = caption.slice('__CAROUSEL__'.length);
    var sepIdx = inner.indexOf('__||');
    var jsonPart = sepIdx > -1 ? inner.slice(0, sepIdx) : inner;
    var igCaption = sepIdx > -1 ? inner.slice(sepIdx + 4) : '';
    return { slides: JSON.parse(jsonPart), igCaption: igCaption };
  } catch(e) { return null; }
}

function _buildCarouselCard(rc, carData, del, igBtn, dateStr, platBadge) {
  var slides = carData.slides || [];
  var igCaption = carData.igCaption || '';
  var cardId = 'arc-car-' + rc.id;
  var total = slides.length;

  var slidesHtml = slides.map(function(s, i) {
    var src = s.image_url || (s.img_b64 ? (s.img_b64.startsWith('data:') ? s.img_b64 : 'data:image/jpeg;base64,' + s.img_b64) : '');
    var imgHtml = src
      ? '<img loading="lazy" src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="slide ' + (i+1) + '">'
      : '<div style="width:100%;height:100%;background:#e8e4de;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#aaa">Sin imagen</div>';
    return '<div class="arc-car-slide" data-slide="' + i + '" style="width:100%;min-width:100%;height:100%;flex-shrink:0">' + imgHtml + '</div>';
  }).join('');

  var dotsHtml = slides.map(function(_, i) {
    return '<span class="arc-car-dot' + (i===0?' active':'') + '" onclick="event.stopPropagation();arcCarGo(\'' + cardId + '\',' + i + ')"></span>';
  }).join('');

  var captionPreview = igCaption ? '<div class="ig-card-caption">' + igCaption.replace(/</g,'&lt;').replace(/\n/g,' ').slice(0, 80) + '…</div>' : '';

  return '<div class="cliente-content-card ig-card" id="content-card-' + rc.id + '" style="position:relative">' +
    del + igBtn +
    // badge carosello
    '<div style="position:absolute;top:7px;left:7px;z-index:4;background:rgba(0,0,0,.55);color:#fff;font-size:0.6rem;font-weight:700;padding:2px 6px;border-radius:10px;letter-spacing:.04em">🎠 ' + total + '</div>' +
    // slider
    '<div id="' + cardId + '" style="position:relative;width:100%;aspect-ratio:1;overflow:hidden;border-radius:8px 8px 0 0">' +
      '<div class="arc-car-track" style="display:flex;width:100%;height:100%;transition:transform .3s ease">' + slidesHtml + '</div>' +
      (total > 1 ? '<button onclick="event.stopPropagation();arcCarMove(\'' + cardId + '\',-1)" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.8);border:none;border-radius:50%;width:24px;height:24px;font-size:0.85rem;cursor:pointer;z-index:3">‹</button>' : '') +
      (total > 1 ? '<button onclick="event.stopPropagation();arcCarMove(\'' + cardId + '\',1)" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.8);border:none;border-radius:50%;width:24px;height:24px;font-size:0.85rem;cursor:pointer;z-index:3">›</button>' : '') +
      '<div style="position:absolute;bottom:6px;left:0;right:0;display:flex;justify-content:center;gap:4px;z-index:3">' + dotsHtml + '</div>' +
    '</div>' +
    captionPreview +
    '<div class="content-card-meta">' + platBadge + '<span class="content-card-date">' + dateStr + '</span></div>' +
  '</div>';
}

function arcCarMove(cardId, dir) {
  var car = document.getElementById(cardId);
  if (!car) return;
  var track = car.querySelector('.arc-car-track');
  var slides = car.querySelectorAll('.arc-car-slide');
  var dots = car.querySelectorAll('.arc-car-dot');
  var cur = parseInt(car.dataset.cur || '0');
  var next = Math.max(0, Math.min(slides.length - 1, cur + dir));
  car.dataset.cur = next;
  track.style.transform = 'translateX(-' + (next * car.offsetWidth) + 'px)';
  dots.forEach(function(d, i) { d.classList.toggle('active', i === next); });
}
function arcCarGo(cardId, idx) {
  var car = document.getElementById(cardId);
  if (!car) return;
  var track = car.querySelector('.arc-car-track');
  var dots = car.querySelectorAll('.arc-car-dot');
  car.dataset.cur = idx;
  track.style.transform = 'translateX(-' + (idx * car.offsetWidth) + 'px)';
  dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
}

function approveContent(id) {
  if (typeof db === 'undefined' || !dbConnected) return;
  db.from('generated_content').update({ status: 'approved' }).eq('id', id).then(function(res) {
    if (res.error) { showToast('Error al aprobar'); return; }
    // Aggiorna UI: rimuovi badge "En revisión" e bottone Aprobar
    var badge = document.getElementById('rev-badge-' + id);
    var btn   = document.getElementById('rev-btn-' + id);
    if (badge) badge.remove();
    if (btn)   btn.remove();
    showToast('✓ Contenido aprobado');
    // Aggiorna cache
    [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
      if (r && r.id === id) r.status = 'approved';
    });
  });
}

function buildClienteContentHtml(content, clientId, showLoadMore) {
  if (!content || !content.length) {
    return '<div class="cliente-content-empty">Sin contenido generado</div>';
  }
  if (showLoadMore === undefined) showLoadMore = true;
  var deleteBtn = '<button class="content-card-delete" onclick="event.stopPropagation();deleteContent(\'__ID__\')" title="Eliminar">✕</button>';

  // Separa "En revisión" dagli altri
  var enRevision = content.filter(function(rc){ return rc.status === 'en_revision'; });
  var approved   = content.filter(function(rc){ return rc.status !== 'en_revision'; });
  var ordenado   = enRevision.concat(approved);

  var buildCard = function(rc) {
    var dateStr = rc.created_at
      ? new Date(rc.created_at).toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'2-digit'})
      : '';
    var platBadge = rc.platform ? '<span class="content-card-plat">' + rc.platform + '</span>' : '';
    var del = deleteBtn.replace('__ID__', rc.id);
    var igBtn = clientId
      ? '<button id="ig-arc-btn-' + rc.id + '" onclick="event.stopPropagation();igPublishFromArchive(\'' + clientId + '\',\'' + rc.id + '\',this)" ' +
          'style="position:absolute;bottom:36px;right:6px;background:rgba(192,57,43,0.9);color:#fff;border:none;border-radius:6px;font-size:0.65rem;padding:0.2rem 0.45rem;cursor:pointer;font-weight:600;z-index:2" ' +
          'title="Publicar en Instagram">📱 IG</button>'
      : '';
    var revBadge = rc.status === 'en_revision'
      ? '<div id="rev-badge-' + rc.id + '" style="position:absolute;top:6px;left:6px;background:#fef3c7;color:#b45309;font-size:0.58rem;font-weight:700;border-radius:4px;padding:0.1rem 0.4rem;z-index:2;border:1px solid #fde68a">👁 En revisión</div>'
      : '';
    var aprobBtn = rc.status === 'en_revision'
      ? '<button id="rev-btn-' + rc.id + '" onclick="event.stopPropagation();approveContent(\'' + rc.id + '\')" ' +
          'style="position:absolute;bottom:36px;left:6px;background:rgba(22,163,74,0.9);color:#fff;border:none;border-radius:6px;font-size:0.65rem;padding:0.2rem 0.45rem;cursor:pointer;font-weight:600;z-index:2">✓ Aprobar</button>'
      : '';

    // Carosello salvato → render con slider
    var carData = _parseCarouselCaption(rc.caption);
    if (carData) {
      return _buildCarouselCard(rc, carData, del, igBtn, dateStr, platBadge);
    }

    // Post singolo
    var imgSrc = _bravoImgSrcFromRecord(rc);
    var captionHtml = rc.caption
      ? '<div class="ig-card-caption">' + rc.caption.replace(/</g,'&lt;').replace(/\n/g,' ') + '</div>'
      : '';
    if (imgSrc) {
      return '<div class="cliente-content-card ig-card" id="content-card-' + rc.id + '" onclick="openContentPreview(\'' + rc.id + '\')" style="position:relative">' +
        del + igBtn + revBadge + aprobBtn +
        '<div class="ig-card-img"><img loading="lazy" src="' + imgSrc + '" alt="' + (rc.headline||'').replace(/"/g,'') + '" onerror="this.parentElement.innerHTML=\'<div class=ig-card-noimg>&#9632;</div>\'"></div>' +
        captionHtml +
        '<div class="content-card-meta">' + platBadge + '<span class="content-card-date">' + dateStr + '</span></div>' +
      '</div>';
    }
    return '<div class="cliente-content-card ig-card ig-card-text" id="content-card-' + rc.id + '" onclick="openContentPreview(\'' + rc.id + '\')" style="position:relative">' +
      del + igBtn + revBadge + aprobBtn +
      '<div class="ig-card-headline">' + (rc.headline||rc.pillar||'Post').substring(0,60) + '</div>' +
      captionHtml +
      '<div class="content-card-meta">' + platBadge + '<span class="content-card-date">' + dateStr + '</span></div>' +
    '</div>';
  };

  var loadMoreBtn = '';
  if (showLoadMore && clientId && content.length >= _CONTENT_PAGE_SIZE) {
    loadMoreBtn = '<div id="content-load-more-wrap-' + clientId + '" style="grid-column:1/-1;text-align:center;padding:1rem 0">' +
      '<button id="content-load-more-' + clientId + '" onclick="loadMoreClientContent(\'' + clientId + '\')" ' +
      'style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.6rem 1.4rem;cursor:pointer;font-size:0.85rem;color:#555">Cargar 20 más</button>' +
    '</div>';
  }

  var revHeader = enRevision.length
    ? '<div style="grid-column:1/-1;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem">' +
        '<span style="font-size:0.72rem;font-weight:700;color:#b45309;background:#fef3c7;border-radius:6px;padding:0.25rem 0.7rem;border:1px solid #fde68a">👁 En revisión — ' + enRevision.length + ' post</span>' +
        '<div style="flex:1;height:1px;background:#fde68a"></div>' +
      '</div>'
    : '';
  var approvedHeader = (enRevision.length && approved.length)
    ? '<div style="grid-column:1/-1;display:flex;align-items:center;gap:0.6rem;margin:0.8rem 0 0.3rem">' +
        '<span style="font-size:0.72rem;font-weight:700;color:#16a34a;background:#f0fdf4;border-radius:6px;padding:0.25rem 0.7rem;border:1px solid #bbf7d0">✓ Aprobados</span>' +
        '<div style="flex:1;height:1px;background:#bbf7d0"></div>' +
      '</div>'
    : '';

  var revCards      = enRevision.map(buildCard).join('');
  var approvedCards = approved.map(buildCard).join('');

  return '<div class="cliente-content-grid ig-grid">' + revHeader + revCards + approvedHeader + approvedCards + loadMoreBtn + '</div>';
}

// ── ELIMINA CONTENUTO ─────────────────────────────────────────
async function deleteContent(contentId) {
  if (!confirm('¿Eliminar este post del archivo?')) return;
  if (typeof db === 'undefined' || !dbConnected) return;

  var res = await db.from('generated_content').delete().eq('id', contentId);
  if (res.error) {
    alert('Error al eliminar: ' + res.error.message);
    return;
  }

  // Rimuovi dalla cache locale
  Object.keys(_clienteContentCache).forEach(function(cid) {
    _clienteContentCache[cid] = (_clienteContentCache[cid] || []).filter(function(r) { return r.id !== contentId; });
  });
  RECENT_CONTENT = (RECENT_CONTENT || []).filter(function(r) { return r.id !== contentId; });

  // Rimuovi la card dal DOM
  var card = document.getElementById('content-card-' + contentId);
  if (card) card.remove();
}

// ── CONTENT PREVIEW MODAL ──────────────────────────────────────
function openContentPreview(contentId) {
  var c = (RECENT_CONTENT||[]).find(function(x){ return x.id === contentId; });
  if (!c) {
    Object.values(_clienteContentCache).forEach(function(arr) {
      if (!c) c = arr.find(function(x){ return x.id === contentId; });
    });
  }
  if (!c) return;

  var overlay = document.createElement('div');
  overlay.id = 'content-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:900;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto';
  overlay.onclick = function(e){ if (e.target === overlay) document.body.removeChild(overlay); };

  var imgSrc = _bravoImgSrcFromRecord(c);
  var isRevision = c.status === 'en_revision';

  var captionEscaped = (c.caption || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  var actionBtns = isRevision
    ? '<div style="display:flex;gap:0.6rem;margin-top:1rem">' +
        '<button id="prev-save-btn" onclick="saveContentEdit(\'' + c.id + '\')" style="flex:1;padding:0.55rem;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.82rem">💾 Guardar cambios</button>' +
        '<button id="prev-approve-btn" onclick="approveContentFromPreview(\'' + c.id + '\')" style="flex:1;padding:0.55rem;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.82rem">✓ Aprobar</button>' +
      '</div>'
    : '';

  overlay.innerHTML =
    '<div style="max-width:540px;width:100%;background:#1a1a1a;border-radius:14px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;border-bottom:1px solid #333">' +
        '<span style="color:#fff;font-weight:700;font-size:0.9rem">' + (isRevision ? '👁 En revisión' : '✓ Aprobado') + '</span>' +
        '<button onclick="document.body.removeChild(document.getElementById(\'content-preview-overlay\'))" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;line-height:1">×</button>' +
      '</div>' +
      (imgSrc ? '<img src="' + imgSrc + '" style="width:100%;display:block;max-height:340px;object-fit:cover">' : '') +
      '<div style="padding:1rem">' +
        (c.headline ? '<div style="font-weight:700;color:#fff;margin-bottom:0.6rem;font-size:0.95rem">' + c.headline.replace(/</g,'&lt;') + '</div>' : '') +
        '<div style="font-size:0.75rem;color:#666;margin-bottom:0.5rem">' + (c.platform||'') + (c.pillar ? ' · ' + c.pillar : '') + '</div>' +
        (isRevision
          ? '<textarea id="prev-caption-area" style="width:100%;min-height:160px;background:#111;color:#ddd;border:1.5px solid #333;border-radius:8px;padding:0.75rem;font-size:0.8rem;line-height:1.6;resize:vertical;font-family:inherit;box-sizing:border-box">' + captionEscaped + '</textarea>'
          : (c.caption ? '<div style="font-size:0.8rem;color:#ccc;line-height:1.6;white-space:pre-line;background:#111;border-radius:8px;padding:0.75rem">' + c.caption.replace(/</g,'&lt;') + '</div>' : '')
        ) +
        actionBtns +
        '<div id="prev-status-msg" style="font-size:0.75rem;color:#888;margin-top:0.5rem;text-align:center"></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
}

function saveContentEdit(contentId) {
  var area = document.getElementById('prev-caption-area');
  var msg  = document.getElementById('prev-status-msg');
  if (!area) return;
  var newCaption = area.value;
  if (typeof db === 'undefined' || !dbConnected) return;
  if (msg) msg.textContent = 'Guardando…';
  db.from('generated_content').update({ caption: newCaption }).eq('id', contentId).then(function(res) {
    if (res.error) { if (msg) msg.textContent = '✗ Error al guardar'; return; }
    if (msg) msg.textContent = '✓ Cambios guardados';
    [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
      if (r && r.id === contentId) r.caption = newCaption;
    });
    setTimeout(function(){ if (msg) msg.textContent = ''; }, 2500);
  });
}

function approveContentFromPreview(contentId) {
  var area = document.getElementById('prev-caption-area');
  var msg  = document.getElementById('prev-status-msg');
  if (area) {
    var newCaption = area.value;
    [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
      if (r && r.id === contentId) r.caption = newCaption;
    });
    if (typeof db !== 'undefined' && dbConnected) {
      db.from('generated_content').update({ caption: newCaption, status: 'approved' }).eq('id', contentId).then(function(res) {
        if (res.error) { if (msg) msg.textContent = '✗ Error al aprobar'; return; }
        _afterApproveUI(contentId);
        var overlay = document.getElementById('content-preview-overlay');
        if (overlay) document.body.removeChild(overlay);
        showToast('✓ Contenido aprobado');
      });
      return;
    }
  }
  approveContent(contentId);
  var overlay = document.getElementById('content-preview-overlay');
  if (overlay) document.body.removeChild(overlay);
}

function _afterApproveUI(id) {
  var badge = document.getElementById('rev-badge-' + id);
  var btn   = document.getElementById('rev-btn-' + id);
  if (badge) badge.remove();
  if (btn)   btn.remove();
  [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
    if (r && r.id === id) r.status = 'approved';
  });
}

// ===============================================================
// BRIEFING — testo integrale per cliente, usato dagli agenti AI
// ===============================================================

var BRIEFING_API = BRAVO_API;

function renderBriefingSection(clientId) {
  if (!clientId) {
    return '<div class="ctab-placeholder">⚠️ Cliente non identificato</div>';
  }
  var html =
    '<div class="cliente-section" style="padding:1.25rem">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;gap:0.6rem;flex-wrap:wrap">' +
        '<div>' +
          '<div class="cliente-section-title" style="margin:0">📄 Briefing del cliente</div>' +
          '<div id="briefMeta" style="font-size:0.75rem;color:#888;margin-top:0.15rem">Cargando…</div>' +
        '</div>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">' +
          '<label class="bk-adopt-btn" style="cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;font-size:0.8rem">' +
            '📎 Subir PDF / Word' +
            '<input type="file" id="briefingFileInput" accept="application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" style="display:none" onchange="briefingHandlePdfUpload(event, \'' + clientId + '\')">' +
          '</label>' +
          '<button class="bk-newkit-btn" id="briefDeleteBtn" onclick="briefingDeleteFile(\'' + clientId + '\')" style="display:none;color:#c0392b;border-color:#c0392b">🗑 Eliminar</button>' +
        '</div>' +
      '</div>' +
      // Viewer PDF (visibile se c'è file_url)
      '<div id="briefPdfWrap" style="display:none;margin-bottom:0.8rem">' +
        '<div style="display:flex;justify-content:flex-end;margin-bottom:0.4rem">' +
          '<a id="briefPdfOpenLink" href="#" target="_blank" style="font-size:0.78rem;color:#888;text-decoration:none">↗ Abrir en pestaña nueva</a>' +
        '</div>' +
        '<object id="briefPdfFrame" data="" type="application/pdf" style="width:100%;height:85vh;border:1.5px solid #e0dbd2;border-radius:8px;display:block">' +
          '<p style="padding:1.5rem;color:#888;font-size:0.85rem">Tu navegador no puede mostrar el PDF. <a id="briefPdfFallback" href="#" target="_blank">Haz clic aquí para abrirlo</a>.</p>' +
        '</object>' +
      '</div>' +
      // Fallback textarea (visibile solo se non c'è file_url)
      '<div id="briefTextWrap">' +
        '<textarea id="briefingTextarea" ' +
          'style="width:100%;min-height:520px;padding:1rem;border:1px solid #e0dbd2;border-radius:8px;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:0.82rem;line-height:1.55;resize:vertical;background:#fff"' +
          'placeholder="Incolla qui il testo del briefing, oppure carica un PDF / Word con il pulsante in alto."></textarea>' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.7rem;gap:0.6rem;flex-wrap:wrap">' +
          '<div id="briefCounter" style="font-size:0.75rem;color:#888">0 caratteri</div>' +
          '<div style="display:flex;gap:0.5rem">' +
            '<button class="bk-newkit-btn" onclick="briefingReload(\'' + clientId + '\')">Annulla</button>' +
            '<button class="bk-adopt-btn" onclick="briefingSave(\'' + clientId + '\')">💾 Guardar</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  setTimeout(function(){ briefingReload(clientId); }, 50);
  setTimeout(function(){
    var ta = document.getElementById('briefingTextarea');
    var cnt = document.getElementById('briefCounter');
    if (ta && cnt) {
      ta.addEventListener('input', function(){ cnt.textContent = (ta.value||'').length.toLocaleString('es-ES') + ' caracteres'; });
    }
  }, 100);

  return html;
}

async function briefingReload(clientId) {
  var meta     = document.getElementById('briefMeta');
  var pdfWrap     = document.getElementById('briefPdfWrap');
  var pdfFrame    = document.getElementById('briefPdfFrame');
  var pdfOpenLink = document.getElementById('briefPdfOpenLink');
  var pdfFallback = document.getElementById('briefPdfFallback');
  var textWrap    = document.getElementById('briefTextWrap');
  var ta       = document.getElementById('briefingTextarea');
  var cnt      = document.getElementById('briefCounter');
  var delBtn   = document.getElementById('briefDeleteBtn');

  if (meta) meta.textContent = 'Cargando…';

  try {
    // Legge direttamente da Supabase JS — non dipende da Railway
    var res = await db.from('client_briefings').select('*').eq('client_id', clientId).limit(1);
    var row = (res.data && res.data[0]) || null;

    if (row && row.file_url) {
      var pdfSrc = row.file_url;
      if (pdfFrame) pdfFrame.data = pdfSrc;
      if (pdfOpenLink) { pdfOpenLink.href = pdfSrc; }
      if (pdfFallback) { pdfFallback.href = pdfSrc; }
      if (pdfWrap)  pdfWrap.style.display  = '';
      if (textWrap) textWrap.style.display  = 'none';
      if (delBtn)   delBtn.style.display    = '';
      var when = row.updated_at ? new Date(row.updated_at).toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'numeric'}) : '';
      if (meta) meta.textContent = '✓ ' + (row.source_filename || 'briefing') + (when ? ' · ' + when : '');
    } else {
      if (pdfWrap)  pdfWrap.style.display  = 'none';
      if (textWrap) textWrap.style.display  = '';
      if (delBtn)   delBtn.style.display    = 'none';
      if (ta) {
        ta.value = (row && row.briefing_text) || '';
        if (cnt) cnt.textContent = ta.value.length.toLocaleString('es-ES') + ' caracteres';
      }
      if (meta) meta.textContent = row ? '✓ Briefing guardado (texto)' : '⚠️ Sin briefing — sube un PDF o escribe el texto';
    }
  } catch(e) {
    if (meta) meta.textContent = '❌ Error cargando: ' + (e.message || e);
  }
}

function briefingHandlePdfUpload(event, clientId) {
  var input = event.target;
  var file = input.files && input.files[0];
  if (!file) return;
  var meta = document.getElementById('briefMeta');
  if (meta) meta.textContent = '⏳ Subiendo y extrayendo texto…';

  // Step 1: estrai testo
  var extractForm = new FormData();
  extractForm.append('pdf_file', file);

  fetch(BRIEFING_API + '/api/briefing/extract-pdf', { method:'POST', body: extractForm })
    .then(function(r){
      if (!r.ok) return r.json().then(function(j){ throw new Error(j.detail || 'Error'); });
      return r.json();
    })
    .then(function(data){
      if (meta) meta.textContent = '⏳ Guardando briefing y subiendo archivo…';
      // Step 2: salva testo + file originale insieme
      var saveForm = new FormData();
      saveForm.append('briefing_text', data.briefing_text || '');
      saveForm.append('source', 'pdf');
      saveForm.append('source_filename', file.name);
      saveForm.append('briefing_file', file);
      return fetch(BRIEFING_API + '/api/briefing/' + encodeURIComponent(clientId), { method:'POST', body: saveForm });
    })
    .then(function(r){
      if (!r.ok) return r.json().then(function(j){ throw new Error(j.detail || 'Error'); });
      return r.json();
    })
    .then(function(){
      if (meta) meta.textContent = '🧠 Opus está analizando el briefing… (~45s)';
      setTimeout(function(){ briefingReload(clientId); }, 50000);
    })
    .catch(function(e){
      if (meta) meta.textContent = '❌ Error: ' + (e.message || e);
    })
    .finally(function(){ input.value = ''; });
}

function briefingDeleteFile(clientId) {
  if (!confirm('¿Eliminar el briefing de este cliente? Se perderá el PDF y el texto guardado.')) return;
  var meta = document.getElementById('briefMeta');
  if (meta) meta.textContent = '⏳ Eliminando…';
  fetch(BRIEFING_API + '/api/briefing/' + encodeURIComponent(clientId), { method:'DELETE' })
    .then(function(){ briefingReload(clientId); })
    .catch(function(e){ if (meta) meta.textContent = '❌ Error: ' + (e.message || e); });
}

function briefingSave(clientId) {
  var ta = document.getElementById('briefingTextarea');
  var meta = document.getElementById('briefMeta');
  if (!ta) return;
  var text = (ta.value || '').trim();
  if (!text) { alert('Il briefing è vuoto.'); return; }

  var form = new FormData();
  form.append('briefing_text', text);
  var filename = ta.dataset.pdfFilename || '';
  form.append('source', filename ? 'pdf' : 'manual');
  if (filename) form.append('source_filename', filename);

  if (meta) meta.textContent = '⏳ Guardando…';

  fetch(BRIEFING_API + '/api/briefing/' + encodeURIComponent(clientId), {
    method: 'POST',
    body: form
  })
    .then(function(r){
      if (!r.ok) return r.json().then(function(j){ throw new Error(j.detail || 'Error'); });
      return r.json();
    })
    .then(function(){
      if (meta) meta.textContent = '✓ Briefing guardado — extrayendo perfil…';
      briefingReload(clientId);
      // Trigger automatico: estrai profilo dal briefing appena salvato
      fetch(AGENT_API + '/api/briefing/extract-profile/' + encodeURIComponent(clientId), { method: 'POST' })
        .then(function(r){ return r.json(); })
        .then(function(data) {
          if (data.ok) {
            _clientProfiles[clientId] = data.profile;
            // Aggiorna assegnazioni team
            var cObj = CLIENTS_DATA.find(function(c){ return c.id === clientId; });
            var ckey = cObj ? (cObj.client_key || cObj.id) : clientId;
            (data.profile.team_bravo || []).forEach(function(m) {
              if (!_equipoAssignments[m.name]) _equipoAssignments[m.name] = [];
              if (_equipoAssignments[m.name].indexOf(ckey) === -1) {
                _equipoAssignments[m.name].push(ckey);
                _equipoSave(m.name);
              }
            });
            if (meta) meta.textContent = '✓ Briefing guardado · Perfil extraído';
          // Trigger automatico: estrai anche i progetti
          _clientProjects[clientId] = undefined;
          extractClientProjects(clientId);
          }
        })
        .catch(function(){
          if (meta) meta.textContent = '✓ Briefing guardado';
        });
    })
    .catch(function(e){
      if (meta) meta.textContent = '❌ Error al guardar: ' + (e.message || e);
    });
}

// ===============================================================
// AGENTES — tab Agentes en la página del cliente
// ===============================================================

var AGENT_API = BRAVO_API;

function _nextMonday() {
  var d = new Date();
  var day = d.getDay();
  var diff = day === 0 ? 1 : (8 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function _formatDate(iso) {
  if (!iso) return '';
  var d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { weekday:'short', day:'numeric', month:'short' });
}

function renderAgentiSection(clientId, clientKey, clientName) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  var weekStart = _nextMonday();

  var html =
    '<span id="agent-client-ctx" data-client-id="' + (clientId||'') + '" data-client-key="' + (clientKey||'') + '" data-client-name="' + (clientName||'').replace(/"/g,'') + '" style="display:none"></span>' +
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.5rem">' +

    // ── Contexto semanal
    '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap;gap:0.6rem">' +
        '<div>' +
          '<div class="cliente-section-title" style="margin:0">📋 Contexto del contenido</div>' +
          '<div style="font-size:0.75rem;color:#888;margin-top:0.15rem">Semana del ' + weekStart + ' · <span id="ag-ctx-meta">Cargando...</span></div>' +
        '</div>' +
        '<button class="bk-newkit-btn" onclick="agentiLoadContext(\'' + clientId + '\',\'' + weekStart + '\')">🔄 Recargar</button>' +
      '</div>' +

      // ── Bloque 1: Material de campo
      '<div style="margin-bottom:1rem">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap;gap:0.4rem">' +
          '<div style="font-size:0.82rem;font-weight:600;color:#2a2a2a">📍 Material de campo</div>' +
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">' +
            '<label class="bk-newkit-btn" style="cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem">' +
              '📎 PDF / texto' +
              '<input type="file" accept="application/pdf,.txt,.md" style="display:none" onchange="agentiHandleContextFile(event,\'' + clientId + '\',\'' + weekStart + '\')">' +
            '</label>' +
            '<label class="bk-newkit-btn" style="cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem;font-size:0.78rem">' +
              '🎙️ Audio' +
              '<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm" style="display:none" onchange="agentiHandleAudio(event,\'' + clientId + '\',\'' + weekStart + '\')">' +
            '</label>' +
          '</div>' +
        '</div>' +
        '<div id="ag-audio-status" style="display:none;padding:0.5rem 0.8rem;background:#f0f8f0;border:1px solid #2d5c2e33;border-radius:6px;font-size:0.78rem;color:#2d5c2e;margin-bottom:0.5rem"></div>' +
        '<textarea id="ag-campo-textarea" ' +
          'style="width:100%;min-height:180px;padding:0.9rem;border:1px solid #e0dbd2;border-radius:8px;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:0.8rem;line-height:1.55;resize:vertical;background:#fff"' +
          'placeholder="Sube el audio de campo — o escribe libremente lo que pasó esta semana."></textarea>' +
        '<div style="font-size:0.72rem;color:#aaa;margin-top:0.3rem">Se puede subir audio o PDF — el contenido se extrae automáticamente y aparece aquí para revisión</div>' +
      '</div>' +

      // ── Bloque 2: Instrucciones Bravo
      '<div style="margin-bottom:0.8rem">' +
        '<div style="font-size:0.82rem;font-weight:600;color:#2a2a2a;margin-bottom:0.4rem">📋 Instrucciones Bravo</div>' +
        '<textarea id="ag-bravo-textarea" ' +
          'style="width:100%;min-height:120px;padding:0.9rem;border:1px solid #e0dbd2;border-radius:8px;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:0.8rem;line-height:1.55;resize:vertical;background:#fff"' +
          'placeholder="Instrucciones para el agente: publicaciones, plataformas, restricciones, prioridades de la semana."></textarea>' +
        '<div style="font-size:0.72rem;color:#aaa;margin-top:0.3rem">Instrucciones adicionales separadas del material de campo</div>' +
      '</div>' +

      '<div style="display:flex;justify-content:flex-end;gap:0.5rem">' +
        '<button class="bk-newkit-btn" onclick="agentiLoadContext(\'' + clientId + '\',\'' + weekStart + '\')">Cancelar</button>' +
        '<button class="bk-adopt-btn" onclick="agentiSaveContext(\'' + clientId + '\',\'' + weekStart + '\')">💾 Guardar contexto</button>' +
      '</div>' +
    '</div>' +

    // ── Material multimedia
    '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap;gap:0.6rem">' +
        '<div class="cliente-section-title" style="margin:0">📸 Genera post con foto</div>' +
        '<button class="bk-newkit-btn" onclick="assetsOpenModal(\'' + clientId + '\',\'' + clientKey + '\')" ' +
          'style="font-size:0.75rem;display:flex;align-items:center;gap:0.3rem">' +
          '📁 Usar desde librería' +
        '</button>' +
      '</div>' +

      // Griglia multi-foto
      '<div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.55rem">' +
          '<div style="font-size:0.72rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#999">Fotos <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#bbb">(máx. 5)</span></div>' +
          '<div id="ag-photos-counter-' + clientId + '" style="font-size:0.68rem;color:#aaa"></div>' +
        '</div>' +
        '<div id="ag-photos-grid-' + clientId + '" class="agent-photos-grid">' +
          '<div class="agent-photo-add" onclick="agMultiAddPhoto(\'' + clientId + '\')">' +
            '<div class="agent-photo-add-icon">+</div>' +
            '<div class="agent-photo-add-text">Añadir foto</div>' +
          '</div>' +
        '</div>' +
        '<input type="file" id="ag-multi-file-' + clientId + '" accept="image/*" multiple style="display:none" onchange="agMultiFileSelected(this,\'' + clientId + '\')">' +
      '</div>' +

      // Formato + variantes + genera
      '<div class="agent-bottom-bar" style="margin-top:0.7rem">' +
        '<select id="ag-format-' + clientId + '" class="agent-format-select" onchange="agMultiRenderGrid(\'' + clientId + '\')">' +
          '<option value="post_instagram">📷 Post Feed 1:1</option>' +
          '<option value="story_instagram">📲 Story 9:16</option>' +
          '<option value="reel_instagram">🎬 Reel / Portada 9:16</option>' +
          '<option value="carousel">🎠 Carrusel IG</option>' +
          '<option value="post_linkedin">💼 LinkedIn</option>' +
          '<option value="post_facebook">👥 Facebook</option>' +
        '</select>' +
        '<select id="ag-num-' + clientId + '" class="agent-variants-select">' +
          '<option value="1">1 var.</option>' +
          '<option value="2">2 var.</option>' +
          '<option value="3" selected>3 var.</option>' +
          '<option value="5">5 var.</option>' +
        '</select>' +
        '<button class="agent-gen-btn-big" id="ag-gen-photo-btn-' + clientId + '" onclick="agMultiGenerate(\'' + clientId + '\',\'' + clientKey + '\')">Genera</button>' +
      '</div>' +

      // Preview risultati
      '<div id="ag-photo-results-' + clientId + '" style="margin-top:0.8rem"></div>' +
    '</div>' +

    '</div>';

  setTimeout(function() {
    agentiLoadContext(clientId, weekStart);
  }, 80);

  return html;
}

function agentiLoadContext(clientId, weekStart) {
  fetch(AGENT_API + '/api/agents/weekly-context/' + encodeURIComponent(clientId) + '?week_start=' + weekStart)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var meta = document.getElementById('ag-ctx-meta');
      var taCampo = document.getElementById('ag-campo-textarea');
      var taBravo = document.getElementById('ag-bravo-textarea');
      if (d.exists && d.data) {
        var ctx = d.data;
        if (taCampo) taCampo.value = ctx.nota_campo || ctx.note_aggiuntive || '';
        if (taBravo) taBravo.value = ctx.istruzioni_bravo || '';
        if (meta) meta.textContent = '✓ Guardado el ' + new Date(ctx.updated_at).toLocaleDateString('es-ES');
      } else {
        if (meta) meta.textContent = 'Sin contexto guardado para esta semana';
      }
    })
    .catch(function(err) { console.error('[AGENT] Error cargando contexto semanal:', err); });
}

function agentiHandleContextFile(event, clientId, weekStart) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  var meta = document.getElementById('ag-ctx-meta');
  if (meta) meta.textContent = 'Extrayendo texto...';

  if (file.name.toLowerCase().endsWith('.pdf')) {
    var form = new FormData();
    form.append('pdf_file', file);
    fetch(AGENT_API + '/api/briefing/extract-pdf', { method: 'POST', body: form })
      .then(function(r) { return r.json(); })
      .then(function(d) {
        var ta = document.getElementById('ag-ctx-textarea');
        if (ta && d.briefing_text) ta.value = d.briefing_text;
        if (meta) meta.textContent = 'PDF extraído (' + (d.char_count || 0) + ' caracteres) — guarda para confirmar';
      })
      .catch(function() { if (meta) meta.textContent = '❌ Error al extraer PDF'; });
  } else {
    var reader = new FileReader();
    reader.onload = function(e) {
      var ta = document.getElementById('ag-ctx-textarea');
      if (ta) ta.value = e.target.result || '';
      if (meta) meta.textContent = 'Archivo cargado — guarda para confirmar';
    };
    reader.readAsText(file);
  }
  event.target.value = '';
}

function agentiHandleAudio(event, clientId, weekStart) {
  var file = event.target.files && event.target.files[0];
  if (!file) return;
  var statusDiv = document.getElementById('ag-audio-status');
  var meta = document.getElementById('ag-ctx-meta');
  if (statusDiv) { statusDiv.style.display = 'block'; statusDiv.textContent = '🎙️ Transcribiendo audio... puede tardar 20-40 segundos'; }

  var form = new FormData();
  form.append('audio_file', file);
  form.append('client_id', clientId);
  form.append('week_start', weekStart);

  fetch(AGENT_API + '/api/agents/transcribe-audio', { method: 'POST', body: form })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (d.context_text) {
        var ta = document.getElementById('ag-campo-textarea');
        if (ta) ta.value = d.context_text;
        if (statusDiv) statusDiv.textContent = '✓ Audio transcrito y contexto extraído — revisa y guarda';
        if (meta) meta.textContent = 'Transcripción lista — guarda para confirmar';
      } else {
        if (statusDiv) statusDiv.textContent = '❌ ' + (d.detail || 'Error en la transcripción');
      }
    })
    .catch(function(e) {
      if (statusDiv) statusDiv.textContent = '❌ Error de red: ' + (e.message || e);
    });
  event.target.value = '';
}

function agentiSaveContext(clientId, weekStart) {
  var taCampo = document.getElementById('ag-campo-textarea');
  var taBravo = document.getElementById('ag-bravo-textarea');
  var meta = document.getElementById('ag-ctx-meta');
  if (meta) meta.textContent = 'Guardando...';

  var form = new FormData();
  form.append('week_start', weekStart);
  form.append('nota_campo', taCampo ? taCampo.value : '');
  form.append('istruzioni_bravo', taBravo ? taBravo.value : '');

  fetch(AGENT_API + '/api/agents/weekly-context/' + encodeURIComponent(clientId), { method: 'POST', body: form })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (meta) meta.textContent = d.ok ? '✓ Guardado el ' + new Date().toLocaleDateString('es-ES') : '❌ Error al guardar';
    })
    .catch(function() { if (meta) meta.textContent = '❌ Error de red'; });
}

function agentiGeneratePlan(clientId, weekStart) {
  var btn = document.getElementById('ag-gen-btn');
  var planDiv = document.getElementById('ag-plan');
  if (btn) btn.disabled = true;
  if (planDiv) planDiv.innerHTML = '<div style="color:#888;font-size:0.82rem">⏳ Stratega al lavoro — può richiedere 30-60 secondi...</div>';

  var form = new FormData();
  form.append('client_id', clientId);
  form.append('week_start', weekStart);
  form.append('force', 'true');

  fetch(AGENT_API + '/api/agents/strategist/run', { method: 'POST', body: form })
    .then(function(r) { return r.json(); })
    .then(function(d) {
      if (!d.ok) throw new Error(d.detail || 'Error');
      // Polling ogni 8 secondi
      var taskId = d.task_id;
      var attempts = 0;
      var poll = setInterval(function() {
        attempts++;
        if (attempts > 20) { clearInterval(poll); if (btn) btn.disabled = false; return; }
        fetch(AGENT_API + '/api/agents/tasks/' + encodeURIComponent(clientId))
          .then(function(r) { return r.json(); })
          .then(function(td) {
            var task = (td.tasks || []).find(function(t) { return t.id === taskId; });
            if (task && (task.status === 'done' || task.status === 'failed')) {
              clearInterval(poll);
              if (btn) btn.disabled = false;
              agentiLoadPlan(clientId, weekStart);
              agentiLoadStatus(clientId);
            }
          });
      }, 8000);
    })
    .catch(function(e) {
      if (planDiv) planDiv.innerHTML = '<div style="color:#C0392B;font-size:0.82rem">❌ ' + (e.message || 'Error') + '</div>';
      if (btn) btn.disabled = false;
    });
}

function agentiLoadPlan(clientId, weekStart) {
  var planDiv = document.getElementById('ag-plan');
  if (!planDiv) return;

  var today = new Date().toISOString().slice(0, 10);
  var ctxEl = document.getElementById('agent-client-ctx');
  var clientKey = (ctxEl && ctxEl.dataset.clientKey) || clientId;

  fetch(AGENT_API + '/api/agents/editorial-plan/' + encodeURIComponent(clientId) + '?week_start=' + weekStart)
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var posts = d.posts || [];
      if (!posts.length) {
        planDiv.innerHTML = '<div style="color:#888;font-size:0.82rem;padding:0.8rem;background:#f9f8f6;border-radius:8px">Sin plan para esta semana. Rellena el contexto y haz clic en "Generar plan semanal".</div>';
        return;
      }
      var pillarColors = { PRODUCTO:'#D13B1E', AGRONOMIA:'#2d5c2e', EQUIPO:'#2c5f8a', TECNOLOGIA:'#F5A623', CLIENTE:'#6d4c8e', CALENDARIO:'#555' };
      planDiv.innerHTML = posts.map(function(p) {
        var color     = pillarColors[p.pillar] || '#888';
        var isToday   = p.scheduled_date === today;
        var borderClr = isToday ? '#2d7a4f' : color;
        var bgClr     = isToday ? '#f0faf4' : '#fff';

        // Bottoni azione: "Usa brief" e "✦ Genera"
        var usaBtn = '';
        if (p.brief) {
          var briefEscaped = p.brief.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
          usaBtn = '<button onclick="agentiUseBrief(\'' + briefEscaped + '\')" ' +
            'style="font-size:0.72rem;padding:0.3rem 0.75rem;border:1px solid ' + borderClr + ';border-radius:20px;' +
            'background:#fff;color:' + borderClr + ';' +
            'cursor:pointer;font-family:inherit;white-space:nowrap">' +
            '↗ Usar brief' +
          '</button>';
          if (p.id) {
            var planIdEsc = (p.id + '').replace(/'/g, "\\'");
            usaBtn += ' <button onclick="agentiGenerateFromPlan(\'' + planIdEsc + '\',\'' + clientId + '\',\'' + (clientKey || '') + '\')" ' +
              'style="font-size:0.72rem;padding:0.3rem 0.75rem;border:none;border-radius:20px;' +
              'background:' + (isToday ? '#2d7a4f' : '#1a3a5c') + ';color:#fff;' +
              'cursor:pointer;font-family:inherit;white-space:nowrap" ' +
              'id="ag-plan-gen-btn-' + planIdEsc + '">✦ Genera</button>';
          }
        }

        return '<div style="background:' + bgClr + ';border:1px solid ' + (isToday ? '#2d7a4f44' : '#e0dbd2') + ';border-radius:8px;padding:0.9rem;border-left:3px solid ' + borderClr + '">' +
          '<div style="display:flex;gap:0.6rem;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap">' +
            (isToday ? '<span style="font-size:0.7rem;font-weight:700;background:#2d7a4f;color:#fff;padding:0.15rem 0.5rem;border-radius:20px">HOY</span>' : '') +
            '<span style="font-weight:700;font-size:0.8rem;color:' + color + '">' + (p.pillar || '') + '</span>' +
            '<span style="font-size:0.75rem;color:#888">' + _formatDate(p.scheduled_date) + '</span>' +
            '<span style="font-size:0.72rem;background:#f0ede8;padding:0.15rem 0.4rem;border-radius:4px;color:#666">' + (p.format || '') + '</span>' +
            '<span style="margin-left:auto">' + usaBtn + '</span>' +
          '</div>' +
          '<div style="font-size:0.82rem;color:#444;line-height:1.4">' + (p.angle || '') + '</div>' +
          (isToday && p.brief ? '<div style="margin-top:0.5rem;font-size:0.78rem;color:#555;line-height:1.5;padding:0.5rem 0.7rem;background:#fff;border:1px solid #d0ead8;border-radius:6px;max-height:80px;overflow:hidden;cursor:pointer" onclick="this.style.maxHeight=this.style.maxHeight===\'none\'?\'80px\':\'none\'">' + (p.brief || '').slice(0, 200) + '…</div>' : '') +
        '</div>';
      }).join('');
    })
    .catch(function() {
      planDiv.innerHTML = '<div style="color:#888;font-size:0.82rem">Error cargando plan.</div>';
    });
}

function agentiUseBrief(brief) {
  // Passa al modo testo libero e incolla il brief dello Strategist
  var freeDiv  = document.getElementById('agent-brief-free');
  var structDiv = document.getElementById('agent-brief-structured');
  var modeBtn  = document.getElementById('agent-brief-mode-btn');
  var ta       = document.getElementById('agent-brief-text');
  if (freeDiv)   freeDiv.style.display   = '';
  if (structDiv) structDiv.style.display = 'none';
  if (modeBtn)   modeBtn.textContent     = '⊞ Estructurado';
  if (ta) {
    ta.value = brief;
    ta.focus();
    ta.scrollTop = 0;
  }
  if (typeof showToast === 'function') showToast('Brief del Estratega cargado — puedes editarlo antes de generar');
}

async function agentiGenerateFromPlan(planId, clientId, clientKey) {
  var btn = document.getElementById('ag-plan-gen-btn-' + planId);
  var resultsDiv = document.getElementById('ag-photo-results-' + clientId);

  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
  if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:1rem;text-align:center;color:#888;font-size:0.82rem">⚡ Generando variantes desde el plan — puede tardar 20-40 seg…</div>';

  try {
    var form = new FormData();
    form.append('client_id', clientKey || clientId);
    var res = await fetch(AGENT_API + '/api/agents/generate-from-plan/' + encodeURIComponent(planId), { method: 'POST', body: form });
    var data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.detail || 'Error generación');

    var variants = data.variants || [];
    if (!variants.length) throw new Error('No se generaron variantes');

    _agCurrentVariants[clientId] = variants;
    if (resultsDiv) {
      resultsDiv.innerHTML = _agRenderVariants(variants, clientId, clientKey);
      _agLoadAvatarLogos(clientId, variants.length);
    }
    if (typeof showToast === 'function') showToast('✦ Variantes generadas — añade una foto para componer la imagen final');
  } catch(e) {
    if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:0.8rem;background:#fff5f3;border:1px solid #D13B1E33;border-radius:8px;color:#D13B1E;font-size:0.82rem">✕ ' + e.message + '</div>';
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Genera'; }
  }
}

function agentiLoadStatus(clientId) {
  var statusDiv = document.getElementById('ag-status');
  if (!statusDiv) return;

  fetch(AGENT_API + '/api/agents/status/' + encodeURIComponent(clientId))
    .then(function(r) { return r.json(); })
    .then(function(d) {
      var agents = d.agents || {};
      var research = d.market_research;
      var agentLabels = { market_researcher: '🔍 Ricercatore', strategist: '📅 Stratega', coordinator: '🎯 Coordinatore', designer: '🎨 Designer' };
      var statusColors = { done: '#2d5c2e', running: '#F5A623', failed: '#C0392B', pending: '#888' };

      var rows = Object.keys(agents).map(function(a) {
        var t = agents[a];
        var color = statusColors[t.status] || '#888';
        var when = t.completed_at ? ' — ' + new Date(t.completed_at).toLocaleDateString('it-IT') : '';
        return '<div style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem">' +
          '<span style="width:8px;height:8px;border-radius:50%;background:' + color + ';flex-shrink:0"></span>' +
          '<span>' + (agentLabels[a] || a) + '</span>' +
          '<span style="color:#888">' + t.status + when + '</span>' +
        '</div>';
      });

      if (research) {
        rows.push('<div style="font-size:0.75rem;color:#888;margin-top:0.4rem">Investigación de mercado válida hasta: ' + new Date(research.valid_until).toLocaleDateString('es-ES') + ' (' + research.keywords_count + ' keyword, ' + research.hashtags_count + ' hashtag)</div>');
      }

      statusDiv.innerHTML = rows.length ? rows.join('') : '<div style="color:#888;font-size:0.82rem">Ningún agente activado todavía.</div>';
    })
    .catch(function(err) { console.error('[AGENT] Error cargando estado agentes:', err); });
}

// ── MULTI-FOTO: griglia per pagina cliente ───────────────────────

var _agMultiPhotos = {}; // clientId → [{file, objectUrl, subBrief}]
var _agMultiCtx    = { clientId: null, idx: -1 };

function agMultiAddPhoto(clientId) {
  var photos = _agMultiPhotos[clientId] || [];
  if (photos.length >= 5) { if (typeof showToast === 'function') showToast('Máximo 5 fotos'); return; }
  var inp = document.getElementById('ag-multi-file-' + clientId);
  if (inp) inp.click();
}

function agMultiFileSelected(input, clientId) {
  var photos = _agMultiPhotos[clientId] || [];
  Array.from(input.files || []).forEach(function(f) {
    if (photos.length >= 5 || !f.type.startsWith('image/')) return;
    photos.push({ file: f, objectUrl: URL.createObjectURL(f), subBrief: '' });
  });
  _agMultiPhotos[clientId] = photos;
  input.value = '';
  agMultiRenderGrid(clientId);
  var numEl = document.getElementById('ag-num-' + clientId);
  if (numEl) numEl.style.display = photos.length > 1 ? 'none' : '';
}

function agMultiRemovePhoto(clientId, idx) {
  var photos = _agMultiPhotos[clientId] || [];
  if (photos[idx] && photos[idx].objectUrl.startsWith('blob:')) URL.revokeObjectURL(photos[idx].objectUrl);
  photos.splice(idx, 1);
  _agMultiPhotos[clientId] = photos;
  agMultiRenderGrid(clientId);
  var numEl = document.getElementById('ag-num-' + clientId);
  if (numEl) numEl.style.display = photos.length > 1 ? 'none' : '';
}

function agMultiOpenSubBrief(clientId, idx) {
  _agMultiCtx = { clientId: clientId, idx: idx };
  var photos = _agMultiPhotos[clientId] || [];
  var ta = document.getElementById('agent-subbrief-text');
  if (ta) ta.value = (photos[idx] && photos[idx].subBrief) || '';
  var ov = document.getElementById('agent-subbrief-overlay');
  var pp = document.getElementById('agent-subbrief-popup');
  if (ov) ov.style.display = '';
  if (pp) pp.style.display = '';
  // Patch save button per questo contesto
  var saveBtn = document.querySelector('.agent-subbrief-save');
  if (saveBtn) saveBtn.onclick = agMultiSaveSubBrief;
  setTimeout(function() { if (ta) ta.focus(); }, 50);
}

function agMultiSaveSubBrief() {
  var ta = document.getElementById('agent-subbrief-text');
  var text = ta ? ta.value.trim() : '';
  var cid = _agMultiCtx.clientId;
  var idx = _agMultiCtx.idx;
  if (cid !== null && idx >= 0) {
    var photos = _agMultiPhotos[cid] || [];
    if (photos[idx]) photos[idx].subBrief = text;
    agMultiRenderGrid(cid);
  }
  document.getElementById('agent-subbrief-overlay').style.display = 'none';
  document.getElementById('agent-subbrief-popup').style.display = 'none';
  _agMultiCtx = { clientId: null, idx: -1 };
  // Ripristina save originale
  var saveBtn = document.querySelector('.agent-subbrief-save');
  if (saveBtn) saveBtn.onclick = function() { if (typeof agentSaveSubBrief === 'function') agentSaveSubBrief(); };
}

function agMultiRenderGrid(clientId) {
  var grid = document.getElementById('ag-photos-grid-' + clientId);
  if (!grid) return;
  var photos = _agMultiPhotos[clientId] || [];

  // Aggiorna contatore
  var counter = document.getElementById('ag-photos-counter-' + clientId);
  if (counter) {
    var fmtEl = document.getElementById('ag-format-' + clientId);
    var fmt = fmtEl ? fmtEl.value : 'post_instagram';
    if (photos.length === 0) {
      counter.textContent = '';
    } else if (fmt === 'carousel') {
      var totalSlides = photos.length + 2; // portada + foto + CTA
      counter.textContent = totalSlides + ' slides totales (' + photos.length + ' fotos + portada + CTA auto) · Carosello';
      counter.style.color = '#C0392B';
    } else {
      counter.textContent = photos.length + ' post' + (photos.length > 1 ? 's separados' : '');
      counter.style.color = '#aaa';
    }
  }
  var cards = photos.map(function(p, i) {
    var label = p.subBrief ? ('📝 ' + p.subBrief.slice(0, 22) + (p.subBrief.length > 22 ? '…' : '')) : '+ Brief';
    var fmtValGrid = (document.getElementById('ag-format-' + clientId) || {}).value || 'post_instagram';
    var isCarouselGrid = fmtValGrid === 'carousel';
    var slideLabel = '';
    if (photos.length > 1) {
      if (isCarouselGrid) {
        // Portada e CTA sono auto-generate — le foto sono le slide di contenuto (2 → N+1)
        slideLabel = '◎ Slide ' + (i + 2) + '/' + (photos.length + 2);
      } else {
        slideLabel = i === 0 ? '① Post 1' : i === photos.length - 1 ? '◎ Post ' + photos.length : '◎ Post ' + (i + 1);
      }
    }
    return '<div class="agent-photo-card" draggable="true" data-cid="' + clientId + '" data-idx="' + i + '" ' +
      'style="cursor:grab;transition:opacity .15s,transform .15s">' +
      '<button class="agent-photo-remove" onclick="agMultiRemovePhoto(\'' + clientId + '\',' + i + ')">×</button>' +
      (slideLabel ? '<div style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,0.55);color:#fff;font-size:0.62rem;font-weight:700;padding:2px 6px;border-radius:10px;pointer-events:none;z-index:2;white-space:nowrap">' + slideLabel + '</div>' : '') +
      '<img class="agent-photo-thumb-card" src="' + p.objectUrl + '" alt="foto ' + (i+1) + '" style="pointer-events:none">' +
      '<button class="agent-photo-brief-btn' + (p.subBrief ? ' has-brief' : '') + '" onclick="agMultiOpenSubBrief(\'' + clientId + '\',' + i + ')">' + label + '</button>' +
    '</div>';
  }).join('');
  var addBtn = photos.length < 5
    ? '<div class="agent-photo-add" onclick="agMultiAddPhoto(\'' + clientId + '\')"><div class="agent-photo-add-icon">+</div><div class="agent-photo-add-text">Añadir foto</div></div>'
    : '';
  grid.innerHTML = cards + addBtn;

  // Drag-and-drop per riordinare
  var dragSrc = null;
  grid.querySelectorAll('.agent-photo-card').forEach(function(card) {
    card.addEventListener('dragstart', function(e) {
      dragSrc = card;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(function() { card.style.opacity = '0.4'; card.style.transform = 'scale(0.95)'; }, 0);
    });
    card.addEventListener('dragend', function() {
      card.style.opacity = ''; card.style.transform = '';
      grid.querySelectorAll('.agent-photo-card').forEach(function(c) { c.style.outline = ''; });
    });
    card.addEventListener('dragover', function(e) {
      e.preventDefault(); e.dataTransfer.dropEffect = 'move';
      if (card !== dragSrc) card.style.outline = '2px solid #C0392B';
    });
    card.addEventListener('dragleave', function() { card.style.outline = ''; });
    card.addEventListener('drop', function(e) {
      e.preventDefault();
      if (!dragSrc || dragSrc === card) return;
      var from = parseInt(dragSrc.dataset.idx);
      var to   = parseInt(card.dataset.idx);
      var arr  = _agMultiPhotos[clientId] || [];
      var moved = arr.splice(from, 1)[0];
      arr.splice(to, 0, moved);
      _agMultiPhotos[clientId] = arr;
      agMultiRenderGrid(clientId);
    });
  });
}

async function agMultiGenerate(clientId, clientKey) {
  var photos = _agMultiPhotos[clientId] || [];
  if (!photos.length) { if (typeof showToast === 'function') showToast('Añade al menos una foto'); return; }

  var formatVal     = (document.getElementById('ag-format-' + clientId) || {}).value || 'post_instagram';
  var numVal        = parseInt((document.getElementById('ag-num-' + clientId) || {}).value) || 3;
  var isCarousel    = formatVal === 'carousel';
  var platform      = formatVal === 'post_linkedin' ? 'LinkedIn'
                    : formatVal === 'post_facebook'  ? 'Facebook' : 'Instagram';
  var contentFormat = isCarousel         ? 'Carosello'
                    : formatVal === 'story_instagram' ? 'Story 9:16'
                    : formatVal === 'reel_instagram'  ? 'Story 9:16'
                    : 'Post 1:1';

  var taCampo = document.getElementById('ag-campo-textarea');
  var brief   = taCampo ? (taCampo.value || '').trim() : '';
  if (!brief) brief = 'Genera un post para este cliente.';

  var resultsDiv = document.getElementById('ag-photo-results-' + clientId);
  var genBtn     = document.getElementById('ag-gen-photo-btn-' + clientId);
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '↻ Generando...'; }
  if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:1rem;text-align:center;color:#888;font-size:0.82rem">⚡ ' + (isCarousel && photos.length > 1 ? 'Generando carosello con ' + photos.length + ' diapositive…' : photos.length > 1 ? 'Generando ' + photos.length + ' post…' : 'Generando variantes…') + '</div>';

  try {
    var form = new FormData();
    form.append('brief', brief);
    form.append('client_id', clientKey || clientId);
    form.append('platform', platform);
    form.append('content_format', contentFormat);
    if (photos.length === 1) {
      form.append('num_variants', numVal);
      form.append('photo_file', photos[0].file);
    } else {
      form.append('num_variants', 1);
      photos.forEach(function(p) { form.append('photo_files', p.file); });
      form.append('photo_briefs', JSON.stringify(photos.map(function(p) { return p.subBrief || ''; })));
    }
    var res = await fetch(AGENT_API + '/api/content/generate-with-photo', { method: 'POST', body: form });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error generación');
    var variants = data.variants || [];
    if (!variants.length) throw new Error('No se generaron variantes');
    _agCurrentVariants[clientId] = variants;
    _agCurrentBrief[clientId] = brief;
    _agCurrentFormat[clientId] = formatVal;
    if (resultsDiv) { resultsDiv.innerHTML = _agRenderVariants(variants, clientId, clientKey, formatVal); _agLoadAvatarLogos(clientId, variants.length); }
    if (typeof showToast === 'function') showToast(isCarousel && photos.length > 1 ? 'Carosello generado: ' + variants.length + ' diapositive' : photos.length > 1 ? variants.length + ' post generados — uno por foto' : 'Variantes generadas');
  } catch(e) {
    if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:0.8rem;background:#fff5f3;border:1px solid #D13B1E33;border-radius:8px;color:#D13B1E;font-size:0.82rem">✕ ' + e.message + '</div>';
  } finally {
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = 'Genera'; }
  }
}

// ── FOTO UPLOAD + GENERA POST (legacy — singola foto) ────────────

var _agPhotoFile = {};       // clientId → File
var _agCurrentVariants = {}; // clientId → array varianti generate
var _agCurrentBrief = {};    // clientId → brief usato per la generazione
var _agCurrentFormat = {};   // clientId → formato selezionato (es. 'carousel')

function agentiPhotoDrop(event, clientId, clientKey) {
  event.preventDefault();
  var dz = document.getElementById('ag-photo-dropzone');
  if (dz) { dz.style.borderColor = '#e0dbd2'; dz.style.background = '#f9f8f6'; }
  var f = event.dataTransfer.files[0];
  if (f && f.type.startsWith('image/')) {
    _agPhotoFile[clientId] = f;
    _agPhotoPreview(clientId, f);
  }
}

function agentiPhotoSelected(input, clientId, clientKey) {
  var f = input.files[0];
  if (!f) return;
  _agPhotoFile[clientId] = f;
  _agPhotoPreview(clientId, f);
}

function _agPhotoPreview(clientId, file) {
  var dz = document.getElementById('ag-photo-dropzone');
  if (!dz) return;
  var url = URL.createObjectURL(file);
  dz.innerHTML =
    '<img src="' + url + '" style="max-height:160px;max-width:100%;border-radius:6px;object-fit:cover">' +
    '<div style="font-size:0.78rem;color:#2d5c2e;margin-top:0.4rem;font-weight:600">✓ ' + file.name + '</div>' +
    '<div style="font-size:0.72rem;color:#aaa">Toca para cambiar la foto</div>';
  dz.onclick = function() { document.getElementById('ag-photo-input-' + clientId).click(); };
}

async function agentiGenerateWithPhoto(clientId, clientKey) {
  var file = _agPhotoFile[clientId];
  if (!file) {
    alert('Prima carica una foto.'); return;
  }

  var userBrief = ((document.getElementById('ag-photo-brief-' + clientId) || {}).value || '').trim();
  var cardCtx   = ((document.getElementById('ag-bravo-textarea') || {}).value || '').trim();
  var sceneBrief = ((document.getElementById('ag-campo-textarea') || {}).value || '').trim();

  var brief = '';
  if (cardCtx && userBrief) {
    brief = cardCtx + '\n\n' + userBrief;
  } else if (cardCtx) {
    brief = cardCtx;
  } else if (userBrief) {
    brief = userBrief;
  } else {
    brief = sceneBrief || 'Genera un post para este cliente.';
  }

  var resultsDiv = document.getElementById('ag-photo-results-' + clientId);
  if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:1rem;text-align:center;color:#888;font-size:0.82rem">⚡ Generando variantes…</div>';

  try {
    var form = new FormData();
    form.append('photo_file', file);
    form.append('brief', brief);
    form.append('client_id', clientKey || clientId);
    form.append('platform', 'Instagram');
    form.append('num_variants', '3');

    var res = await fetch(AGENT_API + '/api/content/generate-with-photo', { method: 'POST', body: form });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error generación');

    var variants = data.variants || [];
    if (!variants.length) throw new Error('No se generaron variantes');

    _agCurrentVariants[clientId] = variants;
    _agCurrentBrief[clientId] = brief;
    if (resultsDiv) {
      resultsDiv.innerHTML = _agRenderVariants(variants, clientId, clientKey);
      _agLoadAvatarLogos(clientId, variants.length);
    }
  } catch(e) {
    if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:0.8rem;background:#fff5f3;border:1px solid #D13B1E33;border-radius:8px;color:#D13B1E;font-size:0.82rem">✕ ' + e.message + '</div>';
  }
}

function _agLoadAvatarLogos(clientId, count) {
  if (typeof loadBrandKitImagesFromDB !== 'function') return;
  loadBrandKitImagesFromDB(clientId).then(function(imgs) {
    if (!imgs || !imgs.logo_b64) return;
    var src = imgB64Src(imgs.logo_b64);
    if (!src) return;
    for (var i = 0; i < count; i++) {
      var el = document.getElementById('ag-av-' + clientId + '-' + i);
      if (el) {
        el.style.background = '#f5f5f5';
        el.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:contain;border-radius:50%">';
      }
    }
  });
}

function _agRenderVariants(variants, clientId, clientKey, formatVal) {
  var caption_preview_limit = 180;
  var handle = '@' + (clientKey || 'bravo.studio');
  var initial = handle.charAt(1).toUpperCase();
  var isCarousel = (formatVal || _agCurrentFormat[clientId]) === 'carousel';

  // Header carosello — mostra la sequenza delle slide prima dei dettagli
  var carouselHeader = '';
  if (isCarousel && variants.length > 1) {
    var slideLabels = variants.map(function(v, i) {
      var tag = i === 0 ? '① Portada' : i === variants.length - 1 ? '↩ CTA' : '◎ Slide ' + (i + 1);
      var thumb = imgB64Src(v.img_b64 || v.image_url || '');
      return '<div style="display:flex;flex-direction:column;align-items:center;gap:0.3rem;min-width:64px">' +
        (thumb ? '<img src="' + thumb + '" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:2px solid #e0dbd2">' : '<div style="width:64px;height:64px;background:#f0ede8;border-radius:6px;border:2px solid #e0dbd2;display:flex;align-items:center;justify-content:center;font-size:1.2rem">🖼️</div>') +
        '<span style="font-size:0.6rem;color:#888;font-weight:700;white-space:nowrap">' + tag + '</span>' +
      '</div>';
    });
    // Connetti le slide con frecce
    var slideRow = slideLabels.join('<div style="color:#ccc;font-size:1.2rem;align-self:center;padding-bottom:1.2rem">→</div>');
    carouselHeader =
      '<div style="background:#f5f3ef;border:1px solid #e0dbd2;border-radius:10px;padding:0.9rem 1rem;margin-bottom:1rem">' +
        '<div style="font-size:0.72rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.06em;margin-bottom:0.6rem">🎠 Carosello · ' + variants.length + ' diapositive</div>' +
        '<div style="display:flex;align-items:flex-start;gap:0.4rem;overflow-x:auto;padding-bottom:0.2rem">' + slideRow + '</div>' +
      '</div>';
  }

  // ── VISTA CAROSELLO: 1 sola card con navigazione slide ──────────────────
  if (isCarousel && variants.length > 1) {
    var carId = 'car-' + clientId;
    var slides = variants.map(function(v, i) {
      var imgSrc = imgB64Src(v.img_b64 || v.image_url || '');
      var slideTag = i === 0 ? '① Portada' : i === variants.length - 1 ? '↩ CTA' : '◎ ' + (i + 1) + '/' + variants.length;
      return '<div class="car-slide" data-slide="' + i + '" style="' + (i===0?'':'display:none') + ';position:relative">' +
        '<div style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.55);color:#fff;font-size:0.62rem;font-weight:700;padding:2px 8px;border-radius:10px;z-index:3">' + slideTag + '</div>' +
        (imgSrc
          ? '<img src="' + imgSrc + '" style="width:100%;aspect-ratio:1/1;display:block;object-fit:cover">'
          : '<div style="width:100%;aspect-ratio:1/1;background:#f0f0f0;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:2rem">🖼️</div>') +
        // Frecce navigazione
        (i > 0 ? '<button onclick="agCarPrev(\'' + carId + '\')" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.85);border:none;border-radius:50%;width:32px;height:32px;font-size:1rem;cursor:pointer;z-index:3">‹</button>' : '') +
        (i < variants.length - 1 ? '<button onclick="agCarNext(\'' + carId + '\')" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.85);border:none;border-radius:50%;width:32px;height:32px;font-size:1rem;cursor:pointer;z-index:3">›</button>' : '') +
      '</div>';
    }).join('');

    // Dots indicatori
    var dots = variants.map(function(_, i) {
      return '<div class="car-dot" data-dot="' + i + '" style="width:6px;height:6px;border-radius:50%;background:' + (i===0?'#262626':'#c7c7c7') + ';transition:background .2s"></div>';
    }).join('');

    // Caption della slide attiva (slide 0 all'inizio)
    var cap0 = (variants[0].caption||'').slice(0, caption_preview_limit);

    return '<div style="max-width:400px;margin:0 auto;margin-top:0.5rem">' +
      // Card Instagram
      '<div id="' + carId + '" style="border:1px solid #dbdbdb;border-radius:12px;overflow:hidden;background:#fff;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif">' +
        // Header profilo
        '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;border-bottom:1px solid #f0f0f0">' +
          '<div id="ag-av-' + clientId + '-0" style="width:34px;height:34px;border-radius:50%;background:#C0392B;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;font-size:0.82rem;font-weight:700;color:#fff">' + initial + '</div>' +
          '<div style="font-size:0.82rem;font-weight:700;color:#111;flex:1">' + handle + '</div>' +
          '<div style="font-size:0.75rem;color:#aaa;margin-right:0.3rem">🎠 ' + variants.length + ' slides</div>' +
          '<div style="font-size:1.1rem;color:#aaa">···</div>' +
        '</div>' +
        // Slide area
        '<div style="position:relative">' + slides + '</div>' +
        // Dots
        '<div style="display:flex;justify-content:center;gap:4px;padding:0.45rem 0">' + dots + '</div>' +
        // Azioni IG mock
        '<div style="display:flex;align-items:center;padding:0.3rem 0.75rem 0.2rem;gap:0.9rem">' +
          '<span style="font-size:1.35rem;cursor:pointer">♡</span>' +
          '<span style="font-size:1.25rem;cursor:pointer">💬</span>' +
          '<span style="font-size:1.2rem;cursor:pointer">↗</span>' +
          '<span style="margin-left:auto;font-size:1.2rem;cursor:pointer">🔖</span>' +
        '</div>' +
        // Caption (aggiornata dinamicamente)
        '<div style="padding:0.3rem 0.75rem 0.8rem">' +
          '<div id="' + carId + '-caption" style="font-size:0.82rem;color:#111;line-height:1.55">' +
            '<span style="font-weight:700">' + handle + '</span> ' + cap0 +
          '</div>' +
        '</div>' +
        // Pulsanti BRAVO
        '<div id="ag-card-actions-' + clientId + '-0" style="display:flex;gap:0.5rem;padding:0.5rem 0.75rem 0.8rem;border-top:1px solid #f5f5f5;flex-wrap:wrap">' +
          '<button class="bk-adopt-btn" style="font-size:0.75rem;flex:1" onclick="agentiApprovePost(0,\'' + clientId + '\')">✓ Aprobar carosello</button>' +
          '<button class="bk-newkit-btn" style="font-size:0.75rem;flex:1;color:#888" onclick="agentiRejectPost(0,\'' + clientId + '\')">✕ Rechazar</button>' +
          '<button class="bk-newkit-btn" style="font-size:0.75rem;flex:1" onclick="agentiCopyCaption(\'' + encodeURIComponent(variants[0].caption||'') + '\')">📋 Caption</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ── VISTA POST SEPARATI (Instagram / LinkedIn / TikTok) ──────────────────
  return '<div style="display:flex;flex-direction:column;gap:2rem;margin-top:0.5rem">' +
    variants.map(function(v, i) {
      var captionShort = (v.caption||'').slice(0, caption_preview_limit) + ((v.caption||'').length > caption_preview_limit ? '… <span style="color:#999;cursor:pointer" onclick="this.parentNode.innerHTML=decodeURIComponent(\'' + encodeURIComponent(v.caption||'') + '\')">more</span>' : '');
      var imgSrc = imgB64Src(v.img_b64 || v.image_url || '');
      return (
        '<div id="ag-card-' + clientId + '-' + i + '" style="max-width:400px;margin:0 auto;border:1px solid #dbdbdb;border-radius:12px;overflow:hidden;background:#fff;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;transition:border-color .2s">' +
          // Header profilo
          '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;border-bottom:1px solid #f0f0f0">' +
            '<div id="ag-av-' + clientId + '-' + i + '" style="width:34px;height:34px;border-radius:50%;background:#C0392B;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;font-size:0.82rem;font-weight:700;color:#fff">' + initial + '</div>' +
            '<div style="font-size:0.82rem;font-weight:700;color:#111;flex:1">' + handle + '</div>' +
            '<div style="font-size:1.1rem;color:#aaa">···</div>' +
          '</div>' +
          // Immagine
          '<div style="width:100%;aspect-ratio:1/1;overflow:hidden;background:#f0f0f0">' +
            (imgSrc ? '<img src="' + imgSrc + '" style="width:100%;height:100%;display:block;object-fit:cover">' : '') +
          '</div>' +
          // Azioni IG mock
          '<div style="display:flex;align-items:center;padding:0.55rem 0.75rem 0.25rem;gap:0.9rem">' +
            '<span style="font-size:1.35rem;cursor:pointer;line-height:1">♡</span>' +
            '<span style="font-size:1.25rem;cursor:pointer;line-height:1">💬</span>' +
            '<span style="font-size:1.2rem;cursor:pointer;line-height:1">↗</span>' +
            '<span style="margin-left:auto;font-size:1.2rem;cursor:pointer;line-height:1">🔖</span>' +
          '</div>' +
          // Caption
          '<div style="padding:0.4rem 0.75rem 0.9rem">' +
            '<div style="font-size:0.82rem;color:#111;line-height:1.55">' +
              '<span style="font-weight:700">' + handle + '</span> ' + captionShort +
            '</div>' +
          '</div>' +
          // Pulsanti BRAVO
          '<div id="ag-card-actions-' + clientId + '-' + i + '" style="display:flex;gap:0.5rem;padding:0.5rem 0.75rem 0.8rem;border-top:1px solid #f5f5f5;flex-wrap:wrap">' +
            '<button class="bk-adopt-btn" style="font-size:0.75rem;padding:0.35rem 0.8rem;flex:1" onclick="agentiApprovePost(' + i + ',\'' + clientId + '\')">✓ Aprobar</button>' +
            '<button class="bk-newkit-btn" style="font-size:0.75rem;flex:1;color:#888" onclick="agentiRejectPost(' + i + ',\'' + clientId + '\')">✕ Rechazar</button>' +
            '<button class="bk-newkit-btn" style="font-size:0.75rem;flex:1" onclick="agentiCopyCaption(\'' + encodeURIComponent(v.caption||'') + '\')">📋 Caption</button>' +
            '<button id="ig-pub-btn-' + clientId + '-' + i + '" class="bk-newkit-btn" style="font-size:0.75rem;flex:1;color:#C0392B;border-color:#C0392B" ' +
              'onclick="igPublishPost(\'' + clientId + '\',' + i + ',this)">📱 IG</button>' +
          '</div>' +
        '</div>'
      );
    }).join('') +
  '</div>';
}

function agCarNav(carId, dir) {
  var car = document.getElementById(carId);
  if (!car) return;
  var slides = car.querySelectorAll('.car-slide');
  var dots   = car.querySelectorAll('.car-dot');
  var active = 0;
  slides.forEach(function(s, i) { if (s.style.display !== 'none') active = i; });
  var next = Math.max(0, Math.min(slides.length - 1, active + dir));
  if (next === active) return;
  slides[active].style.display = 'none';
  slides[next].style.display   = '';
  dots.forEach(function(d, i) { d.style.background = i === next ? '#262626' : '#c7c7c7'; });
  // Aggiorna caption
  var capDiv = document.getElementById(carId + '-caption');
  if (capDiv) {
    var cid = carId.replace('car-', '');
    var variants = _agCurrentVariants[cid] || [];
    var v = variants[next];
    var handle = capDiv.querySelector('span') ? capDiv.querySelector('span').textContent : '';
    if (v) capDiv.innerHTML = '<span style="font-weight:700">' + handle + '</span> ' + (v.caption||'').slice(0, 180);
  }
}
function agCarPrev(carId) { agCarNav(carId, -1); }
function agCarNext(carId) { agCarNav(carId, +1); }

function agentiCopyCaption(encodedCaption) {
  var text = decodeURIComponent(encodedCaption);
  navigator.clipboard.writeText(text).then(function() {
    alert('Caption copiata!');
  }).catch(function() {
    prompt('Copia manualmente:', text);
  });
}

function _addPostToProjectKanban(clientId, v, isCarousel, formatVal) {
  var sp = _activeSprint;
  if (!sp || sp.clientId !== clientId) return;

  var projId = sp.projectId;
  if (!KANBAN_DATA[projId]) {
    KANBAN_DATA[projId] = { info:[], ideas:[], todo:[], wip:[], done:[], pub:[], meet:[], shoot:[], prop:[] };
  }

  var today = new Date().toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
  var fmtLabel = sp.icon + ' ' + sp.label;
  var title = (v.headline || fmtLabel).slice(0, 50);
  var colId = 'done';
  var idx = KANBAN_DATA[projId][colId].length;

  KANBAN_DATA[projId][colId].push({
    t: title,
    m: fmtLabel + ' · ' + today,
    desc: v.caption ? v.caption.slice(0, 120) : '',
    assign: '',
    date: new Date().toISOString().slice(0, 10),
    priority: 'Normal',
    links: [],
    comments: ''
  });

  // Aggiorna DOM kanban se il tab è già aperto
  var container = document.getElementById('kbc-' + projId + '-' + colId);
  if (container) {
    var div = document.createElement('div');
    div.className = 'kb-card';
    (function(pid, cid, ei) { div.onclick = function() { openCardPanel(pid, cid, ei); }; })(projId, colId, idx);
    div.innerHTML =
      '<div class="kb-card-title">' + title + '</div>' +
      '<div class="kb-card-meta">' + fmtLabel + ' · ' + today + '</div>' +
      '<div class="kb-card-footer"><span class="kb-card-links none">—</span></div>';
    container.appendChild(div);
    var head = container.closest('.kb-col').querySelector('.kb-cnt');
    if (head) head.textContent = KANBAN_DATA[projId][colId].length;
  }
}

// ── COLLEGAMENTO PIANO → AGENTI (step Designer) ──────────────────────────────
window._pendingDesignerStep = null;

function launchDesignerStep(ci, si) {
  var card = (_planSuggestState && _planSuggestState.cards) ? _planSuggestState.cards[ci] : null;
  if (!card) return;
  var caption = '';
  var photoUrl = null;
  for (var k = si - 1; k >= 0; k--) {
    var prev = card.subtasks[k];
    if (prev && prev.output && !caption) caption = prev.output;
    if (prev && prev.suggested_photo && prev.suggested_photo.url && !photoUrl) photoUrl = prev.suggested_photo.url;
  }
  window._pendingDesignerStep = { ci: ci, si: si, caption: caption, photoUrl: photoUrl, cardTitle: card.title || '' };
  // Naviga alla tab Agenti del cliente
  var agBtn = document.querySelector('.ctab-btn[data-tab="agenti"]');
  if (agBtn) { agBtn.click(); return; }
  // Fallback: switch diretto
  var panel = document.querySelector('.ctab-panel[data-tab="agenti"]');
  if (panel) {
    document.querySelectorAll('.ctab-panel').forEach(function(p){ p.style.display = 'none'; });
    panel.style.display = '';
    setTimeout(_injectPendingDesignerStep, 300);
  }
}

function _injectPendingDesignerStep() {
  var pending = window._pendingDesignerStep;
  if (!pending) return;
  var agCtx = document.getElementById('agent-client-ctx');
  var clientId = agCtx ? agCtx.dataset.clientId : null;
  if (!clientId) return;
  // Pre-fill "Material de campo" con la caption del Copywriter
  var ta = document.getElementById('ag-campo-textarea');
  if (ta && pending.caption) {
    ta.value = pending.caption;
    ta.style.border = '2px solid #2563eb';
  }
  // Banner di collegamento + foto suggerita
  var resultsDiv = document.getElementById('ag-photo-results-' + clientId);
  if (!resultsDiv) return;
  var photoHtml = pending.photoUrl
    ? '<div style="margin-top:0.8rem;display:flex;align-items:flex-end;gap:0.8rem;flex-wrap:wrap">' +
        '<img src="' + pending.photoUrl + '" style="width:100px;height:100px;object-fit:cover;border-radius:8px;border:2px solid #2563eb;flex-shrink:0">' +
        '<button onclick="_loadPendingPhotoAsFile(\'' + clientId + '\',\'' + pending.photoUrl + '\')" ' +
          'style="background:#2563eb;color:#fff;border:none;border-radius:20px;padding:0.35rem 0.9rem;font-size:0.75rem;cursor:pointer;font-weight:700">⬇ Usar esta foto</button>' +
      '</div>'
    : '';
  resultsDiv.innerHTML =
    '<div style="background:#eff6ff;border:2px solid #2563eb;border-radius:10px;padding:1rem;margin-bottom:0.8rem">' +
      '<div style="font-weight:700;color:#1d4ed8;font-size:0.85rem;margin-bottom:0.3rem">🎨 Conectado al plan: ' + (pending.cardTitle || '') + '</div>' +
      '<div style="font-size:0.75rem;color:#555">La caption del Copywriter está en el campo de texto. ' + (pending.photoUrl ? 'Carga la foto y lanza Genera.' : 'Añade una foto y lanza Genera.') + '</div>' +
      photoHtml +
    '</div>';
}

async function _loadPendingPhotoAsFile(clientId, url) {
  try {
    var res = await fetch(url);
    var blob = await res.blob();
    var ext = (blob.type || 'image/jpeg').split('/')[1] || 'jpg';
    var file = new File([blob], 'foto-sugerida.' + ext, { type: blob.type });
    var photos = _agMultiPhotos[clientId] || [];
    photos.push({ file: file, objectUrl: URL.createObjectURL(file), subBrief: '' });
    _agMultiPhotos[clientId] = photos;
    agMultiRenderGrid(clientId);
    showToast('✓ Foto cargada — haz clic en Genera');
  } catch(e) {
    showToast('Error cargando la foto — cárgala manualmente');
  }
}

// ── Lancio card del piano nel tab Agenti ───────────────────────────────────
var _FORMAT_TO_AGENTI = {
  feed:      'post_instagram',
  story:     'story_instagram',
  reel:      'reel_instagram',
  carousel:  'carousel',
};

window._pendingPlanCardLaunch = null;

// Confronta il brief della card con le scene_description delle foto → ritorna la foto più pertinente
function _bestPhotoForCard(query, photos) {
  if (!photos || !photos.length) return null;
  var STOP = /^(de|el|la|los|las|en|y|a|con|por|para|del|un|una|es|que|se|al|lo|su|sus|the|of|in|and|to|for|with|from|at|by|an|or|is|are|was|were|il|la|le|di|da|in|e|a|un|una|per|con|su|dal|nel|alla)$/i;
  var qWords = (query || '').toLowerCase().split(/\W+/).filter(function(w){ return w.length > 2 && !STOP.test(w); });
  if (!qWords.length) return photos[0];
  var best = null, bestScore = -1;
  photos.forEach(function(p) {
    var dWords = (p.scene_description || '').toLowerCase().split(/\W+/).filter(function(w){ return w.length > 2; });
    var score = qWords.reduce(function(acc, qw) {
      return acc + (dWords.some(function(dw){ return dw === qw || dw.indexOf(qw) === 0 || qw.indexOf(dw) === 0; }) ? 1 : 0);
    }, 0);
    if (score > bestScore) { bestScore = score; best = p; }
  });
  return best || photos[0];
}

async function launchPlanCardInAgentes(ci) {
  var card = (_planSuggestState && _planSuggestState.cards) ? _planSuggestState.cards[ci] : null;
  if (!card) return;

  showToast('⏳ Buscando la mejor foto del rodaje…');

  // Carica TUTTE le foto del rodaje e fa il match automatico con il brief della card
  var photoUrl = null, sceneBrief = '', allPhotos = [], photoScore = 0;
  try {
    var projectId = _planSuggestState.projectId;
    var clientIdF = _planSuggestState.clientId;
    if (projectId && clientIdF) {
      // Carica tutte le foto per il fallback e per il banner
      var pRes  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/rodaje-photos?client_id=' + encodeURIComponent(clientIdF));
      var pData = await pRes.json();
      allPhotos = (pData.photos || []).map(function(p){ return { filename: p.filename || '', scene_description: p.scene_description || '', url: p.url || '' }; });

      if (allPhotos.length) {
        // Usa match semantico via Haiku invece del keyword overlap
        var cardBrief = [card.title, card.pillar, card.creative_note].filter(Boolean).join(' — ');
        try {
          var mRes  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/match-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ client_id: clientIdF, brief: cardBrief })
          });
          var mData = await mRes.json();
          if (mData.ok && mData.photo) {
            photoUrl  = mData.photo.url;
            sceneBrief = mData.photo.scene_description;
          }
        } catch(e2) {
          // Fallback al keyword match locale se Haiku fallisce
          var best = _bestPhotoForCard(cardBrief, allPhotos);
          if (best) { photoUrl = best.url; sceneBrief = best.scene_description; }
        }
      }
    }
  } catch(e) { /* non bloccante */ }

  // Fallback: suggested_photo dal subtask se non ci sono foto dal server
  if (!photoUrl) {
    (card.subtasks || []).forEach(function(s) {
      if (!photoUrl && s.suggested_photo && s.suggested_photo.url) { photoUrl = s.suggested_photo.url; sceneBrief = s.suggested_photo.scene_description || ''; }
      if (!photoUrl && s.media_url) { photoUrl = s.media_url; sceneBrief = s.scene_description || ''; }
    });
  }

  var proj = _planSuggestState.proj || {};
  var scriptOutput = '';
  var sharedRef = _findSharedCard(_planSuggestState.cards || []);
  if (sharedRef) {
    (sharedRef.card.subtasks || []).forEach(function(s) {
      if (!scriptOutput && s.output && (s.name || '').toLowerCase().indexOf('script') >= 0) scriptOutput = s.output;
    });
    if (!scriptOutput) {
      (sharedRef.card.subtasks || []).forEach(function(s) {
        if (!scriptOutput && s.output && s.status === 'done') scriptOutput = s.output;
      });
    }
  }

  // Trova il primo subtask AI non ancora completato per il mark granulare all'approvazione
  var activeSubtaskIdx = -1;
  (card.subtasks || []).forEach(function(sub, si) {
    if (activeSubtaskIdx < 0 && (sub.assignee || '').toLowerCase().indexOf('agente') >= 0 && sub.status !== 'done') {
      activeSubtaskIdx = si;
    }
  });

  window._pendingPlanCardLaunch = {
    ci, photoUrl, sceneBrief, allPhotos,
    activeSubtaskIdx,
    cardTitle:       card.title || '',
    cardFormat:      card.format || 'feed',
    cardPillar:      card.pillar || '',
    creativeNote:    card.creative_note || '',
    clientId:        _planSuggestState.clientId,
    projTitle:       proj.title || '',
    projDesc:        proj.description || '',
    projDeliverable: proj.deliverable || '',
    scriptOutput,
  };

  // Naviga al tab Agenti del cliente
  var agBtn = document.querySelector('.ctab-btn[data-tab="agenti"]');
  if (agBtn) { agBtn.click(); return; }
  var panel = document.querySelector('.ctab-panel[data-tab="agenti"]');
  if (panel) {
    document.querySelectorAll('.ctab-panel').forEach(function(p){ p.style.display='none'; });
    panel.style.display = '';
    setTimeout(_injectPlanCardContext, 300);
  }
}

function _injectPlanCardContext() {
  var pending = window._pendingPlanCardLaunch;
  if (!pending) return;

  var agCtx    = document.getElementById('agent-client-ctx');
  var clientId = agCtx ? agCtx.dataset.clientId : pending.clientId;
  if (!clientId) return;

  // Seleziona il formato corretto nel selettore del tab Agenti
  var fmtVal = _FORMAT_TO_AGENTI[pending.cardFormat] || 'post_instagram';
  var fmtSel = document.getElementById('ag-format-' + clientId);
  if (fmtSel) { fmtSel.value = fmtVal; fmtSel.dispatchEvent(new Event('change')); }

  // Campo "Material de campo" → briefing foto di Claude Vision
  var taCampo = document.getElementById('ag-campo-textarea');
  if (taCampo) {
    taCampo.value = pending.sceneBrief || '';
    taCampo.style.border = pending.sceneBrief ? '2px solid #1F2A24' : '';
  }

  // Campo "Instrucciones Bravo" → brief completo della card
  var taBravo = document.getElementById('ag-bravo-textarea');
  if (taBravo) {
    var bravoLines = [];
    bravoLines.push('📌 ' + pending.cardTitle + (pending.projTitle ? ' — ' + pending.projTitle : ''));
    if (pending.cardPillar) bravoLines.push('📂 Pilar: ' + pending.cardPillar);
    var fmtLabel = { feed:'Post Feed 1:1', story:'Story 9:16', reel:'Reel 9:16', carousel:'Carrusel IG' }[pending.cardFormat] || pending.cardFormat;
    bravoLines.push('📐 Formato: ' + fmtLabel);
    if (pending.creativeNote) {
      bravoLines.push('');
      bravoLines.push('🎯 Nota creativa:');
      bravoLines.push(pending.creativeNote);
    }
    var ctxText = pending.scriptOutput || pending.projDesc || '';
    if (ctxText) {
      bravoLines.push('');
      bravoLines.push('📝 Contexto del proyecto:');
      // Solo le prime 3 righe o max 280 chars — il guión completo è nel piano
      var ctxLines = ctxText.split('\n').filter(function(l){ return l.trim(); });
      var ctxSnippet = ctxLines.slice(0, 3).join('\n');
      if (ctxSnippet.length > 280) ctxSnippet = ctxSnippet.slice(0, 280) + '…';
      bravoLines.push(ctxSnippet);
    }
    if (pending.projDeliverable) {
      bravoLines.push('');
      bravoLines.push('📦 Entregable: ' + pending.projDeliverable);
    }
    bravoLines.push('');
    bravoLines.push('Genera el contenido respetando el brand kit del cliente.');
    taBravo.value = bravoLines.join('\n');
    taBravo.dispatchEvent(new Event('input'));
  }

  // Banner di collegamento + auto-caricamento foto matchata da Vision
  var resultsDiv = document.getElementById('ag-photo-results-' + clientId);
  if (resultsDiv) {
    var photoInfoHtml = '';
    if (pending.photoUrl) {
      photoInfoHtml =
        '<div style="margin-top:0.6rem;display:flex;align-items:center;gap:0.7rem">' +
          '<img src="' + pending.photoUrl + '" style="width:52px;height:52px;object-fit:cover;border-radius:7px;border:1.5px solid #C29547;flex-shrink:0">' +
          '<div style="font-size:0.69rem;color:#555;line-height:1.45">' +
            '<strong style="color:#1F2A24">Foto seleccionada por Vision</strong><br>' +
            (pending.sceneBrief ? pending.sceneBrief.slice(0, 100) + (pending.sceneBrief.length > 100 ? '…' : '') : '') +
            '<br><span style="color:#aaa">Cámbiala desde la cuadrícula si lo necesitas.</span>' +
          '</div>' +
        '</div>';
      // Auto-carica la foto nel grid
      setTimeout(function(){ _loadPendingPhotoAsFile(clientId, pending.photoUrl); }, 100);
    }
    resultsDiv.innerHTML =
      '<div style="background:#f0fdf4;border:2px solid #1F2A24;border-radius:10px;padding:0.9rem 1rem;margin-bottom:0.8rem">' +
        '<div style="font-weight:700;color:#1F2A24;font-size:0.85rem;margin-bottom:0.2rem">✦ ' + (pending.cardTitle || 'Piano') + '</div>' +
        '<div style="font-size:0.75rem;color:#555">Brief precargado · foto matchada por Vision · pulsa <strong>Genera</strong>.</div>' +
        photoInfoHtml +
      '</div>';
  }

  showToast('✦ Foto seleccionada — revisa y pulsa Genera');
}

async function agentiApprovePost(idx, clientId) {
  var variants = _agCurrentVariants[clientId] || [];
  var formatVal = _agCurrentFormat[clientId] || '';
  var isCarousel = formatVal === 'carousel' && variants.length > 1;

  // Per carosello approva sempre partendo dalla slide 0 (portada)
  var v = isCarousel ? variants[0] : variants[idx];
  if (!v) { alert('Variante non trovata.'); return; }

  // Caption da salvare:
  // - Post normale → caption testuale
  // - Carosello    → prefisso __CAROUSEL__ + JSON slide (solo URL/headline, no base64 pesante)
  //                  + separatore __|| + caption Instagram della portada
  var captionToSave;
  if (isCarousel) {
    var slidesData = variants.map(function(s) {
      return {
        headline:  s.headline  || '',
        body:      s.body      || '',
        image_url: s.image_url || '',   // URL Supabase Storage (leggero)
        img_b64:   s.image_url ? '' : (s.img_b64 || '')  // fallback base64 solo se non c'è URL
      };
    });
    captionToSave = '__CAROUSEL__' + JSON.stringify(slidesData) + '__||' + (variants[0].caption || '');
  } else {
    captionToSave = v.caption || '';
  }

  try {
    var res = await db.from('generated_content').insert({
      content_id: crypto.randomUUID(),
      client_id:  clientId,
      brief:      _agCurrentBrief[clientId] || '',
      platform:   v.platform  || 'Instagram',
      pillar:     v.pillar    || '',
      headline:   v.headline  || '',
      img_b64:    v.img_b64   || null,   // thumbnail portada (o post singolo)
      caption:    captionToSave,
      created_at: new Date().toISOString()
    });

    if (res.error) throw new Error(res.error.message);

    // Aggiorna RECENT_CONTENT e ridisegna dashboard
    await loadRecentContentFromDB();
    renderDashboardStats();

    // Incrementa contatore sprint se attivo
    sprintIncrementDone(clientId);

    // Aggiunge card al Tablero Social del progetto attivo
    _addPostToProjectKanban(clientId, v, isCarousel, formatVal);

    // Se arriva dal piano di produzione via "▶ Genera" sulla card → marca solo il subtask attivo come done
    if (window._pendingPlanCardLaunch) {
      var ppc = window._pendingPlanCardLaunch;
      window._pendingPlanCardLaunch = null;
      var pCard = (_planSuggestState && _planSuggestState.cards) ? _planSuggestState.cards[ppc.ci] : null;
      if (pCard) {
        var targetIdx = ppc.activeSubtaskIdx;
        (pCard.subtasks || []).forEach(function(sub, si) {
          if (targetIdx >= 0 ? si === targetIdx : (sub.assignee || '').toLowerCase().indexOf('agente') >= 0 && sub.status !== 'done') {
            if (sub.status !== 'done') {
              sub.status = 'done';
              if (!sub.output) sub.output = captionToSave || '';
            }
          }
        });
        var allDone = (pCard.subtasks || []).every(function(s){ return s.status === 'done'; });
        var anyWip  = (pCard.subtasks || []).some(function(s){ return s.status === 'wip' || s.status === 'review'; });
        pCard.status = allDone ? 'done' : anyWip ? 'wip' : 'todo';
        _patchPlanCard(pCard);
        var detEl = document.getElementById('plan-card-detail-' + ppc.ci);
        if (detEl) detEl.innerHTML = _renderPlanDetail(pCard, ppc.ci);
        _updatePlanCardHeader(pCard, ppc.ci);
        showToast('✓ Contenido aprobado — plan actualizado');
      }
    } else if (window._pendingDesignerStep) {
      // Se arriva dal piano di produzione → marca step Designer come completato
      var pds = window._pendingDesignerStep;
      window._pendingDesignerStep = null;
      if (typeof planSubtaskConfirm === 'function') planSubtaskConfirm(pds.ci, pds.si);
      showToast('✓ Step Designer completado en el plan');
    }

    // Feedback visivo sul pulsante
    var btns = document.querySelectorAll('[onclick*="agentiApprovePost(' + idx + '"]');
    btns.forEach(function(b){ b.textContent = '✓ Guardado!'; b.disabled = true; b.style.opacity='0.6'; });

    // Feedback loop Railway — auto-popola liked_aspects con segnali strutturali
    var likedAspects = [];
    if (v.layout_variant) likedAspects.push('layout: ' + v.layout_variant);
    if (v.content_type)   likedAspects.push('tipo: ' + v.content_type);
    if (v.pillar)         likedAspects.push('pilar: ' + v.pillar);
    fetch(AGENT_API + '/api/content/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:       clientId,
        status:          'approved',
        liked_aspects:   likedAspects.length ? likedAspects : null,
        headline:        v.headline || null,
        layout_variant:  v.layout_variant || null,
        pillar:          v.pillar || null,
        caption_preview: v.caption ? v.caption.slice(0, 120) : null,
        original_brief:  _agCurrentBrief[clientId] || null
      })
    }).catch(function() {});

  } catch(e) {
    alert('Error al guardar: ' + e.message);
  }
}

function agentiRejectPost(idx, clientId) {
  var variants = _agCurrentVariants[clientId] || [];
  var v = variants[idx];
  if (!v) return;

  // Feedback visivo immediato
  var actionsDiv = document.getElementById('ag-card-actions-' + clientId + '-' + idx);
  if (!actionsDiv) return;

  // Mostra form motivo di rifiuto (inline, non blocca gli altri post)
  var reasons = [
    'Tono incorrecto para la marca',
    'Layout no adecuado',
    'Copy débil — falta gancho',
    'No encaja con el brief',
    'Imagen no apropiada',
    'Demasiado genérico',
    'Otro'
  ];
  var opts = reasons.map(function(r, i) {
    return '<button onclick="_agSendReject(' + idx + ',\'' + clientId + '\',this)" ' +
      'data-reason="' + r + '" ' +
      'style="display:block;width:100%;text-align:left;padding:0.35rem 0.6rem;margin-bottom:0.2rem;' +
      'border:1px solid #e0dbd2;border-radius:6px;background:#fff;font-size:0.75rem;color:#444;cursor:pointer">' +
      r + '</button>';
  }).join('');

  actionsDiv.innerHTML =
    '<div style="padding:0.4rem;background:#fdf8f5;border:1px solid #e0dbd2;border-radius:8px">' +
      '<div style="font-size:0.72rem;color:#888;margin-bottom:0.4rem;font-weight:600">¿Por qué lo rechazas?</div>' +
      opts +
      '<button onclick="_agSendReject(' + idx + ',\'' + clientId + '\',null)" ' +
        'style="display:block;width:100%;text-align:center;padding:0.3rem;border:none;background:transparent;' +
        'font-size:0.7rem;color:#bbb;cursor:pointer;margin-top:0.2rem">Saltar</button>' +
    '</div>';
}

function _agSendReject(idx, clientId, btn) {
  var v = (_agCurrentVariants[clientId] || [])[idx];
  if (!v) return;
  var reason = btn ? btn.dataset.reason : null;

  // Feedback visivo
  var card = document.getElementById('ag-card-' + clientId + '-' + idx);
  if (card) { card.style.opacity = '0.4'; card.style.borderColor = '#e0e0e0'; }
  var actionsDiv = document.getElementById('ag-card-actions-' + clientId + '-' + idx);
  if (actionsDiv) {
    actionsDiv.innerHTML = '<span style="font-size:0.75rem;color:#aaa;padding:0.3rem 0.5rem">✕ Rechazado' +
      (reason ? ' — ' + reason : '') + '</span>';
  }

  // Feedback loop Railway (best-effort)
  fetch(AGENT_API + '/api/content/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id:        clientId,
      status:           'rejected',
      rejection_reason: reason || null,
      headline:         v.headline || null,
      layout_variant:   v.layout_variant || null,
      pillar:           v.pillar || null,
      caption_preview:  v.caption ? v.caption.slice(0, 120) : null,
      original_brief:   _agCurrentBrief[clientId] || null
    })
  }).catch(function() {});
}

// ============================================================
// MÉTRICAS — Tab performance post pubblicati
// ============================================================

var _metricasCache = {};  // { clientId: { metrics, aggregates } }
var _metricasFormOpen = {};  // { clientId: bool }

function renderMetricasSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  var cid = clientId;
  var pillars = ['PRODUCTO','AGRONOMIA','EQUIPO','TECNOLOGIA','CLIENTE','CALENDARIO'];
  var platforms = ['instagram','linkedin','facebook'];

  var html =
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.5rem">' +

    // ── Header
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem">' +
      '<div>' +
        '<div class="cliente-section-title" style="margin:0">▲ Métricas de publicaciones</div>' +
        '<div id="met-meta-' + cid + '" style="font-size:0.75rem;color:#888;margin-top:0.15rem">Cargando...</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
        '<select id="met-days-' + cid + '" onchange="metricasLoad(\'' + cid + '\')" ' +
          'style="padding:0.35rem 0.6rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem;background:#fff">' +
          '<option value="30">Últimos 30 días</option>' +
          '<option value="90" selected>Últimos 90 días</option>' +
          '<option value="180">Últimos 6 meses</option>' +
          '<option value="365">Último año</option>' +
        '</select>' +
        '<button class="bk-adopt-btn" id="met-sync-btn-' + cid + '" onclick="metricasSyncInstagram(\'' + cid + '\')">⟳ Sync Instagram</button>' +
        '<button class="bk-adopt-btn" onclick="metricasToggleForm(\'' + cid + '\')">+ Añadir métrica</button>' +
        '<button class="bk-newkit-btn" onclick="metricasAnalizar(\'' + cid + '\')">✦ Analizar con IA</button>' +
      '</div>' +
    '</div>' +

    // ── Panel análisis IA (oculto hasta que se ejecute)
    '<div id="met-analisis-' + cid + '" style="display:none"></div>' +

    // ── Form aggiunta (collassabile)
    '<div id="met-form-wrap-' + cid + '" style="display:none">' +
      '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1.25rem">' +
        '<div style="font-size:0.85rem;font-weight:600;color:#2a2a2a;margin-bottom:1rem">📊 Registrar métricas de un post</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">' +

          '<div style="grid-column:1/-1">' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Titular del post</label>' +
            '<input id="met-f-headline-' + cid + '" type="text" placeholder="Ej: BRAVERIA — EL ARRANQUE QUE MERECES" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Fecha de publicación</label>' +
            '<input id="met-f-date-' + cid + '" type="date" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Plataforma</label>' +
            '<select id="met-f-platform-' + cid + '" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem;background:#fff">' +
              '<option value="instagram">Instagram</option>' +
              '<option value="linkedin">LinkedIn</option>' +
              '<option value="facebook">Facebook</option>' +
            '</select>' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Pilar</label>' +
            '<select id="met-f-pillar-' + cid + '" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem;background:#fff">' +
              '<option value="">— Sin pilar —</option>' +
              pillars.map(function(p){ return '<option value="' + p + '">' + p + '</option>'; }).join('') +
            '</select>' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">❤️ Likes</label>' +
            '<input id="met-f-likes-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">💬 Comentarios</label>' +
            '<input id="met-f-comments-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">👁️ Alcance (Reach)</label>' +
            '<input id="met-f-reach-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">📊 Impresiones</label>' +
            '<input id="met-f-impressions-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">🔖 Guardados (Saves)</label>' +
            '<input id="met-f-saves-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">↗️ Compartidos</label>' +
            '<input id="met-f-shares-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div style="grid-column:1/-1">' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Notas (opcional)</label>' +
            '<input id="met-f-notes-' + cid + '" type="text" placeholder="Campaña verano, boost pagado..." ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem">' +
          '<button class="bk-newkit-btn" onclick="metricasToggleForm(\'' + cid + '\')">Cancelar</button>' +
          '<button class="bk-adopt-btn" id="met-save-btn-' + cid + '" onclick="metricasSave(\'' + cid + '\')">💾 Guardar métricas</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── KPI cards
    '<div id="met-kpi-' + cid + '">' +
      '<div style="color:#888;font-size:0.82rem">Cargando métricas...</div>' +
    '</div>' +

    // ── Grafici
    '<div id="met-charts-' + cid + '" style="display:none">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
        '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1rem">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#2a2a2a;margin-bottom:0.8rem">❤️ Likes por pilar</div>' +
          '<div id="met-chart-pillar-' + cid + '"></div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1rem">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#2a2a2a;margin-bottom:0.8rem">👁️ Alcance por plataforma</div>' +
          '<div id="met-chart-platform-' + cid + '"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── Lista post
    '<div>' +
      '<div style="font-size:0.82rem;font-weight:600;color:#2a2a2a;margin-bottom:0.6rem">Publicaciones registradas</div>' +
      '<div id="met-list-' + cid + '">' +
        '<div style="color:#888;font-size:0.82rem">Cargando...</div>' +
      '</div>' +
    '</div>' +

    '</div>';

  setTimeout(function(){ metricasLoad(cid); }, 80);
  // Precompila data oggi nel form
  setTimeout(function(){
    var df = document.getElementById('met-f-date-' + cid);
    if (df) df.value = new Date().toISOString().split('T')[0];
  }, 100);

  return html;
}

function metricasToggleForm(clientId) {
  var wrap = document.getElementById('met-form-wrap-' + clientId);
  if (!wrap) return;
  var open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : 'block';
}

function metricasLoad(clientId) {
  var meta = document.getElementById('met-meta-' + clientId);
  var daysEl = document.getElementById('met-days-' + clientId);
  var days = daysEl ? daysEl.value : 90;
  if (meta) meta.textContent = 'Cargando...';

  // Carica metriche + report IA salvato in parallelo
  Promise.all([
    fetch(BRAVO_API + '/api/metrics/' + encodeURIComponent(clientId) + '?days=' + days).then(function(r){ return r.json(); }),
    fetch(BRAVO_API + '/api/metrics/report/' + encodeURIComponent(clientId)).then(function(r){ return r.json(); })
  ]).then(function(results){
    var d = results[0];
    var rep = results[1];

    if (!d.ok) {
      if (meta) meta.textContent = '❌ Error: ' + d.error;
      return;
    }
    _metricasCache[clientId] = d;
    var total = d.aggregates.total_posts;
    if (meta) meta.textContent = total + ' publicaciones en los últimos ' + days + ' días';
    metricasRenderKPI(clientId, d.aggregates);
    metricasRenderCharts(clientId, d.aggregates);
    metricasRenderList(clientId, d.metrics);

    // Mostra il report IA salvato se disponibile
    if (rep.ok && rep.report) {
      var panel = document.getElementById('met-analisis-' + clientId);
      if (panel && rep.ok && rep.report) {
        panel.style.display = 'block';
        panel.innerHTML = _metricasRenderReport(rep.report, rep.generated_at, clientId);
      }
    }
  }).catch(function(e){
    if (meta) meta.textContent = '❌ Error de conexión';
    console.error('[MET]', e);
  });
}

function metricasRenderKPI(clientId, agg) {
  var el = document.getElementById('met-kpi-' + clientId);
  if (!el) return;

  var bestPillar = '—';
  var bestLikes = 0;
  Object.entries(agg.by_pillar || {}).forEach(function(kv){
    if (kv[1].likes > bestLikes) { bestLikes = kv[1].likes; bestPillar = kv[0]; }
  });

  function kpiCard(icon, label, value, sub) {
    return '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:0.9rem 1.1rem">' +
      '<div style="font-size:0.72rem;color:#888;margin-bottom:0.25rem">' + icon + ' ' + label + '</div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:#2a2a2a;line-height:1">' + value + '</div>' +
      (sub ? '<div style="font-size:0.7rem;color:#aaa;margin-top:0.2rem">' + sub + '</div>' : '') +
    '</div>';
  }

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.8rem;margin-bottom:0.5rem">' +
      kpiCard('📋', 'Posts registrados', agg.total_posts, '') +
      kpiCard('❤️', 'Media likes/post', agg.avg_likes, agg.total_likes + ' totales') +
      kpiCard('👁️', 'Media alcance/post', agg.avg_reach.toLocaleString('es-ES'), agg.total_reach.toLocaleString('es-ES') + ' totales') +
      kpiCard('⭐', 'Mejor pilar', bestPillar, bestLikes + ' likes acumulados') +
    '</div>';
}

function metricasRenderCharts(clientId, agg) {
  var wrap = document.getElementById('met-charts-' + clientId);
  var pillarEl = document.getElementById('met-chart-pillar-' + clientId);
  var platformEl = document.getElementById('met-chart-platform-' + clientId);
  if (!pillarEl || !platformEl) return;

  var pillarColors = {
    PRODUCTO:'#D13B1E', AGRONOMIA:'#2d5c2e', EQUIPO:'#2c5f8a',
    TECNOLOGIA:'#F5A623', CLIENTE:'#6d4c8e', CALENDARIO:'#888'
  };

  // Grafico pillar
  var pData = agg.by_pillar || {};
  var pKeys = Object.keys(pData);
  if (pKeys.length) {
    var maxLikes = Math.max.apply(null, pKeys.map(function(k){ return pData[k].likes || 0; })) || 1;
    pillarEl.innerHTML = pKeys.map(function(k){
      var v = pData[k].likes || 0;
      var pct = Math.round((v / maxLikes) * 100);
      var color = pillarColors[k] || '#C0392B';
      return '<div style="margin-bottom:0.55rem">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:0.2rem">' +
          '<span>' + k + '</span><span>' + v + ' likes · ' + pData[k].posts + ' posts</span>' +
        '</div>' +
        '<div style="background:#f0ece6;border-radius:4px;height:8px;overflow:hidden">' +
          '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;transition:width 0.5s"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    if (wrap) wrap.style.display = '';
  } else {
    pillarEl.innerHTML = '<div style="color:#aaa;font-size:0.78rem">Sin datos</div>';
  }

  // Grafico platform
  var plData = agg.by_platform || {};
  var plKeys = Object.keys(plData);
  var plColors = { instagram:'#C0392B', linkedin:'#0077b5', facebook:'#1877f2' };
  if (plKeys.length) {
    var maxReach = Math.max.apply(null, plKeys.map(function(k){ return plData[k].reach || 0; })) || 1;
    platformEl.innerHTML = plKeys.map(function(k){
      var v = plData[k].reach || 0;
      var pct = Math.round((v / maxReach) * 100);
      var color = plColors[k] || '#888';
      var label = k.charAt(0).toUpperCase() + k.slice(1);
      return '<div style="margin-bottom:0.55rem">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:0.2rem">' +
          '<span>' + label + '</span><span>' + v.toLocaleString('es-ES') + ' alcance</span>' +
        '</div>' +
        '<div style="background:#f0ece6;border-radius:4px;height:8px;overflow:hidden">' +
          '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;transition:width 0.5s"></div>' +
        '</div>' +
      '</div>';
    }).join('');
  } else {
    platformEl.innerHTML = '<div style="color:#aaa;font-size:0.78rem">Sin datos</div>';
  }
}

function metricasRenderList(clientId, metrics) {
  var el = document.getElementById('met-list-' + clientId);
  if (!el) return;

  if (!metrics || !metrics.length) {
    el.innerHTML =
      '<div style="text-align:center;padding:2.5rem 1rem;color:#aaa">' +
        '<div style="font-size:1.6rem;margin-bottom:0.4rem">📊</div>' +
        '<div style="font-weight:600;color:#888">Sin métricas registradas</div>' +
        '<div style="font-size:0.75rem;margin-top:0.3rem">Usa "+ Añadir métrica" para registrar el rendimiento de un post</div>' +
      '</div>';
    return;
  }

  var platIco = { instagram:'📸', linkedin:'💼', facebook:'👥' };
  var pillarColors = {
    PRODUCTO:'#D13B1E', AGRONOMIA:'#2d5c2e', EQUIPO:'#2c5f8a',
    TECNOLOGIA:'#F5A623', CLIENTE:'#6d4c8e', CALENDARIO:'#888'
  };

  el.innerHTML =
    '<div style="overflow-x:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-size:0.78rem">' +
      '<thead>' +
        '<tr style="border-bottom:2px solid #e0dbd2">' +
          '<th style="text-align:left;padding:0.5rem 0.6rem;color:#888;font-weight:600">Post</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">Fecha</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">❤️</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">💬</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">👁️ Reach</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">🔖</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600"></th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        metrics.map(function(m){
          var ico = platIco[m.platform] || '📱';
          var pColor = pillarColors[m.pillar] || '#aaa';
          var headline = m.headline || '(sin título)';
          if (headline.length > 48) headline = headline.slice(0, 46) + '…';
          var dateStr = m.published_at ? m.published_at.slice(0, 10) : '—';
          return '<tr style="border-bottom:1px solid #f0ece6;transition:background 0.15s" onmouseover="this.style.background=\'#faf9f7\'" onmouseout="this.style.background=\'\'">' +
            '<td style="padding:0.55rem 0.6rem;max-width:220px">' +
              '<div style="font-weight:600;color:#2a2a2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + ico + ' ' + headline + '</div>' +
              (m.pillar ? '<div style="display:inline-block;margin-top:0.2rem;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.65rem;font-weight:700;color:#fff;background:' + pColor + '">' + m.pillar + '</div>' : '') +
            '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;color:#666;white-space:nowrap">' + dateStr + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;font-weight:600;color:#2a2a2a">' + (m.likes||0).toLocaleString('es-ES') + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;color:#555">' + (m.comments||0) + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;font-weight:600;color:#2a2a2a">' + (m.reach||0).toLocaleString('es-ES') + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;color:#555">' + (m.saves||0) + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem">' +
              '<button onclick="metricasDelete(\'' + clientId + '\',\'' + m.id + '\')" ' +
                'style="background:none;border:none;cursor:pointer;color:#ccc;font-size:0.9rem;padding:0.1rem 0.3rem;border-radius:4px" ' +
                'onmouseover="this.style.color=\'#e74c3c\'" onmouseout="this.style.color=\'#ccc\'" ' +
                'title="Eliminar">✕</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
      '</tbody>' +
    '</table>' +
    '</div>';
}

async function metricasSave(clientId) {
  var btn = document.getElementById('met-save-btn-' + clientId);
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  var get = function(id){ var el = document.getElementById(id); return el ? el.value : ''; };

  var dateVal = get('met-f-date-' + clientId);
  if (!dateVal) {
    showToast('Selecciona una fecha de publicación');
    if (btn) { btn.textContent = '💾 Guardar métricas'; btn.disabled = false; }
    return;
  }

  var payload = {
    client_id:   clientId,
    headline:    get('met-f-headline-' + clientId),
    platform:    get('met-f-platform-' + clientId),
    pillar:      get('met-f-pillar-' + clientId) || null,
    published_at: dateVal,
    likes:       parseInt(get('met-f-likes-' + clientId)) || 0,
    comments:    parseInt(get('met-f-comments-' + clientId)) || 0,
    reach:       parseInt(get('met-f-reach-' + clientId)) || 0,
    impressions: parseInt(get('met-f-impressions-' + clientId)) || 0,
    saves:       parseInt(get('met-f-saves-' + clientId)) || 0,
    shares:      parseInt(get('met-f-shares-' + clientId)) || 0,
    notes:       get('met-f-notes-' + clientId),
    source:      'manual',
  };

  try {
    var resp = await fetch(BRAVO_API + '/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');

    showToast('✅ Métricas guardadas');
    metricasToggleForm(clientId);
    // Reset form
    ['headline','notes'].forEach(function(f){
      var el = document.getElementById('met-f-' + f + '-' + clientId);
      if (el) el.value = '';
    });
    ['likes','comments','reach','impressions','saves','shares'].forEach(function(f){
      var el = document.getElementById('met-f-' + f + '-' + clientId);
      if (el) el.value = '0';
    });
    metricasLoad(clientId);
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '💾 Guardar métricas'; btn.disabled = false; }
  }
}

async function metricasDelete(clientId, metricId) {
  if (!confirm('¿Eliminar esta métrica?')) return;
  try {
    var resp = await fetch(BRAVO_API + '/api/metrics/' + encodeURIComponent(metricId), { method: 'DELETE' });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    showToast('Métrica eliminada');
    metricasLoad(clientId);
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  }
}

// ============================================================
// MÉTRICAS — Sync Instagram + Analisis IA
// ============================================================

async function metricasSyncInstagram(clientId) {
  var btn = document.getElementById('met-sync-btn-' + clientId);
  if (btn) { btn.textContent = '⏳ Sincronizando...'; btn.disabled = true; }
  try {
    var res = await fetch(BRAVO_API + '/api/instagram/sync-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error al sincronizar');
    showToast('✅ ' + (data.imported || 0) + ' nuevos · ' + (data.updated || 0) + ' actualizados desde Instagram');
    metricasLoad(clientId);
  } catch(e) {
    showToast('❌ ' + e.message);
  } finally {
    if (btn) { btn.textContent = '⟳ Sync Instagram'; btn.disabled = false; }
  }
}

async function metricasAnalizar(clientId) {
  var panel = document.getElementById('met-analisis-' + clientId);
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML =
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1.25rem">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem">' +
        '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">✦ Análisis IA — Generando...</div>' +
        '<div style="width:14px;height:14px;border:2px solid #C0392B;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>' +
      '</div>' +
      '<div style="font-size:0.78rem;color:#aaa">El agente está analizando las métricas y el Brand Kit del cliente...</div>' +
    '</div>';
  try {
    var res = await fetch(BRAVO_API + '/api/metrics/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    panel.innerHTML = _metricasRenderReport(data.report, null, clientId);
  } catch(e) {
    panel.innerHTML =
      '<div style="background:#fff8f8;border:1px solid #f5c6c6;border-radius:10px;padding:1rem;font-size:0.82rem;color:#c0392b">' +
        '❌ ' + e.message +
      '</div>';
  }
}

function _metricasRenderReport(r, generatedAt, clientId) {
  var fechaStr = generatedAt ? new Date(generatedAt).toLocaleDateString('es-ES', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
  var tendenciaColor = r.tendencia === 'subiendo' ? '#1a6b1e' : r.tendencia === 'bajando' ? '#c0392b' : '#7a5c00';
  var tendenciaIcon  = r.tendencia === 'subiendo' ? '▲' : r.tendencia === 'bajando' ? '▼' : '→';

  return (
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1.25rem;display:flex;flex-direction:column;gap:1rem">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem">' +
        '<div style="display:flex;align-items:center;gap:0.6rem">' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">✦ Análisis IA</div>' +
          (r.tendencia ? '<span style="font-size:0.72rem;font-weight:700;color:' + tendenciaColor + '">' + tendenciaIcon + ' ' + r.tendencia.toUpperCase() + '</span>' : '') +
          (fechaStr ? '<span style="font-size:0.7rem;color:#aaa">· ' + fechaStr + '</span>' : '') +
        '</div>' +
        '<button onclick="document.getElementById(\'met-analisis-' + clientId + '\').style.display=\'none\'" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:0.9rem">✕</button>' +
      '</div>' +

      // Resumen
      '<div style="background:#fafaf8;border-radius:8px;padding:1rem;font-size:0.82rem;color:#2a2a2a;line-height:1.6">' + (r.resumen || '') + '</div>' +

      // Funciona / Mejorar
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">' +
        '<div style="background:#f0fdf0;border:1px solid #b6f0b8;border-radius:8px;padding:0.9rem">' +
          '<div style="font-size:0.75rem;font-weight:700;color:#1a6b1e;margin-bottom:0.5rem">✓ LO QUE FUNCIONA</div>' +
          '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.5">' + (r.funciona || '—') + '</div>' +
        '</div>' +
        '<div style="background:#fff8f0;border:1px solid #f5d87a;border-radius:8px;padding:0.9rem">' +
          '<div style="font-size:0.75rem;font-weight:700;color:#7a4e00;margin-bottom:0.5rem">⚠ LO QUE MEJORAR</div>' +
          '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.5">' + (r.mejorar || '—') + '</div>' +
        '</div>' +
      '</div>' +

      // Voz del público (audience_insights) — card destacada
      (r.audience_insights ?
        '<div style="background:#f0f8ff;border:1px solid #a8d4f5;border-radius:8px;padding:0.9rem">' +
          '<div style="font-size:0.75rem;font-weight:700;color:#1a4e8a;margin-bottom:0.5rem">💬 VOZ DEL PÚBLICO (de los comentarios)</div>' +
          '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.6">' + r.audience_insights + '</div>' +
        '</div>'
      : '') +

      // Ideas
      '<div style="background:#f8f4ff;border:1px solid #d0b8ff;border-radius:8px;padding:0.9rem">' +
        '<div style="font-size:0.75rem;font-weight:700;color:#6b1a9e;margin-bottom:0.5rem">💡 IDEAS PARA STUDIO BRAVO</div>' +
        '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.6">' + (r.ideas || '—') + '</div>' +
      '</div>' +

    '</div>'
  );
}

// ============================================================
// SOCIAL TAB — renderSocialSection + helpers
// ============================================================

function renderSocialSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  setTimeout(function(){ igLoadStatus(clientId); }, 120);

  return (
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.5rem">' +

    // Header
    '<div>' +
      '<div class="cliente-section-title" style="margin:0">📡 Redes Sociales</div>' +
      '<div style="font-size:0.75rem;color:#888;margin-top:0.2rem">Conecta y gestiona las cuentas sociales del cliente</div>' +
    '</div>' +

    // Instagram card
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:12px;overflow:hidden">' +

      // Card header
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;border-bottom:1px solid #f0ece6;background:#fafaf8">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;font-size:1.1rem">📷</div>' +
        '<div>' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">Instagram</div>' +
          '<div style="font-size:0.72rem;color:#888">Cuenta Business / Creator</div>' +
        '</div>' +
        '<span id="ig-status-badge-' + clientId + '" style="margin-left:auto;font-size:0.68rem;padding:0.2rem 0.6rem;border-radius:10px;background:#f0ece6;color:#888">Verificando...</span>' +
      '</div>' +

      // Card body
      '<div id="ig-connect-body-' + clientId + '" style="padding:1rem 1.25rem">' +
        '<div style="color:#aaa;font-size:0.78rem">Cargando...</div>' +
      '</div>' +
    '</div>' +

    // LinkedIn card (próximamente)
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:12px;overflow:hidden;opacity:0.5">' +
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;background:#fafaf8">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:#0077b5;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;font-weight:700;font-size:0.85rem">in</div>' +
        '<div>' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">LinkedIn</div>' +
          '<div style="font-size:0.72rem;color:#888">Página de empresa</div>' +
        '</div>' +
        '<span style="margin-left:auto;font-size:0.68rem;padding:0.2rem 0.6rem;border-radius:10px;background:#f0ece6;color:#aaa">Próximamente</span>' +
      '</div>' +
    '</div>' +

    // Facebook card (próximamente)
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:12px;overflow:hidden;opacity:0.5">' +
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;background:#fafaf8">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:#1877f2;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;font-weight:700;font-size:0.85rem">f</div>' +
        '<div>' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">Facebook</div>' +
          '<div style="font-size:0.72rem;color:#888">Página de empresa</div>' +
        '</div>' +
        '<span style="margin-left:auto;font-size:0.68rem;padding:0.2rem 0.6rem;border-radius:10px;background:#f0ece6;color:#aaa">Próximamente</span>' +
      '</div>' +
    '</div>' +

    '</div>'
  );
}

// ============================================================
// INSTAGRAM PUBLISHING — funzioni frontend
// ============================================================

// Pubblica direttamente dai risultati dell'Agente (ha l'immagine in memoria)
async function igPublishPost(clientId, variantIdx, btn) {
  if (!btn) return;
  var originalText = btn.textContent;
  btn.textContent  = '⏳ Publicando...';
  btn.disabled     = true;

  try {
    // Recupera i dati della variante dal DOM
    var resultsDiv = document.getElementById('ag-photo-results-' + clientId);
    if (!resultsDiv) throw new Error('No se encontraron los resultados del agente');

    // I dati della variante sono salvati nell'oggetto globale dopo la generazione
    var variants = (window._agCurrentVariants && window._agCurrentVariants[clientId]);
    if (!variants || !variants[variantIdx]) throw new Error('Variante no disponible — regenera el post');

    var v = variants[variantIdx];
    var img_b64 = v.img_b64 || v.image_url || '';
    if (!img_b64) throw new Error('No hay imagen disponible para publicar');

    // Se è un URL pubblico (non base64), lo scarica prima
    var imageB64 = img_b64;
    if (img_b64.startsWith('http')) {
      showToast('⏳ Preparando imagen...');
      var imgResp = await fetch(img_b64);
      var blob    = await imgResp.blob();
      imageB64    = await new Promise(function(res) {
        var reader = new FileReader();
        reader.onloadend = function() { res(reader.result.split(',')[1]); };
        reader.readAsDataURL(blob);
      });
    }

    var caption  = v.caption || '';
    var resp     = await fetch(BRAVO_API + '/api/instagram/publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:  clientId,
        image_b64:  imageB64,
        caption:    caption,
        content_id: v.content_id || '',
      }),
    });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error);

    btn.textContent = '✓ Publicado!';
    btn.style.background = '#27ae60';
    btn.style.color      = '#fff';
    btn.style.border     = 'none';
    showToast('✅ Post publicado en @' + (data.ig_username || 'Instagram'));

  } catch(e) {
    btn.textContent = '📱 Pubblica IG';
    btn.disabled    = false;
    showToast('❌ ' + e.message);
  }
}

// Pubblica dall'archivio Contenido (deve recuperare l'immagine da Supabase)
async function igPublishFromArchive(clientId, contentId, btn) {
  if (!btn) return;
  var originalText = btn.textContent;
  btn.textContent  = '⏳';
  btn.disabled     = true;

  try {
    // Cerca il record in cache locale
    var record = null;
    if (window._clienteContentCache && _clienteContentCache[clientId]) {
      record = _clienteContentCache[clientId].find(function(r){ return r.id === contentId; });
    }
    if (!record && window.RECENT_CONTENT) {
      record = RECENT_CONTENT.find(function(r){ return r.id === contentId; });
    }
    if (!record) throw new Error('Post no encontrado en caché — recarga la página');

    var imgSrc = _bravoImgSrcFromRecord(record);
    if (!imgSrc) throw new Error('Este post no tiene imagen — solo se pueden publicar posts con imagen');

    var caption = record.caption || record.headline || '';
    if (!caption) throw new Error('El post no tiene caption');

    // Converti immagine in base64 se è un URL
    var imageB64 = imgSrc;
    if (imgSrc.startsWith('http') || imgSrc.startsWith('/')) {
      showToast('⏳ Preparando imagen...');
      var imgResp = await fetch(imgSrc);
      var blob    = await imgResp.blob();
      imageB64    = await new Promise(function(res) {
        var reader  = new FileReader();
        reader.onloadend = function() { res(reader.result.split(',')[1]); };
        reader.readAsDataURL(blob);
      });
    } else if (imgSrc.startsWith('data:')) {
      imageB64 = imgSrc.split(',')[1];
    }

    var resp = await fetch(BRAVO_API + '/api/instagram/publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:  clientId,
        image_b64:  imageB64,
        caption:    caption,
        content_id: record.content_id || record.id || '',
      }),
    });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error);

    btn.textContent      = '✓';
    btn.style.background = '#27ae60';
    showToast('✅ Publicado en @' + (data.ig_username || 'Instagram'));

  } catch(e) {
    btn.textContent = '📱 IG';
    btn.disabled    = false;
    showToast('❌ ' + e.message);
  }
}

// Salva varianti generate in memoria per poterle pubblicare dopo
function _agStoreVariants(clientId, variants) {
  if (!window._agLastVariants) window._agLastVariants = {};
  window._agLastVariants[clientId] = variants;
}

// ============================================================
// ASSET LIBRARY — Tab Assets per cliente
// ============================================================

var _assetsCache = {};  // { clientId: [asset, ...] }

function renderAssetsSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  var html =
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem">' +

    // ── Header
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem">' +
      '<div>' +
        '<div class="cliente-section-title" style="margin:0">🖼️ Librería de assets</div>' +
        '<div id="assets-meta-' + clientId + '" style="font-size:0.75rem;color:#888;margin-top:0.15rem">Cargando...</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">' +
        '<select id="assets-filter-' + clientId + '" onchange="assetsLoad(\'' + clientId + '\')" ' +
          'style="padding:0.35rem 0.6rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem;background:#fff">' +
          '<option value="">Todos los tipos</option>' +
          '<option value="photo">📸 Fotos</option>' +
          '<option value="video">🎬 Videos</option>' +
          '<option value="logo">🏷️ Logos</option>' +
          '<option value="doc">📄 Documentos</option>' +
        '</select>' +
        '<label class="bk-adopt-btn" style="cursor:pointer">' +
          '+ Subir archivo' +
          '<input type="file" id="assets-upload-input-' + clientId + '" multiple accept="image/*,video/*,.pdf,.svg" style="display:none" ' +
            'onchange="assetsHandleUpload(this,\'' + clientId + '\')">' +
        '</label>' +
      '</div>' +
    '</div>' +

    // ── Drop zone upload
    '<div id="assets-dropzone-' + clientId + '" ' +
      'style="border:2px dashed #e0dbd2;border-radius:10px;padding:1.2rem;text-align:center;background:#faf9f7;cursor:pointer;transition:all 0.2s" ' +
      'onclick="document.getElementById(\'assets-upload-input-' + clientId + '\').click()" ' +
      'ondragover="event.preventDefault();this.style.borderColor=\'#C0392B\';this.style.background=\'#fff5f3\'" ' +
      'ondragleave="this.style.borderColor=\'#e0dbd2\';this.style.background=\'#faf9f7\'" ' +
      'ondrop="assetsHandleDrop(event,\'' + clientId + '\')">' +
      '<div style="font-size:1.5rem;margin-bottom:0.3rem">📁</div>' +
      '<div style="font-size:0.82rem;color:#888">Arrastra aquí fotos, videos o logos — o toca para seleccionar</div>' +
      '<div style="font-size:0.72rem;color:#aaa;margin-top:0.2rem">JPG, PNG, MP4, SVG, PDF · múltiples archivos a la vez</div>' +
    '</div>' +

    // ── Progress upload
    '<div id="assets-upload-progress-' + clientId + '" style="display:none">' +
      '<div style="font-size:0.78rem;color:#555;margin-bottom:0.4rem" id="assets-upload-label-' + clientId + '">Subiendo...</div>' +
      '<div style="background:#f0ece6;border-radius:4px;height:6px;overflow:hidden">' +
        '<div id="assets-upload-bar-' + clientId + '" style="height:100%;background:#C0392B;border-radius:4px;transition:width 0.3s;width:0%"></div>' +
      '</div>' +
    '</div>' +

    // ── Griglia asset
    '<div id="assets-grid-' + clientId + '">' +
      '<div style="color:#888;font-size:0.82rem;padding:2rem;text-align:center">Cargando assets...</div>' +
    '</div>' +

    '</div>';

  setTimeout(function(){ assetsLoad(clientId); }, 80);
  return html;
}

function assetsLoad(clientId) {
  var meta   = document.getElementById('assets-meta-' + clientId);
  var filter = document.getElementById('assets-filter-' + clientId);
  var type   = filter ? filter.value : '';
  var url    = BRAVO_API + '/api/assets/' + encodeURIComponent(clientId);
  if (type) url += '?type=' + type;

  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d.ok) { if (meta) meta.textContent = '❌ ' + d.error; return; }
      _assetsCache[clientId] = d.assets || [];
      var count = d.assets.length;
      if (meta) meta.textContent = count + ' asset' + (count !== 1 ? 's' : '') + (type ? ' · ' + type : '');
      assetsRenderGrid(clientId, d.assets);
    })
    .catch(function(e){ if (meta) meta.textContent = '❌ Error de conexión'; });
}

function assetsRenderGrid(clientId, assets) {
  var grid = document.getElementById('assets-grid-' + clientId);
  if (!grid) return;

  if (!assets || !assets.length) {
    grid.innerHTML =
      '<div style="text-align:center;padding:3rem 1rem;color:#aaa">' +
        '<div style="font-size:2rem;margin-bottom:0.5rem">🖼️</div>' +
        '<div style="font-weight:600;color:#888;margin-bottom:0.3rem">Librería vacía</div>' +
        '<div style="font-size:0.75rem">Sube fotos, logos y videos del cliente para reutilizarlos en cada generación</div>' +
      '</div>';
    return;
  }

  var typeIco = { photo:'📸', video:'🎬', logo:'🏷️', doc:'📄' };

  grid.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.8rem">' +
    assets.map(function(a) {
      var isImg = a.type === 'photo' || a.type === 'logo';
      var ico   = typeIco[a.type] || '📎';
      var tags  = (a.tags || []).map(function(t){
        return '<span style="background:#f0ece6;border-radius:4px;padding:0.1rem 0.35rem;font-size:0.62rem;color:#666">' + t + '</span>';
      }).join(' ');
      var name  = a.filename.length > 22 ? a.filename.slice(0,20) + '…' : a.filename;

      return '<div class="asset-card" style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;overflow:hidden;position:relative;cursor:pointer" ' +
        'onclick="assetsSelectForAgent(\'' + clientId + '\',\'' + a.id + '\')">' +

        // Thumbnail
        (isImg
          ? '<div style="aspect-ratio:1/1;background:#f0ece6;overflow:hidden"><img src="' + a.public_url + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML=\'<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem&quot;>' + ico + '</div>\'"></div>'
          : '<div style="aspect-ratio:1/1;background:#f0ece6;display:flex;align-items:center;justify-content:center;font-size:2.5rem">' + ico + '</div>') +

        // Info
        '<div style="padding:0.45rem 0.5rem">' +
          '<div style="font-size:0.7rem;font-weight:600;color:#2a2a2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.2rem">' + name + '</div>' +
          (tags ? '<div style="display:flex;flex-wrap:wrap;gap:0.2rem">' + tags + '</div>' : '') +
        '</div>' +

        // Pulsante elimina — sempre visibile
        '<button onclick="event.stopPropagation();assetsDelete(\'' + clientId + '\',\'' + a.id + '\')" ' +
          'style="position:absolute;top:4px;right:4px;background:#e74c3c;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:0.65rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.25)" ' +
          'onmouseover="this.style.background=\'#c0392b\'" onmouseout="this.style.background=\'#e74c3c\'" ' +
          'title="Eliminar">✕</button>' +

      '</div>';
    }).join('') +
    '</div>';

  // Mostra il tasto elimina sull'hover della card
  grid.querySelectorAll('.asset-card').forEach(function(card) {
    var btn = card.querySelector('.asset-del-btn');
    if (!btn) return;
    card.addEventListener('mouseenter', function(){ btn.style.display = 'flex'; });
    card.addEventListener('mouseleave', function(){ btn.style.display = 'none'; });
  });
}

function assetsHandleDrop(event, clientId) {
  event.preventDefault();
  var dz = document.getElementById('assets-dropzone-' + clientId);
  if (dz) { dz.style.borderColor = '#e0dbd2'; dz.style.background = '#faf9f7'; }
  var files = Array.from(event.dataTransfer.files || []);
  if (files.length) assetsUploadFiles(clientId, files);
}

function assetsHandleUpload(input, clientId) {
  var files = Array.from(input.files || []);
  if (files.length) assetsUploadFiles(clientId, files);
  input.value = '';
}

async function assetsUploadFiles(clientId, files) {
  var progressWrap = document.getElementById('assets-upload-progress-' + clientId);
  var bar          = document.getElementById('assets-upload-bar-' + clientId);
  var label        = document.getElementById('assets-upload-label-' + clientId);
  if (progressWrap) progressWrap.style.display = 'block';

  var done = 0;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (label) label.textContent = 'Subiendo ' + (i+1) + ' de ' + files.length + ': ' + file.name;
    if (bar)   bar.style.width   = Math.round((i / files.length) * 100) + '%';

    // Determina tipo
    var type = 'photo';
    if (file.type.startsWith('video/'))       type = 'video';
    else if (file.type === 'image/svg+xml')   type = 'logo';
    else if (file.type === 'application/pdf') type = 'doc';

    var form = new FormData();
    form.append('file', file);
    form.append('type', type);

    try {
      var resp = await fetch(BRAVO_API + '/api/assets/' + encodeURIComponent(clientId) + '/upload', {
        method: 'POST',
        body:   form,
      });
      var data = await resp.json();
      if (data.ok && data.asset) {
        if (!_assetsCache[clientId]) _assetsCache[clientId] = [];
        _assetsCache[clientId].unshift(data.asset);
        done++;
      }
    } catch(e) {
      console.error('[ASSETS] upload error:', e);
    }
  }

  if (bar)   bar.style.width = '100%';
  if (label) label.textContent = '✅ ' + done + ' de ' + files.length + ' subidos';
  setTimeout(function(){
    if (progressWrap) progressWrap.style.display = 'none';
    assetsRenderGrid(clientId, _assetsCache[clientId] || []);
    var meta = document.getElementById('assets-meta-' + clientId);
    if (meta) meta.textContent = (_assetsCache[clientId] || []).length + ' assets';
  }, 1200);
}

async function assetsDelete(clientId, assetId) {
  if (!confirm('¿Eliminar este asset de la librería?')) return;
  try {
    var resp = await fetch(BRAVO_API + '/api/assets/' + encodeURIComponent(assetId), { method: 'DELETE' });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error);
    if (_assetsCache[clientId]) {
      _assetsCache[clientId] = _assetsCache[clientId].filter(function(a){ return a.id !== assetId; });
      assetsRenderGrid(clientId, _assetsCache[clientId]);
    }
    showToast('Asset eliminado');
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

// ── Seleziona un asset dalla libreria e usalo nel form Agente ─────────────────

function assetsSelectForAgent(clientId, assetId) {
  var asset = (_assetsCache[clientId] || []).find(function(a){ return a.id === assetId; });
  if (!asset) return;

  // Carica l'immagine come blob e mostra preview nella dropzone dell'Agente
  fetch(asset.public_url)
    .then(function(r){ return r.blob(); })
    .then(function(blob) {
      var file = new File([blob], asset.filename, { type: blob.type });
      // Passa al form Agente come se l'utente avesse caricato il file
      var fakeEvent = { target: { files: [file] } };

      // Cerca il clientKey dal contesto
      var ctx = document.getElementById('agent-client-ctx');
      var clientKey = ctx ? ctx.dataset.clientKey : '';

      agentiPhotoSelected({ files: [file] }, clientId, clientKey);

      // Switcha al tab Agenti
      switchClienteTab('agenti');
      showToast('📸 Foto cargada desde la librería');
    })
    .catch(function(e){ showToast('❌ Error al cargar asset: ' + e.message); });
}

// ── Modale libreria rapida (apribile dal form Agente) ─────────────────────────

var _assetsModalClientId = null;

function assetsOpenModal(clientId, clientKey) {
  _assetsModalClientId = clientId;

  // Crea modale se non esiste
  if (!document.getElementById('assets-modal')) {
    var m = document.createElement('div');
    m.id = 'assets-modal';
    m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;padding:1rem';
    m.innerHTML =
      '<div style="background:#fff;border-radius:14px;width:100%;max-width:640px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid #e0dbd2">' +
          '<div style="font-weight:700;font-size:0.95rem">📁 Selecciona desde la librería</div>' +
          '<button onclick="assetsCloseModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#888">✕</button>' +
        '</div>' +
        '<div id="assets-modal-body" style="padding:1rem;overflow-y:auto;flex:1"></div>' +
      '</div>';
    document.body.appendChild(m);
  }

  var modal = document.getElementById('assets-modal');
  var body  = document.getElementById('assets-modal-body');
  modal.style.display = 'flex';

  // Carica o usa cache
  var assets = (_assetsCache[clientId] || []).filter(function(a){ return a.type === 'photo' || a.type === 'logo'; });

  if (assets.length) {
    _assetsRenderModalGrid(assets, clientId, clientKey);
  } else {
    body.innerHTML = '<div style="color:#888;padding:1.5rem;text-align:center">Cargando...</div>';
    fetch(BRAVO_API + '/api/assets/' + encodeURIComponent(clientId) + '?type=photo')
      .then(function(r){ return r.json(); })
      .then(function(d){
        _assetsCache[clientId] = d.assets || [];
        _assetsRenderModalGrid(d.assets || [], clientId, clientKey);
      });
  }
}

function _assetsRenderModalGrid(assets, clientId, clientKey) {
  var body = document.getElementById('assets-modal-body');
  if (!body) return;
  if (!assets.length) {
    body.innerHTML = '<div style="text-align:center;padding:2rem;color:#aaa"><div style="font-size:1.8rem;margin-bottom:0.5rem">🖼️</div><div>Librería vacía — sube fotos en el tab Assets</div></div>';
    return;
  }
  body.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.6rem">' +
    assets.map(function(a) {
      return '<div style="border:2px solid #e0dbd2;border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color 0.15s" ' +
        'onmouseover="this.style.borderColor=\'#C0392B\'" onmouseout="this.style.borderColor=\'#e0dbd2\'" ' +
        'onclick="assetsPickFromModal(\'' + clientId + '\',\'' + clientKey + '\',\'' + a.id + '\')">' +
        '<div style="aspect-ratio:1/1;background:#f0ece6;overflow:hidden">' +
          '<img src="' + a.public_url + '" loading="lazy" style="width:100%;height:100%;object-fit:cover">' +
        '</div>' +
        '<div style="font-size:0.65rem;padding:0.25rem 0.35rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#555">' + a.filename + '</div>' +
      '</div>';
    }).join('') +
    '</div>';
}

function assetsPickFromModal(clientId, clientKey, assetId) {
  assetsCloseModal();
  assetsSelectForAgent(clientId, assetId);
}

function assetsCloseModal() {
  var m = document.getElementById('assets-modal');
  if (m) m.style.display = 'none';
}

function toggleDarkMode() {
  var isDark = document.body.classList.toggle('dark');
  localStorage.setItem('bravo-dark', isDark ? '1' : '0');
  var btn = document.getElementById('darkToggleBtn');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

(function() {
  if (localStorage.getItem('bravo-dark') === '1') {
    document.body.classList.add('dark');
    window.addEventListener('DOMContentLoaded', function() {
      var btn = document.getElementById('darkToggleBtn');
      if (btn) btn.textContent = '☀️';
    });
  }
})();

