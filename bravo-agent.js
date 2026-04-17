// ============================================================
// bravo-agent.js — Integrazione backend AI DaKady
// Chiama Railway: https://bravoapp-production.up.railway.app
// ============================================================

var BACKEND_URL = 'https://bravoapp-production.up.railway.app';
var agentGenerating = false;
var lastGeneratedContents = [];
var agentPhotoMode = 'none'; // 'file' | 'drive' | 'none'

// ── BRIEF STRUTTURATO ───────────────────────────────────────
var agentBriefMode = 'structured'; // 'structured' | 'free'

function agentToggleBriefMode() {
  agentBriefMode = agentBriefMode === 'structured' ? 'free' : 'structured';
  var isStructured = agentBriefMode === 'structured';
  document.getElementById('agent-brief-structured').style.display = isStructured ? '' : 'none';
  document.getElementById('agent-brief-free').style.display       = isStructured ? 'none' : '';
  document.getElementById('agent-brief-mode-btn').textContent     = isStructured ? '✎ Texto libre' : '⊞ Estructurado';
}

// ── PICKERS (Equipo / Productos) ────────────────────────────
var AGENT_PICKERS = {
  team: {
    title: 'Equipo en campo',
    items: ['Chema', 'Camilo', 'Diego', 'Oscar', 'Bilal', 'Ayub'],
    selected: []
  },
  products: {
    title: 'Solución aplicada',
    items: ['BRAVERIA', 'GS-PMAX', 'AIGRO', 'Dynamizer', 'Sanosil', 'Atens', 'Norden Agro', 'Svensson', 'TESA'],
    selected: []
  }
};
var agentActivePicker = null;

function agentOpenPicker(type) {
  agentActivePicker = type;
  var picker = AGENT_PICKERS[type];
  document.getElementById('agent-picker-title').textContent = picker.title;
  document.getElementById('agent-picker-items').innerHTML = picker.items.map(function(item) {
    var on = picker.selected.indexOf(item) > -1 ? ' on' : '';
    return '<span class="agent-picker-item' + on + '" onclick="agentPickerToggle(\'' + item + '\')">' + item + '</span>';
  }).join('');
  document.getElementById('agent-picker-overlay').style.display = '';
  document.getElementById('agent-picker-popup').style.display   = '';
}

function agentPickerToggle(item) {
  var picker = AGENT_PICKERS[agentActivePicker];
  var idx = picker.selected.indexOf(item);
  if (idx > -1) {
    picker.selected.splice(idx, 1);
  } else {
    picker.selected.push(item);
  }
  // Update pill UI
  var el = Array.from(document.querySelectorAll('#agent-picker-items .agent-picker-item'))
                .find(function(e) { return e.textContent === item; });
  if (el) el.classList.toggle('on', picker.selected.indexOf(item) > -1);
}

function agentClosePicker() {
  document.getElementById('agent-picker-overlay').style.display = 'none';
  document.getElementById('agent-picker-popup').style.display   = 'none';
  if (agentActivePicker) agentUpdatePickerBtn(agentActivePicker);
  agentActivePicker = null;
}

function agentUpdatePickerBtn(type) {
  var picker = AGENT_PICKERS[type];
  var btn    = document.getElementById('agent-btn-' + type);
  var label  = document.getElementById('agent-label-' + type);
  if (!btn || !label) return;
  if (picker.selected.length === 0) {
    label.textContent = picker.title;
    btn.classList.remove('has-value');
  } else {
    label.textContent = picker.selected.join(', ');
    btn.classList.add('has-value');
  }
}

function agentBuildBrief() {
  if (agentBriefMode === 'free') {
    return (document.getElementById('agent-brief-text').value || '').trim();
  }

  var situacion = (document.getElementById('agent-situacion').value || '').trim();
  var client    = (document.getElementById('agent-client').value    || '').trim();
  var location  = (document.getElementById('agent-location').value  || '').trim();
  var angle     = (document.getElementById('agent-angle').value     || '').trim();
  var products  = AGENT_PICKERS.products.selected;
  var team      = AGENT_PICKERS.team.selected;

  if (!situacion && products.length === 0 && team.length === 0) return '';

  var parts = [];
  if (situacion)        parts.push(situacion);
  if (products.length)  parts.push('Solución aplicada: ' + products.join(', ') + '.');
  if (team.length)      parts.push('Equipo: ' + team.join(', ') + '.');
  if (client)           parts.push('Cliente: ' + client + '.');
  if (location)         parts.push('Localización: ' + location + '.');
  if (angle)            parts.push('Enfoque: ' + angle + '.');

  return parts.join(' ');
}

// ── DROP ZONE ───────────────────────────────────────────────
function agentDragOver(e) {
  e.preventDefault();
  document.getElementById('agent-dropzone').classList.add('drag-over');
}
function agentDragLeave(e) {
  e.preventDefault();
  document.getElementById('agent-dropzone').classList.remove('drag-over');
}
function agentDrop(e) {
  e.preventDefault();
  document.getElementById('agent-dropzone').classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    agentApplyFile(file);
  }
}

// ── FILE SELECTION ──────────────────────────────────────────
function agentFileSelected(input) {
  var file = input.files[0];
  if (file) agentApplyFile(file);
}

function agentApplyFile(file) {
  agentPhotoMode = 'file';
  document.getElementById('agent-photo-name').textContent = file.name;
  var thumb = document.getElementById('agent-photo-thumb');
  if (file.type && file.type.startsWith('image/')) {
    thumb.src = URL.createObjectURL(file);
    thumb.style.display = '';
  } else {
    thumb.style.display = 'none';
  }
  document.getElementById('agent-dz-empty').style.display = 'none';
  document.getElementById('agent-dz-selected').style.display = 'flex';
}

function agentAudioSelected(input) {
  var file = input.files[0];
  if (!file) return;
  agentPhotoMode = 'none'; // audio not yet wired to backend
  document.getElementById('agent-photo-name').textContent = '🎙 ' + file.name;
  document.getElementById('agent-photo-thumb').style.display = 'none';
  document.getElementById('agent-dz-empty').style.display = 'none';
  document.getElementById('agent-dz-selected').style.display = 'flex';
}

function agentClearPhoto() {
  agentPhotoMode = 'none';
  document.getElementById('agent-photo-file').value = '';
  document.getElementById('agent-photo-url').value  = '';
  document.getElementById('agent-dz-empty').style.display    = 'flex';
  document.getElementById('agent-dz-selected').style.display = 'none';
  var thumb = document.getElementById('agent-photo-thumb');
  if (thumb.src.startsWith('blob:')) URL.revokeObjectURL(thumb.src);
  thumb.src = '';
}

// ── GOOGLE DRIVE POPUP ──────────────────────────────────────
function agentShowDrivePopup() {
  document.getElementById('agent-drive-overlay').style.display = '';
  document.getElementById('agent-drive-popup').style.display   = '';
  setTimeout(function() {
    var inp = document.getElementById('agent-photo-url');
    if (inp) inp.focus();
  }, 50);
}

function agentCloseDrivePopup() {
  document.getElementById('agent-drive-overlay').style.display = 'none';
  document.getElementById('agent-drive-popup').style.display   = 'none';
}

function agentConfirmDrive() {
  var url = (document.getElementById('agent-photo-url').value || '').trim();
  if (!url) { agentCloseDrivePopup(); return; }

  agentPhotoMode = 'drive';
  // Show as selected state with link icon
  document.getElementById('agent-photo-thumb').src = '';
  document.getElementById('agent-photo-thumb').style.display = 'none';
  document.getElementById('agent-photo-name').textContent = url.length > 48 ? url.slice(0,45)+'…' : url;
  document.getElementById('agent-dz-empty').style.display    = 'none';
  document.getElementById('agent-dz-selected').style.display = 'flex';
  agentCloseDrivePopup();
}

// ── GENERA CONTENUTO ────────────────────────────────────────
async function agentGenerate() {
  if (agentGenerating) return;

  var brief    = agentBuildBrief();
  var platform = document.getElementById('agent-platform').value;
  var num      = parseInt(document.getElementById('agent-num').value) || 3;

  if (!brief) {
    showToast('Scrivi un brief prima di generare');
    return;
  }

  // Determine if we're using the photo endpoint
  var photoUrl  = agentPhotoMode === 'drive' ? (document.getElementById('agent-photo-url').value || '').trim() : '';
  var photoFile = agentPhotoMode === 'file'  ? document.getElementById('agent-photo-file').files[0] : null;
  var usePhoto  = (agentPhotoMode === 'drive' && photoUrl) || (agentPhotoMode === 'file' && photoFile);

  agentGenerating = true;
  agentSetLoading(true);
  document.getElementById('agent-results').innerHTML = '';

  try {
    var data;

    if (usePhoto) {
      // ── Endpoint con foto ──────────────────────────────────
      var form = new FormData();
      form.append('brief', brief);
      form.append('platform', platform);
      form.append('num_variants', num);
      if (photoFile) {
        form.append('photo_file', photoFile);
      } else {
        form.append('photo_url', photoUrl);
      }

      var res = await fetch(BACKEND_URL + '/api/content/generate-with-photo', {
        method: 'POST',
        body: form
        // Note: no Content-Type header — browser sets multipart boundary automatically
      });

      if (!res.ok) {
        var errBody = await res.json().catch(function() { return {}; });
        throw new Error(errBody.detail || 'HTTP ' + res.status);
      }

      data = await res.json();
      lastGeneratedContents = [];
      agentRenderImageVariants(data.variants || []);
      showToast('Immagini generate — seleziona e approva');

    } else {
      // ── Endpoint solo testo ────────────────────────────────
      var res = await fetch(BACKEND_URL + '/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief:          brief,
          client_id:      'dakady',
          platform:       platform,
          num_contents:   num,
          generate_image: false
        })
      });

      if (!res.ok) throw new Error('HTTP ' + res.status);

      data = await res.json();
      lastGeneratedContents = data.contents || [];
      agentRenderResults(lastGeneratedContents);
      showToast('Contenuto generato — seleziona e approva');
    }

  } catch (e) {
    document.getElementById('agent-results').innerHTML =
      '<div class="agent-error">Errore: ' + (e.message || e) + '</div>';
    console.error('[AGENT] Errore:', e);
  } finally {
    agentGenerating = false;
    agentSetLoading(false);
  }
}

// ── RENDER: varianti con immagine composita ──────────────────
function agentRenderImageVariants(variants) {
  var el = document.getElementById('agent-results');
  if (!variants || variants.length === 0) {
    el.innerHTML = '<div class="agent-error">Nessuna variante generata.</div>';
    return;
  }

  el.innerHTML = variants.map(function(v, i) {
    var id = 'img-' + i;
    return '<div class="agent-card" id="agent-card-' + id + '">' +
      '<div class="agent-card-meta">' +
        '<span class="agent-pill">' + (v.pillar || '') + '</span>' +
        '<span class="agent-pill agent-pill-blue">' + (v.format || '') + '</span>' +
        '<span class="agent-pill agent-pill-gray">' + (v.layout_variant || '') + '</span>' +
      '</div>' +
      '<img src="data:image/jpeg;base64,' + v.img_b64 + '" style="width:100%;border-radius:8px;margin:0.5rem 0" alt="variante ' + (i+1) + '">' +
      '<div class="agent-card-headline">' + (v.headline || '') + '</div>' +
      (v.caption ? '<div class="agent-card-caption">' + v.caption.replace(/\n/g, '<br>') + '</div>' : '') +
      (v.agent_notes ? '<div class="agent-card-body" style="font-size:0.75rem;color:#666">' + v.agent_notes + '</div>' : '') +
      '<div class="agent-card-actions">' +
        '<button class="agent-btn-approve" onclick="agentDownloadVariant(' + i + ')">Descarga</button>' +
        '<span style="color:#555;font-size:0.8rem">Variante ' + (i+1) + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  // Store for download
  agentLastImageVariants = variants;
}

var agentLastImageVariants = [];

function agentDownloadVariant(idx) {
  var v = agentLastImageVariants[idx];
  if (!v) return;
  var link = document.createElement('a');
  link.href = 'data:image/jpeg;base64,' + v.img_b64;
  link.download = 'dakady-post-' + (idx + 1) + '.jpg';
  link.click();
}

// ── FEEDBACK ────────────────────────────────────────────────
async function agentFeedback(contentId, status, reason) {
  var content = lastGeneratedContents.find(function(c) { return c.content_id === contentId; });
  try {
    await fetch(BACKEND_URL + '/api/content/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id:       contentId,
        client_id:        'dakady',
        status:           status,
        rejection_reason: reason || null,
        original_brief:   agentBuildBrief(),
        headline:         content ? content.overlay.headline : null,
        layout_variant:   content ? content.overlay.layout_variant : null,
        pillar:           content ? content.pillar : null,
        caption_preview:  content ? content.caption.slice(0, 120) : null
      })
    });

    var card = document.getElementById('agent-card-' + contentId);
    if (card) {
      if (status === 'approved') {
        card.style.borderColor = 'var(--green, #2d7a4f)';
        card.querySelector('.agent-card-actions').innerHTML =
          '<span style="color:var(--green,#2d7a4f);font-weight:600">Approvato</span>';
        showToast('Approvato e salvato');
      } else {
        card.style.opacity = '0.45';
        card.querySelector('.agent-card-actions').innerHTML =
          '<span style="color:#888">Rifiutato</span>';
        showToast('Feedback salvato — migliorera la prossima generazione');
      }
    }
  } catch (e) {
    console.error('[AGENT] Feedback error:', e);
  }
}

function agentReject(contentId) {
  var reason = prompt('Motivo del rifiuto (opzionale):');
  agentFeedback(contentId, 'rejected', reason);
}

// ── RENDERING (solo testo) ───────────────────────────────────
function agentRenderResults(contents) {
  var el = document.getElementById('agent-results');
  if (!contents || contents.length === 0) {
    el.innerHTML = '<div class="agent-error">Nessun contenuto generato.</div>';
    return;
  }

  el.innerHTML = contents.map(function(c) {
    var headline = c.overlay ? c.overlay.headline : '';
    var body     = c.overlay && c.overlay.body ? c.overlay.body : '';
    var caption  = c.caption || '';
    var pillar   = c.pillar || '';
    var ctype    = c.content_type || '';
    var layout   = c.overlay ? c.overlay.layout_variant : '';
    var id       = c.content_id;

    return '<div class="agent-card" id="agent-card-' + id + '">' +
      '<div class="agent-card-meta">' +
        '<span class="agent-pill">' + pillar + '</span>' +
        '<span class="agent-pill agent-pill-blue">' + ctype + '</span>' +
        '<span class="agent-pill agent-pill-gray">' + layout + '</span>' +
      '</div>' +
      '<div class="agent-card-headline">' + headline + '</div>' +
      (body ? '<div class="agent-card-body">' + body + '</div>' : '') +
      '<div class="agent-card-caption">' + caption.replace(/\n/g, '<br>') + '</div>' +
      '<div class="agent-card-actions" id="agent-actions-' + id + '">' +
        '<button class="agent-btn-approve" onclick="agentFeedback(\'' + id + '\',\'approved\',null)">Approva</button>' +
        '<button class="agent-btn-reject"  onclick="agentReject(\'' + id + '\')">Rifiuta</button>' +
      '</div>' +
    '</div>';
  }).join('');
}

// ── UI HELPERS ──────────────────────────────────────────────
function agentSetLoading(on) {
  var btn = document.getElementById('agent-gen-btn');
  if (!btn) return;
  btn.disabled = on;
  // Usa innerHTML per non distruggere lo span spinner
  if (on) {
    btn.innerHTML = '<span style="display:inline-block;margin-right:4px">↻</span>Generando...';
  } else {
    btn.innerHTML = '<span id="agent-spinner" style="display:none">↻ </span>Genera';
  }
}
