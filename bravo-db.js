// ============================================================
// bravo-db.js — Supabase Integration Layer
// BRAVO Centro de Mando — Aprile 2026
// ============================================================
// Questo file collega bravo.html al database Supabase.
// Sostituisce tutti i dati hardcoded con dati reali persistenti.
// Carica dopo bravo.js — sovrascrive le funzioni chiave.
// ============================================================

const { createClient } = supabase;
let db = null;

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


// ── LOAD CLIENTS ─────────────────────────────────────────────
async function loadClientsFromDB() {
  var res = await db.from('clients').select('*').order('name');
  if (res.error) {
    console.error('[BRAVO DB] Error loading clients:', res.error.message);
    return false;
  }
  CLIENTS_DATA = res.data || [];
  return true;
}

// ── LOAD TEAM ─────────────────────────────────────────────────
async function loadTeamFromDB() {
  // TEAM_DATA è già inizializzato in bravo.js con il team BRAVO corretto — non sovrascrivere.
  return true;
}


// ── BRAND KIT ────────────────────────────────────────────────
var BRAND_KITS = {};   // { clientId: { colors, fonts, tone_of_voice, pillars, layouts, notes } }

async function loadBrandKitFromDB(clientId) {
  if (!clientId) return null;
  if (BRAND_KITS[clientId]) return BRAND_KITS[clientId];
  // Esclude logo_b64 e ig_refs_b64 (caricati separatamente al bisogno — sono pesanti)
  var res = await db.from('client_brand')
    .select('id,client_id,colors,fonts,tone_of_voice,pillars,layouts,templates,notes,brand_kit_opus,updated_at')
    .eq('client_id', clientId).single();
  if (res.error) {
    console.warn('[BRAVO DB] Brand kit non disponibile per', clientId);
    return null;
  }
  BRAND_KITS[clientId] = res.data;
  return res.data;
}

async function loadBrandKitImagesFromDB(clientId) {
  if (!clientId) return {};
  var res = await db.from('client_brand')
    .select('logo_b64,ig_refs_b64')
    .eq('client_id', clientId).single();
  if (res.error) return {};
  return { logo_b64: res.data.logo_b64, ig_refs_b64: res.data.ig_refs_b64 || [] };
}

// ── LOAD RECENT CONTENT (ultimi 7 giorni) ────────────────────
var RECENT_CONTENT = [];

// ── DASHBOARD — DATI REALI DA SUPABASE ──────────────────────────
var DASH_PROYECTOS = [];  // client_projects attivi (non rechazado)

async function loadDashProjectsFromDB() {
  var res = await db
    .from('client_projects')
    .select('id,client_id,title,category,status,priority,start_date,end_date,assigned_to,month_target')
    .neq('status', 'rechazado')
    .order('created_at', { ascending: false });

  if (res.error) {
    console.warn('[BRAVO DB] client_projects non disponibile:', res.error.message);
    return false;
  }
  DASH_PROYECTOS = res.data || [];
  console.log('[BRAVO DB] ✓ Proyectos dashboard caricati:', DASH_PROYECTOS.length);
  return true;
}

async function loadRecentContentFromDB() {
  var since = new Date();
  since.setDate(since.getDate() - 7);
  var sinceStr = since.toISOString().split('T')[0] + 'T00:00:00+00:00';

  var res = await db
    .from('generated_content')
    .select('id,client_id,platform,pillar,headline,img_b64,created_at')
    .gte('created_at', sinceStr)
    .order('created_at', { ascending: false })
    .limit(20);

  if (res.error) {
    console.warn('[BRAVO DB] Recent content non disponibile:', res.error.message);
    return false;
  }
  RECENT_CONTENT = res.data || [];
  console.log('[BRAVO DB] ✓ Contenuti recenti caricati:', RECENT_CONTENT.length);
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

  // Nuovi contenuti generati in tempo reale
  db.channel('bravo-content')
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'generated_content'
    }, function(payload) {
      var cid = payload.new.client_id;
      todayContentCounts[cid] = (todayContentCounts[cid] || 0) + 1;
      updateContentBadges();
      updateContentAlertBanner();
      console.log('[BRAVO DB] ★ Nuovo contenuto salvato per:', cid);
      // Ricarica contenuti e aggiorna dashboard + pagina cliente se aperta
      loadRecentContentFromDB().then(function() {
        renderDashContenido();
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
// GENERATED CONTENT — conteggi giornalieri + badge dashboard
// ============================================================

// Mappa client_id → conteggio post generati oggi
var todayContentCounts = {};

// Mappa nome cliente (come appare in CUENTAS) → client_id Supabase
function clientIdFromName(name) {
  if (!name) return '';
  var n = name.toLowerCase();
  if (n.indexOf('dakady') > -1)   return 'dakady';
  if (n.indexOf('altair') > -1)   return 'altair';
  if (n.indexOf('antorgia') > -1) return 'lantorgia';
  if (n.indexOf('dieci') > -1)    return 'ladieci';
  return n.replace(/[^a-z0-9]/g, '');
}

// Restituisce l'UUID Supabase dato un client_key ('dakady', 'altair', ...)
function clientUUIDFromKey(key) {
  if (!key) return key;
  var found = (CLIENTS_DATA || []).find(function(c) { return c.client_key === key; });
  if (found) return found.id;
  // Fallback: mappa statica se CLIENTS_DATA non ancora caricata
  var fallback = {
    'dakady':    'cc000001-0000-0000-0000-000000000001',
    'altair':    'cc000002-0000-0000-0000-000000000002',
    'lantorgia': 'cc000003-0000-0000-0000-000000000003',
    'ladieci':   'cc000004-0000-0000-0000-000000000004'
  };
  if (fallback[key]) return fallback[key];
  console.warn('[DB] UUID non trovato per chiave cliente:', key, '— CLIENTS_DATA potrebbe non essere ancora caricato');
  return null;
}

async function loadTodayContentCounts() {
  var today = new Date().toISOString().split('T')[0];
  var res = await db
    .from('generated_content')
    .select('client_id')
    .gte('created_at', today + 'T00:00:00+00:00')
    .lte('created_at', today + 'T23:59:59+00:00');

  if (res.error) {
    console.warn('[BRAVO DB] Conteggio contenuti non disponibile:', res.error.message);
    return;
  }

  todayContentCounts = {};
  (res.data || []).forEach(function(row) {
    todayContentCounts[row.client_id] = (todayContentCounts[row.client_id] || 0) + 1;
  });

  updateContentBadges();
  updateContentAlertBanner();
}

// Aggiunge badge "★ N hoy" su ogni card del progetto
function updateContentBadges() {
  if (!CUENTAS || !CUENTAS.length) return;
  CUENTAS.forEach(function(c) {
    var cid   = clientIdFromName(c.cliente);
    var count = todayContentCounts[cid] || 0;
    // Trova la card nel DOM (identifica tramite onclick che contiene c.id)
    var cards = document.querySelectorAll('.cuenta-card');
    cards.forEach(function(card) {
      var onclick = card.getAttribute('onclick') || '';
      if (onclick.indexOf(c.id) === -1) return;
      // Rimuovi badge precedente se esiste
      var old = card.querySelector('.content-badge');
      if (old) old.remove();
      // Aggiungi badge se ci sono contenuti oggi
      if (count > 0) {
        var badge = document.createElement('div');
        badge.className = 'content-badge';
        badge.textContent = '★ ' + count + (count === 1 ? ' post hoy' : ' posts hoy');
        badge.setAttribute('onclick', "event.stopPropagation();switchTab('agente',document.querySelector('.nav-tab:nth-child(5)'))");
        card.appendChild(badge);
      }
    });
  });
}

// Mostra/aggiorna l'alert banner in cima alla dashboard
function updateContentAlertBanner() {
  var banner = document.getElementById('content-alert-strip');
  if (!banner) return;

  // Calcola totale post di oggi su tutti i clienti
  var total = Object.values(todayContentCounts).reduce(function(a, b) { return a + b; }, 0);

  if (total === 0) {
    banner.style.display = 'none';
    return;
  }

  // Costruisci messaggio con dettaglio per cliente — usa nome leggibile, non UUID
  var parts = [];
  Object.keys(todayContentCounts).forEach(function(cid) {
    var n = todayContentCounts[cid];
    if (n <= 0) return;
    // Cerca il nome del cliente in CLIENTS_DATA (array caricato da Supabase)
    var clienteName = cid; // fallback: UUID grezzo
    if (typeof CLIENTS_DATA !== 'undefined' && CLIENTS_DATA && CLIENTS_DATA.length) {
      var found = CLIENTS_DATA.find(function(c) { return c.id === cid; });
      if (found) clienteName = found.name || found.client_key || cid;
    }
    parts.push('<strong>' + clienteName + '</strong>: ' + n + ' ' + (n === 1 ? 'post' : 'posts'));
  });

  // Mostra chip piccolo nella topbar invece del banner full-width
  var chip = document.getElementById('ai-notif-chip');
  var chipText = document.getElementById('ai-notif-text');
  if (chip && chipText) {
    chipText.textContent = total + (total === 1 ? ' post generado hoy' : ' posts generados hoy');
    chip.style.display = 'flex';
  }
  // Banner full-width nascosto — usiamo solo il chip
  banner.style.display = 'none';
}

// ============================================================
async function initSupabase() {
  console.log('[BRAVO DB] Inizializzazione...');

  try {
    var backendUrl = (typeof BRAVO_API !== 'undefined' ? BRAVO_API : 'https://bravoapp-production.up.railway.app');
    var cfgRes = await fetch(backendUrl + '/api/config');
    var cfg = await cfgRes.json();
    if (!cfg.supabase_url || !cfg.supabase_key) throw new Error('Configurazione Supabase non disponibile');
    db = createClient(cfg.supabase_url, cfg.supabase_key);

    console.log('[BRAVO DB] Connessione a Supabase...');

    // Test connessione
    var test = await db.from('projects').select('id').limit(1);
    if (test.error) throw test.error;

    // Carica dati principali in parallelo
    var results = await Promise.all([
      loadProjectsFromDB(),
      loadDecisionsFromDB(),
      loadCalendarFromDB(),
      loadTodayTasksFromDB()
    ]);
    // Carica conteggi contenuti (best-effort)
    loadTodayContentCounts();

    var allOk = results.every(function(r) { return r === true; });

    if (allOk) {
      dbConnected = true;

      // Ricarica le view con i dati dal DB
      renderCuentasGrid();
      renderHoyStrip();
      renderDashboardStats();
      updateHistStats();

      // Carica clienti, team e contenuti recenti (best-effort)
      Promise.all([loadClientsFromDB(), loadTeamFromDB(), loadRecentContentFromDB(), loadDashProjectsFromDB()]).then(function() {
        renderClientesView();
        renderClientesPopupList();
        renderDashContenido();
        // Aggiorna dashboard con dati reali
        renderDashSemana();
        renderDashVencimientos();
        renderDashboardStats();
      }).catch(function(e) {
        console.warn('[BRAVO DB] Dati secondari non caricati:', e.message || e);
      });

      // Carica Kanban del progetto attivo
      if (activeTbCuenta) {
        await loadKanbanFromDB(activeTbCuenta);
      }

      showDBStatus(true);
      console.log('[BRAVO DB] ✓ Connesso — tutti i dati caricati da Supabase');
      try { setupRealtime(); } catch(re) { console.warn('[BRAVO DB] Realtime non disponibile:', re.message || re); }
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
