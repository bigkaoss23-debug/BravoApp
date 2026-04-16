// ============================================================
// bravo-db.js — Supabase Integration Layer
// BRAVO Centro de Mando — Aprile 2026
// ============================================================
// Questo file collega bravo.html al database Supabase.
// Sostituisce tutti i dati hardcoded con dati reali persistenti.
// Carica dopo bravo.js — sovrascrive le funzioni chiave.
// ============================================================

const SUPABASE_URL = 'https://jicfvkbyjdarquoqeetv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppY2Z2a2J5amRhcnF1b3FlZXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzNDU5MzksImV4cCI6MjA5MTkyMTkzOX0.qDnZ4m7M0q6gFT3P22sUYHDheCS9MBFyOHJpJsT2mNA';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── STATO CONNESSIONE ────────────────────────────────────────
var dbConnected = false;

// ── HELPERS ─────────────────────────────────────────────────
function formatDBTime(isoString) {
  if (!isoString) return '';
  var d    = new Date(isoString);
  var now  = new Date();
  var diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  var hh   = d.getHours().toString().padStart(2,'0');
  var mm   = d.getMinutes().toString().padStart(2,'0');
  var months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  if (diff === 0) return 'Hoy ' + hh + ':' + mm;
  if (diff === 1) return 'Ayer ' + hh + ':' + mm;
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + hh + ':' + mm;
}

function formatDeadlineDate(dateStr) {
  if (!dateStr) return '';
  var d = new Date(dateStr + 'T00:00:00');
  var months = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return d.getDate() + ' ' + months[d.getMonth()];
}

// ── LOAD PROJECTS ────────────────────────────────────────────
async function loadProjectsFromDB() {
  var res = await db
    .from('projects')
    .select('*, clients(name), project_members(team_members(id,name,initials,color))')
    .order('created_at');

  if (res.error) {
    console.error('[BRAVO DB] Error loading projects:', res.error.message);
    return false;
  }

  CUENTAS = res.data.map(function(p) {
    var members = (p.project_members || []).map(function(pm) { return pm.team_members; }).filter(Boolean);
    return {
      id:            p.id,
      nombre:        p.name,
      cliente:       p.clients ? p.clients.name : '',
      progreso:      p.progress || 0,
      estado:        p.status || 'idle',
      estadoLabel:   p.status_label || '',
      deadline:      formatDeadlineDate(p.deadline),
      deadlineTag:   p.deadline_tag || '',
      deadlineClass: p.deadline_class || 'dead-ok',
      equipo:        members.map(function(m) { return m.initials; }),
      equipoColors:  members.map(function(m) { return m.color; }),
      tareas:        p.open_tasks || 0,
      senal:         p.signal || ''
    };
  });

  return true;
}

// ── LOAD KANBAN CARDS ────────────────────────────────────────
async function loadKanbanFromDB(projectId) {
  var res = await db
    .from('kanban_cards')
    .select('*, assigned_member:team_members(id,name,role), card_links(*)')
    .eq('project_id', projectId)
    .order('position');

  if (res.error) {
    console.error('[BRAVO DB] Error loading kanban:', res.error.message);
    return false;
  }

  if (!KANBAN_DATA[projectId]) KANBAN_DATA[projectId] = {};
  TB_COLS.forEach(function(col) {
    KANBAN_DATA[projectId][col.id] = [];
  });

  res.data.forEach(function(card) {
    var col = card.column_id;
    if (!KANBAN_DATA[projectId][col]) KANBAN_DATA[projectId][col] = [];

    var member = card.assigned_member;
    var assignStr = member ? (member.name + (member.role ? ' — ' + member.role : '')) : '';

    var cardObj = {
      _id:      card.id,
      t:        card.title,
      m:        member ? member.name.split(' ')[0] + ' ' + (member.name.split(' ')[1] ? member.name.split(' ')[1][0] + '.' : '') : 'Sin asignar',
      desc:     card.description || '',
      assign:   assignStr,
      date:     card.due_date || '',
      priority: card.priority || 'Normal',
      links:    (card.card_links || []).map(function(l) { return { id: l.id, name: l.name, url: l.url }; }),
      comments: card.comments || ''
    };

    KANBAN_DATA[projectId][col].push(cardObj);

    // Aggiorna cardStore
    var idx = KANBAN_DATA[projectId][col].length - 1;
    var key = projectId + '__' + col + '__' + idx;
    cardStore[key] = cardObj;
  });

  return true;
}

// ── LOAD DECISIONS ───────────────────────────────────────────
async function loadDecisionsFromDB() {
  var res = await db
    .from('decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (res.error) {
    console.error('[BRAVO DB] Error loading decisions:', res.error.message);
    return false;
  }

  decisions = res.data.map(function(d) {
    return {
      _id:    d.id,
      type:   d.type,
      action: d.action,
      detail: d.detail || 'Accion registrada por BRAVO.',
      tags:   d.tags || [],
      time:   formatDBTime(d.created_at)
    };
  });

  updateHistStats();
  return true;
}

// ── LOAD STRATEGY ─────────────────────────────────────────────
async function loadStrategyFromDB(projectId) {
  var objRes   = await db.from('strategy_objectives').select('*').eq('project_id', projectId).order('position');
  var stepsRes = await db.from('strategy_steps').select('*').eq('project_id', projectId).order('position');

  if (objRes.error || stepsRes.error) return false;

  estrategiaStore[projectId] = {
    objMes:  objRes.data.filter(function(o) { return o.period === 'mes'; })
                        .map(function(o) { return { _id: o.id, t: o.text, done: o.done }; }),
    objTrim: objRes.data.filter(function(o) { return o.period === 'trim'; })
                        .map(function(o) { return { _id: o.id, t: o.text, done: o.done }; }),
    pasos:   stepsRes.data.map(function(s) { return { _id: s.id, t: s.text, meta: s.meta }; })
  };

  return true;
}

// ── LOAD CALENDAR EVENTS ──────────────────────────────────────
async function loadCalendarFromDB() {
  var res = await db.from('calendar_events').select('*').order('event_date');

  if (res.error) {
    console.error('[BRAVO DB] Error loading calendar:', res.error.message);
    return false;
  }

  calEvents = {};
  res.data.forEach(function(e) {
    var d   = new Date(e.event_date + 'T00:00:00');
    var key = d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
    if (!calEvents[key]) calEvents[key] = [];
    calEvents[key].push({ _id: e.id, t: e.title, cls: e.color_class || 'ce-blue' });
  });

  return true;
}

// ── LOAD TODAY TASKS ──────────────────────────────────────────
async function loadTodayTasksFromDB() {
  var today = new Date().toISOString().split('T')[0];
  var res   = await db
    .from('today_tasks')
    .select('*, team_members(name)')
    .eq('task_date', today)
    .order('created_at');

  if (res.error) {
    console.error('[BRAVO DB] Error loading today tasks:', res.error.message);
    return false;
  }

  HOY_TAREAS = {};
  res.data.forEach(function(t) {
    var name = t.team_members ? t.team_members.name : null;
    if (!name) return;
    if (!HOY_TAREAS[name]) HOY_TAREAS[name] = [];
    HOY_TAREAS[name].push({ _id: t.id, t: t.text, urgente: t.urgent, done: t.done });
  });

  return true;
}

// ============================================================
// SAVE FUNCTIONS — scrivono su Supabase
// ============================================================

// ── SAVE DECISION ─────────────────────────────────────────────
async function saveDecisionToDB(action, type, detail) {
  var res = await db.from('decisions').insert({
    type:   type   || 'blue',
    action: action || '',
    detail: detail || 'Accion registrada por BRAVO.',
    tags:   []
  });
  if (res.error) console.error('[BRAVO DB] Error saving decision:', res.error.message);
}

// ── SAVE / UPDATE CARD ────────────────────────────────────────
async function saveCardToDB(projId, colId, cardData) {
  if (cardData._id) {
    var res = await db.from('kanban_cards').update({
      title:       cardData.t,
      description: cardData.desc     || '',
      comments:    cardData.comments || '',
      priority:    cardData.priority || 'Normal',
      due_date:    cardData.date     || null,
      updated_at:  new Date().toISOString()
    }).eq('id', cardData._id);
    if (res.error) console.error('[BRAVO DB] Error updating card:', res.error.message);
  } else {
    var res2 = await db.from('kanban_cards').insert({
      project_id: projId,
      column_id:  colId,
      title:      cardData.t        || 'Nueva tarjeta',
      description:cardData.desc     || '',
      priority:   cardData.priority || 'Normal',
      comments:   cardData.comments || '',
      position:   999
    }).select().single();
    if (res2.error) console.error('[BRAVO DB] Error inserting card:', res2.error.message);
    if (res2.data) cardData._id = res2.data.id;
  }
}

// ── SAVE CARD LINK ────────────────────────────────────────────
async function saveCardLinkToDB(cardId, name, url) {
  var res = await db.from('card_links').insert({ card_id: cardId, name: name, url: url }).select().single();
  if (res.error) console.error('[BRAVO DB] Error saving link:', res.error.message);
  return res.data;
}

async function deleteCardLinkFromDB(linkId) {
  var res = await db.from('card_links').delete().eq('id', linkId);
  if (res.error) console.error('[BRAVO DB] Error deleting link:', res.error.message);
}

// ── SAVE STRATEGY OBJECTIVE ───────────────────────────────────
async function saveObjectiveToDB(projId, period, text) {
  var res = await db.from('strategy_objectives').insert({
    project_id: projId, period: period, text: text, done: false, position: 999
  }).select().single();
  if (res.error) console.error('[BRAVO DB] Error saving objective:', res.error.message);
  return res.data;
}

async function toggleObjectiveInDB(id, done) {
  var res = await db.from('strategy_objectives').update({ done: done }).eq('id', id);
  if (res.error) console.error('[BRAVO DB] Error toggling objective:', res.error.message);
}

// ── SAVE / DELETE STRATEGY STEP ───────────────────────────────
async function saveStepToDB(projId, text, meta) {
  var res = await db.from('strategy_steps').insert({
    project_id: projId, text: text, meta: meta || 'Pendiente', position: 999
  }).select().single();
  if (res.error) console.error('[BRAVO DB] Error saving step:', res.error.message);
  return res.data;
}

async function deleteStepFromDB(id) {
  var res = await db.from('strategy_steps').delete().eq('id', id);
  if (res.error) console.error('[BRAVO DB] Error deleting step:', res.error.message);
}

// ============================================================
// OVERRIDE FUNZIONI BRAVO.JS — aggiunge persistenza
// ============================================================

// Override logDecision → salva anche su Supabase
var _origLogDecision = logDecision;
logDecision = function(action, type, detail) {
  _origLogDecision(action, type, detail);
  if (dbConnected) saveDecisionToDB(action, type, detail);
};

// Override saveCardPanel → salva anche su Supabase
var _origSaveCardPanel = saveCardPanel;
saveCardPanel = function() {
  _origSaveCardPanel();
  if (!dbConnected || !activeCard) return;
  var cd = getCardData(activeCard.projId, activeCard.colId, activeCard.idx);
  saveCardToDB(activeCard.projId, activeCard.colId, cd);
};

// Override addObj → salva anche su Supabase
var _origAddObj = addObj;
addObj = function(id, period) {
  var input = document.getElementById('new-' + period + '-' + id);
  var val   = input ? input.value.trim() : '';
  _origAddObj(id, period);
  if (dbConnected && val) {
    saveObjectiveToDB(id, period, val).then(function(data) {
      if (data) {
        var arr = period === 'mes' ? getEstrategia(id).objMes : getEstrategia(id).objTrim;
        if (arr.length > 0) arr[arr.length-1]._id = data.id;
      }
    });
  }
};

// Override toggleObj → salva anche su Supabase
var _origToggleObj = toggleObj;
toggleObj = function(id, period, idx) {
  _origToggleObj(id, period, idx);
  if (dbConnected) {
    var arr  = period === 'mes' ? getEstrategia(id).objMes : getEstrategia(id).objTrim;
    var item = arr[idx];
    if (item && item._id) toggleObjectiveInDB(item._id, item.done);
  }
};

// Override addPaso → salva anche su Supabase
var _origAddPaso = addPaso;
addPaso = function(id) {
  var txtEl  = document.getElementById('new-paso-' + id);
  var metaEl = document.getElementById('new-paso-meta-' + id);
  var txt    = txtEl  ? txtEl.value.trim()  : '';
  var meta   = metaEl ? metaEl.value.trim() : '';
  _origAddPaso(id);
  if (dbConnected && txt) {
    saveStepToDB(id, txt, meta).then(function(data) {
      if (data) {
        var pasos = getEstrategia(id).pasos;
        if (pasos.length > 0) pasos[pasos.length-1]._id = data.id;
      }
    });
  }
};

// Override deletePaso → cancella anche su Supabase
var _origDeletePaso = deletePaso;
deletePaso = function(id, idx) {
  if (dbConnected) {
    var pasos = getEstrategia(id).pasos;
    var paso  = pasos[idx];
    if (paso && paso._id) deleteStepFromDB(paso._id);
  }
  _origDeletePaso(id, idx);
};

// Override addDriveLink → salva anche su Supabase
var _origAddDriveLink = addDriveLink;
addDriveLink = function() {
  _origAddDriveLink();
  if (!dbConnected || !activeCard) return;
  var cd      = getCardData(activeCard.projId, activeCard.colId, activeCard.idx);
  var nameEl  = document.getElementById('newLinkName');
  var urlEl   = document.getElementById('newLinkUrl');
  if (!cd._id || !urlEl) return;
  var linkName = nameEl ? nameEl.value.trim() : 'Enlace';
  var linkUrl  = urlEl.value.trim();
  if (linkUrl) {
    saveCardLinkToDB(cd._id, linkName || 'Enlace', linkUrl).then(function(data) {
      if (data && cd.links.length > 0) cd.links[cd.links.length-1].id = data.id;
    });
  }
};

// Override removeDriveLink → cancella anche su Supabase
var _origRemoveDriveLink = removeDriveLink;
removeDriveLink = function(i) {
  if (dbConnected && activeCard) {
    var cd   = getCardData(activeCard.projId, activeCard.colId, activeCard.idx);
    var link = cd.links[i];
    if (link && link.id) deleteCardLinkFromDB(link.id);
  }
  _origRemoveDriveLink(i);
};

// Override switchProjTab → carica dati strategy da DB
var _origSwitchProjTab = switchProjTab;
switchProjTab = function(projId, tab, el) {
  _origSwitchProjTab(projId, tab, el);
  if (!dbConnected) return;
  if (tab === 'estrategia') {
    loadStrategyFromDB(projId).then(function() {
      var wrap = document.getElementById(projId + '-estrategia');
      if (wrap) { wrap.dataset.built = ''; renderEstrategia(projId); wrap.dataset.built = '1'; }
    });
  }
  if (tab === 'kanban') {
    loadKanbanFromDB(projId).then(function() {
      var k = document.getElementById(projId + '-kanban');
      if (k) { k.innerHTML = '<div class="kanban-wrap">' + buildKanban(projId) + '</div>'; k.dataset.built = '1'; }
    });
  }
};

// Override switchTbCuenta → carica Kanban del tablero da DB
var _origSwitchTbCuenta = switchTbCuenta;
switchTbCuenta = function(id, el, stClass) {
  activeTbCuenta = id;
  var btns = document.querySelectorAll('.cuenta-sel-btn');
  for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active','st-crit','st-warn','st-good');
  el.classList.add('active');
  if (stClass) el.classList.add(stClass);
  if (dbConnected) {
    loadKanbanFromDB(id).then(function() { renderTablero(); });
  } else {
    renderTablero();
  }
};

// ============================================================
// REAL-TIME SUBSCRIPTIONS
// ============================================================
function setupRealtime() {
  // Nuove decisioni in tempo reale
  db.channel('bravo-decisions')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'decisions'
    }, function(payload) {
      var d = payload.new;
      decisions.unshift({
        _id: d.id, type: d.type, action: d.action,
        detail: d.detail || '', tags: d.tags || [], time: 'Ahora'
      });
      updateHistStats();
      var feed = document.getElementById('histFeed');
      if (feed && feed.children.length > 0) renderHistory();
    })
    .subscribe();

  // Modifiche kanban in tempo reale
  db.channel('bravo-kanban')
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'kanban_cards'
    }, function() {
      if (activeTbCuenta) {
        loadKanbanFromDB(activeTbCuenta).then(function() { renderTablero(); });
      }
    })
    .subscribe();

  // Modifiche progetti in tempo reale
  db.channel('bravo-projects')
    .on('postgres_changes', {
      event: 'UPDATE', schema: 'public', table: 'projects'
    }, function() {
      loadProjectsFromDB().then(function() {
        renderCuentasGrid();
      });
    })
    .subscribe();

  console.log('[BRAVO DB] ✓ Real-time subscriptions attive');
}

// ============================================================
// INDICATORE STATO CONNESSIONE (barra in alto)
// ============================================================
function showDBStatus(connected) {
  var bar = document.getElementById('db-status-bar');
  if (!bar) return;
  if (connected) {
    bar.textContent = '● Supabase connesso — dati in sync';
    bar.style.background = 'rgba(45,122,79,0.15)';
    bar.style.color = '#2d7a4f';
    setTimeout(function() { bar.style.display = 'none'; }, 3000);
  } else {
    bar.textContent = '⚠ Connessione a Supabase fallita — modalità locale';
    bar.style.background = 'rgba(192,57,43,0.1)';
    bar.style.color = '#c0392b';
  }
  bar.style.display = 'block';
}

// ============================================================
// INIT — punto di ingresso principale
// ============================================================
async function initSupabase() {
  console.log('[BRAVO DB] Connessione a Supabase...');

  try {
    // Test connessione
    var test = await db.from('projects').select('id').limit(1);
    if (test.error) throw test.error;

    // Carica tutti i dati in parallelo
    var results = await Promise.all([
      loadProjectsFromDB(),
      loadDecisionsFromDB(),
      loadCalendarFromDB(),
      loadTodayTasksFromDB()
    ]);

    var allOk = results.every(function(r) { return r === true; });

    if (allOk) {
      dbConnected = true;

      // Ricarica le view con i dati dal DB
      renderCuentasGrid();
      renderHoyStrip();
      updateHistStats();

      // Carica Kanban del progetto attivo
      if (activeTbCuenta) {
        await loadKanbanFromDB(activeTbCuenta);
      }

      setupRealtime();
      showDBStatus(true);
      console.log('[BRAVO DB] ✓ Connesso — tutti i dati caricati da Supabase');
    }

  } catch (e) {
    console.error('[BRAVO DB] Errore connessione:', e.message || e);
    showDBStatus(false);
    // Fallback: usa i dati hardcoded di bravo.js
    console.log('[BRAVO DB] Fallback → dati locali attivi');
  }
}

// Avvia dopo che il DOM e bravo.js sono pronti
window.addEventListener('load', function() {
  setTimeout(initSupabase, 100);
});
