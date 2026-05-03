// ============================================================
// MOD-TABLERO — Tablero Social (kanban), Tablero Plan, Card Panel
// Lazy-loaded quando si apre il tab Tablero
// ============================================================

var TB_COLS = [
  { id:'info',  label:'Info',       cls:'tb-info'  }, { id:'ideas', label:'Ideas',     cls:'tb-ideas' },
  { id:'todo',  label:'Por Hacer',  cls:'tb-todo'  }, { id:'wip',   label:'En Proceso', cls:'tb-wip'   },
  { id:'done',  label:'Hecho',      cls:'tb-done'  }, { id:'pub',   label:'Publicado',  cls:'tb-pub'   },
  { id:'meet',  label:'Reuniones',  cls:'tb-meet'  }, { id:'shoot', label:'Rodajes',    cls:'tb-shoot' },
  { id:'prop',  label:'Propuestas', cls:'tb-prop'  },
];
var COLS          = TB_COLS;
var activeTbCuenta = 'ecom';
var _tableroMode  = 'social';
var activeCard    = null;
var cardStore     = {};

var KANBAN_DATA = {
  ecom: {
    info:  [ { t:'Brief cliente aprobado', m:'Verde Fashion', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' }, { t:'Guia de marca v2', m:'Referencia', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Reel de producto 15s', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'', priority:'Alta', links:[], comments:'' } ],
    todo:  [ { t:'Fotografia de producto', m:'Pendiente', desc:'', assign:'', date:'', priority:'Alta', links:[], comments:'' }, { t:'Copy para 5 posts', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' } ],
    wip:   [ { t:'Video unboxing', m:'Carlos Lage', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'', priority:'Alta', links:[], comments:'' } ],
    done:  [ { t:'Identidad visual web', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:[], meet:[ { t:'Kickoff Verde Fashion', m:'28 mar 10:00', desc:'', assign:'', date:'2026-03-28', priority:'Normal', links:[], comments:'' } ],
    shoot: [ { t:'Rodaje catalogo primavera', m:'2 abr estudio', desc:'', assign:'Carlos Lage — Fotógrafo & Filmmaker', date:'2026-04-02', priority:'Alta', links:[], comments:'' } ],
    prop:  [ { t:'Propuesta reels mensuales', m:'Enviada', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
  },
  social: {
    info:  [ { t:'Brief Campana Q2', m:'Bianchi & Co', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
    ideas: [ { t:'Serie detras de camara', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' } ],
    todo:  [ { t:'Calendario mayo', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Alta', links:[], comments:'' } ],
    wip:   [ { t:'Post lanzamiento coleccion', m:'Mari A.', desc:'', assign:'Mari Almendros — Brand & Diseño', date:'', priority:'Alta', links:[], comments:'' } ],
    done:  [ { t:'Copy revisado marzo', m:'Andrea V.', desc:'', assign:'Andrea Valdivia — Social Media Manager', date:'', priority:'Normal', links:[], comments:'' } ],
    pub:   [ { t:'Post 28 mar Campana', m:'Publicado', desc:'', assign:'', date:'2026-03-28', priority:'Normal', links:[], comments:'' } ],
    meet:  [ { t:'Revision semanal', m:'Lun 31 mar 09:30', desc:'', assign:'', date:'2026-03-31', priority:'Normal', links:[], comments:'' } ],
    shoot:[], prop: [ { t:'Propuesta influencer', m:'En revision', desc:'', assign:'', date:'', priority:'Normal', links:[], comments:'' } ],
  },
};

// ── SELECTOR ──────────────────────────────────────────────────

async function buildTbSelector() {
  var sel = document.getElementById('cuentaSelector');
  if (!sel) return;
  sel.innerHTML = '<span style="font-size:0.75rem;color:#aaa;padding:0.3rem 0.6rem">Cargando…</span>';

  try {
    var res   = await fetch(BRAVO_API + '/api/plan-tasks');
    var data  = await res.json();
    var tasks = data.tasks || [];
    if (tasks.length) {
      var byProject = {};
      tasks.forEach(function(t) {
        var pid = t.project_id || 'sin-proyecto';
        if (!byProject[pid]) byProject[pid] = { title: t.project_title || pid, tasks: [] };
        byProject[pid].tasks.push(t);
      });
      CUENTAS = [];
      Object.keys(byProject).forEach(function(pid) {
        var grp = byProject[pid];
        CUENTAS.push({ id: pid, nombre: grp.title, cliente: '', estado: 'good', estadoLabel: 'Activo', tareas: grp.tasks.length });
        KANBAN_DATA[pid] = KANBAN_DATA[pid] || { info:[], ideas:[], todo:[], wip:[], done:[], pub:[], meet:[], shoot:[], prop:[] };
        grp.tasks.forEach(function(t) {
          var col = t.status === 'done' ? 'done' : t.status === 'in_progress' ? 'wip' : 'todo';
          var exists = KANBAN_DATA[pid][col].some(function(k) { return k._db_id === t.id; });
          if (!exists) {
            KANBAN_DATA[pid][col].push({
              t: t.title || '', m: (t.assignee || '') + (t.publish_date ? ' · ' + new Date(t.publish_date + 'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : ''),
              desc: t.creative_note || '', assign: t.assignee || '', date: t.publish_date || '',
              priority: t.priority || 'Normal', links: [], comments: '', _db_id: t.id
            });
          }
        });
      });
      if (!CUENTAS.find(function(c) { return c.id === activeTbCuenta; })) activeTbCuenta = CUENTAS[0].id;
    }
  } catch (e) { console.warn('[TABLERO] Error al cargar plan-tasks:', e.message); }

  var html = '';
  for (var i = 0; i < CUENTAS.length; i++) {
    var c = CUENTAS[i];
    var stClass  = c.estado === 'crit' ? 'st-crit' : c.estado === 'warn' ? 'st-warn' : c.estado === 'good' ? 'st-good' : '';
    var isActive = c.id === activeTbCuenta;
    html += '<button class="cuenta-sel-btn ' + (isActive ? 'active ' + stClass : '') + '" onclick="switchTbCuenta(\'' + c.id + '\',this,\'' + stClass + '\')">' + c.nombre + '</button>';
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
  var data  = KANBAN_DATA[activeTbCuenta] || {};
  var c     = null;
  for (var i = 0; i < CUENTAS.length; i++) { if (CUENTAS[i].id === activeTbCuenta) { c = CUENTAS[i]; break; } }
  var total = 0;
  for (var key in data) { if (data[key]) total += data[key].length; }
  var meta = document.getElementById('tableroMeta');
  if (meta) meta.textContent = (c ? c.cliente : '') + ' - ' + total + ' tarjetas';
  var board = document.getElementById('tableroBoard');
  if (!board) return;
  board.innerHTML = '';
  for (var ci = 0; ci < TB_COLS.length; ci++) {
    var col    = TB_COLS[ci];
    var cards  = data[col.id] || [];
    var colEl  = document.createElement('div'); colEl.className = 'tb-col';
    var head   = document.createElement('div'); head.className = 'tb-head ' + col.cls;
    head.innerHTML = '<span class="tb-head-label">' + col.label + '</span><span class="tb-head-cnt">' + cards.length + '</span>';
    colEl.appendChild(head);
    var cardsEl = document.createElement('div'); cardsEl.className = 'tb-cards'; cardsEl.id = 'tb-' + activeTbCuenta + '-' + col.id;
    for (var ki = 0; ki < cards.length; ki++) {
      var cd     = getCardData(activeTbCuenta, col.id, ki);
      var links  = (cd.links && cd.links.length) ? cd.links.length : 0;
      var aInit  = cd.assign ? (cd.assign.split(' ')[0][0] + (cd.assign.split(' ')[1] ? cd.assign.split(' ')[1][0] : '')) : '?';
      var aColor = _teamColorFor(cd.assign ? cd.assign.split(' — ')[0] : '');
      var cardEl = document.createElement('div'); cardEl.className = 'tb-card';
      var assignName = cd.assign ? cd.assign.split(' — ')[0] : 'Sin asignar';
      cardEl.innerHTML = '<div class="tb-card-title">' + cd.t + '</div>' +
        '<div class="tb-card-footer">' +
          '<div class="tb-card-av" style="background:' + aColor + '">' + aInit + '</div>' +
          '<div class="tb-card-meta">' + assignName + '</div>' +
          '<span class="tb-card-links' + (links === 0 ? ' none' : '') + '">' + (links > 0 ? 'link ' + links : '—') + '</span>' +
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

function switchTableroMode(mode) {
  _tableroMode = mode;
  ['social','plan'].forEach(function(m) {
    var btn = document.getElementById('tbmode-' + m);
    if (btn) {
      btn.style.background  = m === mode ? '#1F2A24' : 'transparent';
      btn.style.color       = m === mode ? '#C29547' : '#888';
      btn.style.borderColor = m === mode ? '#1F2A24' : '#e0dbd2';
    }
  });
  if (mode === 'social') renderTablero(); else renderPlanTablero();
}

function renderPlanTablero() {
  var board = document.getElementById('tableroBoard');
  var meta  = document.getElementById('tableroMeta');
  if (!board) return;
  var tasks = window._allPlanTasks || [];
  if (!tasks.length) {
    board.innerHTML = '<div style="padding:3rem;text-align:center;color:#888;font-size:0.85rem">' +
      '<div style="font-size:2rem;margin-bottom:0.8rem">📋</div>' +
      '<div>Genera y confirma un plan de producción desde un proyecto cliente.</div>' +
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
  tasks.forEach(function(t) { var s = t.status || 'todo'; if (!grouped[s]) s = 'todo'; grouped[s].push(t); });
  var html = '<div style="display:flex;gap:0.8rem;overflow-x:auto;height:100%;padding:0.2rem 0">';
  cols.forEach(function(col) {
    var colTasks = grouped[col.id] || [];
    html += '<div style="flex:0 0 260px;display:flex;flex-direction:column;background:#f9f7f4;border-radius:10px;overflow:hidden">';
    html += '<div style="padding:0.7rem 1rem;background:' + col.color + ';display:flex;align-items:center;justify-content:space-between">' +
      '<span style="font-size:0.75rem;font-weight:700;color:' + col.textColor + '">' + col.dot + ' ' + col.label + '</span>' +
      '<span style="font-size:0.72rem;font-weight:700;color:' + col.textColor + ';background:rgba(0,0,0,0.08);border-radius:20px;padding:0.1rem 0.5rem">' + colTasks.length + '</span>' +
    '</div>';
    html += '<div style="flex:1;overflow-y:auto;padding:0.6rem;display:flex;flex-direction:column;gap:0.5rem">';
    colTasks.forEach(function(task, ti) {
      var fmt      = (typeof _FORMAT_LABELS !== 'undefined' && _FORMAT_LABELS[task.format]) || { icon:'📋', label: task.format || 'Contenido' };
      var totalSub = (task.subtasks || []).length;
      var doneSub  = (task.subtasks || []).filter(function(s) { return s.status === 'done'; }).length;
      var progPct  = totalSub ? Math.round(doneSub / totalSub * 100) : 0;
      var isAI     = (task.assignee || '').toLowerCase().indexOf('agente') >= 0;
      var aColor   = _teamColorFor(task.assignee || '');
      var initials = (task.assignee || '?').split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
      var dateStr  = task.publish_date ? new Date(task.publish_date + 'T12:00:00').toLocaleDateString('es-ES',{day:'2-digit',month:'short'}) : '';
      html += '<div onclick="openPlanTaskDetail(this)" data-taskidx="' + ti + '" data-colid="' + col.id + '" ' +
        'style="background:#fff;border-radius:8px;padding:0.7rem 0.85rem;cursor:pointer;border:1px solid #e8e4de">' +
        '<div style="font-size:0.68rem;margin-bottom:0.3rem">' +
          '<span style="background:#f0ece5;border-radius:20px;padding:0.1rem 0.45rem;font-weight:700;color:#555">' + fmt.icon + ' ' + fmt.label + '</span>' +
          (task.project_title ? ' <span style="color:#aaa">' + task.project_title + '</span>' : '') +
        '</div>' +
        '<div style="font-size:0.82rem;font-weight:600;color:#1F2A24;margin-bottom:0.4rem">' + (task.title || '') + '</div>' +
        '<div style="display:flex;align-items:center;justify-content:space-between">' +
          '<div style="display:flex;align-items:center;gap:0.4rem">' +
            '<div style="width:22px;height:22px;border-radius:50%;background:' + (isAI ? '#1F2A24' : aColor) + ';display:flex;align-items:center;justify-content:center;font-size:0.6rem;font-weight:700;color:#fff">' + (isAI ? '🤖' : initials) + '</div>' +
            '<span style="font-size:0.7rem;color:#888">' + (task.assignee || '') + '</span>' +
          '</div>' +
          (dateStr ? '<span style="font-size:0.68rem;color:#aaa">📅 ' + dateStr + '</span>' : '') +
        '</div>' +
        (totalSub ? '<div style="margin-top:0.5rem"><div style="height:3px;background:#f0ece5;border-radius:2px;overflow:hidden"><div style="height:100%;width:' + progPct + '%;background:' + (progPct === 100 ? '#16a34a' : '#2563eb') + ';border-radius:2px"></div></div><div style="font-size:0.65rem;color:#aaa;margin-top:0.2rem">' + doneSub + '/' + totalSub + ' sub-tareas</div></div>' : '') +
        '<div style="display:flex;gap:0.3rem;margin-top:0.5rem;flex-wrap:wrap">' +
          cols.filter(function(c) { return c.id !== col.id; }).map(function(c) {
            return '<button onclick="event.stopPropagation();movePlanTask(\'' + col.id + '\',' + ti + ',\'' + c.id + '\')" style="font-size:0.62rem;padding:0.1rem 0.4rem;background:' + c.color + ';color:' + c.textColor + ';border:none;border-radius:10px;cursor:pointer">→ ' + c.label + '</button>';
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
  var tasks    = window._allPlanTasks || [];
  var colTasks = tasks.filter(function(t) { return (t.status || 'todo') === fromCol; });
  var task     = colTasks[taskIdx];
  if (!task) return;
  task.status = toCol;
  if (task._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + task._db_id, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toCol })
    }).catch(function() {});
  }
  renderPlanTablero();
}

function openPlanTaskDetail(el) {
  var taskTitle = el.querySelector('[style*="font-weight:600"]');
  if (taskTitle) showToast('📋 ' + taskTitle.textContent.trim());
}

// ── KANBAN CARD PANEL ─────────────────────────────────────────

function getCardKey(projId, colId, idx) { return projId + '__' + colId + '__' + idx; }

function getCardData(projId, colId, idx) {
  var key  = getCardKey(projId, colId, idx);
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
      var cd   = getCardData(projId, col.id, ki);
      var lc   = (cd.links && cd.links.length) ? cd.links.length : 0;
      var prio = (cd.priority && cd.priority !== 'Normal') ? '<span style="font-size:0.58rem;padding:0.08rem 0.3rem;border-radius:3px;background:var(--gold-dim);color:var(--gold);font-weight:700">' + cd.priority + '</span>' : '';
      html += '<div class="kb-card" onclick="openCardPanel(\'' + projId + '\',\'' + col.id + '\',' + ki + ')">' +
        '<div class="kb-card-title">' + cd.t + '</div>' +
        '<div class="kb-card-meta">' + cd.m + '</div>' +
        '<div class="kb-card-footer"><span class="kb-card-links' + (lc === 0 ? ' none' : '') + '">' + (lc > 0 ? lc + ' links' : '—') + '</span>' + prio + '</div>' +
      '</div>';
    }
    html += '</div><button class="kb-add" onclick="addNewCard(\'' + projId + '\',\'' + col.id + '\')">+ Anadir</button></div>';
  }
  html += '</div>';
  return html;
}

function refreshCardEl(projId, colId, idx) {
  var container = document.getElementById('kbc-' + projId + '-' + colId);
  if (!container) return;
  var cards = container.querySelectorAll('.kb-card');
  if (!cards[idx]) return;
  var cd = getCardData(projId, colId, idx);
  var lc = (cd.links && cd.links.length) ? cd.links.length : 0;
  cards[idx].innerHTML = '<div class="kb-card-title">' + cd.t + '</div>' +
    '<div class="kb-card-meta">' + cd.m + '</div>' +
    '<div class="kb-card-footer"><span class="kb-card-links' + (lc === 0 ? ' none' : '') + '">' + (lc > 0 ? lc + ' links' : '—') + '</span></div>';
}

function openCardPanel(projId, colId, idx) {
  activeCard = { projId: projId, colId: colId, idx: idx };
  var cd  = getCardData(projId, colId, idx);
  var col = null;
  for (var i = 0; i < COLS.length; i++) { if (COLS[i].id === colId) { col = COLS[i]; break; } }
  var badge = document.getElementById('panelColBadge');
  if (badge && col) { badge.textContent = col.label; badge.className = 'panel-col-badge ' + col.cls; }
  var pt = document.getElementById('panelTitle');    if (pt)  pt.value  = cd.t;
  var pd = document.getElementById('panelDesc');     if (pd)  pd.value  = cd.desc || '';
  var pa = document.getElementById('panelAssign');   if (pa)  pa.value  = cd.assign || '';
  var pdt= document.getElementById('panelDate');     if (pdt) pdt.value = cd.date || '';
  var pp = document.getElementById('panelPriority'); if (pp)  pp.value  = cd.priority || 'Normal';
  var pc = document.getElementById('panelComments'); if (pc)  pc.value  = cd.comments || '';
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
  var pt = document.getElementById('panelTitle');    if (pt)  cd.t        = pt.value  || cd.t;
  var pd = document.getElementById('panelDesc');     if (pd)  cd.desc     = pd.value;
  var pa = document.getElementById('panelAssign');   if (pa)  cd.assign   = pa.value;
  var pdt= document.getElementById('panelDate');     if (pdt) cd.date     = pdt.value;
  var pp = document.getElementById('panelPriority'); if (pp)  cd.priority = pp.value;
  var pc = document.getElementById('panelComments'); if (pc)  cd.comments = pc.value;
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
      '<div class="drive-link-info"><div class="drive-link-name">' + (lk.name || 'Enlace') + '</div><div class="drive-link-url">' + lk.url + '</div></div>' +
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
  var container = document.getElementById('kbc-' + projId + '-' + colId);
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

// Event listeners del card panel
document.addEventListener('DOMContentLoaded', function() {
  var cpOverlay = document.getElementById('cardPanelOverlay');
  if (cpOverlay) cpOverlay.addEventListener('click', function() { closeCardPanel(); });
  var nlUrl = document.getElementById('newLinkUrl');
  if (nlUrl) nlUrl.addEventListener('keydown', function(e) { if (e.key === 'Enter') addDriveLink(); });
  var amModal = document.getElementById('assignModal');
  if (amModal) amModal.addEventListener('click', function(e) { if (e.target.id === 'assignModal') closeModal(); });
});

// Auto-mark as loaded when included as static script
if (typeof _loadedModules === 'object' && _loadedModules) _loadedModules['tablero'] = true;
