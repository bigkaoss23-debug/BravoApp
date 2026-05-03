// ============================================================
// MOD-PROYECTOS — Filtri, dettaglio progetto, kanban legacy, estrategia
// Lazy-loaded quando si apre il tab Proyectos
// ============================================================

var activeFilters  = { client: 'todos', resp: 'todos', status: 'todos' };
var activeDetailId = null;

var ESTRATEGIA_BASE = {
  ecom: {
    objMes:  [ { t:'Recuperar retraso y entregar v1 del sitio', done:false }, { t:'Conseguir respuesta de Verde Fashion esta semana', done:false }, { t:'Definir paleta de colores definitiva', done:true } ],
    objTrim: [ { t:'Lanzamiento del e-commerce en Q2', done:false }, { t:'Integrar pasarela de pago y logistica', done:false }, { t:'Campana de lanzamiento coordinada con Social', done:false } ],
    pasos:   [ { t:'Llamada directa con Verde Fashion — urgente', meta:'Esta semana - CEO' }, { t:'Replantear cronograma con el equipo', meta:'Lunes 31 mar - Reunion' } ],
  },
  social: {
    objMes:  [ { t:'Aprobar brief Q2 con Bianchi & Co', done:false }, { t:'Publicar 12 piezas de contenido en abril', done:false }, { t:'Cerrar propuesta influencer', done:false } ],
    objTrim: [ { t:'Posicionar a Bianchi & Co como referente en IG', done:false }, { t:'Alcanzar 10k seguidores para el cliente', done:false }, { t:'Renovar contrato por segundo semestre', done:false } ],
    pasos:   [ { t:'Presentar propuesta influencer en reunion semanal', meta:'Lun 31 mar - CEO + Andrea' }, { t:'Revisar KPIs de marzo antes del brief Q2', meta:'Esta semana' } ],
  },
  rebrand: {
    objMes:  [ { t:'Entregar brand guidelines completas', done:false }, { t:'Obtener aprobacion final de paleta', done:false }, { t:'Sesion fotografica corporativa completada', done:false } ],
    objTrim: [ { t:'Rebrand completo entregado para 15 abril', done:false }, { t:'Aplicar nueva identidad en todos los materiales', done:false } ],
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

  var mesHtml = est.objMes.map(function(o, i) {
    return '<div class="est-obj-item ' + (o.done ? 'done' : '') + '" onclick="toggleObj(\'' + id + '\',\'mes\',' + i + ')">' +
      '<div class="est-obj-check">' + (o.done ? 'OK' : '') + '</div><div class="est-obj-text">' + o.t + '</div></div>';
  }).join('');

  var trimHtml = est.objTrim.map(function(o, i) {
    return '<div class="est-obj-item ' + (o.done ? 'done' : '') + '" onclick="toggleObj(\'' + id + '\',\'trim\',' + i + ')">' +
      '<div class="est-obj-check">' + (o.done ? 'OK' : '') + '</div><div class="est-obj-text">' + o.t + '</div></div>';
  }).join('');

  var pasosHtml = est.pasos.map(function(p, i) {
    return '<div class="est-paso-item"><div class="est-paso-num">' + (i + 1) + '</div>' +
      '<div class="est-paso-content"><div class="est-paso-text">' + p.t + '</div><div class="est-paso-meta">' + p.meta + '</div></div>' +
      '<button class="est-paso-del" onclick="deletePaso(\'' + id + '\',' + i + ')">x</button></div>';
  }).join('');

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
  var arr = period === 'mes' ? getEstrategia(id).objMes : getEstrategia(id).objTrim;
  arr[idx].done = !arr[idx].done;
  var wrap = document.getElementById(id + '-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast(arr[idx].done ? 'Objetivo completado' : 'Objetivo reabierto');
}

function addObj(id, period) {
  var input = document.getElementById('new-' + period + '-' + id);
  var val   = input.value.trim(); if (!val) return;
  (period === 'mes' ? getEstrategia(id).objMes : getEstrategia(id).objTrim).push({ t: val, done: false });
  input.value = '';
  var wrap = document.getElementById(id + '-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast('Objetivo anadido');
}

function addPaso(id) {
  var txt  = document.getElementById('new-paso-' + id).value.trim(); if (!txt) return;
  var meta = document.getElementById('new-paso-meta-' + id).value.trim();
  getEstrategia(id).pasos.push({ t: txt, meta: meta || 'Pendiente' });
  document.getElementById('new-paso-' + id).value = '';
  document.getElementById('new-paso-meta-' + id).value = '';
  var wrap = document.getElementById(id + '-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast('Paso anadido');
}

function deletePaso(id, idx) {
  getEstrategia(id).pasos.splice(idx, 1);
  var wrap = document.getElementById(id + '-estrategia');
  if (wrap) { wrap.dataset.built = ''; renderEstrategia(id); }
  showToast('Paso eliminado');
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

function filterBy(type, val, el) {
  activeFilters[type] = val;
  var fb       = document.getElementById('filtersBar');
  var children = fb ? fb.children : [];
  var currentType = null;
  for (var i = 0; i < children.length; i++) {
    var child = children[i];
    if (child.classList.contains('filter-label')) {
      var txt = child.textContent.toLowerCase();
      if (txt.indexOf('cliente') >= 0)  currentType = 'client';
      else if (txt.indexOf('respons') >= 0) currentType = 'resp';
      else if (txt.indexOf('estado') >= 0)  currentType = 'status';
    } else if (child.classList.contains('filter-chip') && currentType === type) {
      child.classList.remove('active', 'active-green', 'active-blue');
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
    cards[i].style.display = show ? '' : 'none';
    if (show) count++;
  }
}

function approveItem(btn, name) {
  var item = btn.closest('.appr-item');
  item.style.opacity = '0.45'; item.style.pointerEvents = 'none';
  item.querySelector('.appr-name').innerHTML += ' <span style="color:var(--green);font-size:0.7rem">OK</span>';
  item.querySelector('.appr-btns').innerHTML = '';
  if (typeof logDecision === 'function') logDecision(name + ' aprobado', 'green');
  showToast('Aprobado: ' + name);
}

function rejectItem(btn, name) {
  var item = btn.closest('.appr-item');
  item.style.opacity = '0.45'; item.style.pointerEvents = 'none';
  item.querySelector('.appr-name').innerHTML += ' <span style="color:var(--red);font-size:0.7rem">X</span>';
  item.querySelector('.appr-btns').innerHTML = '';
  if (typeof logDecision === 'function') logDecision(name + ' bloqueado', 'red');
  showToast('Bloqueado: ' + name);
}

function openAssign(proj) {
  document.getElementById('mProj').value = proj;
  document.getElementById('assignModal').classList.add('open');
}

function closeModal() { document.getElementById('assignModal').classList.remove('open'); }

function confirmAssign() {
  var p    = document.getElementById('mPerson').value;
  var proj = document.getElementById('mProj').value;
  if (!p) { showToast('Selecciona un responsable'); return; }
  if (typeof logDecision === 'function') logDecision(proj + ' asignado a ' + p, 'blue');
  closeModal();
  showToast('Asignado: ' + p);
}

function openDetail(id) {
  var c = null;
  for (var i = 0; i < CUENTAS.length; i++) { if (CUENTAS[i].id === id) { c = CUENTAS[i]; break; } }
  if (!c) return;
  if (activeDetailId === id) { closeDetail(); return; }
  activeDetailId = id;
  var progColor = c.estado === 'crit' ? '#c0392b' : c.estado === 'warn' ? '#c8860a' : c.estado === 'good' ? '#2d7a4f' : '#a09890';
  document.getElementById('detailTitle').innerHTML = c.nombre + ' — ' + c.cliente;
  document.getElementById('detailSub').textContent = c.senal;
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
  ['resumen','kanban','estrategia'].forEach(function(s) {
    var el2 = document.getElementById(projId + '-' + s);
    if (el2) el2.style.display = 'none';
  });
  if (tab === 'kanban') {
    var k = document.getElementById(projId + '-kanban');
    k.style.display = 'block';
    if (!k.dataset.built) { k.innerHTML = '<div class="kanban-wrap">' + buildKanban(projId) + '</div>'; k.dataset.built = '1'; }
  } else if (tab === 'estrategia') {
    var e = document.getElementById(projId + '-estrategia');
    e.style.display = 'block';
    if (!e.dataset.built) { renderEstrategia(projId); e.dataset.built = '1'; }
  } else {
    var r = document.getElementById(projId + '-resumen');
    if (r) r.style.display = 'block';
  }
}

// Auto-mark as loaded when included as static script
if (typeof _loadedModules === 'object' && _loadedModules) _loadedModules['proyectos'] = true;
