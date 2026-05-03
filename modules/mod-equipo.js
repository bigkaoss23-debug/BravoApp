// ============================================================
// MOD-EQUIPO — Gestione team, task, assegnazioni clienti
// Lazy-loaded quando si apre il tab Equipo
// ============================================================

var _equipoTasks       = {};
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
  try {
    var res = await db.from('team_tasks').select('*');
    if (!res.error && res.data && res.data.length) {
      res.data.forEach(function(row) {
        _equipoTasks[row.member_name] = row.tasks || [];
        if (row.assigned_clients) _equipoAssignments[row.member_name] = row.assigned_clients;
      });
    }
  } catch (e) {}

  var hasAnyAssignment = Object.keys(_equipoAssignments).some(function(k) {
    return (_equipoAssignments[k] || []).length > 0;
  });
  if (!hasAnyAssignment && (CLIENTS_DATA || []).length) {
    await _equipoAutoAssignFromBriefings();
  }
  _equipoRenderGrid();
}

function _equipoRenderGrid() {
  var grid = document.getElementById('equipoGrid');
  if (!grid) return;

  grid.innerHTML = TEAM_DATA.map(function(m) {
    var tasks = _equipoTasks[m.name] || [];
    var mKey  = encodeURIComponent(m.name);

    var tasksHtml = tasks.length
      ? tasks.map(function(t, ti) {
          return '<div class="equipo-task-item" id="etask-' + mKey + '-' + ti + '">' +
            '<div class="equipo-task-dot" style="background:' + (m.color || '#999') + '"></div>' +
            '<span style="flex:1">' + t + '</span>' +
            '<span onclick="equipoRemoveTask(\'' + mKey + '\',' + ti + ')" ' +
              'style="cursor:pointer;color:#ccc;font-size:0.9rem;padding:0 0.2rem;line-height:1" title="Rimuovi">×</span>' +
          '</div>';
        }).join('')
      : '<div class="equipo-empty-tasks" id="etask-empty-' + mKey + '">Sin tareas asignadas</div>';

    return '<div class="equipo-card">' +
      '<div class="equipo-card-top">' +
        '<div class="equipo-av" style="background:' + (m.color || '#999') + '">' + (m.initials || '') + '</div>' +
        '<div class="equipo-nombre">' + m.name + '</div>' +
        '<div class="equipo-rol">' + m.role + '</div>' +
        (m.detail ? '<div class="equipo-detail">' + m.detail + '</div>' : '') +
      '</div>' +
      '<div class="equipo-card-body">' +
        '<div class="equipo-section-label">Proyectos asignados</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.8rem">' +
          (CLIENTS_DATA || []).map(function(c) {
            var ckey     = c.client_key || c.id;
            var assigned = (_equipoAssignments[m.name] || []).indexOf(ckey) !== -1;
            return '<div onclick="equipoToggleClient(\'' + encodeURIComponent(m.name) + '\',\'' + ckey + '\')" ' +
              'style="font-size:0.68rem;padding:0.22rem 0.6rem;border-radius:20px;cursor:pointer;transition:all 0.15s;' +
              (assigned
                ? 'background:' + (m.color || '#999') + ';color:#fff;font-weight:600;border:1px solid ' + (m.color || '#999')
                : 'background:var(--bg);color:var(--muted2);border:1px solid var(--border)') + '">' +
              (c.name || ckey) +
            '</div>';
          }).join('') +
          (!(CLIENTS_DATA || []).length ? '<div class="equipo-empty-tasks">Sin clientes</div>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
          '<div class="equipo-section-label" style="margin:0;flex:1">Tareas activas</div>' +
        '</div>' +
        '<div id="etasks-' + mKey + '">' + tasksHtml + '</div>' +
        '<div style="display:flex;gap:0.4rem;margin-top:0.7rem">' +
          '<input id="etask-input-' + mKey + '" type="text" placeholder="Escribe una tarea a mano…" ' +
            'style="flex:1;font-size:0.73rem;padding:0.38rem 0.65rem;border:1px solid var(--border);border-radius:7px;background:var(--bg);color:var(--text);outline:none" ' +
            'onkeydown="if(event.key===\'Enter\')equipoAddTask(\'' + mKey + '\')">' +
          '<button onclick="equipoAddTask(\'' + mKey + '\')" ' +
            'style="font-size:0.82rem;padding:0.3rem 0.7rem;background:var(--accent);color:#fff;border:none;border-radius:7px;cursor:pointer;font-weight:600">+</button>' +
        '</div>' +
        '<button onclick="equipoSuggestAI(\'' + mKey + '\',\'' + encodeURIComponent(m.role) + '\',\'' + encodeURIComponent(m.detail || '') + '\')" ' +
          'id="eai-btn-' + mKey + '" ' +
          'style="width:100%;margin-top:0.5rem;font-size:0.7rem;padding:0.38rem 0.6rem;background:none;border:1px dashed var(--border2);border-radius:8px;cursor:pointer;color:var(--muted);display:flex;align-items:center;justify-content:center;gap:0.35rem">' +
          '✦ Suggerir tareas con IA' +
        '</button>' +
        '<div id="eai-suggestions-' + mKey + '" style="display:none;margin-top:0.5rem;display:flex;flex-direction:column;gap:0.3rem"></div>' +
      '</div>' +
    '</div>';
  }).join('');
}

async function _equipoAutoAssignFromBriefings() {
  for (var i = 0; i < (CLIENTS_DATA || []).length; i++) {
    var c    = CLIENTS_DATA[i];
    var ckey = c.client_key || c.id;
    try {
      var res  = await fetch(AGENT_API + '/api/team/auto-assign/' + encodeURIComponent(c.id));
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
    } catch (e) {}
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
  var name  = decodeURIComponent(mKey);
  var input = document.getElementById('etask-input-' + mKey);
  var val   = (input ? input.value : '').trim();
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
    await db.from('team_tasks').upsert({
      member_name:      memberName,
      tasks:            _equipoTasks[memberName] || [],
      assigned_clients: _equipoAssignments[memberName] || [],
      updated_at:       new Date().toISOString()
    }, { onConflict: 'member_name' });
  } catch (e) {}
}

async function equipoSuggestAI(mKey, roleEnc, detailEnc) {
  var name   = decodeURIComponent(mKey);
  var role   = decodeURIComponent(roleEnc);
  var detail = decodeURIComponent(detailEnc);
  var btn    = document.getElementById('eai-btn-' + mKey);
  var sugBox = document.getElementById('eai-suggestions-' + mKey);

  if (btn)    { btn.innerHTML = '⏳ Pensando…'; btn.disabled = true; }
  if (sugBox) { sugBox.style.display = 'flex'; sugBox.innerHTML = '<div style="font-size:0.7rem;color:var(--muted);padding:0.3rem 0">Cargando sugerencias…</div>'; }

  var clientId = (CLIENTS_DATA && CLIENTS_DATA.length) ? (CLIENTS_DATA[0].client_key || CLIENTS_DATA[0].id) : 'dakady';

  try {
    var res  = await fetch(AGENT_API + '/api/team/suggest-tasks', {
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
        suggestions.map(function(t) {
          return '<div onclick="equipoAddSuggestion(\'' + mKey + '\',\'' + encodeURIComponent(t) + '\',this)" ' +
            'style="display:flex;align-items:center;gap:0.5rem;font-size:0.75rem;padding:0.35rem 0.65rem;border:1px dashed var(--border2);border-radius:8px;cursor:pointer;color:var(--text2);background:var(--bg);transition:background 0.15s">' +
            '<span style="color:var(--accent);font-weight:700">+</span> ' + t +
          '</div>';
        }).join('');
    }
    if (btn) { btn.innerHTML = '✦ Suggerir tareas con IA'; btn.disabled = false; }
  } catch (e) {
    if (sugBox) sugBox.innerHTML = '<div style="font-size:0.7rem;color:#D13B1E">✕ ' + e.message + '</div>';
    if (btn)    { btn.innerHTML = '✦ Suggerir tareas con IA'; btn.disabled = false; }
  }
}

function equipoAddSuggestion(mKey, taskEnc, el) {
  var name = decodeURIComponent(mKey);
  var task = decodeURIComponent(taskEnc);
  if (!_equipoTasks[name]) _equipoTasks[name] = [];
  _equipoTasks[name].push(task);
  _equipoSave(name);
  if (el) {
    el.style.background    = 'var(--green-light, #e8f5e9)';
    el.style.color         = 'var(--muted2)';
    el.style.pointerEvents = 'none';
    el.querySelector('span').textContent = '✓';
  }
  _equipoRenderGrid();
}
