// ============================================================
// bravo-agent.js — Integrazione backend AI DaKady
// Chiama Railway: https://bravoapp-production.up.railway.app
// ============================================================

var BACKEND_URL = (typeof window !== 'undefined' && window.BRAVO_BACKEND)
  ? window.BRAVO_BACKEND
  : (typeof BRAVO_API !== 'undefined' ? BRAVO_API : 'https://bravoapp-production.up.railway.app');
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
      var agCtx = document.getElementById('agent-client-ctx');
      var agClientId  = (agCtx && agCtx.dataset.clientId)  || 'dakady';
      var agClientKey = (agCtx && agCtx.dataset.clientKey) || 'dakady';

      var form = new FormData();
      form.append('brief', brief);
      form.append('platform', platform);
      form.append('num_variants', num);
      form.append('client_id', agClientKey || agClientId);
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
          client_id:      agClientKey || agClientId,
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

// ── SALVA CONTENUTO SU SUPABASE ─────────────────────────────
function agentGetCurrentBrief() {
  if (agentBriefMode === 'free') {
    return (document.getElementById('agent-brief-text') || {}).value || '';
  }
  return agentBuildBrief() || 'Brief generato da BRAVO';
}

function bravoImgSrc(v) {
  var ref = (v && v.image_url) || (v && v.img_b64) || '';
  if (!ref) return '';
  if (ref.startsWith('http') || ref.startsWith('data:')) return ref;
  return 'data:image/jpeg;base64,' + ref;
}

async function saveContentToSupabase(content, imgB64) {
  if (typeof db === 'undefined' || !dbConnected) {
    console.warn('[AGENT] Supabase non connesso — salvataggio saltato');
    return;
  }
  if (!content) {
    console.warn('[AGENT] Contenuto undefined — salvataggio saltato');
    return;
  }

  var overlay = content.overlay || {};

  // Solo colonne che esistono nella tabella generated_content
  var payload = {
    client_id:      (function(){ var ctx = document.getElementById('agent-client-ctx'); return (ctx && ctx.dataset.clientId) || (typeof clientUUIDFromKey === 'function' ? clientUUIDFromKey('dakady') : 'cc000001-0000-0000-0000-000000000001'); })(),
    platform:       content.platform        || 'Instagram',
    pillar:         content.pillar          || '',
    headline:       overlay.headline        || content.headline || '',
    body:           content.body            || '',
    caption:        content.caption         || '',
    layout_variant: overlay.layout_variant  || content.layout_variant || '',
    agent_notes:    content.agent_notes     || '',
    img_b64:        imgB64                  || null,
    generated_by:   'manual',
    status:         'approved'
  };

  var res = await db.from('generated_content').insert(payload);
  if (res.error) {
    console.error('[AGENT] Errore salvataggio contenuto:', res.error.message, payload);
    throw new Error(res.error.message);
  }
  console.log('[AGENT] ✓ Contenuto salvato in Supabase — client_id:', payload.client_id, 'headline:', payload.headline);
}

// ── RENDER: varianti come post Instagram ─────────────────────
function agentRenderImageVariants(variants) {
  var el = document.getElementById('agent-results');
  if (!variants || variants.length === 0) {
    el.innerHTML = '<div class="agent-error">Nessuna variante generata.</div>';
    return;
  }

  // Info cliente dal contesto
  var agCtx    = document.getElementById('agent-client-ctx');
  var clientId = agCtx ? (agCtx.dataset.clientId || '') : '';
  var username = agCtx ? ('@' + (agCtx.dataset.clientKey || 'dakady_oficial')) : '@dakady_oficial';

  function buildCard(v, i, logoHtml) {
    var imgSrc   = bravoImgSrc(v);
    var caption  = (v.caption || '').replace(/</g, '&lt;').replace(/\n/g, ' ');
    var headline = (v.headline || '').replace(/</g, '&lt;');

    return '<div class="agent-card ig-post-mock" id="agent-card-img-' + i + '">' +

      // Header: logo + username
      '<div class="ig-mock-header">' +
        '<div class="ig-mock-avatar" id="ig-av-' + i + '">' + logoHtml + '</div>' +
        '<span class="ig-mock-username">' + username + '</span>' +
        '<span class="ig-mock-dots">•••</span>' +
      '</div>' +

      // Foto generata
      (imgSrc
        ? '<img class="ig-mock-photo" src="' + imgSrc + '" alt="variante ' + (i+1) + '">'
        : '<div style="width:100%;aspect-ratio:4/5;background:#111;display:flex;align-items:center;justify-content:center;color:#444">No image</div>') +

      // Azioni Instagram
      '<div class="ig-mock-actions">' +
        '<span class="ig-mock-icon">♡</span>' +
        '<span class="ig-mock-icon">💬</span>' +
        '<span class="ig-mock-icon">✈</span>' +
        '<span style="margin-left:auto" class="ig-mock-icon">🔖</span>' +
      '</div>' +

      // Caption: headline in grassetto + testo Claude
      '<div class="ig-mock-caption">' +
        '<span class="ig-mock-caption-user">' + username + '</span>' +
        (headline ? '<strong>' + headline + '</strong> ' : '') +
        caption +
      '</div>' +

      // Pillole pillar/format
      '<div class="ig-mock-meta">' +
        (v.pillar ? '<span class="agent-pill">' + v.pillar + '</span>' : '') +
        (v.format ? '<span class="agent-pill agent-pill-blue">' + v.format + '</span>' : '') +
        (v.layout_variant ? '<span class="agent-pill agent-pill-gray">' + v.layout_variant + '</span>' : '') +
      '</div>' +

      // Pulsanti approva/scarica
      '<div class="ig-mock-actions-wrap" id="agent-img-actions-' + i + '">' +
        '<button class="agent-btn-approve" onclick="agentApproveImage(' + i + ')">✓ Approva</button>' +
        '<button class="agent-btn-reject"  onclick="agentDownloadVariant(' + i + ')">⬇ Descarga</button>' +
      '</div>' +

    '</div>';
  }

  // Render iniziale con iniziali
  var initials = username.replace('@','').slice(0,2).toUpperCase();
  el.innerHTML = variants.map(function(v, i) {
    return buildCard(v, i, initials);
  }).join('');

  agentLastImageVariants = variants;

  // Carica logo async e aggiorna tutti gli avatar
  if (clientId && typeof loadBrandKitImagesFromDB === 'function') {
    loadBrandKitImagesFromDB(clientId).then(function(imgs) {
      if (!imgs || !imgs.logo_b64) return;
      var src = typeof imgB64Src === 'function' ? imgB64Src(imgs.logo_b64) : '';
      if (!src) return;
      var logoImg = '<img src="' + src + '" style="width:100%;height:100%;object-fit:cover">';
      variants.forEach(function(_, i) {
        var av = document.getElementById('ig-av-' + i);
        if (av) { av.style.background = '#fff'; av.innerHTML = logoImg; }
      });
    });
  }
}

var agentLastImageVariants = [];

function agentApproveImage(idx) {
  var v = agentLastImageVariants[idx];
  if (!v) return;

  // Aggiorna UI subito
  var actions = document.getElementById('agent-img-actions-' + idx);
  if (actions) actions.innerHTML = '<span style="color:var(--green,#2d7a4f);font-weight:600;font-size:0.85rem">⏳ Salvando...</span>';
  var card = document.getElementById('agent-card-img-' + idx);
  if (card) card.style.borderColor = 'var(--green,#2d7a4f)';

  // Salva su Supabase (senza download automatico)
  saveContentToSupabase({
    platform:       v.platform      || 'Instagram',
    pillar:         v.pillar        || '',
    headline:       v.headline      || '',
    caption:        v.caption       || '',
    layout_variant: v.layout_variant || '',
    agent_notes:    v.agent_notes   || '',
    overlay:        { headline: v.headline, layout_variant: v.layout_variant }
  }, v.image_url || v.img_b64).then(function() {
    if (actions) actions.innerHTML = '<span style="color:var(--green,#2d7a4f);font-weight:700">✓ Guardado en Bravo</span>';
    showToast('✓ Contenido guardado — visible en la página del cliente');
  }).catch(function(err) {
    console.error('[AGENT] Error al guardar:', err);
    if (actions) actions.innerHTML = '<span style="color:var(--red,#D13B1E);font-weight:600">✗ Error al guardar</span>';
    showToast('Error al guardar el contenido');
  });
}

function agentDownloadVariant(idx) {
  var v = agentLastImageVariants[idx];
  if (!v) return;
  var link = document.createElement('a');
  link.href = v.image_url || ('data:image/jpeg;base64,' + v.img_b64);
  link.download = 'dakady-post-' + (idx + 1) + '.jpg';
  link.click();
}

// ── FEEDBACK ────────────────────────────────────────────────
async function agentFeedback(contentId, status, reason) {
  var content = lastGeneratedContents.find(function(c) { return c.content_id === contentId; });

  // ── 1. Salva su Supabase SUBITO (non dipende da Railway) ──
  if (status === 'approved') {
    saveContentToSupabase(content, null).catch(function(err) {
      console.error('[AGENT] Error guardando contenido:', err);
      showToast('Error al guardar el contenido');
    });
  }

  // ── 2. Aggiorna UI ────────────────────────────────────────
  var card = document.getElementById('agent-card-' + contentId);
  if (card) {
    if (status === 'approved') {
      card.style.borderColor = 'var(--green, #2d7a4f)';
      card.querySelector('.agent-card-actions').innerHTML =
        '<span style="color:var(--green,#2d7a4f);font-weight:600">✓ Aprobado y guardado</span>';
      showToast('Aprobado y guardado');
    } else {
      card.style.opacity = '0.45';
      card.querySelector('.agent-card-actions').innerHTML =
        '<span style="color:#888">Rifiutato</span>';
      showToast('Feedback salvato — migliorera la prossima generazione');
    }
  }

  // ── 3. Invia feedback a Railway (best-effort, non blocca) ─
  try {
    var overlay = content && content.overlay ? content.overlay : {};
    fetch(BACKEND_URL + '/api/content/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id:       contentId,
        client_id:        'dakady',
        status:           status,
        rejection_reason: reason || null,
        original_brief:   agentGetCurrentBrief(),
        headline:         overlay.headline      || null,
        layout_variant:   overlay.layout_variant || null,
        pillar:           content ? content.pillar : null,
        caption_preview:  content && content.caption ? content.caption.slice(0, 120) : null
      })
    }).catch(function(e) {
      console.warn('[AGENT] Railway feedback non raggiunto (ignorato):', e.message);
    });
  } catch (e) {
    console.warn('[AGENT] Errore invio feedback Railway:', e);
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
