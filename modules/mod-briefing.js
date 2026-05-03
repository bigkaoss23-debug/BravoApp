// ============================================================
// MOD-BRIEFING — Briefing del cliente (PDF/Word upload + guardado)
// Lazy-loaded — incluido en mod-cliente-page
// ============================================================

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

