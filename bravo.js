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
  if (tab === 'calendario') renderCalendar();
  if (tab === 'tablero') { buildTbSelector(); renderTablero(); }
  if (tab === 'equipo') renderEquipoView();
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
var calEvents = {
  '2026-4-2':  [{ t:'Kickoff Newsletter', cls:'ce-blue' }],
  '2026-4-4':  [{ t:'Paleta Colores', cls:'ce-gold' }],
  '2026-4-10': [{ t:'Brand Guidelines', cls:'ce-green' }],
  '2026-4-15': [{ t:'Rebrand Rossi', cls:'ce-red' }],
  '2026-4-20': [{ t:'Newsletter Ferretti', cls:'ce-gold' }],
  '2026-4-22': [{ t:'Revision Social Q2', cls:'ce-blue' }],
  '2026-5-2':  [{ t:'Campana Social Q2', cls:'ce-red' }],
};
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
var CUENTAS = [
  { id:'ecom',    nombre:'E-commerce',    cliente:'Verde Fashion', progreso:32, estado:'crit', estadoLabel:'En retraso',  deadline:'28 mar', deadlineTag:'Vencido',   deadlineClass:'dead-late', equipo:['CL','AV','MA'], equipoColors:['#D13B1E','#2c5f8a','#2d7a4f'], tareas:7,  senal:'2 dias de retraso. Sin respuesta del cliente.' },
  { id:'social',  nombre:'Social Q2',     cliente:'Bianchi & Co',  progreso:55, estado:'warn', estadoLabel:'Revision',    deadline:'2 may',  deadlineTag:'33 dias',    deadlineClass:'dead-soon', equipo:['AV','MA'],       equipoColors:['#2c5f8a','#2d7a4f'],         tareas:5,  senal:'3 contenidos en revision pendiente.' },
  { id:'rebrand', nombre:'Rebrand',        cliente:'Rossi Srl',     progreso:78, estado:'good', estadoLabel:'En curso',    deadline:'15 abr', deadlineTag:'16 dias',    deadlineClass:'dead-ok',   equipo:['MA','CL'],       equipoColors:['#2d7a4f','#D13B1E'],         tareas:3,  senal:'Logo aprobado. Paleta en seleccion final.' },
  { id:'news',    nombre:'Newsletter',     cliente:'Ferretti SpA',  progreso:10, estado:'idle', estadoLabel:'Planificado', deadline:'20 abr', deadlineTag:'21 dias',    deadlineClass:'dead-ok',   equipo:['AV'],            equipoColors:['#2c5f8a'],                   tareas:8,  senal:'Sin responsable asignado.' },
];

var HOY_TAREAS = {
  'Carlos Lage':    [ { t:'Rodaje catalogo primavera — Verde Fashion', urgente:true }, { t:'Motion logo Rossi — storyboard', urgente:false } ],
  'Andrea Valdivia':[ { t:'Calendario mayo — Bianchi & Co', urgente:true }, { t:'Revisar copy Q2', urgente:false }, { t:'Confirmar kickoff Ferretti', urgente:false } ],
  'Mari Almendros': [ { t:'Paleta final Rossi — URGENTE', urgente:true }, { t:'3 creatividades Bianchi', urgente:false } ],
};

var PERSON_COLORS = { 'Carlos Lage':'#D13B1E', 'Andrea Valdivia':'#2c5f8a', 'Mari Almendros':'#2d7a4f' };
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
  var html = '<div class="hoy-header"><div class="hoy-title">Hoy toca</div><div class="hoy-sub">' + bravoTodayStr() + ' — equipo</div></div>';
  var nombres = Object.keys(HOY_TAREAS);
  for (var ni = 0; ni < nombres.length; ni++) {
    var nombre = nombres[ni];
    var tareas = HOY_TAREAS[nombre];
    var color    = PERSON_COLORS[nombre] || '#999';
    var parts    = nombre.split(' ');
    var initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    var tareasHtml = '';
    for (var ti = 0; ti < tareas.length; ti++) {
      tareasHtml += '<div class="hoy-task ' + (tareas[ti].urgente ? 'urgente' : 'normal') + '"><span class="hoy-task-dot"></span>' + tareas[ti].t + '</div>';
    }
    html += '<div class="hoy-person">' +
      '<div class="hoy-person-head"><div class="hoy-av" style="background:' + color + '">' + initials + '</div>' +
      '<div><div class="hoy-person-name">' + parts[0] + '</div><div class="hoy-person-role">' + parts.slice(1).join(' ') + '</div></div></div>' +
      '<div class="hoy-tasks">' + tareasHtml + '</div></div>';
  }
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

function buildTbSelector() {
  var sel = document.getElementById('cuentaSelector');
  if (!sel) return;
  var html = '';
  for (var i = 0; i < CUENTAS.length; i++) {
    var c = CUENTAS[i];
    var stClass = c.estado==='crit'?'st-crit':c.estado==='warn'?'st-warn':c.estado==='good'?'st-good':'';
    var isActive = c.id === activeTbCuenta;
    html += '<button class="cuenta-sel-btn ' + (isActive?'active '+stClass:'') + '" onclick="switchTbCuenta(\'' + c.id + '\',this,\'' + stClass + '\')">' + c.nombre + ' · ' + c.cliente + '</button>';
  }
  sel.innerHTML = html;
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
      var aColor = cd.assign && cd.assign.indexOf('Carlos') >= 0 ? '#D13B1E' : cd.assign && cd.assign.indexOf('Andrea') >= 0 ? '#2c5f8a' : cd.assign && cd.assign.indexOf('Mari') >= 0 ? '#2d7a4f' : '#a09890';
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

// ── KANBAN ──
var COLS = TB_COLS; // reuse same column definitions

var cardStore = {};

var KANBAN_DATA = {
  ecom: {
    info:  [ { t:'Brief cliente aprobado', m:'Verde Fashion', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' }, { t:'Guia de marca v2', m:'Referencia', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Reel de producto 15s', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Filmmaker', date:'', priority:'Alta', links:[], comments:'' }, { t:'Stories con countdown', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media', date:'', priority:'Normal', links:[], comments:'' } ],
    todo:  [ { t:'Fotografia de producto', m:'Pendiente', desc:'', assign:'', date:'', priority:'Alta', links:[], comments:'' }, { t:'Copy para 5 posts', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media', date:'', priority:'Normal', links:[], comments:'' }, { t:'Banner web hero', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:   [ { t:'Video unboxing', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Filmmaker', date:'', priority:'Alta', links:[], comments:'' }, { t:'Carrusel novedades', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' } ],
    done:  [ { t:'Identidad visual web', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:[], meet:[ { t:'Kickoff Verde Fashion', m:'28 mar 10:00', desc:'', assign:'', date:'2026-03-28', priority:'Normal', links:[], comments:'' } ],
    shoot: [ { t:'Rodaje catalogo primavera', m:'2 abr estudio', desc:'', assign:'Carlos Lage — Filmmaker', date:'2026-04-02', priority:'Alta', links:[], comments:'' } ],
    prop:  [ { t:'Propuesta reels mensuales', m:'Enviada', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
  },
  social: {
    info:  [ { t:'Brief Campana Q2', m:'Bianchi & Co', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Serie detras de camara', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media', date:'', priority:'Normal', links:[], comments:'' }, { t:'Encuestas interactivas', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media', date:'', priority:'Baja', links:[], comments:'' } ],
    todo:  [ { t:'Calendario mayo', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media', date:'', priority:'Alta', links:[], comments:'' }, { t:'3 creatividades nuevas', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:   [ { t:'Post lanzamiento coleccion', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Alta', links:[], comments:'' }, { t:'Story secuencia x5', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media', date:'', priority:'Normal', links:[], comments:'' }, { t:'Reels testimoniales', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Filmmaker', date:'', priority:'Normal', links:[], comments:'' } ],
    done:  [ { t:'Copy revisado marzo', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media', date:'', priority:'Normal', links:[], comments:'' }, { t:'Paleta visual aprobada', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:   [ { t:'Post 28 mar Campana', m:'Publicado', desc:'', assign:'', date:'2026-03-28', priority:'Normal', links:[], comments:'' } ],
    meet:  [ { t:'Revision semanal', m:'Lun 31 mar 09:30', desc:'', assign:'', date:'2026-03-31', priority:'Normal', links:[], comments:'' } ],
    shoot:[], prop: [ { t:'Propuesta influencer', m:'En revision', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
  },
  rebrand: {
    info:  [ { t:'Moodboard aprobado', m:'Rossi Srl', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' }, { t:'Briefing identidad', m:'Referencia', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Motion logo animado', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Filmmaker', date:'', priority:'Normal', links:[], comments:'' } ],
    todo:  [ { t:'Brand guidelines PDF', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'2026-04-10', priority:'Alta', links:[], comments:'' }, { t:'Aplicaciones papeleria', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:   [ { t:'Seleccion paleta final', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Alta', links:[], comments:'' } ],
    done:  [ { t:'Logo v3 aprobado', m:'29 mar', desc:'', assign:'Mari Almendros — Disenadora', date:'2026-03-29', priority:'Normal', links:[], comments:'' }, { t:'Tipografia definida', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:[], meet: [ { t:'Presentacion brand book', m:'10 abr 11:00', desc:'', assign:'', date:'2026-04-10', priority:'Normal', links:[], comments:'' } ],
    shoot: [ { t:'Sesion foto corporativa', m:'8 abr exterior', desc:'', assign:'Carlos Lage — Filmmaker', date:'2026-04-08', priority:'Alta', links:[], comments:'' } ],
    prop:[],
  },
  news: {
    info:  [ { t:'Brief Ferretti SpA', m:'Pendiente firma', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Seccion novedades mes', m:'Sin asignar', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    todo:  [ { t:'Estructura newsletter', m:'Sin asignar', desc:'', assign:'', date:'', priority:'Alta', links:[], comments:'' }, { t:'Diseno plantilla', m:'Mari A.', desc:'', assign:'Mari Almendros — Disenadora', date:'', priority:'Normal', links:[], comments:'' }, { t:'Copy principal', m:'Sin asignar', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
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
  { name:'Carlos Lage',     role:'Filmmaker',   initials:'CL', color:'#D13B1E', status:'on'   },
  { name:'Andrea Valdivia', role:'Social Media', initials:'AV', color:'#2c5f8a', status:'on'   },
  { name:'Mari Almendros',  role:'Disenadora',   initials:'MA', color:'#2d7a4f', status:'away' },
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
    return '<div class="cliente-card" onclick="openClienteDetail(\'' + c.id + '\')">' +
      '<div class="cliente-card-accent" style="background:' + color + '"></div>' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:0.8rem">' +
        '<div class="cliente-logo" style="background:' + color + '">' + initials + '</div>' +
        '<span class="cliente-key">' + (c.client_key || '') + '</span>' +
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
var TEAM_DATA = [];

function renderEquipoView() {
  var grid = document.getElementById('equipoGrid');
  if (!grid) return;
  if (!TEAM_DATA || TEAM_DATA.length === 0) {
    grid.innerHTML = '<div class="equipo-loading">Cargando equipo desde Supabase...</div>';
    return;
  }
  grid.innerHTML = TEAM_DATA.map(function(m) {
    return '<div class="equipo-card">' +
      '<div class="equipo-av" style="background:' + (m.color || '#999') + '">' + (m.initials || '') + '</div>' +
      '<div class="equipo-nombre">' + (m.name || '') + '</div>' +
      '<div class="equipo-rol">' + (m.role || '') + '</div>' +
    '</div>';
  }).join('');
}

// ── DASHBOARD STATS ──
function renderDashboardStats() {
  var open = 0, done = 0;
  Object.values(HOY_TAREAS).forEach(function(tasks) {
    tasks.forEach(function(t) { if (t.done) done++; else open++; });
  });
  var dOpen = document.getElementById('dash-tasks-open');
  var dDone = document.getElementById('dash-tasks-done');
  var dProj = document.getElementById('dash-projects');
  if (dOpen) dOpen.textContent = open;
  if (dDone) dDone.textContent = done;
  if (dProj) dProj.textContent = CUENTAS.filter(function(c){ return c.estado !== 'idle'; }).length;
  var dDl = document.getElementById('dash-deadlines');
  if (dDl) dDl.textContent = CUENTAS.filter(function(c){ return c.deadlineClass === 'dead-ok' || c.deadlineClass === 'dead-soon'; }).length;
  renderDashSemana();
  renderDashVencimientos();
  renderDashContenido();
}

function renderDashSemana() {
  var el = document.getElementById('dash-semana');
  if (!el) return;
  if (!CUENTAS.length) { el.innerHTML = '<div class="dash-content-empty">Sin proyectos</div>'; return; }
  var colors = { crit:'#c0392b', warn:'#c8860a', good:'#2d7a4f', idle:'#a09890' };
  el.innerHTML = CUENTAS.map(function(c) {
    var col = colors[c.estado] || '#a09890';
    return '<div class="dash-proj-row">' +
      '<div class="dash-proj-name" title="' + c.nombre + '">' + c.nombre + '</div>' +
      '<div class="dash-proj-bar"><div class="dash-proj-fill" style="width:' + c.progreso + '%;background:' + col + '"></div></div>' +
      '<div class="dash-proj-pct">' + c.progreso + '%</div>' +
    '</div>';
  }).join('');
}

function renderDashVencimientos() {
  var el = document.getElementById('dash-vencimientos');
  if (!el) return;
  var upcoming = CUENTAS.filter(function(c){ return c.deadline; })
    .slice(0, 4);
  if (!upcoming.length) { el.innerHTML = '<div class="dash-content-empty">Sin vencimientos</div>'; return; }
  var colors = { crit:'var(--red)', warn:'var(--gold)', good:'var(--green)', idle:'var(--muted2)' };
  el.innerHTML = upcoming.map(function(c) {
    var col = colors[c.estado] || 'var(--muted2)';
    return '<div class="dash-dead-item">' +
      '<div class="dash-dead-dot" style="background:' + col + '"></div>' +
      '<div class="dash-dead-info">' +
        '<div class="dash-dead-name">' + c.nombre + '</div>' +
        '<div class="dash-dead-date">' + c.cliente + ' · ' + c.deadline + '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

function renderDashContenido() {
  var el = document.getElementById('dash-contenido');
  if (!el) return;
  if (!RECENT_CONTENT || !RECENT_CONTENT.length) {
    el.innerHTML = '<div class="dash-content-empty">Nessun contenuto generato questa settimana</div>';
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
    // Risolvi nome cliente da UUID
    var clientObj = CLIENTS_DATA.find(function(x){ return x.id === cid; });
    var clientLabel = clientObj ? (clientObj.name || cid) : cid;
    var thumbs = items.slice(0,8).map(function(c) {
      if (c.img_b64) {
        return '<img class="dash-thumb" src="data:image/jpeg;base64,' + c.img_b64 +
          '" title="' + (c.headline || '') + '" onclick="openContentPreview(\'' + c.id + '\')">';
      }
      return '<div class="dash-thumb" style="background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.55rem;color:var(--muted);padding:4px;text-align:center;line-height:1.2;overflow:hidden">' + ((c.headline||c.pillar||'POST').substring(0,18)) + '</div>';
    }).join('');
    return '<div class="dash-content-client">' +
      '<div class="dash-content-client-name">' + clientLabel + ' · ' + items.length + ' post</div>' +
      '<div class="dash-content-strip">' + thumbs + '</div>' +
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
  }).join('');
}

// ── CLIENTE PAGE ────────────────────────────────────────────────
function openClientePage(clientIdx) {
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
  var content = (RECENT_CONTENT||[]).filter(function(rc){ return rc.client_id === c.id; });

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

  var contentHtml = content.length ? '<div class="cliente-content-grid">' +
    content.slice(0,12).map(function(rc) {
      if (rc.img_b64) {
        return '<img class="cliente-content-thumb" src="data:image/jpeg;base64,' + rc.img_b64 +
          '" title="' + (rc.headline||'') + '" onclick="openContentPreview(\'' + rc.id + '\')">';
      }
      return '<div class="cliente-content-thumb" style="background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:var(--muted);padding:0.5rem;text-align:center;line-height:1.3">' + ((rc.headline||rc.pillar||'Post').substring(0,30)) + '</div>';
    }).join('') + '</div>'
  : '<div class="cliente-content-empty">Sin contenido generado esta semana</div>';

  document.getElementById('clientePageBody').innerHTML =
    '<div class="cliente-info-card">' +
      '<div class="cliente-info-logo" style="background:' + color + '">' + initials + '</div>' +
      '<div class="cliente-info-name">' + (c.name||'') + '</div>' +
      '<div class="cliente-info-sector">' + (c.sector||'') + '</div>' +
      (c.city    ? '<div class="cliente-info-row">&#128205; ' + c.city + '</div>' : '') +
      (c.address ? '<div class="cliente-info-row">&#127968; ' + c.address + '</div>' : '') +
      (c.phone   ? '<div class="cliente-info-row">&#128222; ' + c.phone + '</div>' : '') +
      (c.website ? '<div class="cliente-info-row">&#127760; <a href="https://' + c.website + '" target="_blank" style="color:var(--accent)">' + c.website + '</a></div>' : '') +
      (c.instagram ? '<div class="cliente-info-row">&#64; ' + c.instagram + '</div>' : '') +
      (c.description ? '<div class="cliente-info-desc">' + c.description + '</div>' : '') +
    '</div>' +
    '<div class="cliente-main-col">' +
      '<div class="cliente-section">' +
        '<div class="cliente-section-head"><div class="cliente-section-title">Proyectos activos</div><span style="font-size:0.75rem;color:var(--muted)">' + projs.length + ' total</span></div>' +
        '<div class="cliente-section-body">' + projsHtml + '</div>' +
      '</div>' +
      '<div class="cliente-section">' +
        '<div class="cliente-section-head"><div class="cliente-section-title">Contenido generado</div><span style="font-size:0.75rem;color:var(--muted)">' + content.length + ' esta semana</span></div>' +
        '<div class="cliente-section-body">' + contentHtml + '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('clientePage').classList.add('open');
}

function closeClientePage() {
  document.getElementById('clientePage').classList.remove('open');
  openClientesPopup();
}

// ── CONTENT PREVIEW MODAL ──────────────────────────────────────
function openContentPreview(contentId) {
  var c = (RECENT_CONTENT||[]).find(function(x){ return x.id === contentId; });
  if (!c || !c.img_b64) return;
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:900;display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.onclick = function(){ document.body.removeChild(overlay); };
  overlay.innerHTML = '<div style="max-width:480px;width:90%;background:#111;border-radius:12px;overflow:hidden">' +
    '<img src="data:image/jpeg;base64,' + c.img_b64 + '" style="width:100%;display:block">' +
    '<div style="padding:1rem">' +
      '<div style="font-weight:700;color:#fff;margin-bottom:0.4rem">' + (c.headline||'') + '</div>' +
      '<div style="font-size:0.75rem;color:#666">' + (c.platform||'') + ' · ' + (c.pillar||'') + '</div>' +
    '</div>' +
  '</div>';
  document.body.appendChild(overlay);
}
