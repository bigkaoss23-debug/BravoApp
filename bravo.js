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
var TEAM_DATA = [
  { name: 'Carlos Lage',    role: 'Filmmaker',        detail: 'Producción audiovisual, rodajes en campo', initials: 'CL', color: '#2C3E50' },
  { name: 'Andrea Valdivia',role: 'Social Media',     detail: 'Calendario, publicación, community',       initials: 'AV', color: '#C0392B' },
  { name: 'Mari Almendros', role: 'Diseño Gráfico',   detail: 'Piezas estáticas, carruseles, identidad',  initials: 'MA', color: '#8E44AD' },
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
    // Risolvi nome cliente da UUID
    var clientObj = CLIENTS_DATA.find(function(x){ return x.id === cid || x.client_key === cid; });
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
    var api = (typeof AGENT_API !== 'undefined' ? AGENT_API : 'https://bravoapp-production.up.railway.app');
    var res = await fetch(api + '/api/clients/create', {
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

  var contentHtml = content.length ? '<div class="cliente-content-grid">' +
    content.slice(0,12).map(function(rc) {
      if (rc.img_b64) {
        return '<img class="cliente-content-thumb" src="data:image/jpeg;base64,' + rc.img_b64 +
          '" title="' + (rc.headline||'') + '" onclick="openContentPreview(\'' + rc.id + '\')">';
      }
      return '<div class="cliente-content-thumb" style="background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:0.65rem;color:var(--muted);padding:0.5rem;text-align:center;line-height:1.3">' + ((rc.headline||rc.pillar||'Post').substring(0,30)) + '</div>';
    }).join('') + '</div>'
  : '<div class="cliente-content-empty">Sin contenido generado esta semana</div>';

  var nProjs   = projs.length;
  var nContent = content.length;

  // Render base (senza brand kit)
  _bkCurrentClientId = c.id;
  renderClientePageBody(c, color, initials, projsHtml, contentHtml, null, nProjs, nContent);
  document.getElementById('clientePage').classList.add('open');

  // Carica brand kit async e aggiorna
  if (typeof loadBrandKitFromDB === 'function') {
    loadBrandKitFromDB(c.id).then(function(bk) {
      renderClientePageBody(c, color, initials, projsHtml, contentHtml, bk, nProjs, nContent);
    });
  }
}

function renderBrandKitSection(bk) {
  if (!bk) return '';
  var colors    = bk.colors    || [];
  var fonts     = bk.fonts     || [];
  var pillars   = bk.pillars   || [];
  var layouts   = bk.layouts   || [];
  var templates = bk.templates || [];

  var logoHtml = bk.logo_b64
    ? '<div class="bk-logo-wrap"><img class="bk-logo" src="' + bk.logo_b64 + '" alt="Logo"></div>'
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

  var kitBodyHtml =
    (logoHtml ? '<div class="bk-block bk-block-logo">' + logoHtml + '</div>' : '') +
    (colors.length ? '<div class="bk-block"><div class="bk-block-title">Colores</div><div class="bk-swatches">' + colorsHtml + '</div></div>' : '') +
    (fonts.length  ? '<div class="bk-block"><div class="bk-block-title">Tipografía</div><div class="bk-fonts">' + fontsHtml + '</div></div>' : '') +
    (bk.tone_of_voice ? '<div class="bk-block"><div class="bk-block-title">Tono de voz</div><div class="bk-tone">' + bk.tone_of_voice + '</div></div>' : '') +
    (pillars.length ? '<div class="bk-block"><div class="bk-block-title">Pilares editoriales</div><div class="bk-pillars">' + pillarsHtml + '</div></div>' : '') +
    (layouts.length ? '<div class="bk-block"><div class="bk-block-title">Layouts preferidos</div><div class="bk-layouts">' + layoutsHtml + '</div></div>' : '') +
    (templates.length ? '<div class="bk-block"><div class="bk-block-title">Templates Story</div><div class="bk-templates">' + templatesHtml + '</div></div>' : '') +
    (bk.notes ? '<div class="bk-block"><div class="bk-block-title">Notas</div><div class="bk-notes">' + bk.notes + '</div></div>' : '');

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

function renderBrandKitOpusPanel(opus, clientId) {
  var colors   = opus.colors   || [];
  var fonts    = opus.fonts    || [];
  var pillars  = opus.pillars  || [];
  var layouts  = opus.layouts  || [];

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
      (opus.tone_of_voice ? '<div class="bk-block"><div class="bk-block-title">Tono de voz</div><div class="bk-tone">' + opus.tone_of_voice + '</div></div>' : '') +
      (pillars.length ? '<div class="bk-block"><div class="bk-block-title">Pilares</div><div class="bk-pillars">' + pillarsH + '</div></div>' : '') +
      (layouts.length ? '<div class="bk-block"><div class="bk-block-title">Layouts</div><div class="bk-layouts">' + layoutsH + '</div></div>' : '') +
      (opus.notes     ? '<div class="bk-block"><div class="bk-block-title">Notas</div><div class="bk-notes">' + opus.notes + '</div></div>' : '') +
    '</div>' +
  '</div>';
}

var _bkCurrentClientId = null;
var _bkPendingFiles = [];
var _bkOpusResult = null;

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

function renderBkModalResult(kit, hasLogo, logoIsNew) {
  var colors = (kit.colors||[]).map(function(c){
    return '<span class="bk-res-swatch" style="background:' + c.hex + '" title="' + c.name + '"></span>';
  }).join('');
  var fonts = (kit.fonts||[]).map(function(f){ return '<span class="bk-res-tag">' + f.name + '</span>'; }).join('');
  var layouts = (kit.layouts||[]).map(function(l){ return '<span class="bk-res-tag">' + l.name + '</span>'; }).join('');

  var logoNote = hasLogo
    ? (logoIsNew ? '<div class="bk-res-note">📷 Logo rilevato e salvato</div>' : '<div class="bk-res-note">🔒 Logo esistente mantenuto</div>')
    : '';

  return '<div class="bk-modal-result">' +
    '<div class="bk-modal-result-badge">★ OPUS — Analisi completata</div>' +
    logoNote +
    (colors ? '<div class="bk-res-row"><span class="bk-res-label">Colori</span><div class="bk-res-swatches">' + colors + '</div></div>' : '') +
    (fonts  ? '<div class="bk-res-row"><span class="bk-res-label">Font</span><div>' + fonts + '</div></div>' : '') +
    (kit.tone_of_voice ? '<div class="bk-res-row"><span class="bk-res-label">Tono</span><span class="bk-res-tone">' + kit.tone_of_voice.slice(0,120) + '…</span></div>' : '') +
    (layouts ? '<div class="bk-res-row"><span class="bk-res-label">Layouts</span><div>' + layouts + '</div></div>' : '') +
  '</div>' +
  '<div class="bk-modal-result-actions">' +
    '<button class="bk-modal-save-btn" onclick="saveBrandKitOpus()">✓ Salva questo Brand Kit</button>' +
    '<button class="bk-modal-keep-btn" onclick="closeBrandKitModal()">Mantieni stile attuale</button>' +
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
  var count = _bkPendingFiles.length;
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
  var SUPA_URL = 'https://jicfvkbyjdarquoqeetv.supabase.co';
  var SUPA_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';
  var hasExistingLogo = false;

  fetch(SUPA_URL + '/rest/v1/client_brand?client_id=eq.' + clientId + '&select=logo_b64', {
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
  })
  .then(function(r){ return r.json(); })
  .then(function(rows){
    hasExistingLogo = !!(rows && rows[0] && rows[0].logo_b64);

    var form = new FormData();
    form.append('client_id', clientId);
    form.append('client_name', clientName);
    form.append('has_existing_logo', hasExistingLogo ? '1' : '0');
    _bkPendingFiles.forEach(function(f){ form.append('files', f); });

    return fetch('https://bravoapp-production.up.railway.app/api/brand/analyze', { method: 'POST', body: form });
  })
  .then(function(r){ return r.json(); })
  .then(function(data){
    if (!data.success) throw new Error(data.detail || 'Error de análisis');
    _bkOpusResult = data.brand_kit;
    var logoIsNew = data.logo_saved || false;
    var fill = document.getElementById('bkModalFill');
    if (fill) fill.style.width = '100%';
    setTimeout(function(){
      var b = document.getElementById('bkModalBody');
      if (b) b.innerHTML = renderBkModalResult(_bkOpusResult, true, logoIsNew);
    }, 400);
  })
  .catch(function(err){
    var b = document.getElementById('bkModalBody');
    if (b) b.innerHTML = '<div class="bk-modal-error">✕ Error: ' + err.message + '</div>' +
      '<button class="bk-modal-keep-btn" style="margin-top:1rem" onclick="closeBrandKitModal()">Chiudi</button>';
  });
}

function saveBrandKitOpus() {
  if (!_bkOpusResult) return;
  var clientId = _bkCurrentClientId || '';
  var SUPA_URL = 'https://jicfvkbyjdarquoqeetv.supabase.co';
  var SUPA_KEY = typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : '';

  var payload = {
    colors:        _bkOpusResult.colors        || [],
    fonts:         _bkOpusResult.fonts         || [],
    tone_of_voice: _bkOpusResult.tone_of_voice || '',
    pillars:       _bkOpusResult.pillars       || [],
    layouts:       _bkOpusResult.layouts       || [],
    templates:     _bkOpusResult.templates     || [],
    notes:         _bkOpusResult.notes         || '',
    brand_kit_opus: _bkOpusResult
  };

  fetch(SUPA_URL + '/rest/v1/client_brand?client_id=eq.' + clientId, {
    method: 'PATCH',
    headers: {
      'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY,
      'Content-Type': 'application/json', 'Prefer': 'return=minimal'
    },
    body: JSON.stringify(payload)
  })
  .then(function(){
    var b = document.getElementById('bkModalBody');
    if (b) b.innerHTML = '<div class="bk-modal-success">✓ Brand Kit salvato! Ricarico…</div>';
    setTimeout(function(){ closeBrandKitModal(); location.reload(); }, 1200);
  })
  .catch(function(err){ alert('Error al guardar: ' + err.message); });
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
}

function renderClientePageBody(c, color, initials, projsHtml, contentHtml, bk, projsCount, contentCount) {
  var logoSidebar = bk && bk.logo_b64
    ? '<div class="cliente-sidebar-logo-wrap"><img class="cliente-sidebar-logo" src="' + bk.logo_b64 + '" alt="Logo"></div>'
    : '<div class="cliente-info-logo" style="background:' + color + '">' + initials + '</div>';

  var brandKitHtml = renderBrandKitSection(bk);
  var placeholder = function(icon, label) {
    return '<div class="ctab-placeholder">' + icon + ' <strong>' + label + '</strong> — próximamente</div>';
  };

  var tab = _clienteActiveTab || 'proyectos';

  var tabs8 = [
    { id:'proyectos',  label:'▦ Proyectos',  badge: projsCount||0 },
    { id:'contenido',  label:'★ Contenido',  badge: contentCount||0 },
    { id:'brandkit',   label:'◈ Brand Kit',  badge: 0 },
    { id:'briefing',   label:'📄 Briefing',  badge: 0 },
    { id:'agenti',     label:'🤖 Agenti',    badge: 0 },
    { id:'estrategia', label:'◎ Estrategia', badge: 0 },
    { id:'perfil',     label:'◈ Perfil',     badge: 0 },
    { id:'calendario', label:'◷ Calendario', badge: 0 },
    { id:'equipo',     label:'◉ Equipo',     badge: 0 },
    { id:'metricas',   label:'▲ Métricas',   badge: 0 }
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
    agenti:     renderAgentiSection(c && c.id, c && c.client_key),
    estrategia: renderEstrategiaSection(c && c.id),
    perfil:     renderPerfilSection(c && c.id),
    calendario: renderCalendarioSection(c && c.id),
    equipo:     renderClienteEquipoSection(c && c.id, c && c.client_key),
    metricas:   placeholder('▲', 'Métricas')
  };

  var panelsHtml = tabs8.map(function(t) {
    return '<div class="ctab-panel" data-tab="' + t.id + '" style="' + (tab===t.id?'':'display:none') + '">' + panels[t.id] + '</div>';
  }).join('');

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
      panelsHtml +
    '</div>';
}

// ── PROYECTOS PROPUESTOS ──────────────────────────────────────────
var _cprojFilter     = 'todos';
var _cprojMonthFilter= 'todos';   // filtro mese target
var _cprojSort       = 'default'; // 'default' | 'priority' | 'month' | 'category'
var _cprojSelected   = {};        // { projectId: true } — checkbox selezione
var _programarState  = { clientId: null, projectId: null, category: null, title: '' };
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
      '<button class="cproj-extract-btn" onclick="extractClientProjects(\'' + clientId + '\')">⚡ Extraer proyectos del briefing</button>' +
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
            ? '<button class="cproj-btn cproj-btn-agentes" onclick="sendProyectoToAgentes(\'' + clientId + '\',\'' + p.id + '\')" title="Abrir en Agentes con el brief precargado">⚡ Agentes</button>'
            : '') +
          advBtn +
          '<button class="cproj-btn cproj-btn-edit" onclick="startEditProject(\'' + clientId + '\',\'' + p.id + '\')" title="Editar proyecto">✏️</button>' +
          '<button class="cproj-btn cproj-btn-undo" style="font-size:0.65rem" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'propuesto\')">↩</button>';

    // Avatar responsabile (angolo in alto a destra)
    var assignInfo = { 'Carlos Lage': {i:'CL',c:'#2C3E50'}, 'Andrea Valdivia': {i:'AV',c:'#C0392B'}, 'Mari Almendros': {i:'MA',c:'#8E44AD'} };
    var aInfo = p.assigned_to ? assignInfo[p.assigned_to] : null;
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

    return '<div class="cproj-card ' + priCls + (isRejected?' rechazado':'') + (isProgrammed?' programado':'') + (isCompleted?' completado':'') + (isSel?' selected':'') + '">' +
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
    '</div>';
  }).join('');

  // ── Inline Programar Panel (invece del modal fixed) ─────────────────────────
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
    inlinePanel =
      '<div class="cproj-inline-panel">' +
        '<div class="cproj-inline-panel-head">' +
          '<span>📅 Programar: <strong>' + (ps.title || 'Proyecto') + '</strong></span>' +
          '<button onclick="closeProgramarModal()" style="background:none;border:none;font-size:1.4rem;line-height:1;cursor:pointer;color:var(--muted2);padding:0">×</button>' +
        '</div>' +
        '<div class="cproj-inline-panel-body">' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Fecha inicio *</label>' +
            '<input type="date" class="cproj-edit-input" id="progInlineStart" value="' + psStart + '">' +
          '</div>' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Fecha fin</label>' +
            '<input type="date" class="cproj-edit-input" id="progInlineEnd" value="' + psEnd + '">' +
          '</div>' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Asignar a</label>' +
            '<select class="cproj-edit-input" id="progInlineAssign">' +
              '<option value="">Sin asignar</option>' +
              ['Carlos Lage','Andrea Valdivia','Mari Almendros'].map(function(n){
                return '<option value="' + n + '"' + (psAss===n?' selected':'') + '>' + n + '</option>';
              }).join('') +
            '</select>' +
            (psSugg && !psAss ? '<div style="font-size:0.7rem;color:var(--muted2);margin-top:0.25rem">💡 Sugerido: ' + psSugg.split(' ')[0] + '</div>' : '') +
          '</div>' +
          (psShowBudget
            ? '<div class="cproj-edit-group">' +
                '<label class="cproj-edit-label">Presupuesto (€)</label>' +
                '<input type="number" class="cproj-edit-input" id="progInlineBudget" value="' + psBudg + '" min="0" step="100">' +
              '</div>'
            : '<input type="hidden" id="progInlineBudget" value="">') +
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
  _clientProjects[clientId] = undefined;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = '<div class="cproj-loading">⚡ Extrayendo proyectos del briefing… (30-60 seg)</div>';
  try {
    var res = await fetch(AGENT_API + '/api/briefing/extract-projects/' + encodeURIComponent(clientId), { method: 'POST' });
    var data = await res.json();
    if (data.ok) {
      _clientProjects[clientId] = data.projects && data.projects.length ? data.projects : null;
    } else {
      _clientProjects[clientId] = null;
    }
  } catch(e) {
    _clientProjects[clientId] = null;
  }
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
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

function sendProyectoToAgentes(clientId, projectId) {
  var arr = _clientProjects[clientId];
  var proj = arr ? arr.find(function(x){ return x.id === projectId; }) : null;
  if (!proj) { showToast('No se encontró el proyecto'); return; }

  var brief = '📌 Proyecto: ' + (proj.title || '') + '\n' +
    (proj.description ? '\n📝 Descripción:\n' + proj.description : '') +
    (proj.deliverable ? '\n\n📦 Entregable: ' + proj.deliverable : '') +
    (proj.month_target ? '\n📅 Mes objetivo: ' + proj.month_target : '') +
    '\n\n—\nGenera el contenido para este proyecto siguiendo el briefing y el contexto de marca del cliente.';

  // Cambia tab → Agenti
  switchClienteTab('agenti');

  // Inietta il testo nella textarea dopo il render
  setTimeout(function() {
    var ta = document.getElementById('ag-bravo-textarea');
    if (ta) {
      ta.value = brief;
      ta.focus();
      ta.dispatchEvent(new Event('input'));
      // Scroll alla textarea
      ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 80);

  showToast('⚡ Brief del proyecto cargado en Agentes');
}

// ── MODAL PROGRAMAR ──────────────────────────────────────────────────────────

// Auto-suggerimento responsabile per categoria
var _catDefaultAssign = {
  CONTENIDO:  'Mari Almendros',
  CAMPANA:    'Mari Almendros',
  PUBLICIDAD: 'Carlos Lage',
  ALIANZAS:   'Andrea Valdivia',
  SEO_LOCAL:  'Andrea Valdivia',
  CONVERSION: 'Carlos Lage'
};

function openProgramarModal(clientId, projectId, category) {
  var arr  = _clientProjects[clientId];
  var proj = arr ? arr.find(function(x){ return x.id === projectId; }) : null;
  var title = proj ? (proj.title || 'Programar proyecto') : 'Programar proyecto';
  _programarState = { clientId: clientId, projectId: projectId, category: category, title: title };
  // Re-render il panel Proyectos per mostrare il form inline (niente modal fixed)
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
  // Scrolla fino al form inline
  var inlPanel = document.querySelector('.cproj-inline-panel');
  if (inlPanel) inlPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeProgramarModal() {
  var cid = _programarState.clientId;
  _programarState = { clientId: null, projectId: null, category: null, title: '' };
  if (cid) {
    var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
    if (panel) panel.innerHTML = renderProyectosSection(cid);
  }
}

async function saveProgramar() {
  // Legge dal form inline (IDs con prefisso progInline)
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

  var body = {
    status:      'aprobado',
    start_date:  startVal,
    end_date:    endVal,
    assigned_to: assignVal || null,
    budget_eur:  budgetVal ? parseInt(budgetVal) : null
  };

  // Il pulsante salva è nel panel inline (non nel modal)
  var saveBtn = document.querySelector('.cproj-inline-panel .btn-acc');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }

  try {
    await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(_programarState.projectId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    // Aggiorna cache locale
    var arr = _clientProjects[_programarState.clientId];
    if (arr) {
      var proj = arr.find(function(x){ return x.id === _programarState.projectId; });
      if (proj) {
        proj.status      = 'aprobado';
        proj.start_date  = startVal;
        proj.end_date    = endVal;
        proj.assigned_to = assignVal || null;
        proj.budget_eur  = budgetVal ? parseInt(budgetVal) : null;
      }
    }
    var savedClientId = _programarState.clientId;
    closeProgramarModal();  // resetta _programarState — usare savedClientId d'ora in poi
    // Aggiorna entrambe le tab (già re-renderizzato da closeProgramarModal, ma vogliamo il Calendario anche)
    var panelCal = document.querySelector('.ctab-panel[data-tab="calendario"]');
    if (panelCal) panelCal.innerHTML = renderCalendarioSection(savedClientId);
    showToast('✅ Proyecto programado correctamente');
  } catch(e) {
    showToast('Error al guardar. Intenta de nuevo.');
  }
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Guardar'; }
}

// ── SECCIÓN CALENDARIO (GANTT) ────────────────────────────────────────────────

function renderCalendarioSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">Sin cliente</div>';

  var allProjects = _clientProjects[clientId];

  // Non ancora caricati → usa quelli in cache Proyectos (già caricati normalmente)
  if (!allProjects || allProjects.length === 0) {
    return '<div class="ctab-placeholder" style="padding:3rem 1rem;text-align:center">' +
      '◷ <strong>Sin proyectos programados</strong><br>' +
      '<span style="font-size:0.78rem;color:var(--muted2)">Aprueba y programa proyectos en el tab ▦ Proyectos para verlos aquí.</span>' +
    '</div>';
  }

  var programmed = allProjects.filter(function(p) { return p.start_date && p.status !== 'rechazado'; });

  if (programmed.length === 0) {
    return '<div class="ctab-placeholder" style="padding:3rem 1rem;text-align:center">' +
      '📅 <strong>Ningún proyecto tiene fecha asignada</strong><br>' +
      '<span style="font-size:0.78rem;color:var(--muted2)">Usa el botón "📅 Programar" en los proyectos aprobados.</span>' +
    '</div>';
  }

  // Calcola range mesi dal primo start al last end
  var dates = programmed.map(function(p) {
    return { s: new Date(p.start_date), e: new Date(p.end_date || p.start_date) };
  });
  var minDate = dates.reduce(function(a,b){ return b.s < a ? b.s : a; }, dates[0].s);
  var maxDate = dates.reduce(function(a,b){ return b.e > a ? b.e : a; }, dates[0].e);

  // Inizia dal primo del mese minimo, finisce all'ultimo del mese massimo
  var startMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  var endMonth   = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

  // Costruisce array mesi
  var months = [];
  var cur = new Date(startMonth);
  var mNames = ['Ene','Feb','Mar','Apr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  while (cur <= endMonth) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth(), label: mNames[cur.getMonth()] + ' ' + cur.getFullYear() });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  // Minimo 3 mesi visibili
  while (months.length < 3) {
    var last = months[months.length - 1];
    var nm = new Date(last.year, last.month + 1, 1);
    months.push({ year: nm.getFullYear(), month: nm.getMonth(), label: mNames[nm.getMonth()] + ' ' + nm.getFullYear() });
  }

  var nCols = months.length;

  var catColors = {
    CONTENIDO:  '#1a6fa8', PUBLICIDAD: '#a81a6f', ALIANZAS: '#1a8a1e',
    SEO_LOCAL:  '#a87c1a', CONVERSION: '#6f1aa8', CAMPANA:  '#a81a1a'
  };
  var catBg = {
    CONTENIDO:  '#e8f4fd', PUBLICIDAD: '#fde8f4', ALIANZAS: '#e8fde9',
    SEO_LOCAL:  '#fdf5e8', CONVERSION: '#f0e8fd', CAMPANA:  '#fde8e8'
  };
  var assignInitials = { 'Carlos Lage': 'CL', 'Andrea Valdivia': 'AV', 'Mari Almendros': 'MA' };
  var assignColors   = { 'Carlos Lage': '#2C3E50', 'Andrea Valdivia': '#C0392B', 'Mari Almendros': '#8E44AD' };

  // Intestazione mesi
  var headerCells = months.map(function(m) {
    var isNow = m.year === new Date().getFullYear() && m.month === new Date().getMonth();
    return '<div class="gantt-month-head' + (isNow?' gantt-month-now':'') + '">' + m.label + '</div>';
  }).join('');

  // Riga per ogni progetto
  var rows = programmed.map(function(p) {
    var s    = new Date(p.start_date);
    var e    = new Date(p.end_date || p.start_date);
    var col  = catColors[p.category] || '#888';
    var bg   = catBg[p.category]   || '#f0f0f0';
    var init = p.assigned_to ? (assignInitials[p.assigned_to] || p.assigned_to.slice(0,2).toUpperCase()) : '';
    var iCol = p.assigned_to ? (assignColors[p.assigned_to] || '#888') : '';

    // Calcola span colonne
    var sIdx = months.findIndex(function(m){ return m.year===s.getFullYear() && m.month===s.getMonth(); });
    var eIdx = months.findIndex(function(m){ return m.year===e.getFullYear() && m.month===e.getMonth(); });
    if (sIdx < 0) sIdx = 0;
    if (eIdx < 0) eIdx = months.length - 1;
    var span = eIdx - sIdx + 1;

    // Celle vuote prima e dopo
    var cells = '';
    if (sIdx > 0) cells += '<div class="gantt-cell gantt-cell-empty" style="grid-column:span '+sIdx+'"></div>';
    cells += '<div class="gantt-bar" style="grid-column:span '+span+';background:'+bg+';border-left:3px solid '+col+';color:'+col+'">' +
      '<span class="gantt-bar-title">' + (p.title||'') + '</span>' +
      (init ? '<span class="gantt-bar-avatar" style="background:'+iCol+'">' + init + '</span>' : '') +
    '</div>';
    var after = nCols - sIdx - span;
    if (after > 0) cells += '<div class="gantt-cell gantt-cell-empty" style="grid-column:span '+after+'"></div>';

    return '<div class="gantt-row" style="grid-template-columns:repeat('+nCols+',1fr)">' + cells + '</div>';
  }).join('');

  return '<div class="gantt-wrap">' +
    '<div class="gantt-header" style="grid-template-columns:repeat('+nCols+',1fr)">' + headerCells + '</div>' +
    rows +
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

// ===============================================================
// BRIEFING — testo integrale per cliente, usato dagli agenti AI
// ===============================================================

var BRIEFING_API = 'https://bravoapp-production.up.railway.app';

function renderBriefingSection(clientId) {
  if (!clientId) {
    return '<div class="ctab-placeholder">⚠️ Cliente non identificato</div>';
  }
  var html =
    '<div class="cliente-section" style="padding:1.25rem">' +
      '<div class="brief-head" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;gap:0.6rem;flex-wrap:wrap">' +
        '<div>' +
          '<div class="cliente-section-title" style="margin:0">📄 Briefing del cliente</div>' +
          '<div id="briefMeta" style="font-size:0.75rem;color:#888;margin-top:0.15rem">Cargando…</div>' +
        '</div>' +
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap">' +
          '<label class="bk-newkit-btn" style="cursor:pointer;display:inline-flex;align-items:center;gap:0.3rem">' +
            '📎 Carica PDF' +
            '<input type="file" accept="application/pdf" style="display:none" onchange="briefingHandlePdfUpload(event, \'' + clientId + '\')">' +
          '</label>' +
          '<button class="bk-newkit-btn" onclick="briefingReload(\'' + clientId + '\')">🔄 Ricarica</button>' +
        '</div>' +
      '</div>' +
      '<textarea id="briefingTextarea" ' +
        'style="width:100%;min-height:520px;padding:1rem;border:1px solid #e0dbd2;border-radius:8px;font-family:ui-monospace,Menlo,Monaco,monospace;font-size:0.82rem;line-height:1.55;resize:vertical;background:#fff"' +
        'placeholder="Incolla o carica qui il briefing integrale del cliente (testo libero, markdown, copiato da PDF…)."></textarea>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.7rem;gap:0.6rem;flex-wrap:wrap">' +
        '<div id="briefCounter" style="font-size:0.75rem;color:#888">0 caratteri</div>' +
        '<div style="display:flex;gap:0.5rem">' +
          '<button class="bk-newkit-btn" onclick="briefingReload(\'' + clientId + '\')">Annulla modifiche</button>' +
          '<button class="bk-adopt-btn" onclick="briefingSave(\'' + clientId + '\')">💾 Salva briefing</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  // Avvio caricamento asincrono
  setTimeout(function(){ briefingReload(clientId); }, 50);
  // Contatore live
  setTimeout(function(){
    var ta = document.getElementById('briefingTextarea');
    var cnt = document.getElementById('briefCounter');
    if (ta && cnt) {
      ta.addEventListener('input', function(){
        cnt.textContent = (ta.value || '').length.toLocaleString('it-IT') + ' caratteri';
      });
    }
  }, 100);

  return html;
}

function briefingReload(clientId) {
  var meta = document.getElementById('briefMeta');
  var ta = document.getElementById('briefingTextarea');
  var cnt = document.getElementById('briefCounter');
  if (meta) meta.textContent = 'Cargando…';

  fetch(BRIEFING_API + '/api/briefing/' + encodeURIComponent(clientId))
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!ta) return;
      if (data.exists) {
        ta.value = data.briefing_text || '';
        var src = data.source === 'pdf' ? ('PDF: ' + (data.source_filename||'')) : 'manuale';
        var when = data.updated_at ? new Date(data.updated_at).toLocaleString('it-IT') : '';
        if (meta) meta.textContent = '✓ Guardado — origen: ' + src + (when ? ' · ' + when : '');
      } else {
        ta.value = '';
        if (meta) meta.textContent = '⚠️ Sin briefing guardado para este cliente';
      }
      if (cnt) cnt.textContent = (ta.value || '').length.toLocaleString('it-IT') + ' caratteri';
    })
    .catch(function(e){
      if (meta) meta.textContent = '❌ Error cargando: ' + (e.message || e);
    });
}

function briefingHandlePdfUpload(event, clientId) {
  var input = event.target;
  var file = input.files && input.files[0];
  if (!file) return;
  var meta = document.getElementById('briefMeta');
  if (meta) meta.textContent = '⏳ Estrazione testo dal PDF…';

  var form = new FormData();
  form.append('pdf_file', file);

  fetch(BRIEFING_API + '/api/briefing/extract-pdf', { method:'POST', body:form })
    .then(function(r){
      if (!r.ok) return r.json().then(function(j){ throw new Error(j.detail || 'Error'); });
      return r.json();
    })
    .then(function(data){
      var ta = document.getElementById('briefingTextarea');
      var cnt = document.getElementById('briefCounter');
      if (ta) ta.value = data.briefing_text || '';
      if (cnt) cnt.textContent = (data.char_count || 0).toLocaleString('it-IT') + ' caratteri';
      if (meta) meta.textContent = '📎 Testo estratto da "' + data.filename + '" — rivedi e clicca Salva.';
      // memorizza il filename per poi passarlo al save
      if (ta) ta.dataset.pdfFilename = data.filename || '';
    })
    .catch(function(e){
      if (meta) meta.textContent = '❌ Error extracción: ' + (e.message || e);
    })
    .finally(function(){ input.value = ''; });
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

var AGENT_API = 'https://bravoapp-production.up.railway.app';

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

function renderAgentiSection(clientId, clientKey) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  var weekStart = _nextMonday();

  var html =
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.5rem">' +

    // ── Contexto semanal
    '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap;gap:0.6rem">' +
        '<div>' +
          '<div class="cliente-section-title" style="margin:0">📋 Contexto semanal</div>' +
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
        '<div style="font-size:0.72rem;color:#aaa;margin-top:0.3rem">El agente Estratega lee esto como instrucciones — separado del contenido de campo</div>' +
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
      '</div>' +

      // Drop zone foto
      '<div id="ag-photo-dropzone" ' +
        'style="background:#f9f8f6;border:2px dashed #e0dbd2;border-radius:10px;padding:1.5rem;text-align:center;cursor:pointer;transition:border-color 0.2s,background 0.2s" ' +
        'onclick="document.getElementById(\'ag-photo-input-' + clientId + '\').click()" ' +
        'ondragover="event.preventDefault();this.style.borderColor=\'#D13B1E\';this.style.background=\'#fff5f3\'" ' +
        'ondragleave="this.style.borderColor=\'#e0dbd2\';this.style.background=\'#f9f8f6\'" ' +
        'ondrop="agentiPhotoDrop(event,\'' + clientId + '\',\'' + clientKey + '\')">' +
        '<input type="file" id="ag-photo-input-' + clientId + '" accept="image/*" style="display:none" ' +
          'onchange="agentiPhotoSelected(this,\'' + clientId + '\',\'' + clientKey + '\')">' +
        '<div style="font-size:1.4rem;margin-bottom:0.4rem">🖼️</div>' +
        '<div style="font-size:0.85rem;font-weight:600;color:#2a2a2a">Arrastra la foto aquí o toca para subir</div>' +
        '<div style="font-size:0.75rem;color:#aaa;margin-top:0.25rem">JPG, PNG — el agente genera los posts automáticamente</div>' +
      '</div>' +

      // Brief rapido
      '<div style="margin-top:0.8rem;display:flex;gap:0.6rem;align-items:flex-start">' +
        '<textarea id="ag-photo-brief-' + clientId + '" ' +
          'style="flex:1;padding:0.7rem 0.8rem;border:1px solid #e0dbd2;border-radius:8px;font-size:0.82rem;font-family:inherit;resize:none;height:68px;background:#fff" ' +
          'placeholder="Brief del post (opcional) — si no escribes nada usa el contexto de la semana"></textarea>' +
        '<button class="bk-adopt-btn" style="white-space:nowrap;align-self:flex-end" ' +
          'onclick="agentiGenerateWithPhoto(\'' + clientId + '\',\'' + clientKey + '\')">⚡ Genera</button>' +
      '</div>' +

      // Preview risultati
      '<div id="ag-photo-results-' + clientId + '" style="margin-top:0.8rem"></div>' +
    '</div>' +

    // ── Plan editorial
    '<div>' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.8rem;flex-wrap:wrap;gap:0.6rem">' +
        '<div class="cliente-section-title" style="margin:0">📅 Plan editorial</div>' +
        '<button class="bk-adopt-btn" onclick="agentiGeneratePlan(\'' + clientId + '\',\'' + weekStart + '\')" id="ag-gen-btn">🚀 Generar plan semanal</button>' +
      '</div>' +
      '<div id="ag-plan" style="display:flex;flex-direction:column;gap:0.6rem">' +
        '<div style="color:#888;font-size:0.82rem">Cargando plan...</div>' +
      '</div>' +
    '</div>' +

    // ── Estado agentes
    '<div>' +
      '<div class="cliente-section-title" style="margin-bottom:0.8rem">⚙️ Estado de los agentes</div>' +
      '<div id="ag-status" style="display:flex;flex-direction:column;gap:0.4rem">' +
        '<div style="color:#888;font-size:0.82rem">Cargando...</div>' +
      '</div>' +
    '</div>' +

    '</div>';

  setTimeout(function() {
    agentiLoadContext(clientId, weekStart);
    agentiLoadPlan(clientId, weekStart);
    agentiLoadStatus(clientId);
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
    .catch(function() {});
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
        var color = pillarColors[p.pillar] || '#888';
        return '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:8px;padding:0.9rem;border-left:3px solid ' + color + '">' +
          '<div style="display:flex;gap:0.6rem;align-items:center;margin-bottom:0.4rem;flex-wrap:wrap">' +
            '<span style="font-weight:700;font-size:0.8rem;color:' + color + '">' + (p.pillar || '') + '</span>' +
            '<span style="font-size:0.75rem;color:#888">' + _formatDate(p.scheduled_date) + '</span>' +
            '<span style="font-size:0.72rem;background:#f0ede8;padding:0.15rem 0.4rem;border-radius:4px;color:#666">' + (p.format || '') + '</span>' +
          '</div>' +
          '<div style="font-size:0.82rem;color:#444;line-height:1.4">' + (p.angle || '') + '</div>' +
        '</div>';
      }).join('');
    })
    .catch(function() {
      planDiv.innerHTML = '<div style="color:#888;font-size:0.82rem">Error cargando plan.</div>';
    });
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
        rows.push('<div style="font-size:0.75rem;color:#888;margin-top:0.4rem">Ricerca mercato valida fino: ' + new Date(research.valid_until).toLocaleDateString('it-IT') + ' (' + research.keywords_count + ' keyword, ' + research.hashtags_count + ' hashtag)</div>');
      }

      statusDiv.innerHTML = rows.length ? rows.join('') : '<div style="color:#888;font-size:0.82rem">Ningún agente activado todavía.</div>';
    })
    .catch(function() {});
}

// ── FOTO UPLOAD + GENERA POST ────────────────────────────────────

var _agPhotoFile = {};       // clientId → File
var _agCurrentVariants = {}; // clientId → array varianti generate
var _agCurrentBrief = {};    // clientId → brief usato per la generazione

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

  var brief = (document.getElementById('ag-photo-brief-' + clientId) || {}).value || '';
  // Se brief vuoto, usa il contesto campo come brief
  if (!brief.trim()) {
    var taCampo = document.getElementById('ag-campo-textarea');
    brief = taCampo ? (taCampo.value || '').trim() : '';
  }
  if (!brief) brief = 'Genera un post para este cliente.';

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
    if (resultsDiv) resultsDiv.innerHTML = _agRenderVariants(variants, clientId, clientKey);
  } catch(e) {
    if (resultsDiv) resultsDiv.innerHTML = '<div style="padding:0.8rem;background:#fff5f3;border:1px solid #D13B1E33;border-radius:8px;color:#D13B1E;font-size:0.82rem">✕ ' + e.message + '</div>';
  }
}

function _agRenderVariants(variants, clientId, clientKey) {
  var caption_preview_limit = 180;
  return '<div style="display:flex;flex-direction:column;gap:2rem;margin-top:0.5rem">' +
    variants.map(function(v, i) {
      var captionShort = (v.caption||'').slice(0, caption_preview_limit) + ((v.caption||'').length > caption_preview_limit ? '… <span style="color:#999;cursor:pointer" onclick="this.parentNode.innerHTML=decodeURIComponent(\'' + encodeURIComponent(v.caption||'') + '\')">more</span>' : '');
      var platform = (v.platform||'Instagram').toLowerCase();
      var isLinkedin = platform.indexOf('linkedin') !== -1;
      var handle = clientKey || 'bravo.studio';
      return (
        // Card esterna — sfondo bianco, bordo sottile, max-width stile mobile
        '<div style="max-width:400px;margin:0 auto;border:1px solid #dbdbdb;border-radius:12px;overflow:hidden;background:#fff;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif">' +

          // — Header profilo
          '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.65rem 0.75rem;border-bottom:1px solid #f0f0f0">' +
            '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
              '<div style="width:28px;height:28px;border-radius:50%;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden">' +
                '<span style="font-size:0.8rem;font-weight:700;color:#C0392B">' + handle.charAt(0).toUpperCase() + '</span>' +
              '</div>' +
            '</div>' +
            '<div>' +
              '<div style="font-size:0.82rem;font-weight:700;color:#111;line-height:1.2">' + handle + '</div>' +
              '<div style="font-size:0.68rem;color:#888">' + (v.pillar||'') + ' · ' + (v.format||'Post 1:1') + '</div>' +
            '</div>' +
            '<div style="margin-left:auto;font-size:1.1rem;color:#555;cursor:pointer">···</div>' +
          '</div>' +

          // — Immagine quadrata
          '<div style="width:100%;aspect-ratio:1/1;overflow:hidden;background:#f0f0f0">' +
            '<img src="data:image/jpeg;base64,' + v.img_b64 + '" style="width:100%;height:100%;display:block;object-fit:cover">' +
          '</div>' +

          // — Azioni (like, commento, condividi, salva)
          '<div style="display:flex;align-items:center;padding:0.55rem 0.75rem 0.25rem;gap:0.9rem">' +
            '<span style="font-size:1.35rem;cursor:pointer;line-height:1" title="Like">♡</span>' +
            '<span style="font-size:1.25rem;cursor:pointer;line-height:1" title="Commento">💬</span>' +
            '<span style="font-size:1.2rem;cursor:pointer;line-height:1" title="Condividi">↗</span>' +
            '<span style="margin-left:auto;font-size:1.2rem;cursor:pointer;line-height:1" title="Salva">🔖</span>' +
          '</div>' +

          // — Caption + layout badge
          '<div style="padding:0.4rem 0.75rem 0.75rem">' +
            '<div style="font-size:0.82rem;color:#111;line-height:1.55">' +
              '<span style="font-weight:700">' + handle + '</span> ' + captionShort +
            '</div>' +
            '<div style="margin-top:0.6rem;font-size:0.68rem;color:#aaa">Layout: ' + (v.layout_variant||'') + '</div>' +
          '</div>' +

          // — Azioni BRAVO
          '<div style="display:flex;gap:0.5rem;padding:0.5rem 0.75rem 0.8rem;border-top:1px solid #f5f5f5">' +
            '<button class="bk-adopt-btn" style="font-size:0.75rem;padding:0.35rem 0.8rem;flex:1" onclick="agentiApprovePost(' + i + ',\'' + clientId + '\')">✓ Approva</button>' +
            '<button class="bk-newkit-btn" style="font-size:0.75rem;flex:1" onclick="agentiCopyCaption(\'' + encodeURIComponent(v.caption||'') + '\')">📋 Copia caption</button>' +
          '</div>' +

        '</div>'
      );
    }).join('') +
  '</div>';
}

function agentiCopyCaption(encodedCaption) {
  var text = decodeURIComponent(encodedCaption);
  navigator.clipboard.writeText(text).then(function() {
    alert('Caption copiata!');
  }).catch(function() {
    prompt('Copia manualmente:', text);
  });
}

async function agentiApprovePost(idx, clientId) {
  var variants = _agCurrentVariants[clientId] || [];
  var v = variants[idx];
  if (!v) { alert('Variante non trovata.'); return; }

  try {
    var res = await db.from('generated_content').insert({
      content_id: crypto.randomUUID(),
      client_id:  clientId,
      brief:      _agCurrentBrief[clientId] || '',
      platform:   v.platform  || 'Instagram',
      pillar:     v.pillar    || '',
      headline:   v.headline  || '',
      img_b64:    v.img_b64   || null,
      created_at: new Date().toISOString()
    });

    if (res.error) throw new Error(res.error.message);

    // Aggiorna RECENT_CONTENT e ridisegna dashboard
    await loadRecentContentFromDB();
    renderDashboardStats();

    // Feedback visivo sul pulsante
    var btns = document.querySelectorAll('[onclick*="agentiApprovePost(' + idx + '"]');
    btns.forEach(function(b){ b.textContent = '✓ Guardado!'; b.disabled = true; b.style.opacity='0.6'; });

  } catch(e) {
    alert('Error al guardar: ' + e.message);
  }
}
