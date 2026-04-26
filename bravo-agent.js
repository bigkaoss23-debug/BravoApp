// ============================================================
// bravo-agent.js — Integrazione backend AI DaKady
// Chiama Railway: https://bravoapp-production.up.railway.app
// ============================================================

var BACKEND_URL = (typeof window !== 'undefined' && window.BRAVO_BACKEND)
  ? window.BRAVO_BACKEND
  : (typeof BRAVO_API !== 'undefined' ? BRAVO_API : 'https://bravoapp-production.up.railway.app');
var agentGenerating = false;
var lastGeneratedContents = [];
var agentPhotoMode = 'none'; // legacy compat

// ── PIPELINE ────────────────────────────────────────────────
var agentPipelineMode = localStorage.getItem('bravo_pipeline_mode') || 'manual';
var agentPipelineConfig = (function() {
  try { return JSON.parse(localStorage.getItem('bravo_pipeline_config')) || null; } catch(e) { return null; }
})() || { publications: [
  { format: 'post_instagram' },
  { format: 'story_instagram' },
  { format: 'carousel' }
]};

var _PIPELINE_FORMATS = [
  { value: 'post_instagram',  label: '📷 Post Instagram' },
  { value: 'story_instagram', label: '📱 Historia Instagram' },
  { value: 'carousel',        label: '🎠 Carosello IG' },
  { value: 'reel_instagram',  label: '🎬 Reel Instagram' },
  { value: 'post_linkedin',   label: '💼 LinkedIn' },
  { value: 'post_facebook',   label: '👥 Facebook' },
  { value: 'post_tiktok',     label: '🎵 TikTok' }
];

function setPipelineMode(mode) {
  agentPipelineMode = mode;
  localStorage.setItem('bravo_pipeline_mode', mode);
  var manBtn  = document.getElementById('pipeline-mode-manual-btn');
  var autoBtn = document.getElementById('pipeline-mode-auto-btn');
  if (manBtn)  { manBtn.style.background  = mode === 'manual' ? '#1F2A24' : '#fff'; manBtn.style.color  = mode === 'manual' ? '#C29547' : '#888'; }
  if (autoBtn) { autoBtn.style.background = mode === 'auto'   ? '#1F2A24' : '#fff'; autoBtn.style.color = mode === 'auto'   ? '#C29547' : '#888'; }
  // Aggiorna label nel modal se aperto
  var mManBtn  = document.getElementById('pipeline-modal-mode-manual');
  var mAutoBtn = document.getElementById('pipeline-modal-mode-auto');
  if (mManBtn)  { mManBtn.style.background  = mode === 'manual' ? '#1F2A24' : '#fff'; mManBtn.style.color  = mode === 'manual' ? '#C29547' : '#888'; }
  if (mAutoBtn) { mAutoBtn.style.background = mode === 'auto'   ? '#1F2A24' : '#fff'; mAutoBtn.style.color = mode === 'auto'   ? '#C29547' : '#888'; }
  var desc = document.getElementById('pipeline-modal-mode-desc');
  if (desc) desc.innerHTML = mode === 'manual'
    ? '👤 <strong>Manual</strong>: tú lanzas el pipeline cuando quieres. Ideal para pruebas.'
    : '🤖 <strong>Automático</strong>: el sistema genera contenido cada día según el calendario.';
}

function _pipelineFormatOptions(selected) {
  return _PIPELINE_FORMATS.map(function(f) {
    return '<option value="' + f.value + '"' + (f.value === selected ? ' selected' : '') + '>' + f.label + '</option>';
  }).join('');
}

function _renderPipelinePubsList() {
  return agentPipelineConfig.publications.map(function(p, i) {
    var canRemove = agentPipelineConfig.publications.length > 1;
    return '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
      '<div style="width:22px;height:22px;border-radius:50%;background:#e0dbd2;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;color:#888;flex-shrink:0">' + (i+1) + '</div>' +
      '<select onchange="agentPipelineSetFormat(' + i + ',this.value)" style="flex:1;padding:0.4rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:8px;font-size:0.82rem;background:#fff;color:#1F2A24">' +
        _pipelineFormatOptions(p.format) +
      '</select>' +
      (canRemove ? '<button onclick="agentPipelineRemovePub(' + i + ')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:1.1rem;padding:0 0.3rem;flex-shrink:0">×</button>' : '<div style="width:24px"></div>') +
    '</div>';
  }).join('');
}

function agentPipelineSetFormat(idx, val) {
  agentPipelineConfig.publications[idx].format = val;
  localStorage.setItem('bravo_pipeline_config', JSON.stringify(agentPipelineConfig));
}

function agentPipelineAddPub() {
  agentPipelineConfig.publications.push({ format: 'post_instagram' });
  localStorage.setItem('bravo_pipeline_config', JSON.stringify(agentPipelineConfig));
  var list = document.getElementById('pipeline-pubs-list');
  if (list) list.innerHTML = _renderPipelinePubsList();
}

function agentPipelineRemovePub(idx) {
  agentPipelineConfig.publications.splice(idx, 1);
  localStorage.setItem('bravo_pipeline_config', JSON.stringify(agentPipelineConfig));
  var list = document.getElementById('pipeline-pubs-list');
  if (list) list.innerHTML = _renderPipelinePubsList();
}

function openPipelineModal() {
  var existing = document.getElementById('pipeline-modal-overlay');
  if (existing) existing.remove();

  var n = agentPipelineConfig.publications.length;
  var overlay = document.createElement('div');
  overlay.id = 'pipeline-modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1200;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:460px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.25)">' +
      '<div style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);padding:1.2rem 1.4rem;display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div style="color:#C29547;font-size:1rem;font-weight:700">✦ Configurar pipeline</div>' +
          '<div style="color:#aaa;font-size:0.75rem;margin-top:0.15rem">Elige qué publicar y cómo lanzarlo</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'pipeline-modal-overlay\').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1rem;line-height:1">✕</button>' +
      '</div>' +
      '<div style="padding:1.4rem">' +
        '<div style="font-size:0.72rem;font-weight:700;color:#1F2A24;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.6rem">Publicaciones a crear</div>' +
        '<div style="font-size:0.72rem;color:#888;margin-bottom:0.8rem">Una fila = un contenido. El pipeline los genera en orden con las fotos cargadas.</div>' +
        '<div id="pipeline-pubs-list">' + _renderPipelinePubsList() + '</div>' +
        '<button onclick="agentPipelineAddPub()" style="width:100%;padding:0.45rem;border:1.5px dashed #e0dbd2;border-radius:8px;background:#fafaf8;color:#888;cursor:pointer;font-size:0.8rem;margin-bottom:1.4rem">+ Añadir tipo de contenido</button>' +
        '<div style="font-size:0.72rem;font-weight:700;color:#1F2A24;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.6rem">Modo de producción</div>' +
        '<div style="display:flex;border:1.5px solid #e0dbd2;border-radius:10px;overflow:hidden;margin-bottom:0.6rem">' +
          '<button id="pipeline-modal-mode-manual" onclick="setPipelineMode(\'manual\')" style="flex:1;padding:0.6rem;font-size:0.82rem;font-weight:600;border:none;cursor:pointer;background:' + (agentPipelineMode==='manual'?'#1F2A24':'#fff') + ';color:' + (agentPipelineMode==='manual'?'#C29547':'#888') + '">👤 Manual</button>' +
          '<button id="pipeline-modal-mode-auto" onclick="setPipelineMode(\'auto\')" style="flex:1;padding:0.6rem;font-size:0.82rem;font-weight:600;border:none;border-left:1.5px solid #e0dbd2;cursor:pointer;background:' + (agentPipelineMode==='auto'?'#1F2A24':'#fff') + ';color:' + (agentPipelineMode==='auto'?'#C29547':'#888') + '">🤖 Automático</button>' +
        '</div>' +
        '<div id="pipeline-modal-mode-desc" style="font-size:0.72rem;color:#888;margin-bottom:1.4rem;line-height:1.5">' +
          (agentPipelineMode==='manual'
            ? '👤 <strong>Manual</strong>: tú lanzas el pipeline cuando quieres. Ideal para pruebas.'
            : '🤖 <strong>Automático</strong>: el sistema genera contenido cada día según el calendario.') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.7rem;padding:0 1.4rem 1.4rem">' +
        '<button onclick="document.getElementById(\'pipeline-modal-overlay\').remove()" style="flex:1;padding:0.65rem;border:1.5px solid #e0dbd2;border-radius:10px;background:#f5f3ef;color:#555;cursor:pointer;font-size:0.85rem">Cancelar</button>' +
        '<button onclick="launchPipeline()" style="flex:2;padding:0.65rem;border:none;border-radius:10px;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;font-weight:700;cursor:pointer;font-size:0.85rem">✦ Lanzar — ' + n + ' contenido' + (n>1?'s':'') + '</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);
}

async function launchPipeline() {
  if (agentPhotos.length === 0) { showToast('⚠️ Carga al menos una foto antes'); return; }
  localStorage.setItem('bravo_pipeline_config', JSON.stringify(agentPipelineConfig));

  var overlay = document.getElementById('pipeline-modal-overlay');
  if (overlay) overlay.remove();

  var pubs   = agentPipelineConfig.publications;
  var prog   = document.getElementById('pipeline-progress');
  var bar    = document.getElementById('agent-pipeline-bar');
  if (prog) { prog.style.display = ''; prog.innerHTML = '⏳ Iniciando pipeline…'; }

  for (var i = 0; i < pubs.length; i++) {
    var pub = pubs[i];
    var label = (_PIPELINE_FORMATS.find(function(f){ return f.value === pub.format; }) || { label: pub.format }).label;
    if (prog) prog.innerHTML = '⏳ (' + (i+1) + '/' + pubs.length + ') Generando ' + label + '…';

    var formatSel = document.getElementById('agent-format-select');
    if (formatSel) { formatSel.value = pub.format; agentFormatChange(); }

    await agentGenerate();
    await new Promise(function(r){ setTimeout(r, 800); });
  }

  if (prog) prog.innerHTML = '✅ Pipeline completado — ' + pubs.length + ' contenido' + (pubs.length>1?'s':'') + ' generado' + (pubs.length>1?'s':'');
  showToast('✅ Pipeline completado!');
}

// ── SISTEMA MULTI-FOTO ──────────────────────────────────────
var agentPhotos = []; // [{file, objectUrl, subBrief, name}]
var agentSubBriefIdx = -1;
var AGENT_MAX_PHOTOS = 5;

function agentAddPhotoClick() {
  if (agentPhotos.length >= AGENT_MAX_PHOTOS) {
    showToast('Máximo ' + AGENT_MAX_PHOTOS + ' fotos');
    return;
  }
  document.getElementById('agent-multi-file').click();
}

function agentMultiFileSelected(input) {
  var files = Array.from(input.files || []);
  files.forEach(function(file) {
    if (agentPhotos.length >= AGENT_MAX_PHOTOS) return;
    if (!file.type.startsWith('image/')) return;
    agentPhotos.push({ file: file, objectUrl: URL.createObjectURL(file), subBrief: '', name: file.name });
  });
  input.value = '';
  agentRenderPhotoGrid();
}

function agentRemovePhoto(idx) {
  var p = agentPhotos[idx];
  if (p && p.objectUrl && p.objectUrl.startsWith('blob:')) URL.revokeObjectURL(p.objectUrl);
  agentPhotos.splice(idx, 1);
  agentRenderPhotoGrid();
}

function agentOpenSubBrief(idx) {
  agentSubBriefIdx = idx;
  document.getElementById('agent-subbrief-text').value = agentPhotos[idx].subBrief || '';
  document.getElementById('agent-subbrief-overlay').style.display = '';
  document.getElementById('agent-subbrief-popup').style.display = '';
  setTimeout(function() { document.getElementById('agent-subbrief-text').focus(); }, 50);
}

function agentSaveSubBrief() {
  if (agentSubBriefIdx >= 0 && agentPhotos[agentSubBriefIdx]) {
    agentPhotos[agentSubBriefIdx].subBrief = (document.getElementById('agent-subbrief-text').value || '').trim();
    agentRenderPhotoGrid();
  }
  agentCloseSubBrief();
}

function agentCloseSubBrief() {
  agentSubBriefIdx = -1;
  document.getElementById('agent-subbrief-overlay').style.display = 'none';
  document.getElementById('agent-subbrief-popup').style.display = 'none';
}

function agentRenderPhotoGrid() {
  var grid = document.getElementById('agent-photos-grid');
  if (!grid) return;
  var cards = agentPhotos.map(function(p, i) {
    var label = p.subBrief ? ('📝 ' + p.subBrief.slice(0, 22) + (p.subBrief.length > 22 ? '…' : '')) : '+ Brief';
    return '<div class="agent-photo-card">' +
      '<button class="agent-photo-remove" onclick="agentRemovePhoto(' + i + ')">×</button>' +
      '<img class="agent-photo-thumb-card" src="' + p.objectUrl + '" alt="foto ' + (i+1) + '">' +
      '<button class="agent-photo-brief-btn' + (p.subBrief ? ' has-brief' : '') + '" onclick="agentOpenSubBrief(' + i + ')">' + label + '</button>' +
    '</div>';
  }).join('');
  var addBtn = agentPhotos.length < AGENT_MAX_PHOTOS
    ? '<div class="agent-photo-add" onclick="agentAddPhotoClick()"><div class="agent-photo-add-icon">+</div><div class="agent-photo-add-text">Añadir foto</div></div>'
    : '';
  grid.innerHTML = cards + addBtn;

  // Mostra/nascondi pipeline bar
  var pipelineBar = document.getElementById('agent-pipeline-bar');
  if (pipelineBar) {
    pipelineBar.style.display = agentPhotos.length > 0 ? '' : 'none';
    setPipelineMode(agentPipelineMode); // sync pulsanti
  }

  // Variantes: visibile solo con 0-1 foto e formato non-carosello
  agentUpdateVariantsVisibility();
}

function agentUpdateVariantsVisibility() {
  var varEl = document.getElementById('agent-num');
  var fmt   = (document.getElementById('agent-format-select') || {}).value || '';
  if (!varEl) return;
  // Nascondi se: più foto caricate (1 post per foto) O formato carosello
  var hide = agentPhotos.length > 1 || fmt === 'carousel';
  varEl.style.display = hide ? 'none' : '';
}

function agentFormatChange() {
  agentUpdateVariantsVisibility();
}

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

// ── TOGGLE TIPO CONTENUTO (Post / Carosello) ────────────────
function agentContentTypeChange() {
  var type = document.getElementById('agent-content-type').value;
  var isCarousel = type === 'carousel';
  document.getElementById('agent-ctrl-platform').style.display  = isCarousel ? 'none' : '';
  document.getElementById('agent-ctrl-variants').style.display  = isCarousel ? 'none' : '';
  document.getElementById('agent-ctrl-slides').style.display    = isCarousel ? '' : 'none';
}

// ── GENERA CONTENUTO ────────────────────────────────────────
async function agentGenerate() {
  if (agentGenerating) return;

  // Legge il nuovo selettore formato unificato
  var formatVal = (document.getElementById('agent-format-select') || {}).value || 'post_instagram';
  var contentType = formatVal === 'carousel' ? 'carousel' : 'post';
  var platform = formatVal === 'post_linkedin' ? 'LinkedIn'
               : formatVal === 'post_tiktok'   ? 'TikTok'
               : formatVal === 'post_facebook'  ? 'Facebook'
               : 'Instagram';

  var brief    = agentBuildBrief();
  var num      = parseInt((document.getElementById('agent-num') || {}).value) || 3;

  // Arricchisce il brief con i sub-brief delle foto
  if (agentPhotos.length > 0) {
    var photoCtx = agentPhotos
      .map(function(p, i) { return p.subBrief ? ('Foto ' + (i+1) + ': ' + p.subBrief) : null; })
      .filter(Boolean).join('. ');
    if (photoCtx) brief = brief ? brief + '. ' + photoCtx : photoCtx;
  }

  // ── Branch carosello ──────────────────────────────────────
  if (contentType === 'carousel') {
    if (!brief) { showToast('Scrivi un brief prima di generare'); return; }
    var agCtx2 = document.getElementById('agent-client-ctx');
    var carClientId = (agCtx2 && agCtx2.dataset.clientKey) || (agCtx2 && agCtx2.dataset.clientId) || 'altair';
    var numSlides = parseInt((document.getElementById('agent-num-slides') || {}).value) || 6;

    agentGenerating = true;
    agentSetLoading(true);
    document.getElementById('agent-results').innerHTML = '';
    try {
      var form = new FormData();
      form.append('brief', brief);
      form.append('client_id', carClientId);
      form.append('num_slides', numSlides);

      var res = await fetch(BACKEND_URL + '/api/content/generate-carousel', {
        method: 'POST', body: form
      });
      if (!res.ok) {
        var errBody = await res.json().catch(function() { return {}; });
        throw new Error(errBody.detail || 'HTTP ' + res.status);
      }
      var data = await res.json();
      agentRenderCarousel(data);
      showToast('Carosello generato — ' + numSlides + ' slide');
    } catch(e) {
      document.getElementById('agent-results').innerHTML =
        '<div class="agent-error">Errore carosello: ' + (e.message || e) + '</div>';
    } finally {
      agentGenerating = false;
      agentSetLoading(false);
    }
    return;
  }

  if (!brief) {
    showToast('Scrivi un brief prima di generare');
    return;
  }

  // Multi-foto: usa tutte le foto caricate
  var usePhoto = agentPhotos.length > 0;
  var photoFile = agentPhotos.length === 1 ? agentPhotos[0].file : null;
  var photoUrl  = '';

  agentGenerating = true;
  agentSetLoading(true);
  document.getElementById('agent-results').innerHTML = '';

  try {
    var data;

    if (usePhoto) {
      // ── Endpoint con foto (singola o multipla) ─────────────
      var agCtx = document.getElementById('agent-client-ctx');
      var agClientId  = (agCtx && agCtx.dataset.clientId)  || 'dakady';
      var agClientKey = (agCtx && agCtx.dataset.clientKey) || 'dakady';

      var form = new FormData();
      form.append('brief', brief);
      form.append('platform', platform);
      form.append('client_id', agClientKey || agClientId);

      if (agentPhotos.length === 1) {
        // 1 foto → N varianti
        form.append('num_variants', num);
        form.append('photo_file', agentPhotos[0].file);
      } else {
        // Più foto → 1 post per foto (piano settimanale)
        form.append('num_variants', 1);
        agentPhotos.forEach(function(p) {
          form.append('photo_files', p.file);
        });
        var briefs = agentPhotos.map(function(p) { return p.subBrief || ''; });
        form.append('photo_briefs', JSON.stringify(briefs));
      }

      var multiPhoto = agentPhotos.length > 1;
      if (multiPhoto) {
        showToast('Analizzando ' + agentPhotos.length + ' foto — potrebbe richiedere qualche minuto...');
      }

      var res = await fetch(BACKEND_URL + '/api/content/generate-with-photo', {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        var errBody = await res.json().catch(function() { return {}; });
        throw new Error(errBody.detail || 'HTTP ' + res.status);
      }

      data = await res.json();
      lastGeneratedContents = [];
      agentRenderImageVariants(data.variants || []);
      var msg = multiPhoto
        ? (data.variants || []).length + ' post generati — uno per foto'
        : 'Immagini generate — seleziona e approva';
      showToast(msg);

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
    format:         content.format          || '',
    content_type:   content.content_type    || '',
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

// ── RENDER: carosello HTML in iframe ─────────────────────────
function agentRenderCarousel(data) {
  var el = document.getElementById('agent-results');
  var html = data.carousel_html || '';
  var caption = data.caption || '';
  var slides = data.slides || [];

  // Encode HTML as blob URL for iframe
  var blob = new Blob([html], { type: 'text/html' });
  var blobUrl = URL.createObjectURL(blob);

  var slidePreview = slides.map(function(s, i) {
    return '<span style="font-size:0.7rem;color:#999;margin-right:8px;">' +
      (i+1) + '. <b style="color:#C4A06A">' + (s.headline || '') + '</b>' +
      (s.h2 ? ' ' + s.h2 : '') + '</span>';
  }).join('');

  el.innerHTML =
    '<div style="padding:1rem">' +
      '<div style="font-size:0.7rem;font-weight:700;letter-spacing:.08em;color:#999;text-transform:uppercase;margin-bottom:0.75rem">Carosello · ' + slides.length + ' slide</div>' +
      '<iframe src="' + blobUrl + '" style="width:100%;height:520px;border:none;border-radius:12px;background:#0A0E13;" allowfullscreen></iframe>' +
      '<div style="margin-top:0.75rem;padding:0.6rem;background:#f5f3ef;border-radius:8px;font-size:0.72rem;color:#666;line-height:1.5;">' +
        slidePreview +
      '</div>' +
      (caption ? '<div style="margin-top:0.75rem">' +
        '<div style="font-size:0.7rem;font-weight:700;color:#999;letter-spacing:.08em;text-transform:uppercase;margin-bottom:0.4rem">Caption Instagram</div>' +
        '<div style="font-size:0.8rem;color:#444;white-space:pre-line;background:#fff;border:1px solid #e0dbd2;border-radius:8px;padding:0.75rem">' + caption + '</div>' +
        '<button onclick="navigator.clipboard.writeText(this.dataset.txt);showToast(\'Caption copiata\')" data-txt="' + caption.replace(/"/g, '&quot;') + '" style="margin-top:0.5rem;font-size:0.72rem;padding:0.3rem 0.8rem;border:1px solid #ddd;border-radius:20px;background:#fff;cursor:pointer;color:#666">Copia caption</button>' +
      '</div>' : '') +
    '</div>';
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
    platform:       v.platform       || 'Instagram',
    pillar:         v.pillar         || '',
    format:         v.format         || '',
    content_type:   v.content_type   || '',
    headline:       v.headline       || '',
    body:           v.body           || '',
    caption:        v.caption        || '',
    layout_variant: v.layout_variant || '',
    agent_notes:    v.agent_notes    || '',
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
  btn.innerHTML = on
    ? '<span style="display:inline-block;margin-right:6px;animation:spin 1s linear infinite">↻</span>Generando...'
    : '<span id="agent-spinner" style="display:none">↻ </span>Genera';
}
