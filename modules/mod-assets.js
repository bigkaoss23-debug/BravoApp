// ============================================================
// MOD-ASSETS — Tab Assets: librería de archivos por cliente
// Lazy-loaded quando si apre il tab Assets
// ============================================================

// ============================================================
// ASSET LIBRARY — Tab Assets per cliente
// ============================================================

var _assetsCache = {};  // { clientId: [asset, ...] }

function renderAssetsSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  var html =
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.25rem">' +

    // ── Header
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem">' +
      '<div>' +
        '<div class="cliente-section-title" style="margin:0">🖼️ Librería de assets</div>' +
        '<div id="assets-meta-' + clientId + '" style="font-size:0.75rem;color:#888;margin-top:0.15rem">Cargando...</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">' +
        '<select id="assets-filter-' + clientId + '" onchange="assetsLoad(\'' + clientId + '\')" ' +
          'style="padding:0.35rem 0.6rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem;background:#fff">' +
          '<option value="">Todos los tipos</option>' +
          '<option value="photo">📸 Fotos</option>' +
          '<option value="video">🎬 Videos</option>' +
          '<option value="logo">🏷️ Logos</option>' +
          '<option value="doc">📄 Documentos</option>' +
        '</select>' +
        '<label class="bk-adopt-btn" style="cursor:pointer">' +
          '+ Subir archivo' +
          '<input type="file" id="assets-upload-input-' + clientId + '" multiple accept="image/*,video/*,.pdf,.svg" style="display:none" ' +
            'onchange="assetsHandleUpload(this,\'' + clientId + '\')">' +
        '</label>' +
      '</div>' +
    '</div>' +

    // ── Drop zone upload
    '<div id="assets-dropzone-' + clientId + '" ' +
      'style="border:2px dashed #e0dbd2;border-radius:10px;padding:1.2rem;text-align:center;background:#faf9f7;cursor:pointer;transition:all 0.2s" ' +
      'onclick="document.getElementById(\'assets-upload-input-' + clientId + '\').click()" ' +
      'ondragover="event.preventDefault();this.style.borderColor=\'#C0392B\';this.style.background=\'#fff5f3\'" ' +
      'ondragleave="this.style.borderColor=\'#e0dbd2\';this.style.background=\'#faf9f7\'" ' +
      'ondrop="assetsHandleDrop(event,\'' + clientId + '\')">' +
      '<div style="font-size:1.5rem;margin-bottom:0.3rem">📁</div>' +
      '<div style="font-size:0.82rem;color:#888">Arrastra aquí fotos, videos o logos — o toca para seleccionar</div>' +
      '<div style="font-size:0.72rem;color:#aaa;margin-top:0.2rem">JPG, PNG, MP4, SVG, PDF · múltiples archivos a la vez</div>' +
    '</div>' +

    // ── Progress upload
    '<div id="assets-upload-progress-' + clientId + '" style="display:none">' +
      '<div style="font-size:0.78rem;color:#555;margin-bottom:0.4rem" id="assets-upload-label-' + clientId + '">Subiendo...</div>' +
      '<div style="background:#f0ece6;border-radius:4px;height:6px;overflow:hidden">' +
        '<div id="assets-upload-bar-' + clientId + '" style="height:100%;background:#C0392B;border-radius:4px;transition:width 0.3s;width:0%"></div>' +
      '</div>' +
    '</div>' +

    // ── Griglia asset
    '<div id="assets-grid-' + clientId + '">' +
      '<div style="color:#888;font-size:0.82rem;padding:2rem;text-align:center">Cargando assets...</div>' +
    '</div>' +

    '</div>';

  setTimeout(function(){ assetsLoad(clientId); }, 80);
  return html;
}

function assetsLoad(clientId) {
  var meta   = document.getElementById('assets-meta-' + clientId);
  var filter = document.getElementById('assets-filter-' + clientId);
  var type   = filter ? filter.value : '';
  var url    = BRAVO_API + '/api/assets/' + encodeURIComponent(clientId);
  if (type) url += '?type=' + type;

  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d.ok) { if (meta) meta.textContent = '❌ ' + d.error; return; }
      _assetsCache[clientId] = d.assets || [];
      var count = d.assets.length;
      if (meta) meta.textContent = count + ' asset' + (count !== 1 ? 's' : '') + (type ? ' · ' + type : '');
      assetsRenderGrid(clientId, d.assets);
    })
    .catch(function(e){ if (meta) meta.textContent = '❌ Error de conexión'; });
}

function assetsRenderGrid(clientId, assets) {
  var grid = document.getElementById('assets-grid-' + clientId);
  if (!grid) return;

  if (!assets || !assets.length) {
    grid.innerHTML =
      '<div style="text-align:center;padding:3rem 1rem;color:#aaa">' +
        '<div style="font-size:2rem;margin-bottom:0.5rem">🖼️</div>' +
        '<div style="font-weight:600;color:#888;margin-bottom:0.3rem">Librería vacía</div>' +
        '<div style="font-size:0.75rem">Sube fotos, logos y videos del cliente para reutilizarlos en cada generación</div>' +
      '</div>';
    return;
  }

  var typeIco = { photo:'📸', video:'🎬', logo:'🏷️', doc:'📄' };

  grid.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.8rem">' +
    assets.map(function(a) {
      var isImg = a.type === 'photo' || a.type === 'logo';
      var ico   = typeIco[a.type] || '📎';
      var tags  = (a.tags || []).map(function(t){
        return '<span style="background:#f0ece6;border-radius:4px;padding:0.1rem 0.35rem;font-size:0.62rem;color:#666">' + t + '</span>';
      }).join(' ');
      var name  = a.filename.length > 22 ? a.filename.slice(0,20) + '…' : a.filename;

      return '<div class="asset-card" style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;overflow:hidden;position:relative;cursor:pointer" ' +
        'onclick="assetsSelectForAgent(\'' + clientId + '\',\'' + a.id + '\')">' +

        // Thumbnail
        (isImg
          ? '<div style="aspect-ratio:1/1;background:#f0ece6;overflow:hidden"><img src="' + a.public_url + '" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML=\'<div style=&quot;display:flex;align-items:center;justify-content:center;height:100%;font-size:2rem&quot;>' + ico + '</div>\'"></div>'
          : '<div style="aspect-ratio:1/1;background:#f0ece6;display:flex;align-items:center;justify-content:center;font-size:2.5rem">' + ico + '</div>') +

        // Info
        '<div style="padding:0.45rem 0.5rem">' +
          '<div style="font-size:0.7rem;font-weight:600;color:#2a2a2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:0.2rem">' + name + '</div>' +
          (tags ? '<div style="display:flex;flex-wrap:wrap;gap:0.2rem">' + tags + '</div>' : '') +
        '</div>' +

        // Pulsante elimina — sempre visibile
        '<button onclick="event.stopPropagation();assetsDelete(\'' + clientId + '\',\'' + a.id + '\')" ' +
          'style="position:absolute;top:4px;right:4px;background:#e74c3c;color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:0.65rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.25)" ' +
          'onmouseover="this.style.background=\'#c0392b\'" onmouseout="this.style.background=\'#e74c3c\'" ' +
          'title="Eliminar">✕</button>' +

      '</div>';
    }).join('') +
    '</div>';

  // Mostra il tasto elimina sull'hover della card
  grid.querySelectorAll('.asset-card').forEach(function(card) {
    var btn = card.querySelector('.asset-del-btn');
    if (!btn) return;
    card.addEventListener('mouseenter', function(){ btn.style.display = 'flex'; });
    card.addEventListener('mouseleave', function(){ btn.style.display = 'none'; });
  });
}

function assetsHandleDrop(event, clientId) {
  event.preventDefault();
  var dz = document.getElementById('assets-dropzone-' + clientId);
  if (dz) { dz.style.borderColor = '#e0dbd2'; dz.style.background = '#faf9f7'; }
  var files = Array.from(event.dataTransfer.files || []);
  if (files.length) assetsUploadFiles(clientId, files);
}

function assetsHandleUpload(input, clientId) {
  var files = Array.from(input.files || []);
  if (files.length) assetsUploadFiles(clientId, files);
  input.value = '';
}

async function assetsUploadFiles(clientId, files) {
  var progressWrap = document.getElementById('assets-upload-progress-' + clientId);
  var bar          = document.getElementById('assets-upload-bar-' + clientId);
  var label        = document.getElementById('assets-upload-label-' + clientId);
  if (progressWrap) progressWrap.style.display = 'block';

  var done = 0;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    if (label) label.textContent = 'Subiendo ' + (i+1) + ' de ' + files.length + ': ' + file.name;
    if (bar)   bar.style.width   = Math.round((i / files.length) * 100) + '%';

    // Determina tipo
    var type = 'photo';
    if (file.type.startsWith('video/'))       type = 'video';
    else if (file.type === 'image/svg+xml')   type = 'logo';
    else if (file.type === 'application/pdf') type = 'doc';

    var form = new FormData();
    form.append('file', file);
    form.append('type', type);

    try {
      var resp = await fetch(BRAVO_API + '/api/assets/' + encodeURIComponent(clientId) + '/upload', {
        method: 'POST',
        body:   form,
      });
      var data = await resp.json();
      if (data.ok && data.asset) {
        if (!_assetsCache[clientId]) _assetsCache[clientId] = [];
        _assetsCache[clientId].unshift(data.asset);
        done++;
      }
    } catch(e) {
      console.error('[ASSETS] upload error:', e);
    }
  }

  if (bar)   bar.style.width = '100%';
  if (label) label.textContent = '✅ ' + done + ' de ' + files.length + ' subidos';
  setTimeout(function(){
    if (progressWrap) progressWrap.style.display = 'none';
    assetsRenderGrid(clientId, _assetsCache[clientId] || []);
    var meta = document.getElementById('assets-meta-' + clientId);
    if (meta) meta.textContent = (_assetsCache[clientId] || []).length + ' assets';
  }, 1200);
}

async function assetsDelete(clientId, assetId) {
  if (!confirm('¿Eliminar este asset de la librería?')) return;
  try {
    var resp = await fetch(BRAVO_API + '/api/assets/' + encodeURIComponent(assetId), { method: 'DELETE' });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error);
    if (_assetsCache[clientId]) {
      _assetsCache[clientId] = _assetsCache[clientId].filter(function(a){ return a.id !== assetId; });
      assetsRenderGrid(clientId, _assetsCache[clientId]);
    }
    showToast('Asset eliminado');
  } catch(e) {
    showToast('❌ ' + e.message);
  }
}

// ── Seleziona un asset dalla libreria e usalo nel form Agente ─────────────────

function assetsSelectForAgent(clientId, assetId) {
  var asset = (_assetsCache[clientId] || []).find(function(a){ return a.id === assetId; });
  if (!asset) return;

  // Carica l'immagine come blob e mostra preview nella dropzone dell'Agente
  fetch(asset.public_url)
    .then(function(r){ return r.blob(); })
    .then(function(blob) {
      var file = new File([blob], asset.filename, { type: blob.type });
      // Passa al form Agente come se l'utente avesse caricato il file
      var fakeEvent = { target: { files: [file] } };

      // Cerca il clientKey dal contesto
      var ctx = document.getElementById('agent-client-ctx');
      var clientKey = ctx ? ctx.dataset.clientKey : '';

      agentiPhotoSelected({ files: [file] }, clientId, clientKey);

      // Switcha al tab Agenti
      switchClienteTab('agenti');
      showToast('📸 Foto cargada desde la librería');
    })
    .catch(function(e){ showToast('❌ Error al cargar asset: ' + e.message); });
}

// ── Modale libreria rapida (apribile dal form Agente) ─────────────────────────

var _assetsModalClientId = null;

function assetsOpenModal(clientId, clientKey) {
  _assetsModalClientId = clientId;

  // Crea modale se non esiste
  if (!document.getElementById('assets-modal')) {
    var m = document.createElement('div');
    m.id = 'assets-modal';
    m.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;align-items:center;justify-content:center;padding:1rem';
    m.innerHTML =
      '<div style="background:#fff;border-radius:14px;width:100%;max-width:640px;max-height:80vh;display:flex;flex-direction:column;overflow:hidden">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid #e0dbd2">' +
          '<div style="font-weight:700;font-size:0.95rem">📁 Selecciona desde la librería</div>' +
          '<button onclick="assetsCloseModal()" style="background:none;border:none;font-size:1.2rem;cursor:pointer;color:#888">✕</button>' +
        '</div>' +
        '<div id="assets-modal-body" style="padding:1rem;overflow-y:auto;flex:1"></div>' +
      '</div>';
    document.body.appendChild(m);
  }

  var modal = document.getElementById('assets-modal');
  var body  = document.getElementById('assets-modal-body');
  modal.style.display = 'flex';

  // Carica o usa cache
  var assets = (_assetsCache[clientId] || []).filter(function(a){ return a.type === 'photo' || a.type === 'logo'; });

  if (assets.length) {
    _assetsRenderModalGrid(assets, clientId, clientKey);
  } else {
    body.innerHTML = '<div style="color:#888;padding:1.5rem;text-align:center">Cargando...</div>';
    fetch(BRAVO_API + '/api/assets/' + encodeURIComponent(clientId) + '?type=photo')
      .then(function(r){ return r.json(); })
      .then(function(d){
        _assetsCache[clientId] = d.assets || [];
        _assetsRenderModalGrid(d.assets || [], clientId, clientKey);
      });
  }
}

function _assetsRenderModalGrid(assets, clientId, clientKey) {
  var body = document.getElementById('assets-modal-body');
  if (!body) return;
  if (!assets.length) {
    body.innerHTML = '<div style="text-align:center;padding:2rem;color:#aaa"><div style="font-size:1.8rem;margin-bottom:0.5rem">🖼️</div><div>Librería vacía — sube fotos en el tab Assets</div></div>';
    return;
  }
  body.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.6rem">' +
    assets.map(function(a) {
      return '<div style="border:2px solid #e0dbd2;border-radius:8px;overflow:hidden;cursor:pointer;transition:border-color 0.15s" ' +
        'onmouseover="this.style.borderColor=\'#C0392B\'" onmouseout="this.style.borderColor=\'#e0dbd2\'" ' +
        'onclick="assetsPickFromModal(\'' + clientId + '\',\'' + clientKey + '\',\'' + a.id + '\')">' +
        '<div style="aspect-ratio:1/1;background:#f0ece6;overflow:hidden">' +
          '<img src="' + a.public_url + '" loading="lazy" style="width:100%;height:100%;object-fit:cover">' +
        '</div>' +
        '<div style="font-size:0.65rem;padding:0.25rem 0.35rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#555">' + a.filename + '</div>' +
      '</div>';
    }).join('') +
    '</div>';
}

function assetsPickFromModal(clientId, clientKey, assetId) {
  assetsCloseModal();
  assetsSelectForAgent(clientId, assetId);
}

function assetsCloseModal() {
  var m = document.getElementById('assets-modal');
  if (m) m.style.display = 'none';
}

