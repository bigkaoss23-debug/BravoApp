// ============================================================
// MOD-AGENTI — Tab Agentes en la página del cliente
// Lazy-loaded quando si apre il tab Agentes
// ============================================================

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
        '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:#888;cursor:pointer;white-space:nowrap" title="Activa la autocrítica IA en 5 dimensiones (tarda ~10s más)">' +
          '<input type="checkbox" id="ag-critique-' + clientId + '" style="accent-color:#1F2A24;width:13px;height:13px">' +
          '✦ Alta calidad' +
        '</label>' +
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

  var taCampo    = document.getElementById('ag-campo-textarea');
  var brief      = taCampo ? (taCampo.value || '').trim() : '';
  if (!brief) brief = 'Genera un post para este cliente.';
  var critiqueEl = document.getElementById('ag-critique-' + clientId);
  var doCritique = critiqueEl ? critiqueEl.checked : false;

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
    form.append('self_critique', doCritique ? 'true' : 'false');
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
    // Estrae solo il blocco CAPTION dall'output del copywriter (senza TITULAR, senza extra)
    if (prev && prev.output && !caption) {
      var raw = prev.output;
      var capMatch = raw.match(/CAPTION:\s*([\s\S]+?)(?:\n\nHASHTAGS:|\n\n[A-Z]{3,}:|$)/);
      caption = capMatch ? capMatch[1].trim() : raw.trim();
    }
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

