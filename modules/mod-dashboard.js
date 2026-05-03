// ============================================================
// MOD-DASHBOARD — Strip hoy, grid cuentas, stats dashboard
// Precaricato al boot (sempre visibile nella home)
// ============================================================

function _fetchClientesStatus() {
  fetch(BRAVO_API + '/api/clients/status-summary')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data || !data.clients) return;
      data.clients.forEach(function(s) { _clientesStatusCache[s.client_id] = s; });
      Object.keys(_clientesStatusCache).forEach(function(cid) {
        var badge = document.getElementById('status-badge-' + cid);
        if (!badge) return;
        var s   = _clientesStatusCache[cid];
        var col = s.status === 'ok' ? '#2d7a4f' : s.status === 'warning' ? '#c8860a' : '#aaa';
        var tip = s.status === 'ok' ? s.published + ' pub. esta semana'
                : s.status === 'warning' ? s.drafts + ' en borrador'
                : 'Sin actividad';
        badge.style.background = col;
        badge.title = tip;
      });
    })
    .catch(function() {});
}

function _fetchStudioKPI(callback) {
  fetch(BRAVO_API + '/api/studio/kpi')
    .then(function(r) { return r.ok ? r.json() : null; })
    .then(function(data) {
      if (!data) return;
      _studioKPICache = data;
      if (callback) callback(data);
    })
    .catch(function() {});
}

function renderHoyStrip() {
  var strip = document.getElementById('hoyStrip');
  if (!strip) return;

  var html = '<div class="hoy-header">' +
    '<div class="hoy-title">Hoy toca</div>' +
    '<div class="hoy-sub">' + bravoTodayStr() + ' — equipo</div>' +
    '</div>';

  var taskData = JSON.parse(JSON.stringify((typeof _equipoTasks !== 'undefined') ? _equipoTasks : {}));
  var today       = new Date().toISOString().slice(0, 10);
  var inSevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  (window._allPlanTasks || []).forEach(function(card) {
    (card.subtasks || []).forEach(function(s) {
      var assignee = s.assignee || '';
      if (!assignee || assignee.toLowerCase().indexOf('agente') >= 0) return;
      var taskDate = s.date || card.publish_date || '';
      if (taskDate && taskDate >= today && taskDate <= inSevenDays) {
        if (!taskData[assignee]) taskData[assignee] = [];
        var label    = (card.title || '') + ' — ' + (s.name || s.title || '');
        var alreadyIn = taskData[assignee].some(function(t) { return (typeof t === 'string' ? t : t.t) === label; });
        if (!alreadyIn) taskData[assignee].push({ t: label, date: taskDate, status: s.status || 'todo' });
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
    var tasks    = taskData[nombre] || [];
    var color    = PERSON_COLORS[nombre] || '#888';
    var initials = nombre.split(' ').map(function(w) { return w[0]; }).join('').slice(0, 2).toUpperCase();

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
          return '<div class="hoy-task normal"><div class="hoy-task-dot"></div><span>' + text + '</span></div>';
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
    var c         = CUENTAS[i];
    var badgeClass = c.estado === 'crit' ? 'b-red' : c.estado === 'warn' ? 'b-gold' : c.estado === 'good' ? 'b-green' : 'b-muted';
    var progColor  = c.estado === 'crit' ? '#c0392b' : c.estado === 'warn' ? '#c8860a' : c.estado === 'good' ? '#2d7a4f' : '#a09890';
    var avatars    = '';
    for (var j = 0; j < c.equipo.length; j++) {
      avatars += '<div class="cuenta-av" style="background:' + c.equipoColors[j] + '">' + c.equipo[j] + '</div>';
    }
    var dlClass = c.deadlineClass === 'dead-late' ? 'dead-late' : c.deadlineClass === 'dead-soon' ? 'dead-soon' : 'dead-ok';
    html += '<div class="cuenta-card ' + c.estado + '" onclick="openDetail(\'' + c.id + '\')">' +
      '<div class="cuenta-top">' +
        '<div class="prog-ring-wrap">' + buildProgRing(c.progreso, progColor) +
          '<div class="prog-ring-label" style="color:' + progColor + '">' + c.progreso + '%</div></div>' +
        '<div class="cuenta-info">' +
          '<div class="cuenta-nombre">' + c.nombre + '</div>' +
          '<div class="cuenta-cliente">' + c.cliente + '</div>' +
          '<div class="cuenta-badges"><span class="badge ' + badgeClass + '">' + c.estadoLabel + '</span> ' +
            '<span style="font-size:0.65rem;color:var(--muted)">' + c.tareas + ' tasks</span></div>' +
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

function renderDashboardStats() {
  var activos = (DASH_PROYECTOS || []).filter(function(p) {
    return ['aprobado','planificado','en_progreso','en_revision'].indexOf(p.status) >= 0;
  }).length;

  var today = new Date(); today.setHours(0,0,0,0);
  var in14  = new Date(today); in14.setDate(in14.getDate() + 14);
  var vencimientos = (DASH_PROYECTOS || []).filter(function(p) {
    if (!p.end_date || p.status === 'completado') return false;
    var d = new Date(p.end_date);
    return d >= today && d <= in14;
  }).length;

  var totalTasks = (typeof DASH_PLAN_TASKS !== 'undefined' ? DASH_PLAN_TASKS : []).filter(function(t) {
    return t.status !== 'done';
  }).length;
  var contenidos = (typeof RECENT_CONTENT !== 'undefined' ? RECENT_CONTENT : []).length;

  var dOpen = document.getElementById('dash-tasks-open');
  var dDone = document.getElementById('dash-tasks-done');
  var dDl   = document.getElementById('dash-deadlines');
  var dProj = document.getElementById('dash-projects');
  if (dOpen) dOpen.textContent = totalTasks   || '—';
  if (dDone) dDone.textContent = contenidos   || '—';
  if (dDl)   dDl.textContent   = vencimientos || '0';
  if (dProj) dProj.textContent = activos      || '—';

  renderDashSemana();
  renderDashVencimientos();
  renderDashProximas();
  renderDashContenido();
  renderDashAtencion();
}

function renderDashAtencion() {
  var el = document.getElementById('dashAtencion');
  if (!el) return;
  var items   = [];
  var todayAt = new Date(); todayAt.setHours(0,0,0,0);

  (DASH_PROYECTOS || []).filter(function(p) {
    if (!p.end_date || p.status === 'completado' || p.status === 'rechazado') return false;
    return new Date(p.end_date) < todayAt;
  }).slice(0, 3).forEach(function(p) {
    var clientObj  = (CLIENTS_DATA || []).find(function(c) { return c.id === p.client_id; });
    items.push({ type:'red', icon:'⏰', text: (p.title || 'Proyecto') + ' — deadline vencida', client: clientObj ? clientObj.name : '' });
  });

  (DASH_PROYECTOS || []).filter(function(p) {
    return !p.assigned_to && ['aprobado','planificado','en_progreso'].indexOf(p.status) >= 0;
  }).slice(0, 2).forEach(function(p) {
    var clientObj = (CLIENTS_DATA || []).find(function(c) { return c.id === p.client_id; });
    items.push({ type:'gold', icon:'👤', text: (p.title || 'Proyecto') + ' — sin responsable asignado', client: clientObj ? clientObj.name : '' });
  });

  if (Object.keys(HOY_TAREAS).length === 0) {
    items.push({ type:'blue', icon:'@', text: 'Equipo sin tareas asignadas hoy — planifica el trabajo del día', client: '' });
  }

  if (!items.length) { el.style.display = 'none'; return; }
  el.style.display = '';
  el.innerHTML = '<div class="dash-atencion-wrap">' +
    '<div class="dash-atencion-label">Requiere atención</div>' +
    '<div class="dash-atencion-list">' +
    items.map(function(item) {
      var typeColor = item.type === 'red' ? 'var(--red)' : item.type === 'gold' ? 'var(--gold)' : item.type === 'green' ? 'var(--green)' : 'var(--blue)';
      var typeBg    = item.type === 'red' ? 'rgba(192,57,43,0.18)' : item.type === 'gold' ? 'rgba(200,134,10,0.15)' : item.type === 'green' ? 'rgba(45,122,79,0.15)' : 'rgba(44,95,138,0.15)';
      return '<div class="dash-alert-item" style="border-left-color:' + typeColor + '">' +
        '<div class="dash-alert-ico" style="background:' + typeBg + ';color:' + typeColor + '">' + item.icon + '</div>' +
        '<div class="dash-alert-body">' +
          '<div class="dash-alert-text">' + item.text + '</div>' +
          (item.client ? '<div class="dash-alert-client">' + item.client + '</div>' : '') +
        '</div></div>';
    }).join('') +
    '</div></div>';
}

function renderDashSemana() {
  var el = document.getElementById('dash-semana');
  if (!el) return;
  var projs = (DASH_PROYECTOS || []).filter(function(p) { return p.status !== 'propuesto'; });
  if (!projs.length) {
    el.innerHTML = '<div class="dash-content-empty" style="text-align:center;padding:0.8rem 0;font-size:0.75rem;color:var(--muted2);line-height:1.6">📋 Los proyectos activos<br>de tus clientes aparecerán aquí</div>';
    return;
  }
  var byClient = {};
  projs.forEach(function(p) {
    if (!byClient[p.client_id]) byClient[p.client_id] = [];
    byClient[p.client_id].push(p);
  });
  el.innerHTML = Object.keys(byClient).map(function(cid) {
    var items      = byClient[cid];
    var clientObj  = (CLIENTS_DATA || []).find(function(c) { return c.id === cid; });
    var clientName = clientObj ? (clientObj.name || cid) : cid;
    var completed  = items.filter(function(p) { return p.status === 'completado'; }).length;
    var inProgress = items.filter(function(p) { return ['en_progreso','en_revision'].indexOf(p.status) >= 0; }).length;
    var approved   = items.filter(function(p) { return ['aprobado','planificado'].indexOf(p.status) >= 0; }).length;
    var total = items.length;
    var pct   = total > 0 ? Math.round((completed * 100 + inProgress * 65 + approved * 30) / total) : 0;
    var col   = completed === total ? 'var(--green)' : inProgress > 0 ? 'var(--gold)' : '#4e7ca1';
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
  var in30  = new Date(today); in30.setDate(in30.getDate() + 30);
  var upcoming = (DASH_PROYECTOS || []).filter(function(p) {
    if (!p.end_date || p.status === 'completado') return false;
    var d = new Date(p.end_date);
    return d >= today && d <= in30;
  }).sort(function(a,b) { return new Date(a.end_date) - new Date(b.end_date); }).slice(0, 5);

  if (!upcoming.length) {
    el.innerHTML = '<div class="dash-content-empty" style="text-align:center;padding:0.8rem 0;font-size:0.75rem;color:var(--muted2);line-height:1.6">📅 Sin vencimientos<br>en los próximos 30 días</div>';
    return;
  }
  el.innerHTML = upcoming.map(function(p) {
    var clientObj  = (CLIENTS_DATA || []).find(function(c) { return c.id === p.client_id; });
    var clientName = clientObj ? (clientObj.name || '—') : '—';
    var d          = new Date(p.end_date);
    var diffDays   = Math.ceil((d - today) / (1000*60*60*24));
    var col        = diffDays <= 7 ? 'var(--red)' : diffDays <= 14 ? 'var(--gold)' : 'var(--green)';
    var dayStr     = diffDays === 0 ? 'hoy' : diffDays === 1 ? 'mañana' : 'en ' + diffDays + ' días';
    return '<div class="dash-dead-item">' +
      '<div class="dash-dead-dot" style="background:' + col + '"></div>' +
      '<div class="dash-dead-info">' +
        '<div class="dash-dead-name">' + (p.title || '—') + '</div>' +
        '<div class="dash-dead-date">' + clientName + ' · ' + dayStr + '</div>' +
      '</div></div>';
  }).join('');
}

function renderDashProximas() {
  var el    = document.getElementById('dash-proximas');
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
    var d        = new Date(t.publish_date + 'T12:00:00');
    var dateStr  = d.toLocaleDateString('es-ES', { weekday:'short', day:'2-digit', month:'short' });
    var color    = _teamColorFor(t.assignee);
    var initials = _teamInitialsFor(t.assignee);
    var isToday  = d.toDateString() === today.toDateString();
    var isTomorrow = d - today === 86400000;
    var badge    = isToday ? '<span style="font-size:0.6rem;background:#c0392b;color:#fff;border-radius:4px;padding:0.05rem 0.3rem;margin-left:0.3rem">HOY</span>'
                 : isTomorrow ? '<span style="font-size:0.6rem;background:#c29547;color:#fff;border-radius:4px;padding:0.05rem 0.3rem;margin-left:0.3rem">MAÑANA</span>'
                 : '';
    return '<div style="display:flex;align-items:center;gap:0.55rem;padding:0.4rem 0;border-bottom:1px solid #f0ece5">' +
      '<div style="width:26px;height:26px;border-radius:50%;background:' + color + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:0.62rem;font-weight:700;flex-shrink:0">' + initials + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.75rem;font-weight:600;color:#1F2A24;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (t.title || '') + badge + '</div>' +
        '<div style="font-size:0.65rem;color:#888">' + dateStr + (t.project_title ? ' · ' + t.project_title : '') + '</div>' +
      '</div></div>';
  }).join('');
}

function renderDashContenido() {
  var el = document.getElementById('dash-contenido');
  if (!el) return;
  if (!RECENT_CONTENT || !RECENT_CONTENT.length) {
    el.innerHTML = '<div class="dash-content-empty">Sin contenido generado esta semana</div>';
    return;
  }
  var byClient = {};
  RECENT_CONTENT.forEach(function(c) {
    var cid = c.client_id || 'otro';
    if (!byClient[cid]) byClient[cid] = [];
    byClient[cid].push(c);
  });
  el.innerHTML = Object.keys(byClient).map(function(cid) {
    var items      = byClient[cid];
    var clientObj  = CLIENTS_DATA.find(function(x) { return x.id === cid || x.client_key === cid; });
    var clientLabel = clientObj ? (clientObj.name || cid) : cid;
    var clientIdx  = clientObj ? CLIENTS_DATA.indexOf(clientObj) : -1;
    var navAction  = clientIdx >= 0 ? 'openClientePage(' + clientIdx + ')' : '';
    var thumbs = items.slice(0, 10).map(function(c) {
      var clickAction = clientIdx >= 0 ? 'openClientePage(' + clientIdx + ')' : "openContentPreview('" + c.id + "')";
      if (c.img_b64) {
        return '<div class="dash-thumb-wrap" onclick="' + clickAction + '" title="' + (c.headline || clientLabel) + '">' +
          '<img class="dash-thumb" src="' + (typeof _bravoImgSrcFromRecord === 'function' ? _bravoImgSrcFromRecord(c) : '') + '">' +
          '<div class="dash-thumb-hover">Ver →</div></div>';
      }
      return '<div class="dash-thumb-wrap dash-thumb-text" onclick="' + clickAction + '" title="' + (c.headline || '') + '">' +
        '<div class="dash-thumb-label">' + ((c.headline || c.pillar || 'POST').substring(0, 22)) + '</div>' +
        '<div class="dash-thumb-hover">Ver →</div></div>';
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
      '</div></div>';
  }).join('');
}
