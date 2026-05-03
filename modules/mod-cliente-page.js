// ============================================================
// MOD-CLIENTE-PAGE — Pagina cliente: brand kit, proyectos, contenido, etc.
// Lazy-loaded quando si apre un cliente
// ============================================================

// ── CLIENTE PAGE ────────────────────────────────────────────────
var _currentClienteIdx;

function openClientePage(clientIdx) {
  _currentClienteIdx = clientIdx;
  _clienteActiveTab = 'proyectos';
  closeClientesPopup();
  var c = typeof clientIdx === 'number'
    ? CLIENTS_DATA[clientIdx]
    : CLIENTS_DATA.find(function(x){ return x.id === clientIdx || x.client_key === clientIdx; });
  if (!c) { console.warn('[BRAVO] openClientePage: cliente non trovato idx=', clientIdx, 'data=', CLIENTS_DATA.length); return; }
  var idx = CLIENTS_DATA.indexOf(c);
  var color = CLIENT_COLORS[idx % CLIENT_COLORS.length];
  var initials = (c.name||'').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
  var projs = CUENTAS.filter(function(p){
    return p.cliente && p.cliente.toLowerCase().indexOf((c.name||'').split(' ')[0].toLowerCase()) >= 0;
  });
  var content = (RECENT_CONTENT||[]).filter(function(rc){ return rc.client_id === c.id || rc.client_id === c.client_key; });

  // Topbar
  document.getElementById('clientePageName').textContent = c.name || '';
  document.getElementById('clientePageSector').textContent = (c.sector||'') + (c.city ? ' · ' + c.city : '');

  // Body
  var colorDot = { crit:'var(--red)', warn:'var(--gold)', good:'var(--green)', idle:'var(--muted2)' };

  var projsHtml = projs.length ? projs.map(function(p) {
    var col = colorDot[p.estado] || 'var(--muted2)';
    return '<div class="cliente-proj-item" onclick="switchTab(\'tablero\',document.querySelector(\'[onclick*=tablero]\'));closeClientePage()">' +
      '<div class="cliente-proj-dot" style="background:' + col + '"></div>' +
      '<div class="cliente-proj-name">' + p.nombre + '</div>' +
      '<div class="cliente-proj-meta">' + p.estadoLabel + ' · ' + (p.deadline||'—') + '</div>' +
      '<div class="cliente-proj-pct" style="color:' + col + '">' + p.progreso + '%</div>' +
    '</div>';
  }).join('') : '<div class="cliente-content-empty">Sin proyectos activos</div>';

  // Usa cache se disponibile, altrimenti RECENT_CONTENT (7gg) come stato iniziale
  var initialContent = _clienteContentCache[c.id] || content;
  var contentHtml = buildClienteContentHtml(initialContent);

  var nProjs   = projs.length;
  var nContent = initialContent.length;

  // Render base (senza brand kit)
  _bkCurrentClientId = c.id;
  renderClientePageBody(c, color, initials, projsHtml, contentHtml, null, nProjs, nContent);
  document.getElementById('clientePage').classList.add('open');

  // Carica brand kit async e aggiorna
  if (typeof loadBrandKitFromDB === 'function') {
    loadBrandKitFromDB(c.id).then(function(bk) {
      if (bk) {
        if (!bk._opus && bk.brand_kit_opus) bk._opus = bk.brand_kit_opus;
        bk._clientId = c.id;
      }
      // Usa il content già caricato se disponibile, così il re-render non lo cancella
      var cachedContent = _clienteContentCache[c.id];
      var currentContentHtml = (cachedContent && cachedContent.length)
        ? buildClienteContentHtml(cachedContent, c.id, cachedContent.length >= _CONTENT_PAGE_SIZE)
        : contentHtml;
      var actualCount = (cachedContent && cachedContent.length) ? cachedContent.length : nContent;
      renderClientePageBody(c, color, initials, projsHtml, currentContentHtml, bk, nProjs, actualCount);
      // Se l'utente era già sul tab agenti quando il brand kit è arrivato,
      // il re-render ha azzerato il pannello — ricarica i dati subito
      if (_clienteActiveTab === 'agenti') {
        var agCtx = document.getElementById('agent-client-ctx');
        if (agCtx && agCtx.dataset.clientId) {
          var _w = _nextMonday();
          agentiLoadContext(agCtx.dataset.clientId, _w);
        }
      }
    });
  }

  // Carica logo async e aggiorna l'elemento nel DOM
  if (typeof loadBrandKitImagesFromDB === 'function') {
    loadBrandKitImagesFromDB(c.id).then(function(imgs) {
      if (!imgs || !imgs.logo_b64) return;
      var src = imgB64Src(imgs.logo_b64);
      if (!src) return;
      var el = document.getElementById('cliente-page-logo');
      if (el) {
        el.style.background = '#fff';
        el.style.padding = '3px';
        el.innerHTML = '<img src="' + src + '" style="width:100%;height:100%;object-fit:contain;border-radius:inherit">';
      }
    });
  }

  // Carica i primi 20 contenuti del cliente
  _clienteContentOffset[c.id] = 0;
  _clienteContentCache[c.id]  = [];
  loadClientAllContent(c.id, 0).then(function(firstPage) {
    var panel = document.querySelector('.ctab-panel[data-tab="contenido"] .cliente-section-body');
    if (panel) {
      panel.innerHTML = buildClienteContentHtml(firstPage, c.id, firstPage.length >= _CONTENT_PAGE_SIZE);
    }
    var realCount = firstPage.length;
    var badge = document.querySelector('.ctab-btn[data-tab="contenido"] .ctab-badge');
    if (badge) badge.textContent = realCount + (realCount >= _CONTENT_PAGE_SIZE ? '+' : '');
    // Aggiorna nContent per renderClientePageBody successivi (brand kit callback)
    nContent = realCount;
  });

  // Carica KPI studio se è cliente self (Bravo stesso)
  if (c.is_self === true) {
    _fetchStudioKPI(function(kpiData) {
      var kpiEl = document.getElementById('studio-kpi-banner');
      if (kpiEl && kpiData) {
        kpiEl.innerHTML = renderStudioKPIBanner(kpiData);
      }
    });
  }
}

function imgB64Src(b64) {
  if (!b64) return '';
  var s = String(b64);
  if (s.startsWith('data:')) return s;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/9j/'))   return 'data:image/jpeg;base64,' + s;
  if (s.startsWith('iVBOR'))  return 'data:image/png;base64,' + s;
  if (s.startsWith('PHN2') || s.startsWith('<svg')) return 'data:image/svg+xml;base64,' + s;
  return 'data:image/jpeg;base64,' + s;
}
function _logoSrc(b64) { return imgB64Src(b64); }

function renderBrandKitSection(bk) {
  if (!bk) bk = {};
  var colors    = bk.colors    || [];
  var fonts     = bk.fonts     || [];
  var pillars   = bk.pillars   || [];
  var layouts   = bk.layouts   || [];
  var templates = bk.templates || [];
  var contentTypes = bk.content_types || [];

  var logoHtml = bk.logo_b64
    ? '<div class="bk-logo-wrap"><img class="bk-logo" src="' + imgB64Src(bk.logo_b64) + '" alt="Logo"></div>'
    : '';

  var colorsHtml = colors.map(function(col) {
    return '<div class="bk-swatch-wrap" title="' + (col.uso||'') + '">' +
      '<div class="bk-swatch" style="background:' + col.hex + '"></div>' +
      '<div class="bk-swatch-label">' +
        '<span class="bk-swatch-name">' + col.name + '</span>' +
        '<span class="bk-swatch-hex">' + col.hex + '</span>' +
      '</div>' +
    '</div>';
  }).join('');

  var fontsHtml = fonts.map(function(f) {
    return '<div class="bk-font-row">' +
      '<span class="bk-font-name">' + f.name + '</span>' +
      '<span class="bk-font-tipo">' + (f.tipo||'') + '</span>' +
      '<span class="bk-font-uso">' + (f.uso||'') + '</span>' +
    '</div>';
  }).join('');

  var pillarsHtml = pillars.map(function(p) {
    return '<div class="bk-pillar-row">' +
      '<span class="bk-pillar-dot" style="background:' + (p.color||'var(--muted2)') + '"></span>' +
      '<span class="bk-pillar-name">' + p.nombre + '</span>' +
      '<span class="bk-pillar-pct">' + (p.pct||'') + '%</span>' +
      (p.descripcion ? '<span class="bk-pillar-desc">' + p.descripcion + '</span>' : '') +
    '</div>';
  }).join('');

  var layoutsHtml = layouts.map(function(l) {
    return '<div class="bk-layout-chip">' +
      '<code>' + l.name + '</code>' +
      (l.descripcion ? '<span>' + l.descripcion + '</span>' : '') +
    '</div>';
  }).join('');

  var templatesHtml = templates.map(function(t) {
    return '<div class="bk-tpl-item">' +
      '<img class="bk-tpl-thumb" src="' + (t.svg_b64||'') + '" alt="' + (t.name||'') + '">' +
      '<div class="bk-tpl-name">' + (t.name||'') + '</div>' +
      (t.descripcion ? '<div class="bk-tpl-desc">' + t.descripcion + '</div>' : '') +
    '</div>';
  }).join('');

  // (Recursos visuales / logo / IG refs rimossi — non più necessari con il nuovo flusso Claude Design)

  var kitBodyHtml =
    (logoHtml ? '<div class="bk-block bk-block-logo">' + logoHtml + '</div>' : '') +
    (colors.length ? '<div class="bk-block"><div class="bk-block-title">Colores</div><div class="bk-swatches">' + colorsHtml + '</div></div>' : '') +
    (fonts.length  ? '<div class="bk-block"><div class="bk-block-title">Tipografía</div><div class="bk-fonts">' + fontsHtml + '</div></div>' : '') +
    (bk.tone_of_voice ? '<div class="bk-block"><div class="bk-block-title">Tono de voz</div><div class="bk-tone">' + bk.tone_of_voice + '</div></div>' : '') +
    (pillars.length ? '<div class="bk-block"><div class="bk-block-title">Pilares editoriales</div><div class="bk-pillars">' + pillarsHtml + '</div></div>' : '') +
    (layouts.length ? '<div class="bk-block"><div class="bk-block-title">Layouts preferidos</div><div class="bk-layouts">' + layoutsHtml + '</div></div>' : '') +
    (templates.length ? '<div class="bk-block"><div class="bk-block-title">Templates Story</div><div class="bk-templates">' + templatesHtml + '</div></div>' : '') +
    (bk.notes ? '<div class="bk-block"><div class="bk-block-title">Notas</div><div class="bk-notes">' + bk.notes + '</div></div>' : '') +
    (function() {
      var clientId = bk._clientId || '';
      var ctHtml = contentTypes.length
        ? contentTypes.map(function(ct) {
            return '<div class="bk-ct-item">' +
              '<div class="bk-ct-name">' + ct.name + '</div>' +
              (ct.when_to_use ? '<div class="bk-ct-when">' + ct.when_to_use + '</div>' : '') +
              (ct.example_headline ? '<div class="bk-ct-headline">&ldquo;' + ct.example_headline + '&rdquo;</div>' : '') +
            '</div>';
          }).join('')
        : '<div class="bk-ct-empty">Sin angulos narrativos. Genera los con IA desde el briefing.</div>';
      return '<div class="bk-block" id="bk-block-content-types">' +
        '<div class="bk-block-title" style="display:flex;align-items:center;justify-content:space-between">' +
          'Angulos Narrativos' +
          (clientId ? '<button class="bk-newkit-btn" id="bk-ct-btn" onclick="extractContentTypes(\'' + clientId + '\')" style="font-size:0.7rem">✦ Genera con IA</button>' : '') +
        '</div>' +
        '<div class="bk-ct-list" id="bk-ct-list">' + ctHtml + '</div>' +
      '</div>';
    })();

  var opusHtml = bk._opus
    ? renderBrandKitOpusPanel(bk._opus, bk._clientId)
    : '';

  // ── 1. Brand Book PDF (referencia visual para Bravo — NO leído por agentes) ──
  var clientId = bk._clientId || '';
  var pdfHtml =
    '<div id="bk-pdf-section-' + clientId + '" style="margin-bottom:1.2rem">' +
      '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted2);margin-bottom:0.5rem">📄 Brand Book (referencia visual)</div>' +
      '<div id="bk-brandbook-embed-' + clientId + '" style="text-align:center;color:var(--muted2);font-size:0.78rem;padding:1rem 0">⏳ Cargando…</div>' +
    '</div>';

  // ── 2. Inyectar JSON de Claude Design ───────────────────────────────────
  var injectHtml =
    '<div style="margin-bottom:1.2rem">' +
      '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted2);margin-bottom:0.5rem">📥 Inyectar Brand Kit (JSON)</div>' +
      '<div style="background:#f8f6f2;border:1px dashed #d0c9be;border-radius:10px;padding:1rem">' +
        '<div style="margin-bottom:0.6rem">' +
          '<textarea id="bk-json-input-' + clientId + '" placeholder=\'Pega aquí el JSON generado por Claude Design…\' ' +
            'style="width:100%;height:100px;font-family:monospace;font-size:0.72rem;border:1px solid #e0dbd2;border-radius:6px;padding:0.5rem;resize:vertical;background:#fff"></textarea>' +
        '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center">' +
          '<button onclick="injectBrandKitJSON(\'' + clientId + '\')" ' +
            'style="padding:0.45rem 1.2rem;background:#1F2A24;color:#C29547;border:none;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer">' +
            '✦ Inyectar Brand Kit</button>' +
          '<span id="bk-inject-status-' + clientId + '" style="font-size:0.72rem;color:#888"></span>' +
        '</div>' +
      '</div>' +
    '</div>';

  var topHtml = pdfHtml + injectHtml;

  return '<div class="cliente-section bk-section">' +
    '<div class="cliente-section-head">' +
      '<div class="cliente-section-title">Brand Kit</div>' +
    '</div>' +
    '<div class="bk-body" id="bkCurrentBody">' + topHtml + kitBodyHtml + '</div>' +
  '</div>';
}

async function injectBrandKitJSON(clientId) {
  var textarea = document.getElementById('bk-json-input-' + clientId);
  var statusEl = document.getElementById('bk-inject-status-' + clientId);
  if (!textarea || !textarea.value.trim()) {
    if (statusEl) statusEl.textContent = '⚠️ Pega el JSON antes de inyectar';
    return;
  }
  var jsonStr = textarea.value.trim();
  var parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch(e) {
    if (statusEl) statusEl.textContent = '❌ JSON no válido: ' + e.message;
    return;
  }
  if (statusEl) statusEl.textContent = '⏳ Inyectando...';
  try {
    var res = await fetch(AGENT_API + '/api/brand-kit/inject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, brand_kit_json: parsed })
    });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error');
    if (statusEl) statusEl.innerHTML = '✅ Inyectado — ' + (data.colors||0) + ' colores, ' + (data.fonts||0) + ' fuentes, ' + (data.pillars||0) + ' pilares, ' + (data.angles||0) + ' ángulos';
    textarea.value = '';
    // Ricarica la pagina cliente per mostrare il nuovo brand kit
    if (typeof showToast === 'function') showToast('Brand kit inyectado correctamente');
    setTimeout(function() { if (typeof switchClienteTab === 'function') switchClienteTab('brandkit'); }, 500);
  } catch(e) {
    if (statusEl) statusEl.textContent = '❌ ' + e.message;
  }
}

// ── Brand Book: carica HTML/PDF dal DB, mostra come embed ─────────────
async function loadBrandbookPdf(clientId) {
  var container = document.getElementById('bk-brandbook-embed-' + clientId);
  if (!container) return;
  try {
    var res = await fetch(BRAVO_API + '/api/brand-kit/brandbook/' + clientId);
    var data = await res.json();
    if (data.exists && data.html) {
      var fname = data.filename || 'Brand Book';
      var headerHtml =
        '<div style="margin-bottom:0.5rem;display:flex;align-items:center;gap:0.5rem">' +
          '<span style="font-size:0.78rem;color:var(--text);font-weight:600">📎 ' + fname + '</span>' +
          '<button onclick="bkRemoveBrandbook(\'' + clientId + '\')" style="font-size:0.65rem;padding:0.2rem 0.5rem;background:none;border:1px solid var(--border);border-radius:4px;cursor:pointer;color:var(--muted2)" title="Eliminar">✕</button>' +
        '</div>';
      container.innerHTML = headerHtml +
        '<iframe id="bk-bb-frame-' + clientId + '" ' +
          'style="width:100%;height:600px;border:1px solid var(--border);border-radius:8px;background:#fff" ' +
          'sandbox="allow-same-origin"></iframe>';
      var frame = document.getElementById('bk-bb-frame-' + clientId);
      if (frame) frame.srcdoc = data.html;
    } else {
      // Nessun brand book caricato — mostra input upload
      container.innerHTML =
        '<div style="padding:1rem;background:var(--bg);border:1px dashed var(--border2);border-radius:8px;text-align:center">' +
          '<div style="font-size:0.78rem;color:var(--muted2);margin-bottom:0.6rem">No hay Brand Book cargado aún</div>' +
          '<label style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 1rem;background:var(--accent);color:#fff;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer">' +
            '📤 Subir Brand Book' +
            '<input type="file" accept=".pdf,.html,.htm" onchange="bkUploadBrandbook(\'' + clientId + '\', this)" style="display:none">' +
          '</label>' +
          '<div style="font-size:0.65rem;color:var(--muted2);margin-top:0.4rem">Solo referencia visual para Bravo — los agentes no lo leen</div>' +
        '</div>';
    }
  } catch(e) {
    container.innerHTML =
      '<div style="padding:1rem;background:var(--bg);border:1px dashed var(--border2);border-radius:8px;text-align:center">' +
        '<div style="font-size:0.78rem;color:var(--muted2);margin-bottom:0.6rem">Carga el Brand Book del cliente</div>' +
        '<label style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.4rem 1rem;background:var(--accent);color:#fff;border-radius:6px;font-size:0.75rem;font-weight:600;cursor:pointer">' +
          '📤 Subir Brand Book' +
          '<input type="file" accept=".pdf,.html,.htm" onchange="bkUploadBrandbook(\'' + clientId + '\', this)" style="display:none">' +
        '</label>' +
        '<div style="font-size:0.65rem;color:var(--muted2);margin-top:0.4rem">Solo referencia visual para Bravo — los agentes no lo leen</div>' +
      '</div>';
  }
}

async function bkUploadBrandbook(clientId, inputEl) {
  var file = inputEl.files && inputEl.files[0];
  if (!file) return;
  var container = document.getElementById('bk-brandbook-embed-' + clientId);
  if (container) container.innerHTML = '<div style="padding:1rem;text-align:center;font-size:0.78rem;color:var(--muted2)">⏳ Subiendo ' + file.name + '…</div>';
  var form = new FormData();
  form.append('file', file);
  try {
    var res = await fetch(BRAVO_API + '/api/brand-kit/brandbook/' + clientId, { method: 'POST', body: form });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error');
    if (typeof showToast === 'function') showToast('Brand Book subido correctamente');
    loadBrandbookPdf(clientId);
  } catch(e) {
    if (container) container.innerHTML = '<div style="color:#c0392b;font-size:0.78rem;padding:1rem;text-align:center">❌ ' + e.message + '</div>';
  }
}

async function bkRemoveBrandbook(clientId) {
  if (!confirm('¿Eliminar el Brand Book PDF?')) return;
  try {
    await fetch(BRAVO_API + '/api/brand-kit/brandbook/' + clientId, { method: 'DELETE' });
    loadBrandbookPdf(clientId);
  } catch(e) {}
}

function renderIgConnectBlock(clientId) {
  var html =
    '<div class="bk-block" id="ig-connect-block-' + clientId + '" style="margin-top:0.5rem">' +
      '<div class="bk-block-title" style="display:flex;align-items:center;gap:0.5rem">' +
        '📱 Cuenta de Instagram' +
        '<span id="ig-status-badge-' + clientId + '" style="font-size:0.68rem;padding:0.15rem 0.5rem;border-radius:10px;background:#f0ece6;color:#888">Verificando...</span>' +
      '</div>' +
      '<div id="ig-connect-body-' + clientId + '">' +
        '<div style="color:#aaa;font-size:0.78rem">Cargando...</div>' +
      '</div>' +
    '</div>';

  setTimeout(function(){ igLoadStatus(clientId); }, 120);
  return html;
}

function igLoadStatus(clientId) {
  var body  = document.getElementById('ig-connect-body-' + clientId);
  var badge = document.getElementById('ig-status-badge-' + clientId);

  fetch(BRAVO_API + '/api/instagram/token/' + encodeURIComponent(clientId))
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.connected) {
        if (badge) { badge.textContent = '✓ Conectado'; badge.style.background = '#e8fde9'; badge.style.color = '#1a8a1e'; }
        if (body) body.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.6rem;padding:0.7rem;background:#f0fdf0;border:1px solid #b6f0b8;border-radius:8px">' +
            '<div>' +
              '<div style="font-size:0.82rem;font-weight:600;color:#1a6b1e">@' + (d.ig_username || 'cuenta conectada') + '</div>' +
              (d.expires_at ? '<div style="font-size:0.7rem;color:#888;margin-top:0.15rem">Token válido hasta ' + new Date(d.expires_at).toLocaleDateString('es-ES') + '</div>' : '') +
            '</div>' +
            '<button onclick="igDisconnect(\'' + clientId + '\')" class="bk-newkit-btn" style="color:#e74c3c;border-color:#e74c3c">Desconectar</button>' +
          '</div>';
      } else {
        // Controlla se il backend IG è configurato
        fetch(BRAVO_API + '/api/instagram/status')
          .then(function(r){ return r.json(); })
          .then(function(s){
            if (badge) { badge.textContent = '○ No conectado'; badge.style.background = '#f0ece6'; badge.style.color = '#888'; }
            if (!body) return;
            if (s.enabled) {
              body.innerHTML =
                '<div style="font-size:0.78rem;color:#666;margin-bottom:0.7rem">Conecta la cuenta Instagram Business del cliente para publicar directamente desde BRAVO.</div>' +
                '<button class="bk-adopt-btn" onclick="igStartOAuth(\'' + clientId + '\')">📱 Conectar Instagram</button>';
            } else {
              body.innerHTML =
                '<div style="padding:0.8rem;background:#fef9f0;border:1px solid #f5d87a;border-radius:8px;font-size:0.78rem;color:#7a5c00">' +
                  '⚙️ <strong>Pending de activación</strong> — El publishing Instagram está listo pero necesita las credenciales Meta.<br>' +
                  '<span style="color:#aaa;font-size:0.7rem;margin-top:0.3rem;display:block">Añade INSTAGRAM_APP_ID e INSTAGRAM_APP_SECRET al .env del backend para activar.</span>' +
                '</div>';
            }
          });
      }
    })
    .catch(function(){
      if (badge) { badge.textContent = '⚠ Error'; badge.style.color = '#e74c3c'; }
    });
}

function igStartOAuth(clientId) {
  var redirectUri = window.location.origin + '/ig-callback.html';
  fetch(BRAVO_API + '/api/instagram/auth-url?client_id=' + encodeURIComponent(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri))
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (!d.ok) { showToast('❌ ' + d.error); return; }
      var popup = window.open(d.url, 'ig_oauth', 'width=600,height=700,scrollbars=yes');
      // Ascolta messaggio dalla popup callback
      window.addEventListener('message', function handler(e) {
        if (e.data && e.data.type === 'ig_oauth_success') {
          window.removeEventListener('message', handler);
          if (popup) popup.close();
          showToast('✅ Instagram conectado: @' + (e.data.ig_username || ''));
          igLoadStatus(clientId);
        }
        if (e.data && e.data.type === 'ig_oauth_error') {
          window.removeEventListener('message', handler);
          if (popup) popup.close();
          showToast('❌ Error al conectar: ' + (e.data.error || 'desconocido'));
        }
      });
    })
    .catch(function(e){ showToast('❌ Error: ' + e.message); });
}

function igDisconnect(clientId) {
  if (!confirm('¿Desconectar la cuenta Instagram de este cliente?')) return;
  fetch(BRAVO_API + '/api/instagram/token/' + encodeURIComponent(clientId), { method: 'DELETE' })
    .then(function(r){ return r.json(); })
    .then(function(d){
      if (d.ok) { showToast('Cuenta Instagram desconectada'); igLoadStatus(clientId); }
      else showToast('❌ Error: ' + (d.error || ''));
    });
}

function renderBrandKitOpusPanel(opus, clientId) {
  // Supporta sia array (vecchio formato) sia oggetto con chiavi (nuovo schema Bravo)
  var colors = Array.isArray(opus.colors)
    ? opus.colors
    : Object.entries(opus.colors || {}).map(function(e) {
        return { name: e[0], hex: e[1].hex || '', uso: e[1].usage || e[1].uso || '' };
      });

  // fonts: array diretto oppure ricavato da typography.styles
  var fonts = Array.isArray(opus.fonts)
    ? opus.fonts
    : (opus.typography && opus.typography.styles
        ? Object.entries(opus.typography.styles).map(function(e) {
            return { name: (opus.typography.font_family || '') + ' ' + (e[1].weight || ''), tipo: e[0], uso: e[1].role || '' };
          })
        : []);

  var pillars  = opus.pillars  || (opus.content_pillars || []);
  var layouts  = Array.isArray(opus.layouts) ? opus.layouts
    : Object.entries(opus.backgrounds || {}).map(function(e) {
        return { name: e[0], descripcion: e[1].when_to_use || '' };
      });

  var swatches = colors.map(function(c) {
    return '<div class="bk-swatch-wrap"><div class="bk-swatch" style="background:' + c.hex + '"></div>' +
      '<div class="bk-swatch-label"><span class="bk-swatch-name">' + c.name + '</span><span class="bk-swatch-hex">' + c.hex + '</span></div></div>';
  }).join('');

  var fontsH = fonts.map(function(f) {
    return '<div class="bk-font-row"><span class="bk-font-name">' + f.name + '</span>' +
      '<span class="bk-font-tipo">' + (f.tipo||'') + '</span>' +
      '<span class="bk-font-uso">' + (f.uso||'') + '</span></div>';
  }).join('');

  var pillarsH = pillars.map(function(p) {
    return '<div class="bk-pillar-row"><span class="bk-pillar-dot" style="background:' + (p.color||'#999') + '"></span>' +
      '<span class="bk-pillar-name">' + p.nombre + '</span>' +
      '<span class="bk-pillar-pct">' + (p.pct||'') + '%</span>' +
      (p.descripcion ? '<span class="bk-pillar-desc">' + p.descripcion + '</span>' : '') + '</div>';
  }).join('');

  var layoutsH = layouts.map(function(l) {
    return '<div class="bk-layout-chip"><code>' + l.name + '</code>' +
      (l.descripcion ? '<span>' + l.descripcion + '</span>' : '') + '</div>';
  }).join('');

  return '<div class="bk-opus-panel">' +
    '<div class="bk-opus-header">' +
      '<span class="bk-opus-badge">★ OPUS</span>' +
      '<span class="bk-opus-title">Analisi Brand Kit — Claude Opus</span>' +
      '<div class="bk-opus-actions">' +
        '<button class="bk-adopt-btn" onclick="adoptOpusBrandKit(\'' + (clientId||'') + '\')">✓ Adotta questo Brand Kit</button>' +
        '<button class="bk-discard-btn" onclick="discardOpusBrandKit()">✕ Scarta</button>' +
      '</div>' +
    '</div>' +
    '<div class="bk-body">' +
      (colors.length  ? '<div class="bk-block"><div class="bk-block-title">Colores</div><div class="bk-swatches">' + swatches + '</div></div>' : '') +
      (fonts.length   ? '<div class="bk-block"><div class="bk-block-title">Tipografía</div><div class="bk-fonts">' + fontsH + '</div></div>' : '') +
      (opus.tone_of_voice ? '<div class="bk-block"><div class="bk-block-title">Tono de voz</div><div class="bk-tone">' + (typeof opus.tone_of_voice === 'object' ? (opus.tone_of_voice.persona || '') + (opus.tone_of_voice.principles ? '<ul style="margin-top:0.5rem;padding-left:1.2rem">' + opus.tone_of_voice.principles.map(function(p){return '<li>'+p+'</li>';}).join('') + '</ul>' : '') : opus.tone_of_voice) + '</div></div>' : '') +
      (pillars.length ? '<div class="bk-block"><div class="bk-block-title">Pilares</div><div class="bk-pillars">' + pillarsH + '</div></div>' : '') +
      (layouts.length ? '<div class="bk-block"><div class="bk-block-title">Layouts</div><div class="bk-layouts">' + layoutsH + '</div></div>' : '') +
      (opus.notes     ? '<div class="bk-block"><div class="bk-block-title">Notas</div><div class="bk-notes">' + opus.notes + '</div></div>' : '') +
    '</div>' +
  '</div>';
}

var _bkCurrentClientId = null;

var _clienteActiveTab = 'proyectos';
var _clientProjects = {};   // clientId → array | null | undefined

function switchClienteTab(tabName) {
  _clienteActiveTab = tabName;
  var tabs = document.querySelectorAll('.ctab-btn');
  for (var i = 0; i < tabs.length; i++) {
    tabs[i].classList.toggle('active', tabs[i].dataset.tab === tabName);
  }
  var panels = document.querySelectorAll('.ctab-panel');
  for (var j = 0; j < panels.length; j++) {
    panels[j].style.display = panels[j].dataset.tab === tabName ? '' : 'none';
  }
  // Quando si apre il Calendario, carica le tareas se non già in cache
  if (tabName === 'calendario') {
    var calPanel = document.querySelector('.ctab-panel[data-tab="calendario"]');
    if (calPanel) {
      var cid = calPanel.dataset.clientId;
      if (cid && !_clientTasksCache.hasOwnProperty(cid)) {
        _loadClientTasks(cid);
      }
    }
  }
  // Quando si apre il Brand Kit, carica il Brand Book
  if (tabName === 'brandkit') {
    // Carica il PDF del briefing originale
    var bkBbSection = document.querySelector('[id^="bk-brandbook-embed-"]');
    if (bkBbSection) {
      var cid = bkBbSection.id.replace('bk-brandbook-embed-', '');
      if (cid) loadBrandbookPdf(cid);
    }
  }
  // Quando si apre Equipo, carica team assegnato da Supabase
  if (tabName === 'equipo') {
    var eqPanel = document.querySelector('.ctab-panel[data-tab="equipo"]');
    if (eqPanel && eqPanel.dataset.clientId && typeof db !== 'undefined' && db) {
      var eqCid = eqPanel.dataset.clientId;
      db.from('client_profile').select('team_bravo').eq('client_id', eqCid).single().then(function(res) {
        if (!res.error && res.data && Array.isArray(res.data.team_bravo) && res.data.team_bravo.length) {
          var validNames = _teamMembers.map(function(x){ return x.name; });
          var state = {};
          res.data.team_bravo.forEach(function(m) {
            var n = typeof m === 'string' ? m : m.name;
            if (validNames.indexOf(n) >= 0) state[n] = true;
          });
          _clienteEquipoState[eqCid] = state;
          var c = CLIENTS_DATA[_currentClienteIdx];
          if (c && c.id === eqCid) {
            eqPanel.innerHTML = renderClienteEquipoSection(eqCid, c.client_key);
          }
        }
      });
    }
  }

  // Quando si apre Proyectos, ri-renderizza sempre con lo stato equipo aggiornato
  if (tabName === 'proyectos') {
    var projPanel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
    if (projPanel && projPanel.dataset.clientId) {
      projPanel.innerHTML = renderProyectosSection(projPanel.dataset.clientId);
    }
  }

  // Quando si apre Agenti, ricarica i dati — necessario perché renderClientePageBody
  // viene chiamato due volte (base + brand kit) e la seconda chiamata resetta il DOM
  if (tabName === 'agenti') {
    var agCtx = document.getElementById('agent-client-ctx');
    if (agCtx && agCtx.dataset.clientId) {
      var agCid = agCtx.dataset.clientId;
      var agWeek = _nextMonday();
      agentiLoadContext(agCid, agWeek);
      if (window._pendingDesignerStep) {
        setTimeout(_injectPendingDesignerStep, 300);
      } else if (window._pendingPlanCardLaunch) {
        setTimeout(_injectPlanCardContext, 300);
      }
    }
  }

  // Se il tab ha un placeholder (modulo non ancora caricato), carica il modulo e ri-renderizza
  var lazyPlaceholder = document.querySelector('.ctab-panel[data-tab="' + tabName + '"] [data-lazy-tab="' + tabName + '"]');
  if (lazyPlaceholder) {
    var lazyCid = lazyPlaceholder.dataset.clientId;
    var lazyPanel = document.querySelector('.ctab-panel[data-tab="' + tabName + '"]');
    var _renderMap = {
      briefing: function() { if (typeof renderBriefingSection === 'function' && lazyPanel) lazyPanel.innerHTML = renderBriefingSection(lazyCid); },
      agenti:   function() {
        var c = CLIENTS_DATA.find(function(x){ return x.id === lazyCid; });
        if (typeof renderAgentiSection === 'function' && lazyPanel) lazyPanel.innerHTML = renderAgentiSection(lazyCid, c && c.client_key, c && c.name);
      },
      assets:   function() { if (typeof renderAssetsSection   === 'function' && lazyPanel) lazyPanel.innerHTML = renderAssetsSection(lazyCid); },
      metricas: function() { if (typeof renderMetricasSection === 'function' && lazyPanel) lazyPanel.innerHTML = renderMetricasSection(lazyCid); },
      social:   function() { if (typeof renderSocialSection   === 'function' && lazyPanel) lazyPanel.innerHTML = renderSocialSection(lazyCid); }
    };
    if (_renderMap[tabName]) loadModule(tabName, _renderMap[tabName]);
  }
}


function renderStudioKPIBanner(kpiData) {
  if (!kpiData) return '';
  var ac = kpiData.active_clients || 0;
  var pm = kpiData.published_month || 0;
  var ae = (kpiData.avg_engagement || 0).toFixed(1);
  var pa = kpiData.pending_approval || 0;
  return '<div class="studio-kpi-banner" style="background:#1a1a1a;color:#fff;padding:1.5rem;border-radius:6px;margin:0 0 1rem 0">' +
    '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:1rem">' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + ac + '</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Clientes activos</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + pm + '</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Publicados este mes</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + ae + '%</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Engagement promedio</div>' +
      '</div>' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;font-weight:bold">' + pa + '</div>' +
        '<div style="font-size:0.75rem;color:#aaa">Pendientes de aprobación</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function renderClientePageBody(c, color, initials, projsHtml, contentHtml, bk, projsCount, contentCount) {
  var logoSidebar = '<div id="cliente-page-logo" class="cliente-info-logo" style="background:' + color + ';overflow:hidden">' + initials + '</div>';

  // Assicura che bk abbia sempre il clientId per i blocchi upload/inject
  if (!bk) bk = {};
  if (c && c.id) bk._clientId = bk._clientId || c.id;
  var brandKitHtml = renderBrandKitSection(bk);
  var placeholder = function(icon, label) {
    return '<div class="ctab-placeholder">' + icon + ' <strong>' + label + '</strong> — próximamente</div>';
  };

  var tab = _clienteActiveTab || 'proyectos';

  var tabs8 = [
    { id:'briefing',   label:'📄 Briefing',   badge: 0 },
    { id:'estrategia', label:'◎ Estrategia',  badge: 0 },
    { id:'perfil',     label:'◈ Perfil',      badge: 0 },
    { id:'brandkit',   label:'◈ Brand Kit',   badge: 0 },
    { id:'equipo',     label:'◉ Equipo',      badge: 0 },
    { id:'proyectos',  label:'▦ Proyectos',   badge: projsCount||0 },
    { id:'contenido',  label:'★ Contenido',   badge: contentCount||0 },
    { id:'calendario', label:'◷ Calendario',  badge: 0 },
    { id:'assets',     label:'🖼️ Assets',     badge: 0 },
    { id:'metricas',   label:'▲ Métricas',    badge: 0 },
    { id:'social',     label:'📡 Social',     badge: 0 }
  ];

  var tabBtns = tabs8.map(function(t) {
    var badgeHtml = t.badge ? ' <span class="ctab-badge">' + t.badge + '</span>' : '';
    return '<button class="ctab-btn' + (tab===t.id?' active':'') + '" data-tab="' + t.id + '" onclick="switchClienteTab(\'' + t.id + '\')">' + t.label + badgeHtml + '</button>';
  }).join('');

  var panels = {
    proyectos:  renderProyectosSection(c && c.id),
    contenido:  '<div class="cliente-section"><div class="cliente-section-body">' + contentHtml + '</div></div>',
    brandkit:   brandKitHtml || '<div class="ctab-placeholder">⏳ Cargando Brand Kit…</div>',
    briefing:   (typeof renderBriefingSection === 'function' ? renderBriefingSection(c && c.id) : '<div class="ctab-placeholder" data-lazy-tab="briefing" data-client-id="' + (c && c.id) + '">⏳ Cargando briefing…</div>'),
    agenti:     (typeof renderAgentiSection   === 'function' ? renderAgentiSection(c && c.id, c && c.client_key, c && c.name) : '<div class="ctab-placeholder" data-lazy-tab="agenti" data-client-id="' + (c && c.id) + '">⏳ Cargando agentes…</div>'),
    estrategia: renderEstrategiaSection(c && c.id),
    perfil:     renderPerfilSection(c && c.id),
    calendario: renderCalendarioSection(c && c.id),
    equipo:     renderClienteEquipoSection(c && c.id, c && c.client_key),
    assets:     (typeof renderAssetsSection   === 'function' ? renderAssetsSection(c && c.id)   : '<div class="ctab-placeholder" data-lazy-tab="assets"   data-client-id="' + (c && c.id) + '">⏳ Cargando assets…</div>'),
    metricas:   (typeof renderMetricasSection === 'function' ? renderMetricasSection(c && c.id) : '<div class="ctab-placeholder" data-lazy-tab="metricas" data-client-id="' + (c && c.id) + '">⏳ Cargando métricas…</div>'),
    social:     (typeof renderSocialSection   === 'function' ? renderSocialSection(c && c.id)   : '<div class="ctab-placeholder" data-lazy-tab="social"   data-client-id="' + (c && c.id) + '">⏳ Cargando social…</div>')
  };

  var clientId = c && c.id;
  var panelsHtml = tabs8.map(function(t) {
    var extraAttr = ((t.id === 'calendario' || t.id === 'equipo' || t.id === 'proyectos') && clientId) ? ' data-client-id="' + clientId + '"' : '';
    return '<div class="ctab-panel" data-tab="' + t.id + '"' + extraAttr + ' style="' + (tab===t.id?'':'display:none') + '">' + panels[t.id] + '</div>';
  }).join('');

  var kpiBanner = (c.is_self === true)
    ? '<div id="studio-kpi-banner" style="padding:0 1rem;margin-bottom:1rem">⏳ Cargando KPI…</div>'
    : '';

  document.getElementById('clientePageBody').innerHTML =
    '<div class="cliente-info-card">' +
      logoSidebar +
      '<div class="cliente-info-name">' + (c.name||'') + '</div>' +
      '<div class="cliente-info-sector">' + (c.sector||'') + '</div>' +
      (c.city     ? '<div class="cliente-info-row">&#128205; ' + c.city + '</div>' : '') +
      (c.address  ? '<div class="cliente-info-row">&#127968; ' + c.address + '</div>' : '') +
      (c.phone    ? '<div class="cliente-info-row">&#128222; ' + c.phone + '</div>' : '') +
      (c.website  ? '<div class="cliente-info-row">&#127760; <a href="https://' + c.website + '" target="_blank" style="color:var(--accent)">' + c.website + '</a></div>' : '') +
      (c.instagram? '<div class="cliente-info-row">&#64; ' + c.instagram + '</div>' : '') +
      (c.description ? '<div class="cliente-info-desc">' + c.description + '</div>' : '') +
      '<div class="ctab-bar">' + tabBtns + '</div>' +
    '</div>' +
    '<div class="cliente-main-col">' +
      kpiBanner +
      panelsHtml +
    '</div>';
}

// ── PROYECTOS PROPUESTOS ──────────────────────────────────────────
var _cprojFilter     = 'todos';
var _cprojMonthFilter= 'todos';   // filtro mese target
var _cprojSort       = 'default'; // 'default' | 'priority' | 'month' | 'category'
var _cprojSelected   = {};        // { projectId: true } — checkbox selezione
var _projectStepsCache = {};     // { projectId: [tasks] } — cache lazy steps
var _programarState  = { clientId: null, projectId: null, category: null, title: '' };
var _programarTasks       = [];   // tareas del breakdown en edición
var _programarExpandedIdx = null; // índice tarea expandida (-1 = ninguna)
var _clientTasksCache     = {};   // { clientId: [task, ...] } — cargadas para Gantt
var _editingProjId   = null;

var _clienteEquipoState = {}; // { clientId: { name: bool } } — solo in memoria

function _getClienteEquipo(clientId) {
  return _clienteEquipoState[clientId] || null;
}
function _saveClienteEquipo(clientId, state) {
  _clienteEquipoState[clientId] = state;
}
function toggleClienteEquipoMember(clientId, name) {
  var state = _getClienteEquipo(clientId) || {};
  state[name] = !state[name];
  _saveClienteEquipo(clientId, state);
  var el = document.getElementById('ceq-toggle-' + name.replace(/\s/g,'_'));
  if (el) {
    var isOn = !!state[name];
    el.classList.toggle('ceq-on', isOn);
    el.classList.toggle('ceq-off', !isOn);
    el.textContent = isOn ? 'ON' : 'OFF';
    el.style.background = isOn ? '#22c55e' : 'var(--border)';
    el.style.color = isOn ? '#fff' : 'var(--muted2)';
  }
}
function confirmarClienteEquipo(clientId) {
  var state = _getClienteEquipo(clientId) || {};
  var active = Object.keys(state).filter(function(k){ return state[k]; });
  if (!active.length) return; // bottone disabilitato se nessun membro selezionato

  // Esci dalla modalità modifica
  _clienteEquipoEditing[clientId] = false;

  // Salva su Supabase
  if (typeof db !== 'undefined' && db) {
    db.from('client_profile')
      .upsert({ client_id: clientId, team_bravo: active.map(function(n){ return { name: n }; }), updated_at: new Date().toISOString() }, { onConflict: 'client_id' })
      .then(function(res) {
        if (res.error) console.warn('[BRAVO] Errore salvataggio team:', res.error.message);
        else console.log('[BRAVO] ✓ Team salvato:', active);
      });
  }

  // Aggiorna il pannello equipo → mostra stato salvato
  var eqPanel = document.querySelector('.ctab-panel[data-tab="equipo"]');
  if (eqPanel) {
    var c = CLIENTS_DATA[_currentClienteIdx];
    eqPanel.innerHTML = renderClienteEquipoSection(clientId, c && c.client_key);
  }

  // Aggiorna anche il pannello proyectos (ora l'equipo è configurato)
  var projPanel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (projPanel) projPanel.innerHTML = renderProyectosSection(clientId);

  showToast('✅ Equipo guardado — ' + active.length + ' miembros');
}

function renderProyectosSection(clientId) {
  if (!clientId) return '<div class="cproj-empty">Sin cliente</div>';

  // Verifica equipo configurado
  var eqState = _getClienteEquipo(clientId) || {};
  var activeMembers = Object.keys(eqState).filter(function(k){ return eqState[k]; });
  if (!activeMembers.length) {
    return '<div style="padding:2.5rem;text-align:center;color:var(--muted2);line-height:1.9">' +
      '<div style="font-size:2rem;margin-bottom:0.5rem">◉</div>' +
      '<div style="font-size:0.95rem;font-weight:600;color:var(--text);margin-bottom:0.4rem">Equipo no configurado</div>' +
      '<div style="font-size:0.8rem">Ve a la pestaña <strong>Equipo</strong>, selecciona los miembros y confirma antes de continuar.</div>' +
    '</div>';
  }

  var projects = _clientProjects[clientId];

  // No cargados aún → disparar carga
  if (projects === undefined) {
    _loadClientProjects(clientId);
    return '<div class="cproj-loading">⏳ Cargando proyectos…</div>';
  }

  // null → no hay datos en Supabase aún
  if (projects === null || projects.length === 0) {
    return '<div class="cproj-empty">' +
      '◈ No hay proyectos propuestos para este cliente.<br>' +
      '<span style="font-size:0.72rem;color:var(--muted2)">Sube el briefing y extrae los proyectos automáticamente.</span><br><br>' +
      '<button class="cproj-extract-btn" onclick="extractClientProjects(\'' + clientId + '\')">🧠 Regenerar con Opus</button>' +
    '</div>';
  }

  var cats = ['todos','CONTENIDO','PUBLICIDAD','ALIANZAS','SEO_LOCAL','CONVERSION','CAMPANA'];
  var catLabels = { todos:'Todos', CONTENIDO:'Contenido', PUBLICIDAD:'Publicidad', ALIANZAS:'Alianzas', SEO_LOCAL:'SEO Local', CONVERSION:'Conversión', CAMPANA:'Campaña' };

  // ── KPI Banner ──────────────────────────────────────────────────────────────
  var totalCount     = projects.length;
  var approvedCount  = projects.filter(function(p){ return p.status !== 'rechazado' && p.status !== 'propuesto'; }).length;
  var sinAsignar     = projects.filter(function(p){ return !p.assigned_to && p.status !== 'rechazado'; }).length;
  var enProgreso     = projects.filter(function(p){ return p.status === 'en_progreso'; }).length;
  var completados    = projects.filter(function(p){ return p.status === 'completado'; }).length;
  var kpiBanner =
    '<div class="cproj-kpi-bar">' +
      '<span class="cproj-kpi-chip">📋 <strong>' + totalCount + '</strong> proyectos</span>' +
      '<span class="cproj-kpi-chip cproj-kpi-green">✓ <strong>' + approvedCount + '</strong> activos</span>' +
      (sinAsignar > 0 ? '<span class="cproj-kpi-chip cproj-kpi-warn">⚠ <strong>' + sinAsignar + '</strong> sin asignar</span>' : '') +
      (enProgreso > 0 ? '<span class="cproj-kpi-chip cproj-kpi-blue">▶ <strong>' + enProgreso + '</strong> en progreso</span>' : '') +
      (completados > 0 ? '<span class="cproj-kpi-chip cproj-kpi-muted">✔ <strong>' + completados + '</strong> completados</span>' : '') +
      '<button class="cproj-extract-btn" style="margin-left:auto;font-size:0.7rem;padding:0.3rem 0.8rem" onclick="extractClientProjects(\'' + clientId + '\')" title="Regenerar proyectos desde el briefing">🧠 Regenerar con Opus</button>' +
    '</div>';

  // ── Filtro mesi disponibili ─────────────────────────────────────────────────
  var months = ['todos'];
  projects.forEach(function(p){ if(p.month_target && months.indexOf(p.month_target)===-1) months.push(p.month_target); });

  // ── Filter bar categoria ────────────────────────────────────────────────────
  var filterBar =
    '<div class="cproj-filter-bar">' +
      cats.map(function(c) {
        var count = c === 'todos' ? projects.length : projects.filter(function(p){ return p.category === c; }).length;
        if (c !== 'todos' && count === 0) return '';
        return '<button class="cproj-filter-btn' + (_cprojFilter===c?' active':'') + '" onclick="cprojSetFilter(\'' + clientId + '\',\'' + c + '\')">' + catLabels[c] + (count?' ('+count+')':'') + '</button>';
      }).join('') +
    '</div>' +

    // Filtro mese + sort + select-all
    '<div class="cproj-toolbar">' +
      '<div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap">' +
        '<span style="font-size:0.7rem;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Mes:</span>' +
        months.map(function(m){
          return '<button class="cproj-filter-btn' + (_cprojMonthFilter===m?' active':'') + '" style="font-size:0.7rem" onclick="cprojSetMonthFilter(\'' + clientId + '\',\'' + m + '\')">' + (m==='todos'?'Todos':m) + '</button>';
        }).join('') +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;align-items:center">' +
        '<span style="font-size:0.7rem;color:var(--muted2);font-weight:700;text-transform:uppercase;letter-spacing:0.06em">Orden:</span>' +
        '<select class="cproj-sort-select" onchange="cprojSetSort(\'' + clientId + '\',this.value)">' +
          '<option value="default"' + (_cprojSort==='default'?' selected':'') + '>Por defecto</option>' +
          '<option value="priority"' + (_cprojSort==='priority'?' selected':'') + '>Prioridad</option>' +
          '<option value="month"'   + (_cprojSort==='month'   ?' selected':'') + '>Mes objetivo</option>' +
          '<option value="category"'+(_cprojSort==='category'?' selected':'') + '>Categoría</option>' +
        '</select>' +
        '<button class="cproj-filter-btn" style="font-size:0.7rem" onclick="cprojSelectAll(\'' + clientId + '\')">' +
          (Object.keys(_cprojSelected).length > 0 ? '☑ Deseleccionar todo' : '☐ Seleccionar todo') +
        '</button>' +
      '</div>' +
    '</div>';

  // ── Filtra e ordina visible ─────────────────────────────────────────────────
  var visible = projects.filter(function(p){
    var catOk   = _cprojFilter      === 'todos' || p.category    === _cprojFilter;
    var monthOk = _cprojMonthFilter === 'todos' || p.month_target === _cprojMonthFilter;
    return catOk && monthOk;
  });

  var PRIORITY_ORDER = { alta:0, media:1, baja:2 };
  if (_cprojSort === 'priority') {
    visible = visible.slice().sort(function(a,b){ return (PRIORITY_ORDER[a.priority]||1)-(PRIORITY_ORDER[b.priority]||1); });
  } else if (_cprojSort === 'month') {
    visible = visible.slice().sort(function(a,b){ return (a.month_target||'zzz').localeCompare(b.month_target||'zzz'); });
  } else if (_cprojSort === 'category') {
    visible = visible.slice().sort(function(a,b){ return (a.category||'').localeCompare(b.category||''); });
  }

  // ── Toolbar acciones masivas (appare solo se ci sono selezioni) ─────────────
  var selIds = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  var bulkBar = selIds.length > 0
    ? '<div class="cproj-bulk-bar">' +
        '<span class="cproj-bulk-count">' + selIds.length + ' seleccionado' + (selIds.length!==1?'s':'') + '</span>' +
        '<button class="cproj-bulk-btn cproj-bulk-approve" onclick="bulkApprove(\'' + clientId + '\')">✓ Aprobar seleccionados</button>' +
        '<button class="cproj-bulk-btn cproj-bulk-reject"  onclick="bulkReject(\'' + clientId + '\')">✗ Rechazar seleccionados</button>' +
        '<button class="cproj-bulk-btn" onclick="bulkClear(\'' + clientId + '\')">Limpiar selección</button>' +
      '</div>'
    : '';

  var approvedForPDF = projects.filter(function(p){ return p.status !== 'rechazado'; }).length;
  var header = '<div class="cproj-header">' +
    kpiBanner +
    '<div style="display:flex;gap:0.4rem;flex-shrink:0">' +
      (approvedForPDF > 0
        ? '<button class="cproj-extract-btn" style="background:#1a1a2e;color:#a78bfa;border-color:#4c1d95" onclick="exportProyectosPDF(\'' + clientId + '\')">📄 Exportar PDF</button>'
        : '') +
      '<button class="cproj-extract-btn" onclick="extractClientProjects(\'' + clientId + '\')">↺ Re-extraer</button>' +
    '</div>' +
  '</div>';

  // Workflow stati in ordine
  var ESTADO_FLOW = ['propuesto','aprobado','planificado','en_progreso','en_revision','completado'];
  var ESTADO_LABELS = {
    propuesto:   'Propuesto',
    aprobado:    '✓ Aprobado',
    planificado: '📅 Planificado',
    en_progreso: '▶ En progreso',
    en_revision: '👁 En revisión',
    completado:  '✔ Completado',
    rechazado:   '✗ Rechazado'
  };
  var ESTADO_COLORS = {
    propuesto:   '#888',
    aprobado:    '#1a8a1e',
    planificado: '#1a6fa8',
    en_progreso: '#d97706',
    en_revision: '#7c3aed',
    completado:  '#374151',
    rechazado:   '#cc2222'
  };
  var ESTADO_BG = {
    propuesto:   '#f0f0f0',
    aprobado:    '#e8fde9',
    planificado: '#e8f4fd',
    en_progreso: '#fef3c7',
    en_revision: '#ede9fe',
    completado:  '#f3f4f6',
    rechazado:   '#fde8e8'
  };
  // Progress % per la barra
  var ESTADO_PCT = { propuesto:0, aprobado:10, planificado:30, en_progreso:60, en_revision:85, completado:100, rechazado:0 };

  var CAT_OPTIONS = ['CONTENIDO','PUBLICIDAD','ALIANZAS','SEO_LOCAL','CONVERSION','CAMPANA'];

  var cards = visible.map(function(p) {
    var status    = p.status || 'propuesto';
    var isRejected  = status === 'rechazado';
    var isCompleted = status === 'completado';
    var isApproved  = !isRejected && status !== 'propuesto';
    var catCls = 'cproj-cat-' + (p.category || 'CONTENIDO');
    var priCls = 'cproj-priority-' + (p.priority || 'media');

    // ── MODALITÀ EDIT INLINE ──────────────────────────────────────────────────
    if (_editingProjId === p.id) {
      var catOpts = CAT_OPTIONS.map(function(c) {
        return '<option value="' + c + '"' + (p.category===c?' selected':'') + '>' + (catLabels[c]||c) + '</option>';
      }).join('');
      return '<div class="cproj-card cproj-card-editing ' + priCls + '">' +
        '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--accent);margin-bottom:0.75rem">✏️ Editando proyecto</div>' +
        '<div class="cproj-edit-group">' +
          '<label class="cproj-edit-label">Título</label>' +
          '<input class="cproj-edit-input" id="edit-title-' + p.id + '" value="' + (p.title||'').replace(/"/g,'&quot;') + '">' +
        '</div>' +
        '<div class="cproj-edit-group">' +
          '<label class="cproj-edit-label">Descripción</label>' +
          '<textarea class="cproj-edit-textarea" id="edit-desc-' + p.id + '">' + (p.description||'') + '</textarea>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem">' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Categoría</label>' +
            '<select class="cproj-edit-select" id="edit-cat-' + p.id + '">' + catOpts + '</select>' +
          '</div>' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Mes objetivo</label>' +
            '<input class="cproj-edit-input" id="edit-month-' + p.id + '" value="' + (p.month_target||'') + '" placeholder="ej: Mayo 2026">' +
          '</div>' +
        '</div>' +
        '<div class="cproj-edit-group">' +
          '<label class="cproj-edit-label">Entregable</label>' +
          '<input class="cproj-edit-input" id="edit-deliverable-' + p.id + '" value="' + (p.deliverable||'').replace(/"/g,'&quot;') + '">' +
        '</div>' +
        '<div class="cproj-actions" style="margin-top:0.75rem">' +
          '<button class="cproj-btn cproj-btn-approve" onclick="saveEditProject(\'' + clientId + '\',\'' + p.id + '\')">💾 Guardar</button>' +
          '<button class="cproj-btn cproj-btn-undo" onclick="cancelEditProject(\'' + clientId + '\')">Cancelar</button>' +
        '</div>' +
      '</div>';
    }
    // ─────────────────────────────────────────────────────────────────────────

    var isProgrammed = isApproved && p.start_date;
    var programBadge = '';
    if (isProgrammed) {
      var fmt = function(d) { var x = new Date(d); return x.getDate()+'/'+(x.getMonth()+1)+'/'+x.getFullYear(); };
      var assignBadge = p.assigned_to ? ' · <span style="font-weight:700">'+p.assigned_to.split(' ')[0]+'</span>' : '';
      programBadge = '<div class="cproj-schedule-badge">📅 ' + fmt(p.start_date) + ' → ' + fmt(p.end_date||p.start_date) + assignBadge + '</div>';
    }

    // Badge stato + progress bar
    var stCol = ESTADO_COLORS[status] || '#888';
    var stBg  = ESTADO_BG[status]    || '#f0f0f0';
    var pct   = ESTADO_PCT[status]   || 0;
    var estadoBadge = '<div class="cproj-estado-badge" style="color:'+stCol+';background:'+stBg+'">' + (ESTADO_LABELS[status]||status) + '</div>';
    var progressBar = !isRejected
      ? '<div class="cproj-progress-track"><div class="cproj-progress-fill" style="width:'+pct+'%;background:'+stCol+'"></div></div>'
      : '';

    // Bottone avanza stato (→ prossimo step)
    var curIdx  = ESTADO_FLOW.indexOf(status);
    var nextSt  = (curIdx >= 0 && curIdx < ESTADO_FLOW.length - 1) ? ESTADO_FLOW[curIdx + 1] : null;
    var advBtn  = (nextSt && !isRejected)
      ? '<button class="cproj-btn cproj-btn-advance" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'' + nextSt + '\')" title="Avanzar a: ' + (ESTADO_LABELS[nextSt]||nextSt) + '">→</button>'
      : '';

    var isContentCat = CAT_CONTENT.indexOf(p.category) !== -1;

    var actions = isRejected
      ? '<button class="cproj-btn cproj-btn-undo" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'propuesto\')">Recuperar</button>'
      : status === 'propuesto'
        ? '<button class="cproj-btn cproj-btn-approve" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'aprobado\')">✓ Aprobar</button>' +
          '<button class="cproj-btn cproj-btn-reject"  onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'rechazado\')">✗ Rechazar</button>' +
          '<button class="cproj-btn cproj-btn-edit" onclick="startEditProject(\'' + clientId + '\',\'' + p.id + '\')" title="Editar antes de aprobar">✏️</button>'
        : estadoBadge +
          (isApproved && !isCompleted
            ? '<button class="cproj-btn cproj-btn-program" onclick="openProgramarModal(\'' + clientId + '\',\'' + p.id + '\',\'' + (p.category||'') + '\')">' +
                (isProgrammed ? '✏️ Editar fecha' : '📅 Programar') +
              '</button>'
            : '') +
          (isContentCat && !isCompleted
            ? '<button class="cproj-btn" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;font-weight:700" onclick="event.stopPropagation();openPlanSuggest(\'' + clientId + '\',\'' + p.id + '\')" title="Generar plan con Opus">✦ Plan</button>'
            : '') +
          advBtn +
          '<button class="cproj-btn cproj-btn-edit" onclick="startEditProject(\'' + clientId + '\',\'' + p.id + '\')" title="Editar proyecto">✏️</button>' +
          '<button class="cproj-btn cproj-btn-undo" style="font-size:0.65rem" onclick="advanceProjectStatus(\'' + clientId + '\',\'' + p.id + '\',\'propuesto\')">↩</button>';

    // Avatar responsabile (angolo in alto a destra)
    var aInfo = p.assigned_to ? { i: _teamInitialsFor(p.assigned_to), c: _teamColorFor(p.assigned_to) } : null;
    var avatarEl = aInfo
      ? '<div class="cproj-avatar" style="background:'+aInfo.c+'" title="'+p.assigned_to+'">'+aInfo.i+'</div>'
      : (isApproved && !isCompleted && !isRejected
          ? '<button class="cproj-avatar cproj-avatar-empty" onclick="openProgramarModal(\''+clientId+'\',\''+p.id+'\',\''+(p.category||'')+'\''+')" title="Asignar responsable">+</button>'
          : '');

    var isSel = !!_cprojSelected[p.id];
    var checkboxEl = !isRejected
      ? '<input type="checkbox" class="cproj-checkbox"' + (isSel?' checked':'') +
          ' onchange="cprojToggleSelect(\'' + p.id + '\',\'' + clientId + '\')">'
      : '';

    return '<div class="cproj-card ' + priCls + (isRejected?' rechazado':'') + (isProgrammed?' programado':'') + (isCompleted?' completado':'') + (isSel?' selected':'') + '" onclick="cprojToggleExpand(this)" style="cursor:pointer">' +
      '<div class="cproj-card-top">' +
        checkboxEl +
        '<span class="cproj-cat-badge ' + catCls + '">' + (catLabels[p.category] || p.category) + '</span>' +
        '<div class="cproj-title">' + (p.title||'') + '</div>' +
        avatarEl +
      '</div>' +
      progressBar +
      '<div class="cproj-desc">' + (p.description||'') + '</div>' +
      '<div class="cproj-meta-row">' +
        (p.month_target ? '<span>📅 ' + p.month_target + '</span>' : '') +
        (p.deliverable  ? '<span>📦 ' + p.deliverable + '</span>' : '') +
      '</div>' +
      (p.why ? '<div class="cproj-why">💬 ' + p.why + '</div>' : '') +
      programBadge +
      '<div class="cproj-actions">' + actions + '</div>' +
      (_sprintPickerOpen === p.id ? _renderSprintPicker(clientId, p) : '') +
      '<div class="cproj-steps-area" id="cproj-steps-' + p.id + '" data-pid="' + p.id + '" data-loaded="0">' +
        '<div class="cproj-steps-loading">Cargando pasos...</div>' +
      '</div>' +
    '</div>';
  }).join('');

  // ── Inline Programar Panel 2.0 ───────────────────────────────────────────────
  var inlinePanel = '';
  if (_programarState.projectId && _programarState.clientId === clientId) {
    var ps = _programarState;
    var psArr = _clientProjects[clientId];
    var psProj = psArr ? psArr.find(function(x){ return x.id === ps.projectId; }) : null;
    var psSugg = (_catDefaultAssign && _catDefaultAssign[ps.category]) || '';
    var psStart = psProj && psProj.start_date  ? psProj.start_date  : '';
    var psEnd   = psProj && psProj.end_date    ? psProj.end_date    : '';
    var psAss   = psProj && psProj.assigned_to ? psProj.assigned_to : psSugg;
    var psBudg  = psProj && psProj.budget_eur  ? psProj.budget_eur  : '';
    var psShowBudget = ps.category === 'PUBLICIDAD';

    var roleEmoji = { estrategia:'🧠', copy:'✍️', diseño:'🎨', video:'🎬', ads:'📣', publicación:'📤', reporting:'📊', gestión:'📋' };
    var tasksHtml = _programarTasks.length
      ? _programarTasks.map(function(t, i) {
          var col = _teamColorFor(t.assigned_to);
          return '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.6rem;background:var(--bg);border-radius:8px;border:1px solid var(--border)">' +
            '<span style="font-size:0.85rem">' + (roleEmoji[t.role] || '📌') + '</span>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:0.75rem;font-weight:600;color:var(--text)">' + t.title + '</div>' +
              '<div style="font-size:0.68rem;color:' + col + ';margin-top:0.1rem">' + (t.assigned_to || 'Sin asignar') + ' · ' + (t.role || '') + '</div>' +
            '</div>' +
            '<div style="font-size:0.65rem;color:var(--muted2);white-space:nowrap">' + (t.start_date || '') + (t.end_date && t.end_date !== t.start_date ? ' → ' + t.end_date : '') + '</div>' +
            '<button onclick="programarRemoveTask(' + i + ')" style="background:none;border:none;cursor:pointer;color:var(--muted2);font-size:1rem;padding:0 0.2rem;flex-shrink:0">×</button>' +
          '</div>';
        }).join('')
      : '<div style="font-size:0.73rem;color:var(--muted2);text-align:center;padding:0.8rem">Sin tareas asignadas — usa "Sugerir con IA" o añade manualmente</div>';

    inlinePanel =
      '<div class="cproj-inline-panel">' +
        '<div class="cproj-inline-panel-head">' +
          '<span>📅 Programar: <strong>' + (ps.title || 'Proyecto') + '</strong></span>' +
          '<button onclick="closeProgramarModal()" style="background:none;border:none;font-size:1.4rem;line-height:1;cursor:pointer;color:var(--muted2);padding:0">×</button>' +
        '</div>' +
        '<div class="cproj-inline-panel-body">' +

          // ── Bloque 1: Fechas y responsable principal
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem">' +
            '<div class="cproj-edit-group" style="margin:0">' +
              '<label class="cproj-edit-label">Fecha inicio *</label>' +
              '<input type="date" class="cproj-edit-input" id="progInlineStart" value="' + psStart + '">' +
            '</div>' +
            '<div class="cproj-edit-group" style="margin:0">' +
              '<label class="cproj-edit-label">Fecha fin</label>' +
              '<input type="date" class="cproj-edit-input" id="progInlineEnd" value="' + psEnd + '">' +
            '</div>' +
          '</div>' +
          '<div class="cproj-edit-group">' +
            '<label class="cproj-edit-label">Responsable principal (project owner)</label>' +
            '<select class="cproj-edit-input" id="progInlineAssign">' +
              '<option value="">Sin asignar</option>' +
              _teamMembers.filter(function(m){ return m.employment_type !== 'agent'; }).map(function(m){
                return '<option value="' + m.name + '"' + (psAss===m.name?' selected':'') + '>' + m.name + ' — ' + m.role + '</option>';
              }).join('') +
              '<optgroup label="Agentes AI">' +
              _teamMembers.filter(function(m){ return m.employment_type === 'agent'; }).map(function(m){
                return '<option value="' + m.name + '"' + (psAss===m.name?' selected':'') + '>🤖 ' + m.name + '</option>';
              }).join('') +
              '</optgroup>' +
            '</select>' +
          '</div>' +
          (psShowBudget
            ? '<div class="cproj-edit-group">' +
                '<label class="cproj-edit-label">Presupuesto (€)</label>' +
                '<input type="number" class="cproj-edit-input" id="progInlineBudget" value="' + psBudg + '" min="0" step="100">' +
              '</div>'
            : '<input type="hidden" id="progInlineBudget" value="">') +

          // ── Bloque 2: Tareas del equipo
          '<div style="margin-top:1rem">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem">' +
              '<label class="cproj-edit-label" style="margin:0">Tareas del equipo</label>' +
              '<div style="display:flex;gap:0.4rem">' +
                '<button id="progAiBtn" onclick="programarSuggestAI()" style="font-size:0.68rem;padding:0.28rem 0.65rem;background:none;border:1px dashed var(--border2);border-radius:6px;cursor:pointer;color:var(--muted);display:flex;align-items:center;gap:0.3rem">✦ Sugerir con IA</button>' +
                '<button onclick="programarAddTaskRow()" style="font-size:0.68rem;padding:0.28rem 0.65rem;background:var(--bg);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--text)">+ Añadir</button>' +
              '</div>' +
            '</div>' +
            '<div id="progTasksList" style="display:flex;flex-direction:column;gap:0.35rem">' + tasksHtml + '</div>' +
          '</div>' +

        '</div>' +
        '<div class="cproj-inline-panel-foot">' +
          '<button class="btn btn-ghost" onclick="closeProgramarModal()">Cancelar</button>' +
          '<button class="btn btn-acc" onclick="saveProgramar()">💾 Guardar</button>' +
        '</div>' +
      '</div>';
  }

  return header + inlinePanel + filterBar + bulkBar + '<div class="cproj-grid">' + cards + '</div>';
}

function cprojSetFilter(clientId, filter) {
  _cprojFilter = filter;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojSetMonthFilter(clientId, month) {
  _cprojMonthFilter = month;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojSetSort(clientId, sort) {
  _cprojSort = sort;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojToggleExpand(cardEl) {
  if (event && event.target && (event.target.tagName === 'BUTTON' || event.target.tagName === 'INPUT' || event.target.tagName === 'SELECT')) return;
  cardEl.classList.toggle('cproj-card-expanded');
  // Carica steps la primera vez que se expande
  if (cardEl.classList.contains('cproj-card-expanded')) {
    var stepsDiv = cardEl.querySelector('.cproj-steps-area');
    if (stepsDiv && stepsDiv.dataset.loaded === '0') {
      var pid = stepsDiv.dataset.pid;
      if (pid) loadProjectSteps(pid, stepsDiv);
    }
  }
}

async function loadProjectSteps(projectId, container) {
  if (_projectStepsCache[projectId]) {
    _renderStepsInContainer(_projectStepsCache[projectId], container);
    return;
  }
  try {
    var res = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/tasks');
    var data = await res.json();
    var tasks = (data.tasks || []).filter(function(t) { return t.source === 'opus'; });
    _projectStepsCache[projectId] = tasks;
    _renderStepsInContainer(tasks, container);
  } catch(e) {
    container.innerHTML = '<div class="cproj-steps-loading" style="color:#c0392b">Error cargando pasos.</div>';
  }
  container.dataset.loaded = '1';
}

function _renderStepsInContainer(tasks, container) {
  if (!tasks || tasks.length === 0) {
    container.innerHTML = '<div class="cproj-steps-loading">No hay pasos definidos.</div>';
    container.dataset.loaded = '1';
    return;
  }
  var _ROLE_COLORS = {
    market_researcher: '#e8f4fd', content_designer: '#f0e8fd',
    strategist: '#fdf5e8', designer: '#e8fde9',
    metrics_analyst: '#fde8f4', audio_transcriber: '#f5f5f5'
  };
  var _ROLE_TEXT = {
    market_researcher: '#1a6fa8', content_designer: '#6f1aa8',
    strategist: '#a87c1a', designer: '#1a8a1e',
    metrics_analyst: '#a81a6f', audio_transcriber: '#555'
  };
  var html = '<div class="cproj-steps-header">Pasos del proyecto (' + tasks.length + ')</div>';
  tasks.forEach(function(t, i) {
    var role = t.role || 'strategist';
    var agInfo = _AGENT_LABELS[role] || { icon: '●', label: role };
    var status = t.status || 'pendiente';
    var isDone = status === 'completado';
    var roleBg  = _ROLE_COLORS[role] || '#f0f0f0';
    var roleCol = _ROLE_TEXT[role]   || '#555';
    var dayLabel = (t.offset_days !== undefined && t.offset_days !== null)
      ? 'Día ' + t.offset_days + (t.duration_days > 1 ? '–' + (t.offset_days + t.duration_days - 1) : '')
      : '';
    var statusBadge = '<span class="cproj-step-status-badge step-st-' + status + '">' +
      (status === 'pendiente' ? 'Pendiente' : status === 'en_progreso' ? 'En progreso' : 'Completado') + '</span>';
    var btns = isDone
      ? '<button class="cproj-step-btn cproj-step-btn-done" disabled>✓ Completado</button>'
      : '<button class="cproj-step-btn cproj-step-btn-done" onclick="markStepDone(\'' + t.id + '\',\'' + t.project_id + '\',this)">✓ Marcar completado</button>';
    html += '<div class="cproj-step-item' + (isDone ? ' step-completado' : '') + '" id="step-item-' + t.id + '">' +
      '<div class="cproj-step-num">' + (i + 1) + '</div>' +
      '<div class="cproj-step-body">' +
        '<div class="cproj-step-title">' + (t.title || '') + '</div>' +
        '<div class="cproj-step-meta">' +
          '<span class="cproj-step-role-badge" style="background:' + roleBg + ';color:' + roleCol + '">' + agInfo.icon + ' ' + agInfo.label + '</span>' +
          (dayLabel ? '<span class="cproj-step-day">📅 ' + dayLabel + '</span>' : '') +
          statusBadge +
        '</div>' +
        (t.description ? '<div style="font-size:0.69rem;color:var(--muted2);margin-top:0.2rem;line-height:1.4">' + t.description + '</div>' : '') +
        '<div class="cproj-step-btns">' + btns + '</div>' +
      '</div>' +
    '</div>';
  });
  container.innerHTML = html;
  container.dataset.loaded = '1';
}

async function markStepDone(taskId, projectId, btn) {
  btn.disabled = true;
  btn.textContent = '...';
  try {
    await fetch(AGENT_API + '/api/projects/tasks/' + encodeURIComponent(taskId), {
      method: 'PATCH', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ status: 'completado' })
    });
    // Aggiorna cache locale
    if (_projectStepsCache[projectId]) {
      var t = _projectStepsCache[projectId].find(function(x){ return x.id === taskId; });
      if (t) t.status = 'completado';
    }
    var item = document.getElementById('step-item-' + taskId);
    if (item) {
      item.classList.add('step-completado');
      btn.textContent = '✓ Completado';
      btn.classList.remove('cproj-step-btn-done');
      btn.style.background = '#ccc';
    }
  } catch(e) {
    btn.disabled = false;
    btn.textContent = '✓ Marcar completado';
  }
}

function cprojToggleSelect(projectId, clientId) {
  _cprojSelected[projectId] = !_cprojSelected[projectId];
  if (!_cprojSelected[projectId]) delete _cprojSelected[projectId];
  // Aggiorna solo la bulk bar e i checkbox senza re-render completo
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cprojSelectAll(clientId) {
  var projects = _clientProjects[clientId] || [];
  var selIds = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  if (selIds.length > 0) {
    // Deseleziona tutto
    _cprojSelected = {};
  } else {
    // Seleziona tutti non rifiutati
    projects.forEach(function(p){
      if (p.status !== 'rechazado') _cprojSelected[p.id] = true;
    });
  }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function bulkApprove(clientId) {
  var ids = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  if (!ids.length) return;
  var arr = _clientProjects[clientId] || [];
  await Promise.all(ids.map(function(id) {
    var proj = arr.find(function(x){ return x.id === id; });
    if (proj && proj.status === 'propuesto') {
      proj.status = 'aprobado';
      return fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(id), {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status: 'aprobado' })
      });
    }
    return Promise.resolve();
  }));
  _cprojSelected = {};
  showToast('✅ ' + ids.length + ' proyectos aprobados');
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function bulkReject(clientId) {
  var ids = Object.keys(_cprojSelected).filter(function(id){ return _cprojSelected[id]; });
  if (!ids.length) return;
  var arr = _clientProjects[clientId] || [];
  await Promise.all(ids.map(function(id) {
    var proj = arr.find(function(x){ return x.id === id; });
    if (proj) {
      proj.status = 'rechazado';
      return fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(id), {
        method: 'PATCH', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ status: 'rechazado' })
      });
    }
    return Promise.resolve();
  }));
  _cprojSelected = {};
  showToast('✗ ' + ids.length + ' proyectos rechazados');
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function bulkClear(clientId) {
  _cprojSelected = {};
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

// ── EXPORT PROPUESTA PDF ──────────────────────────────────────────────────────

function exportProyectosPDF(clientId) {
  var projects = (_clientProjects[clientId] || []).filter(function(p){ return p.status !== 'rechazado'; });
  if (!projects.length) { showToast('No hay proyectos para exportar'); return; }

  // Dati cliente
  var c = CLIENTS_DATA.find(function(x){ return x.id === clientId; }) || {};
  var clientName   = c.name   || 'Cliente';
  var clientSector = c.sector || '';
  var today = new Date();
  var dateStr = today.getDate() + '/' + (today.getMonth()+1) + '/' + today.getFullYear();

  var CAT_COLORS_PDF = {
    CONTENIDO:'#1a6fa8', PUBLICIDAD:'#a81a6f', ALIANZAS:'#1a8a1e',
    SEO_LOCAL:'#a87c1a', CONVERSION:'#6f1aa8', CAMPANA:'#a81a1a'
  };
  var CAT_LABELS_PDF = {
    CONTENIDO:'Contenido', PUBLICIDAD:'Publicidad', ALIANZAS:'Alianzas',
    SEO_LOCAL:'SEO Local', CONVERSION:'Conversión', CAMPANA:'Campaña'
  };
  var STATUS_LABELS_PDF = {
    propuesto:'Propuesto', aprobado:'Aprobado', planificado:'Planificado',
    en_progreso:'En progreso', en_revision:'En revisión', completado:'Completado'
  };

  // Raggruppa per categoria
  var byCategory = {};
  projects.forEach(function(p){
    var cat = p.category || 'CONTENIDO';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  });

  var categorySections = Object.keys(byCategory).map(function(cat) {
    var col = CAT_COLORS_PDF[cat] || '#555';
    var lbl = CAT_LABELS_PDF[cat] || cat;
    var rows = byCategory[cat].map(function(p, i) {
      var bgRow = i % 2 === 0 ? '#fff' : '#f9f8f6';
      var statusLabel = STATUS_LABELS_PDF[p.status] || p.status || '';
      return '<tr style="background:' + bgRow + '">' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-weight:600;font-size:13px;color:#1a1a1a">' + (p.title||'') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;line-height:1.5">' + (p.description||'—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;white-space:nowrap">' + (p.deliverable||'—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;white-space:nowrap">' + (p.month_target||'—') + '</td>' +
        '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:11px;color:#888;white-space:nowrap">' + statusLabel + '</td>' +
        (p.budget_eur ? '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#555;white-space:nowrap">€' + p.budget_eur + '</td>' : '<td style="padding:10px 12px;border-bottom:1px solid #eee;font-size:12px;color:#ccc">—</td>') +
      '</tr>';
    }).join('');

    return '<div style="margin-bottom:28px">' +
      '<div style="background:' + col + ';color:#fff;padding:7px 14px;border-radius:6px 6px 0 0;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase">' + lbl + ' — ' + byCategory[cat].length + ' proyecto' + (byCategory[cat].length!==1?'s':'') + '</div>' +
      '<table style="width:100%;border-collapse:collapse;border:1px solid #eee;border-top:none;border-radius:0 0 6px 6px;overflow:hidden">' +
        '<thead>' +
          '<tr style="background:#f5f3ef">' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Proyecto</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Descripción</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Entregable</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Mes</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Estado</th>' +
            '<th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;font-weight:700;border-bottom:2px solid #eee">Presup.</th>' +
          '</tr>' +
        '</thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>' +
    '</div>';
  }).join('');

  var html = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
    '<title>Propuesta — ' + clientName + '</title>' +
    '<style>' +
      'body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin:0; padding:0; color:#1a1a1a; background:#fff; }' +
      '.page { max-width:900px; margin:0 auto; padding:40px 48px; }' +
      '.header { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:24px; border-bottom:3px solid #C0392B; margin-bottom:32px; }' +
      '.brand { font-size:22px; font-weight:900; letter-spacing:0.08em; color:#1a1a1a; }' +
      '.brand span { color:#C0392B; }' +
      '.brand-sub { font-size:11px; color:#888; margin-top:3px; letter-spacing:0.06em; }' +
      '.client-block { text-align:right; }' +
      '.client-name { font-size:20px; font-weight:800; color:#1a1a1a; }' +
      '.client-sector { font-size:12px; color:#888; margin-top:2px; }' +
      '.client-date { font-size:11px; color:#aaa; margin-top:4px; }' +
      '.intro { background:#f5f3ef; border-radius:8px; padding:16px 20px; margin-bottom:32px; font-size:13px; color:#555; line-height:1.6; }' +
      '.intro strong { color:#1a1a1a; }' +
      '.summary { display:flex; gap:12px; margin-bottom:32px; }' +
      '.summary-chip { flex:1; background:#f5f3ef; border-radius:8px; padding:12px 16px; text-align:center; }' +
      '.summary-chip .num { font-size:24px; font-weight:900; color:#C0392B; }' +
      '.summary-chip .lbl { font-size:11px; color:#888; margin-top:2px; text-transform:uppercase; letter-spacing:0.06em; }' +
      '.footer { margin-top:40px; padding-top:20px; border-top:1px solid #eee; display:flex; justify-content:space-between; align-items:center; }' +
      '.footer-brand { font-size:12px; font-weight:800; color:#C0392B; letter-spacing:0.08em; }' +
      '.footer-note { font-size:11px; color:#aaa; }' +
      '.print-btn { position:fixed; bottom:24px; right:24px; background:#C0392B; color:#fff; border:none; border-radius:10px; padding:12px 24px; font-size:14px; font-weight:700; cursor:pointer; box-shadow:0 4px 20px rgba(192,57,43,0.4); z-index:9999; }' +
      '.print-btn:hover { background:#a93226; }' +
      '@media print { .print-btn { display:none; } body { padding:0; } .page { padding:20px 28px; } }' +
    '</style></head><body>' +
    '<button class="print-btn" onclick="window.print()">🖨 Exportar PDF</button>' +
    '<div class="page">' +
      '<div class="header">' +
        '<div>' +
          '<div class="brand">BRAVO<span>!</span>COMUNICA</div>' +
          '<div class="brand-sub">Propuesta de proyectos</div>' +
        '</div>' +
        '<div class="client-block">' +
          '<div class="client-name">' + clientName + '</div>' +
          (clientSector ? '<div class="client-sector">' + clientSector + '</div>' : '') +
          '<div class="client-date">Fecha: ' + dateStr + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="intro">Este documento recoge los <strong>' + projects.length + ' proyectos</strong> propuestos por BRAVO!COMUNICA para <strong>' + clientName + '</strong>. Cada proyecto incluye descripción, entregable y mes objetivo estimado. Queda pendiente de revisión y aprobación por parte del cliente.</div>' +
      '<div class="summary">' +
        '<div class="summary-chip"><div class="num">' + projects.length + '</div><div class="lbl">Total proyectos</div></div>' +
        '<div class="summary-chip"><div class="num">' + projects.filter(function(p){return p.status==='aprobado'||p.status==='planificado'||p.status==='en_progreso';}).length + '</div><div class="lbl">En ejecución</div></div>' +
        '<div class="summary-chip"><div class="num">' + Object.keys(byCategory).length + '</div><div class="lbl">Áreas de trabajo</div></div>' +
        '<div class="summary-chip"><div class="num">' + projects.filter(function(p){return p.budget_eur;}).reduce(function(s,p){return s+(p.budget_eur||0);},0) + '€</div><div class="lbl">Presupuesto total</div></div>' +
      '</div>' +
      categorySections +
      '<div class="footer">' +
        '<div class="footer-brand">BRAVO!COMUNICA</div>' +
        '<div class="footer-note">Documento generado el ' + dateStr + ' · Confidencial</div>' +
      '</div>' +
    '</div>' +
    '<script>setTimeout(function(){ window.print(); }, 600);<\/script>' +
  '</body></html>';

  var win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  } else {
    showToast('⚠ Activa las ventanas emergentes para exportar el PDF');
  }
}

async function _loadClientProjects(clientId) {
  try {
    var res = await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(clientId));
    var data = await res.json();
    _clientProjects[clientId] = (data.projects && data.projects.length) ? data.projects : null;
  } catch(e) {
    _clientProjects[clientId] = null;
  }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function extractClientProjects(clientId) {
  if (!confirm('¿Regenerar los proyectos con Opus?\nOpus leerá el briefing completo y puede tardar 2-4 minutos.')) return;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  var startTime = Date.now();

  function updateLoadingMsg(secs) {
    if (!panel) return;
    var dots = '.'.repeat((secs % 3) + 1);
    panel.innerHTML = '<div class="cproj-loading">🧠 Opus está analizando el briefing' + dots +
      '<br><span style="font-size:0.75rem;color:#aaa">Tiempo transcurrido: ' + secs + 's</span></div>';
  }

  updateLoadingMsg(0);

  // 1. Avvia il job (ritorna subito)
  try {
    var startRes = await fetch(AGENT_API + '/api/briefing/extract-projects/' + encodeURIComponent(clientId), { method: 'POST' });
    if (!startRes.ok) {
      var errData = {}; try { errData = await startRes.json(); } catch(e) {}
      if (panel) panel.innerHTML = '<div class="cproj-loading" style="color:#c0392b">❌ ' + (errData.detail || 'Error al iniciar análisis') + '</div>';
      return;
    }
  } catch(e) {
    if (panel) panel.innerHTML = '<div class="cproj-loading" style="color:#c0392b">❌ No se pudo conectar al backend.<br><span style="font-size:0.72rem">' + (e.message || '') + '</span></div>';
    return;
  }

  // 2. Polling ogni 5s fino a completamento (max 5 minuti)
  var pollCount = 0;
  var maxPolls = 60;
  var pollTimer = setInterval(async function() {
    pollCount++;
    var secs = Math.floor((Date.now() - startTime) / 1000);
    updateLoadingMsg(secs);

    if (pollCount > maxPolls) {
      clearInterval(pollTimer);
      if (panel) panel.innerHTML = '<div class="cproj-loading" style="color:#c0392b">❌ Tiempo de espera agotado. Vuelve a intentarlo.</div>';
      return;
    }

    try {
      var statusRes = await fetch(AGENT_API + '/api/briefing/extract-projects/' + encodeURIComponent(clientId) + '/status');
      var statusData = await statusRes.json();

      if (statusData.status === 'done') {
        clearInterval(pollTimer);
        _clientProjects[clientId] = statusData.projects && statusData.projects.length ? statusData.projects : null;
        if (panel) panel.innerHTML = renderProyectosSection(clientId);
      } else if (statusData.status === 'error') {
        clearInterval(pollTimer);
        if (panel) panel.innerHTML = '<div class="cproj-loading" style="color:#c0392b">❌ ' + (statusData.error || 'Error en el análisis') + '</div>';
      }
      // status === 'running' → continua polling
    } catch(e) {
      // errore di rete temporaneo → riprova al prossimo poll
    }
  }, 5000);
}

async function advanceProjectStatus(clientId, projectId, newStatus) {
  await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(projectId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  var arr = _clientProjects[clientId];
  if (arr) { var p = arr.find(function(x){ return x.id === projectId; }); if(p) p.status = newStatus; }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
  var panelCal = document.querySelector('.ctab-panel[data-tab="calendario"]');
  if (panelCal) panelCal.innerHTML = renderCalendarioSection(clientId);
}

// Alias retrocompatibilità
function approveClientProject(clientId, projectId) { return advanceProjectStatus(clientId, projectId, 'aprobado'); }
function rejectClientProject(clientId, projectId)  { return advanceProjectStatus(clientId, projectId, 'rechazado'); }

// ── EDIT INLINE ──────────────────────────────────────────────────────────────

function startEditProject(clientId, projectId) {
  _editingProjId = projectId;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

function cancelEditProject(clientId) {
  _editingProjId = null;
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function saveEditProject(clientId, projectId) {
  var title       = document.getElementById('edit-title-'       + projectId);
  var desc        = document.getElementById('edit-desc-'        + projectId);
  var cat         = document.getElementById('edit-cat-'         + projectId);
  var month       = document.getElementById('edit-month-'       + projectId);
  var deliverable = document.getElementById('edit-deliverable-' + projectId);

  if (!title || !title.value.trim()) { showToast('El título no puede estar vacío'); return; }

  var body = {
    title:        title.value.trim(),
    description:  desc        ? desc.value.trim()        : undefined,
    category:     cat         ? cat.value                : undefined,
    month_target: month       ? month.value.trim()       : undefined,
    deliverable:  deliverable ? deliverable.value.trim() : undefined
  };

  try {
    await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(projectId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    // Aggiorna cache locale
    var arr = _clientProjects[clientId];
    if (arr) {
      var proj = arr.find(function(x){ return x.id === projectId; });
      if (proj) {
        proj.title        = body.title;
        proj.description  = body.description;
        proj.category     = body.category;
        proj.month_target = body.month_target;
        proj.deliverable  = body.deliverable;
      }
    }
    _editingProjId = null;
    showToast('✅ Proyecto actualizado');
  } catch(e) {
    showToast('Error al guardar. Intenta de nuevo.');
    return;
  }
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

// ── AUTO-LINK Proyectos → Agentes ────────────────────────────────────────────
var CAT_CONTENT = ['CONTENIDO','CAMPANA','ALIANZAS','SEO_LOCAL','CONVERSION'];

// ── SISTEMA SPRINT ──────────────────────────────────────────────────────────
// Un "sprint" è una sessione focalizzata su un solo deliverable:
// es. "12 feed posts" o "16 stories". Tiene traccia dell'avanzamento
// e pre-carica il contesto giusto nel form Agenti.

var _activeSprint = null; // { clientId, projectId, format, label, total, icon, fmtVal, done }
var _sprintPickerOpen = null; // projectId con picker aperto

// Parsa il testo del progetto e rileva i deliverable (feed/stories/reels)
function _parseDeliverables(text) {
  var t = (text || '').toLowerCase();
  var deliverables = [];
  var feedM  = t.match(/(\d+)\s*posts?\s*de\s*feed/);
  var storyM = t.match(/(\d+)\s*stories/);
  var reelM  = t.match(/(\d+)\s*reels?/);
  if (feedM)  deliverables.push({ format:'feed',  label:'Feed',    count:parseInt(feedM[1]),  icon:'📷', fmtVal:'post_instagram' });
  if (storyM) deliverables.push({ format:'story', label:'Stories', count:parseInt(storyM[1]), icon:'📲', fmtVal:'story_instagram' });
  if (reelM)  deliverables.push({ format:'reel',  label:'Reels',   count:parseInt(reelM[1]),  icon:'🎬', fmtVal:'reel_instagram'  });
  return deliverables;
}

// Rileva il formato di produzione corretto dal titolo/categoria/descrizione del progetto
function _detectProjectFormat(proj) {
  var t = ((proj.title || '') + ' ' + (proj.description || '') + ' ' + (proj.deliverable || '')).toLowerCase();
  var cat = (proj.category || '').toUpperCase();

  // Lavori di design / brand
  if (t.match(/brand\s*kit|kit\s*de\s*marca|identidad.*visual|manual.*marca/)) return { format:'brand_kit',  label:'Brand Kit',   count:1, icon:'🎨' };
  if (t.match(/logo|logotipo|isologo/))                                          return { format:'logo',       label:'Logotipo',    count:1, icon:'✏️' };
  if (t.match(/tipograf/))                                                        return { format:'tipografia', label:'Tipografía',  count:1, icon:'🔤' };
  if (t.match(/paleta|color.*corpora|colores/))                                  return { format:'paleta',     label:'Paleta',      count:1, icon:'🎨' };
  if (t.match(/manual|guía.*estilo|style.*guide/))                               return { format:'manual',     label:'Manual',      count:1, icon:'📖' };
  // Publicidad / SEO
  if (t.match(/google\s*ads|meta\s*ads|publicidad|campaña\s*ads/) || cat === 'PUBLICIDAD') return { format:'ads',    label:'Ads',        count:1, icon:'📣' };
  if (t.match(/seo|google\s*business|tripadvisor/) || cat === 'SEO_LOCAL')       return { format:'seo',        label:'SEO',         count:1, icon:'🔍' };
  // Newsletter / email
  if (t.match(/newsletter|email\s*marketing|mailing/))                           return { format:'newsletter', label:'Newsletter',  count:1, icon:'✉️' };
  // Fallback social
  return null; // usa _parseDeliverables
}

// Apre il selettore sprint nella card del progetto
function openSprintSelector(clientId, projectId) {
  var arr  = _clientProjects[clientId];
  var proj = arr ? arr.find(function(x){ return x.id === projectId; }) : null;
  if (!proj) { showToast('Proyecto no encontrado'); return; }

  var deliverables = _parseDeliverables((proj.description || '') + ' ' + (proj.deliverable || ''));

  // Nessun deliverable rilevabile → fallback al vecchio comportamento
  if (!deliverables.length) {
    _sendProyectoToAgentesFallback(clientId, proj);
    return;
  }

  // Se c'è solo un deliverable, avvia subito senza picker
  if (deliverables.length === 1) {
    startSprint(clientId, proj, deliverables[0]);
    return;
  }

  // Apre/chiude il picker inline
  if (_sprintPickerOpen === projectId) {
    _sprintPickerOpen = null;
  } else {
    _sprintPickerOpen = projectId;
  }
  // Rende la sezione Proyectos per aggiornare il DOM
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

// Avvia il sprint: imposta stato, cambia tab, inietta banner e contesto
function startSprint(clientId, proj, deliverable) {
  _sprintPickerOpen = null;
  _activeSprint = {
    clientId:  clientId,
    projectId: proj.id,
    projTitle: proj.title || '',
    format:    deliverable.format,
    label:     deliverable.label,
    total:     deliverable.count,
    icon:      deliverable.icon,
    fmtVal:    deliverable.fmtVal,
    done:      0
  };

  switchClienteTab('agenti');

  setTimeout(function() {
    // Pre-seleziona il formato nel selettore
    var fmtSel = document.getElementById('ag-format-' + clientId);
    if (fmtSel) { fmtSel.value = deliverable.fmtVal; fmtSel.dispatchEvent(new Event('change')); }

    // Inietta il contesto del sprint nella textarea "Instrucciones Bravo"
    var ta = document.getElementById('ag-bravo-textarea');
    if (ta) {
      var ctx = '🎯 Sprint: ' + deliverable.icon + ' ' + deliverable.count + ' ' + deliverable.label + '\n' +
        '📌 Proyecto: ' + (proj.title || '') + '\n' +
        (proj.description ? '\n' + proj.description : '') +
        (proj.deliverable  ? '\n\n📦 ' + proj.deliverable : '') +
        '\n\n—\nGenera el contenido respetando el brand kit del cliente. Cada pieza debe seguir las reglas visuales y de copy indicadas.';
      ta.value = ctx;
      ta.dispatchEvent(new Event('input'));
    }

    // Inietta il banner in cima alla sezione Agenti
    _agentiInjectSprintBanner(clientId);

    showToast(deliverable.icon + ' Sprint ' + deliverable.label + ' iniciado — ' + deliverable.count + ' piezas');
  }, 150);
}

// Inietta / aggiorna il banner sprint nel DOM del tab Agenti
function _agentiInjectSprintBanner(clientId) {
  var sp = _activeSprint;
  if (!sp || sp.clientId !== clientId) return;

  var pct  = sp.total > 0 ? Math.round((sp.done / sp.total) * 100) : 0;
  var done = sp.done;
  var tot  = sp.total;
  var isComplete = done >= tot;

  var banner = document.getElementById('sprint-banner-' + clientId);
  if (!banner) {
    // Crea il banner e inserisce prima del primo figlio della sezione Agenti
    var section = document.querySelector('.ctab-panel[data-tab="agenti"] .cliente-section');
    if (!section) return;
    banner = document.createElement('div');
    banner.id = 'sprint-banner-' + clientId;
    section.insertBefore(banner, section.firstChild);
  }

  banner.style.cssText = 'background:' + (isComplete ? '#e8fde9' : '#f0f8ff') +
    ';border:1.5px solid ' + (isComplete ? '#2d7a4f' : '#2980b9') +
    ';border-radius:10px;padding:0.9rem 1.1rem;margin-bottom:1rem';

  banner.innerHTML =
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem">' +
      '<div>' +
        '<div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:' + (isComplete?'#2d7a4f':'#1a6fa8') + ';margin-bottom:0.25rem">' +
          '🎯 Sprint activo' +
        '</div>' +
        '<div style="font-size:0.92rem;font-weight:600;color:#1a1a1a">' +
          sp.icon + ' ' + sp.label + ' · ' + sp.projTitle +
        '</div>' +
        '<div style="font-size:0.78rem;color:#555;margin-top:0.2rem">' +
          (isComplete
            ? '✅ Sprint completado — ' + done + '/' + tot + ' piezas generadas'
            : done + ' / ' + tot + ' piezas completadas') +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;align-items:center">' +
        (isComplete
          ? '<button onclick="closeActiveSprint(\'' + clientId + '\')" style="background:#2d7a4f;color:#fff;border:none;border-radius:6px;padding:0.4rem 0.9rem;font-size:0.78rem;cursor:pointer;font-weight:600">✓ Cerrar sprint</button>'
          : '<button onclick="closeActiveSprint(\'' + clientId + '\')" style="background:#f0f0f0;border:1px solid #ccc;border-radius:6px;padding:0.35rem 0.75rem;font-size:0.73rem;cursor:pointer;color:#555">✕ Cerrar</button>') +
      '</div>' +
    '</div>' +
    '<div style="margin-top:0.65rem;background:#e0e0e0;border-radius:99px;height:6px;overflow:hidden">' +
      '<div style="height:100%;width:' + pct + '%;background:' + (isComplete ? '#2d7a4f' : '#2980b9') + ';border-radius:99px;transition:width 0.4s ease"></div>' +
    '</div>';
}

// Chiude il sprint attivo
function closeActiveSprint(clientId) {
  _activeSprint = null;
  var banner = document.getElementById('sprint-banner-' + clientId);
  if (banner) banner.remove();
  showToast('Sprint cerrado');
}

// Incrementa il contatore sprint quando un post viene approvato
function sprintIncrementDone(clientId) {
  if (!_activeSprint || _activeSprint.clientId !== clientId) return;
  _activeSprint.done = (_activeSprint.done || 0) + 1;
  _agentiInjectSprintBanner(clientId);
}

// Fallback: comportamento precedente per progetti senza deliverable strutturati
function _sendProyectoToAgentesFallback(clientId, proj) {
  var brief = '📌 Proyecto: ' + (proj.title || '') + '\n' +
    (proj.description ? '\n📝 Descripción:\n' + proj.description : '') +
    (proj.deliverable ? '\n\n📦 Entregable: ' + proj.deliverable : '') +
    (proj.month_target ? '\n📅 Mes objetivo: ' + proj.month_target : '') +
    '\n\n—\nGenera el contenido para este proyecto siguiendo el briefing y el contexto de marca del cliente.';
  switchClienteTab('agenti');
  setTimeout(function() {
    var ta = document.getElementById('ag-bravo-textarea');
    if (ta) { ta.value = brief; ta.focus(); ta.dispatchEvent(new Event('input')); ta.scrollIntoView({ behavior:'smooth', block:'center' }); }
  }, 80);
  showToast('⚡ Brief del proyecto cargado en Agentes');
}

// Mantiene retrocompatibilità con eventuali chiamate residue
function sendProyectoToAgentes(clientId, projectId) {
  openSprintSelector(clientId, projectId);
}

// ── RENDER DEL PICKER SPRINT (inline nella card progetto) ───────────────────
function _renderSprintPicker(clientId, proj) {
  var deliverables = _parseDeliverables((proj.description || '') + ' ' + (proj.deliverable || ''));
  if (!deliverables.length) return '';

  return '<div style="margin-top:0.75rem;padding:0.75rem;background:#f8f8f8;border:1px solid #e0dbd2;border-radius:8px">' +
    '<div style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin-bottom:0.6rem">🎯 Selecciona el formato del sprint</div>' +
    '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">' +
    deliverables.map(function(d) {
      var isActive = _activeSprint && _activeSprint.projectId === proj.id && _activeSprint.format === d.format;
      var done = isActive ? (_activeSprint.done || 0) : 0;
      var pct  = isActive ? Math.round((done / d.count) * 100) : 0;
      return '<button onclick="startSprint(\'' + clientId + '\',' + JSON.stringify(proj).replace(/'/g,"\\'") + ',' + JSON.stringify(d).replace(/'/g,"\\'") + ')" ' +
        'style="flex:1;min-width:90px;padding:0.6rem 0.8rem;border:1.5px solid ' + (isActive ? '#2980b9' : '#d0ccc5') + ';' +
        'border-radius:8px;background:' + (isActive ? '#e8f4fd' : '#fff') + ';cursor:pointer;text-align:left">' +
        '<div style="font-size:1rem;margin-bottom:0.15rem">' + d.icon + '</div>' +
        '<div style="font-size:0.8rem;font-weight:600;color:#1a1a1a">' + d.count + ' ' + d.label + '</div>' +
        (isActive ? '<div style="font-size:0.68rem;color:#2980b9;margin-top:0.2rem">' + done + '/' + d.count + ' · ' + pct + '%</div>' : '') +
      '</button>';
    }).join('') +
    '</div>' +
  '</div>';
}

// ── MODAL PROGRAMAR ──────────────────────────────────────────────────────────

// Auto-suggerimento responsabile per categoria
var _catDefaultAssign = {
  CONTENIDO:  'Andrea Valdivia',
  CAMPANA:    'Andrea Valdivia',
  PUBLICIDAD: 'Carlos Lage',
  ALIANZAS:   'Andrea Valdivia',
  SEO_LOCAL:  'Andrea Valdivia',
  CONVERSION: 'Carlos Lage'
};

async function openProgramarModal(clientId, projectId, category) {
  var arr  = _clientProjects[clientId];
  var proj = arr ? arr.find(function(x){ return x.id === projectId; }) : null;
  var title = proj ? (proj.title || 'Programar proyecto') : 'Programar proyecto';
  _programarState = { clientId: clientId, projectId: projectId, category: category, title: title };
  // Carica tareas esistenti per questo progetto
  _programarTasks = [];
  try {
    var r = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/tasks');
    var d = await r.json();
    if (d.ok && d.tasks) _programarTasks = d.tasks;
  } catch(e) {}
  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
  var inlPanel = document.querySelector('.cproj-inline-panel');
  if (inlPanel) inlPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeProgramarModal() {
  var cid = _programarState.clientId;
  _programarState = { clientId: null, projectId: null, category: null, title: '' };
  _programarExpandedIdx = null;
  if (cid) {
    var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
    if (panel) panel.innerHTML = renderProyectosSection(cid);
  }
}

// ── MODAL PLAN OPUS ────────────────────────────────────────────────────────
var _DEFAULT_TEAM = [
  { name: 'Carlos Lage',       role: 'Filmmaker',           mode: 'human' },
  { name: 'Andrea Valdivia',   role: 'Social Media Manager', mode: 'human' },
  { name: 'Mari Almendros',    role: 'Brand Designer',       mode: 'human' },
  { name: 'Vicente Palazzolo', role: 'CEO & Sales',          mode: 'human' },
];

var _AI_AGENTS = [
  { key: 'copywriter', name: 'Agente Copywriter', role: 'Redacción y contenido',  icon: '✍️', desc: 'Genera posts, captions y copy para redes sociales', format: 'post_instagram' },
  { key: 'designer',   name: 'Agente Diseñador',  role: 'Diseño y creatividad',   icon: '🎨', desc: 'Aplica el layout de marca sobre la foto del rodaje',  format: 'feed' },
];

var _planSuggestState = { clientId: null, projectId: null, proj: null, cards: [], team: [], step: 1 };

// ============================================================
// FLUJO DE PRODUCCIÓN — Pre-rodaje · Rodaje · Post-rodaje
// ============================================================

function _addDays(dateStr, days) {
  var d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function _fmtDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

// 6 pasos comunes a todo el proyecto (se hacen una sola vez para todos los contenidos)
function _buildSharedSubtasks(shootingDate, team) {
  team = team || [];
  function ra(name) {
    var m = team.find(function(t){ return t.name === name; });
    if (!m || m._disabled) return 'Por asignar';
    return m.mode === 'ai' ? '🤖 Agente AI (' + m.role + ')' : name;
  }
  return [
    { phase:'pre',    name:'Script y guión',           assignee:ra('Andrea Valdivia'),   date:_addDays(shootingDate,-7), status:'todo', tip:'Definir mensajes clave y hilo narrativo de los contenidos. Compartir con Carlos antes del rodaje.' },
    { phase:'pre',    name:'Brief para el filmmaker',  assignee:ra('Carlos Lage'),       date:_addDays(shootingDate,-5), status:'todo', tip:'Lista de planos, recursos técnicos y material a llevar el día del rodaje.' },
    { phase:'pre',    name:'Confirmación logística',   assignee:ra('Vicente Palazzolo'), date:_addDays(shootingDate,-2), status:'todo', tip:'Confirmar fecha, hora, lugar y personas presentes con el cliente.' },
    { phase:'rodaje', name:'🎬 Día de rodaje',          assignee:ra('Carlos Lage'),       date:shootingDate,              status:'todo', tip:'Grabar todo el material previsto. Vicente acompaña al cliente.' },
    { phase:'post',   name:'Edición y montaje',        assignee:ra('Carlos Lage'),       date:_addDays(shootingDate,7),  status:'todo', tip:'Selección de material, corte, música y color para todas las piezas del mes.' },
    { phase:'post',   name:'Revisión del cliente',     assignee:ra('Vicente Palazzolo'), date:_addDays(shootingDate,12), status:'todo', tip:'Presentar el material editado y recoger aprobación o feedback.' },
  ];
}

// 2 pasos individuales por cada contenido (uno por card)
function _buildIndividualSubtasks(shootingDate, publishDate, team) {
  team = team || [];
  function ra(name) {
    var m = team.find(function(t){ return t.name === name; });
    if (!m || m._disabled) return 'Por asignar';
    return m.mode === 'ai' ? '🤖 Agente AI (' + m.role + ')' : name;
  }
  var photoDate   = shootingDate;
  var captionDate = _addDays(shootingDate, 9);
  var designDate  = _addDays(shootingDate, 11);
  var pubDate     = publishDate || _addDays(shootingDate, 14);
  return [
    { phase:'post', name:'Selección o creación de foto', assignee:'Agente Creativo', agent_type:'shooting', date:photoDate,   status:'todo', tip:'Busca la mejor foto del rodaje para este post. Si no hay fotos disponibles, genera un brief para crear la imagen con IA.' },
    { phase:'post', name:'Redacción de caption',         assignee:'Agente Copywriter', agent_type:'caption', date:captionDate, status:'todo', tip:'Usar el briefing de marca, la foto seleccionada y el guión como base. Incluir CTA y hashtags.' },
    { phase:'post', name:'Diseño del post',              assignee:'Agente Designer',   agent_type:'diseno',  date:designDate,  status:'todo', tip:'Tomar la foto aprobada + caption del Copywriter + brand kit del cliente → diseñar el post final.' },
    { phase:'pub',  name:'Preparar para publicación',    assignee:'Agente Publicador', agent_type:'publicacion', date:pubDate, status:'todo', tip:'Ensamblar imagen final + caption + hashtags. Dejar todo listo para publicación manual.' },
  ];
}

// Identifica la card "Producción compartida" entre las cards del piano
function _findSharedCard(cards) {
  for (var i = 0; i < cards.length; i++) {
    if (cards[i].format === 'shared') return { card: cards[i], index: i };
  }
  return null;
}

function _isSharedDone(cards) {
  var s = _findSharedCard(cards);
  if (!s) return false;
  var subs = s.card.subtasks || [];
  if (!subs.length) return false;
  return subs.every(function(x){ return x.status === 'done'; });
}

// Carga / guarda fecha de rodaje en Supabase vía PATCH
function _loadRodajeMeta(projectId) {
  // Cerca nel cache locale dei progetti per tutti i clienti
  var allProjs = [];
  Object.keys(_clientProjects || {}).forEach(function(cid) {
    var arr = _clientProjects[cid];
    if (Array.isArray(arr)) allProjs = allProjs.concat(arr);
  });
  var proj = allProjs.find(function(p) { return p.id === projectId; });
  // shooting_date è il nome reale della colonna Supabase
  if (proj && proj.shooting_date) return { date: proj.shooting_date, approx: false };
  return { date: '', approx: false };
}

function _saveRodajeMeta(projectId, date, approx) {
  // Aggiorna cache locale (in-memory, non localStorage)
  Object.keys(_clientProjects || {}).forEach(function(cid) {
    var arr = _clientProjects[cid];
    if (Array.isArray(arr)) {
      var proj = arr.find(function(p) { return p.id === projectId; });
      if (proj) { proj.shooting_date = date; }
    }
  });
  // Salva su Supabase tramite PATCH
  fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(projectId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shooting_date: date || null })
  }).catch(function(e) { console.warn('[BRAVO] Errore salvataggio rodaje_date:', e); });
}

// Genera el flujo completo: una card compartida + las individuales con sólo caption y programación
async function generateAllWorkflowPlans() {
  var dateInput = document.getElementById('rodaje-date-input');
  var approxCb  = document.getElementById('rodaje-approx');
  var isApprox  = !!(approxCb && approxCb.checked);
  var sd        = dateInput ? dateInput.value : '';

  if (!sd && !isApprox) {
    showToast('⚠️ Introduce la fecha de rodaje (o marca "Por confirmar")');
    return;
  }
  if (!sd && isApprox) {
    var d = new Date(); d.setDate(d.getDate() + 21);
    sd = d.toISOString().slice(0, 10);
  }

  _planSuggestState.shooting_date        = sd;
  _planSuggestState.shooting_date_approx = isApprox;
  _saveRodajeMeta(_planSuggestState.projectId, sd, isApprox);

  var cards = _planSuggestState.cards;
  var sharedExists = _findSharedCard(cards);
  var team = _planSuggestState.team || [];
  var sharedSubs = _buildSharedSubtasks(sd, team);
  var st = _planSuggestState;

  // Actualiza subtasks en memoria para todas las cards
  cards.forEach(function(card) {
    if (card.format === 'shared') {
      card.subtasks = sharedSubs;
    } else {
      card.subtasks = _buildIndividualSubtasks(sd, card.publish_date, team);
    }
    card.status = 'todo';
  });

  if (sharedExists) {
    // Caso A: ya existe la card compartida → sólo patch a cada una (todas tienen _db_id)
    cards.forEach(function(card){ if (card._db_id) _patchPlanCard(card); });
    document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(cards);
    showToast('✦ Plan recalculado con la nueva fecha');
    return;
  }

  // Caso B: primera vez → patch a las que tengan _db_id + POST de la nueva shared, luego reload
  var newShared = {
    title:        'Producción compartida',
    format:       'shared',
    publish_date: sd,
    assignee:     'Equipo Bravo',
    creative_note:'Pasos comunes a todos los contenidos del proyecto. Hasta que no estén completados, las publicaciones individuales quedan en espera.',
    subtasks:     sharedSubs,
    status:       'todo',
  };

  // Tutte le card individuali — con o senza _db_id (UPSERT le aggiorna se esistono già)
  var allIndividuals = cards.filter(function(c){ return c.format !== 'shared'; });

  // Guarda en Supabase: la nueva shared + TODAS las individuales
  var toSave = [newShared].concat(allIndividuals);
  showToast('Generando plan completo…');
  await _savePlanTasksToSupabase(st.clientId, st.projectId, st.proj, toSave);
  // Reload para coger los _db_id
  openPlanSuggest(st.clientId, st.projectId);
}

// Render del panel "Organizar producción" en la cabecera
function _renderRodajeOrganizer(cards) {
  var sd       = _planSuggestState.shooting_date || '';
  var approx   = !!_planSuggestState.shooting_date_approx;
  var hasShared= !!_findSharedCard(cards);

  // Si ya está montado todo el flujo, sólo un resumen colapsado
  if (hasShared && sd) {
    var label = _fmtDateShort(sd) + (approx ? ' (aprox.)' : '');
    var sharedDone = _isSharedDone(cards);
    var statusBg   = sharedDone ? '#f0fdf4' : '#fff8e7';
    var statusBd   = sharedDone ? '#bbf7d0' : '#fde68a';
    var statusCol  = sharedDone ? '#15803d' : '#92400e';
    var statusTxt  = sharedDone ? '✅ Producción compartida lista — publicaciones desbloqueadas' : '⏳ Producción compartida en curso — publicaciones en espera';
    return '<div style="background:'+statusBg+';border:1.5px solid '+statusBd+';border-radius:10px;padding:0.7rem 1rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.7rem;flex-wrap:wrap">' +
      '<span style="font-size:1.1rem">🎬</span>' +
      '<div style="flex:1;min-width:180px;font-size:0.75rem;color:'+statusCol+'"><strong>Rodaje:</strong> '+label+' · '+statusTxt+'</div>' +
      '<button onclick="openRodajePhotos()" style="font-size:0.68rem;padding:0.25rem 0.7rem;background:#2563eb;border:none;border-radius:6px;cursor:pointer;color:#fff;font-weight:700">📁 Material</button>' +
      '<button onclick="_showRodajeEditor()" style="font-size:0.68rem;padding:0.25rem 0.7rem;background:#fff;border:1px solid '+statusBd+';border-radius:6px;cursor:pointer;color:'+statusCol+'">✏️ Cambiar fecha</button>' +
    '</div>';
  }

  // Setup inicial
  var todayPlus21 = new Date(); todayPlus21.setDate(todayPlus21.getDate() + 21);
  var defaultDate = sd || todayPlus21.toISOString().slice(0, 10);
  var nCards = cards.filter(function(c){ return c.format !== 'shared'; }).length;

  return '<div id="rodaje-organizer" style="background:#fff;border:2px solid #C29547;border-radius:12px;padding:1rem 1.1rem;margin-bottom:1.2rem">' +
    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">' +
      '<span style="font-size:1.1rem">🎬</span>' +
      '<div style="font-size:0.85rem;font-weight:700;color:#1F2A24">Organizar la producción</div>' +
    '</div>' +
    '<div style="font-size:0.73rem;color:#666;margin-bottom:0.9rem;line-height:1.5">Para crear los <strong>'+nCards+' contenidos</strong> hace falta un día de rodaje. A partir de esa fecha el sistema organiza al equipo: pre-rodaje (script, brief, logística), día de rodaje, edición, revisión del cliente y publicación.</div>' +
    '<div style="font-size:0.7rem;font-weight:600;color:#555;margin-bottom:0.35rem;text-transform:uppercase;letter-spacing:0.05em">📅 Fecha de rodaje</div>' +
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.8rem;flex-wrap:wrap;align-items:center">' +
      '<input type="date" id="rodaje-date-input" value="'+defaultDate+'" style="flex:1;min-width:150px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:7px;font-size:0.82rem;background:#fff">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:#888;cursor:pointer;white-space:nowrap;user-select:none">' +
        '<input type="checkbox" id="rodaje-approx" '+(approx?'checked':'')+'> Aún por confirmar' +
      '</label>' +
    '</div>' +
    '<button onclick="generateAllWorkflowPlans()" style="width:100%;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:9px;padding:0.65rem 1rem;font-size:0.82rem;font-weight:700;cursor:pointer">✦ Generar plan completo para el equipo</button>' +
  '</div>';
}

function _showRodajeEditor() {
  // Re-abre el editor borrando provisionalmente la marca de "ya organizado"
  var sd = _planSuggestState.shooting_date;
  var approx = _planSuggestState.shooting_date_approx;
  var body = document.getElementById('planSuggestBody');
  if (!body) return;
  // Forzamos render del organizer en modo setup mostrando un mini-form encima de las cards
  var nCards = _planSuggestState.cards.filter(function(c){ return c.format !== 'shared'; }).length;
  body.querySelector('#rodaje-organizer-edit') && body.querySelector('#rodaje-organizer-edit').remove();
  var editor = document.createElement('div');
  editor.id = 'rodaje-organizer-edit';
  editor.style.cssText = 'background:#fff;border:2px solid #C29547;border-radius:12px;padding:1rem 1.1rem;margin-bottom:1rem';
  editor.innerHTML =
    '<div style="font-size:0.82rem;font-weight:700;color:#1F2A24;margin-bottom:0.7rem">🎬 Cambiar fecha de rodaje</div>' +
    '<div style="font-size:0.7rem;color:#888;margin-bottom:0.6rem">Al confirmar se recalcularán las fechas del flujo compartido y de las '+nCards+' card individuales.</div>' +
    '<div style="display:flex;gap:0.5rem;margin-bottom:0.7rem;flex-wrap:wrap;align-items:center">' +
      '<input type="date" id="rodaje-date-input" value="'+(sd||'')+'" style="flex:1;min-width:150px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:7px;font-size:0.82rem">' +
      '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:#888;cursor:pointer;white-space:nowrap"><input type="checkbox" id="rodaje-approx" '+(approx?'checked':'')+'> Aún por confirmar</label>' +
    '</div>' +
    '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
      '<button onclick="this.closest(\'#rodaje-organizer-edit\').remove()" style="font-size:0.72rem;padding:0.35rem 0.8rem;background:none;border:1px solid #e0dbd2;border-radius:6px;cursor:pointer;color:#888">Cancelar</button>' +
      '<button onclick="generateAllWorkflowPlans()" style="font-size:0.72rem;padding:0.4rem 1rem;background:#1F2A24;color:#C29547;border:none;border-radius:6px;cursor:pointer;font-weight:700">✓ Recalcular</button>' +
    '</div>';
  body.insertBefore(editor, body.firstChild);
}

async function openPlanSuggest(clientId, projectId) {
  var projects = _clientProjects[clientId] || [];
  var proj = projects.find(function(p){ return p.id === projectId; });
  if (!proj) { showToast('Proyecto no encontrado'); return; }

  var overlay  = document.getElementById('planSuggestOverlay');
  var subtitle = document.getElementById('planSuggestSubtitle');
  var body     = document.getElementById('planSuggestBody');
  var footer   = document.getElementById('planSuggestFooter');

  // Team: sempre tutti i membri (4 umani + 6 agenti AI)
  var team = _teamMembers.map(function(m) {
    if (m.employment_type === 'agent') {
      return { name: m.name, role: m.role, mode: 'ai', _agentIcon: m.initials, _agentKey: m._agentKey };
    }
    return { name: m.name, role: m.role, mode: 'human' };
  });

  _planSuggestState = { clientId: clientId, projectId: projectId, proj: proj, cards: [], team: team, step: 1, shooting_date: '' };
  if (subtitle) subtitle.textContent = proj.title || '';
  overlay.style.display = '';

  // Controlla se esiste già un piano salvato per questo progetto
  body.innerHTML = '<div style="text-align:center;padding:2rem;color:#888;font-size:0.82rem">Cargando…</div>';
  footer.style.display = 'none';

  try {
    var res  = await fetch(BRAVO_API + '/api/plan-tasks?project_id=' + encodeURIComponent(projectId));
    var data = await res.json();
    var saved = (data.tasks || []).filter(function(t){ return t.project_id === projectId; });

    if (saved.length > 0) {
      // Piano già salvato → mostra direttamente le card esistenti
      _planSuggestState.cards = saved.map(function(t) {
        return {
          title:        t.title || '',
          publish_date: t.publish_date || '',
          assignee:     t.assignee || '',
          format:       t.format || '',
          pillar:       t.pillar || '',
          creative_note:t.creative_note || '',
          status:       t.status || 'todo',
          subtasks:     typeof t.subtasks === 'string' ? JSON.parse(t.subtasks || '[]') : (t.subtasks || []),
          _db_id:       t.id,
          _db_id_confirmed: true
        };
      });
      // Carga fecha de rodaje: prima dalla shared card salvata, poi dal cache progetto
      var rmeta = _loadRodajeMeta(projectId);
      if (!rmeta.date) {
        var sharedCard = _planSuggestState.cards.find(function(c){ return c.format === 'shared'; });
        if (sharedCard && sharedCard.publish_date) rmeta.date = sharedCard.publish_date;
      }
      _planSuggestState.shooting_date        = rmeta.date;
      _planSuggestState.shooting_date_approx = rmeta.approx;
      body.innerHTML = _renderPlanCards(_planSuggestState.cards);
      footer.style.display = 'flex';
      footer.innerHTML =
        '<button onclick="_renderPlanStep1()" style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.55rem 1.2rem;cursor:pointer;font-size:0.82rem;color:#555">🧠 Regenerar con Opus</button>' +
        '<div style="display:flex;gap:0.5rem">' +
          '<button onclick="openRodajePhotos()" style="background:#f5f3ef;border:1.5px solid #2563eb;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#2563eb;font-weight:600">📁 Material</button>' +
          '<button onclick="openBriefingRodaje()" style="background:#f5f3ef;border:1.5px solid #C29547;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#C29547;font-weight:600">📋 Briefing</button>' +
          '<button onclick="confirmPlan()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.55rem 1.4rem;cursor:pointer;font-size:0.82rem;font-weight:700">✦ Confirmar cambios</button>' +
        '</div>';
    } else {
      // Nessun piano → inizia dal passo 1 (selezione team)
      _renderPlanStep1();
    }
  } catch(e) {
    console.warn('[PLAN] Error al cargar plan:', e.message);
    showToast('⚠️ Error al cargar plan: ' + (e.message || 'error de conexión'));
    _renderPlanStep1();
  }
}

// Mapa de clave de agente → etiqueta e icono legibles
var _AGENT_LABELS = {
  market_researcher:  { icon: '🔍', label: 'Agente Investigador',  role: 'Investigación de mercado y análisis' },
  strategist:         { icon: '🧭', label: 'Agente Estratega',     role: 'Estrategia editorial y planificación' },
  content_designer:   { icon: '✍️', label: 'Agente Copywriter',    role: 'Redacción de captions y textos' },
  designer:           { icon: '🎨', label: 'Agente Diseñador',     role: 'Diseño visual y brand kit' },
  metrics_analyst:    { icon: '📊', label: 'Agente Métricas',      role: 'KPIs, reportes y análisis de resultados' },
  audio_transcriber:  { icon: '🎙️', label: 'Agente Transcriptor', role: 'Transcripción de audio y vídeo' },
};

function _renderPlanStep1() {
  var body   = document.getElementById('planSuggestBody');
  var footer = document.getElementById('planSuggestFooter');
  var team   = _planSuggestState.team;
  var proj   = _planSuggestState.proj || {};

  // ── Bloque agente sugerido por Opus ─────────────────────────────────────
  var agentKey    = proj.responsible_agent || '';
  var agentInfo   = _AGENT_LABELS[agentKey] || null;
  var coAgents    = Array.isArray(proj.co_agents) ? proj.co_agents : [];
  var miniBrief   = proj.mini_brief || '';

  var agentBlock = '';
  if (agentInfo) {
    var coAgentsHtml = coAgents.length
      ? '<div style="margin-top:0.5rem;display:flex;gap:0.4rem;flex-wrap:wrap">' +
          coAgents.map(function(k) {
            var co = _AGENT_LABELS[k];
            return co ? '<span style="font-size:0.68rem;padding:0.2rem 0.55rem;background:#f0f8f0;border:1px solid #c3e8d0;border-radius:20px;color:#2d7a4f">' + co.icon + ' ' + co.label + '</span>' : '';
          }).join('') +
        '</div>'
      : '';

    var miniBriefHtml = miniBrief
      ? '<div style="margin-top:0.6rem;font-size:0.72rem;color:#555;line-height:1.5;background:#fef9f0;padding:0.6rem 0.75rem;border-radius:7px;border-left:3px solid #C29547">' +
          '<span style="font-size:0.65rem;font-weight:700;color:#C29547;text-transform:uppercase;letter-spacing:0.07em">Mini-brief de Opus</span><br>' +
          miniBrief.replace(/\n/g, '<br>') +
        '</div>'
      : '';

    agentBlock =
      '<div style="margin-bottom:1rem;padding:0.85rem 1rem;background:#f2faf5;border:1.5px solid #c3e8d0;border-radius:10px">' +
        '<div style="font-size:0.65rem;font-weight:700;color:#2d7a4f;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.4rem">Agente asignado por Opus</div>' +
        '<div style="display:flex;align-items:center;gap:0.65rem">' +
          '<span style="font-size:1.4rem">' + agentInfo.icon + '</span>' +
          '<div>' +
            '<div style="font-weight:700;font-size:0.85rem;color:#1F2A24">' + agentInfo.label + '</div>' +
            '<div style="font-size:0.7rem;color:#555">' + agentInfo.role + '</div>' +
          '</div>' +
        '</div>' +
        coAgentsHtml +
        miniBriefHtml +
      '</div>';
  }

  // ── Filas del equipo ─────────────────────────────────────────────────────
  var rows = team.map(function(m, i) {
    // ── Agente AI puro: fila semplice senza toggle ──
    if (m._agentKey) {
      var agInfo = _AGENT_LABELS[m._agentKey] || {};
      return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.55rem 0;border-bottom:1px solid #f0ece5">' +
        '<div style="width:34px;height:34px;border-radius:50%;background:' + _teamColorFor(m.name) + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.85rem;flex-shrink:0">' + (agInfo.icon || '🤖') + '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:0.82rem;color:#1F2A24">' + (agInfo.label || m.name) + '</div>' +
          '<div style="font-size:0.7rem;color:#888">' + (agInfo.role || m.role) + '</div>' +
        '</div>' +
        '<span style="font-size:0.68rem;padding:0.2rem 0.6rem;background:#f0f8f0;border:1px solid #c3e8d0;border-radius:20px;color:#2d7a4f;font-weight:600;white-space:nowrap">🤖 Agente AI</span>' +
      '</div>';
    }

    var isAI    = m.mode === 'ai';
    var isExtra = m._extra;
    var isAndrea = m.name === 'Andrea Valdivia';

    var avatar = '<div style="width:34px;height:34px;border-radius:50%;background:' + _teamColorFor(m.name) + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;font-weight:700;flex-shrink:0">' +
      (isAI ? '🤖' : _teamInitialsFor(m.name)) +
    '</div>';

    var controls =
      '<button onclick="setPlanTeamMode(' + i + ',\'human\')" style="padding:0.25rem 0.6rem;border-radius:6px;font-size:0.7rem;font-weight:600;cursor:pointer;border:1.5px solid ' + (!isAI?'#1F2A24':'#e0dbd2') + ';background:' + (!isAI?'#1F2A24':'#fff') + ';color:' + (!isAI?'#C29547':'#888') + '">👤 Persona</button>' +
      '<button onclick="setPlanTeamMode(' + i + ',\'ai\')" style="padding:0.25rem 0.6rem;border-radius:6px;font-size:0.7rem;font-weight:600;cursor:pointer;border:1.5px solid ' + (isAI?'#C29547':'#e0dbd2') + ';background:' + (isAI?'#1F2A24':'#fff') + ';color:' + (isAI?'#C29547':'#888') + '">🤖 Agente AI</button>';

    var agentsBlock = '';

    return '<div>' +
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.7rem 0;border-bottom:1px solid #f0ece5">' +
        avatar +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:600;font-size:0.82rem;color:#1F2A24">' + m.name + '</div>' +
          '<div style="font-size:0.7rem;color:#888">' + m.role + (isAndrea ? ' — copy, estrategia y publicación' : '') + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:0.3rem">' + controls + '</div>' +
        (isExtra ? '<button onclick="removePlanTeamMember(' + i + ')" style="background:none;border:none;color:#c0392b;cursor:pointer;font-size:0.9rem;padding:0 0.2rem">✕</button>' : '') +
      '</div>' +
      agentsBlock +
    '</div>';
  }).join('');

  body.innerHTML =
    agentBlock +
    '<div style="font-size:0.75rem;color:#888;margin-bottom:0.7rem;padding:0.6rem 0.8rem;background:#fef9f0;border-radius:8px;border-left:3px solid #C29547">' +
      'Equipo completo del proyecto. Para cada persona puedes elegir si trabaja como <strong>Persona</strong> o la sustituye un <strong>Agente AI</strong>.' +
    '</div>' +
    rows +
    '<button onclick="addPlanTeamMember()" style="margin-top:0.8rem;width:100%;padding:0.55rem;border:1.5px dashed #e0dbd2;border-radius:8px;background:#fafaf8;color:#888;cursor:pointer;font-size:0.8rem">+ Añadir miembro al proyecto</button>' +
    '<div id="planAddMemberForm" style="display:none;margin-top:0.6rem;gap:0.5rem;flex-wrap:wrap">' +
      '<input id="planNewName" placeholder="Nombre" style="flex:1;min-width:120px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:8px;font-size:0.8rem">' +
      '<input id="planNewRole" placeholder="Rol (ej. Fotógrafo)" style="flex:1;min-width:120px;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:8px;font-size:0.8rem">' +
      '<button onclick="confirmAddPlanMember()" style="padding:0.45rem 0.9rem;background:#1F2A24;color:#C29547;border:none;border-radius:8px;font-size:0.8rem;font-weight:700;cursor:pointer">Añadir</button>' +
    '</div>' +
    '<div style="margin-top:1.2rem;padding:0.9rem 1rem;background:#fafaf8;border:1.5px solid #e0dbd2;border-radius:10px">' +
      '<div style="font-size:0.75rem;font-weight:700;color:#1F2A24;margin-bottom:0.5rem">📅 Fecha de onboarding del cliente</div>' +
      '<div style="font-size:0.72rem;color:#888;margin-bottom:0.6rem">Fecha en que comienza el trabajo con el cliente. El plan de producción se organiza a partir de este punto.</div>' +
      '<input type="date" id="planShootingDate" value="' + (_planSuggestState.shooting_date || '') + '" style="width:100%;padding:0.45rem 0.7rem;border:1.5px solid #e0dbd2;border-radius:8px;font-size:0.82rem;background:#fff;color:#1F2A24" onchange="_planSuggestState.shooting_date=this.value">' +
      '<div style="font-size:0.68rem;color:#aaa;margin-top:0.3rem">Opcional — si no lo sabes todavía, déjalo vacío</div>' +
    '</div>';

  footer.style.display = 'flex';
  footer.innerHTML =
    '<button onclick="closePlanSuggest()" style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.55rem 1.2rem;cursor:pointer;font-size:0.82rem;color:#555">Cancelar</button>' +
    '<button onclick="runPlanGeneration()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.55rem 1.4rem;cursor:pointer;font-size:0.82rem;font-weight:700">✦ Generar plan →</button>';
}

function setTodoAutomatico() {
  _planSuggestState.team.forEach(function(m, i) {
    if (!m._agentKey) {
      _planSuggestState.team[i].mode = 'ai';
    }
  });
  // Attiva tutti gli agenti puri
  _planSuggestState.team.forEach(function(t) {
    if (t._agentKey) t._disabled = false;
  });
  _renderPlanStep1();
}

function setPlanTeamMode(idx, mode) {
  _planSuggestState.team[idx].mode = mode;
  // Se stiamo cambiando Andrea → sincronizza gli agenti puri
  var m = _planSuggestState.team[idx];
  if (m.name === 'Andrea Valdivia') {
    _planSuggestState.team.forEach(function(t) {
      if (t._agentKey) t._disabled = (mode === 'human'); // AI attivi solo se Andrea è AI
    });
  }
  _renderPlanStep1();
}

function togglePlanAgent(idx) {
  _planSuggestState.team[idx]._disabled = !_planSuggestState.team[idx]._disabled;
  _renderPlanStep1();
}

function addPlanTeamMember() {
  var form = document.getElementById('planAddMemberForm');
  if (form) form.style.display = form.style.display === 'none' ? 'flex' : 'none';
}

function confirmAddPlanMember() {
  var name = (document.getElementById('planNewName') || {}).value || '';
  var role = (document.getElementById('planNewRole') || {}).value || '';
  if (!name.trim()) return;
  _planSuggestState.team.push({ name: name.trim(), role: role.trim() || 'Colaborador', mode: 'human', _extra: true });
  _renderPlanStep1();
}

function removePlanTeamMember(idx) {
  _planSuggestState.team.splice(idx, 1);
  _renderPlanStep1();
}

async function runPlanGeneration() {
  var body   = document.getElementById('planSuggestBody');
  var footer = document.getElementById('planSuggestFooter');
  var state  = _planSuggestState;
  var proj   = state.proj;

  // Se esiste già un piano salvato, chiede conferma prima di sovrascrivere
  if (state.cards && state.cards.length > 0) {
    var ok = confirm('⚠️ Ya existe un plan para este proyecto.\n\n¿Eliminar el plan actual y generar uno nuevo con Opus?');
    if (!ok) return;
    state.cards = [];
  }

  body.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2rem;margin-bottom:1rem">✦</div><div style="color:#888;font-size:0.85rem">Opus construyendo el plan con el briefing guardado…<br><span style="font-size:0.75rem;color:#bbb;margin-top:0.5rem;display:block">15-30 segundos</span></div></div>';
  footer.style.display = 'none';

  var deliverables = _parseDeliverables((proj.description || '') + ' ' + (proj.deliverable || '') + ' ' + (proj.title || ''));
  var del = deliverables[0] || _detectProjectFormat(proj) || { format: 'feed', label: 'Feed', count: 4, fmtVal: 'post_instagram' };
  var startDate = new Date().toISOString().slice(0, 10);

  // Prepara team per il backend
  var teamForApi = state.team.map(function(m) {
    return { name: m.mode === 'ai' ? '🤖 Agente AI (' + m.role + ')' : m.name, role: m.role, mode: m.mode };
  });

  try {
    var res = await fetch(AGENT_API + '/api/projects/suggest-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:           state.clientId,
        project_id:          state.projectId || null,
        project_title:       proj.title || '',
        project_description: proj.description || '',
        deliverable_format:  del.format,
        deliverable_count:   del.count,
        start_date:          startDate,
        shooting_date:       state.shooting_date || null,
        publish_days:        ['monday', 'wednesday', 'friday'],
        team:                teamForApi,
        responsible_agent:   proj.responsible_agent || null,
        mini_brief:          proj.mini_brief || null
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.detail || 'Error');
    // Assegna UUID stabile a ogni card generata da Opus (serve per UPSERT lato backend)
    state.cards = (data.plan.cards || []).map(function(c) {
      if (!c._db_id) c._db_id = crypto.randomUUID();
      return c;
    });
    state.briefing_rodaje = null;
    var bSrc = data.briefing_source || 'none';
    var bLabel = bSrc === 'distilled' ? '📄 Briefing: cargado desde Supabase' :
                 bSrc === 'full_truncated' ? '📄 Briefing: texto guardado (sin distilado)' :
                 '⚠️ Briefing: no disponible — sube el briefing del cliente';
    var bColor = bSrc === 'none' ? '#c0392b' : '#2d7a4f';
    var dbg = data._debug ? ' | uuid:' + (data._debug.client_uuid||'?') + ' brand:' + data._debug.brand_found + ' brief:' + data._debug.briefing_found : '';
    body.innerHTML = '<div style="font-size:0.72rem;color:' + bColor + ';padding:0.4rem 0.8rem;margin-bottom:0.5rem;background:' + (bSrc === 'none' ? '#fdf2f2' : '#f2faf5') + ';border-radius:6px;border:1px solid ' + (bSrc === 'none' ? '#f5c6c6' : '#c3e8d0') + '">' + bLabel + dbg + '</div>' + _renderPlanCards(state.cards);
    footer.style.display = 'flex';
    footer.innerHTML = _planFooterWithBriefing();
    // Auto-salva subito dopo generazione — così il piano sopravvive al reload della pagina
    _savePlanTasksToSupabase(state.clientId, state.projectId, state.proj, state.cards).catch(function(e){ console.warn('[PLAN] Auto-save fallito:', e); });
  } catch(e) {
    body.innerHTML = '<div style="color:#c0392b;padding:1.5rem;text-align:center">❌ ' + (e.message || e) + '</div>';
    footer.style.display = 'flex';
  }
}

function _planFooterWithBriefing() {
  return '<button onclick="_renderPlanStep1()" style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.55rem 1.2rem;cursor:pointer;font-size:0.82rem;color:#555">← Modificar equipo</button>' +
    '<div style="display:flex;gap:0.5rem">' +
      '<button onclick="openRodajePhotos()" style="background:#f5f3ef;border:1.5px solid #2563eb;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#2563eb;font-weight:600">📁 Material</button>' +
      '<button onclick="openBriefingRodaje()" style="background:#f5f3ef;border:1.5px solid #C29547;border-radius:8px;padding:0.55rem 1.1rem;cursor:pointer;font-size:0.82rem;color:#C29547;font-weight:600">📋 Briefing</button>' +
      '<button onclick="confirmPlan()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.55rem 1.4rem;cursor:pointer;font-size:0.82rem;font-weight:700">✦ Confirmar plan</button>' +
    '</div>';
}

// ── BRIEFING DE RODAJE ─────────────────────────────────────────────────────

async function openRodajePhotos() {
  var state = _planSuggestState;
  if (!state.projectId) { showToast('Confirma primero el plan'); return; }

  var existing = document.getElementById('rodajePhotosOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'rodajePhotosOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1300;display:flex;align-items:center;justify-content:center;padding:1rem';

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:680px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 8px 40px rgba(0,0,0,0.18)">' +
      '<div style="padding:1.1rem 1.4rem;background:linear-gradient(135deg,#1a4fa8,#2563eb);display:flex;align-items:center;justify-content:space-between;flex-shrink:0">' +
        '<div>' +
          '<div style="font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:0.2rem">Material del rodaje</div>' +
          '<div style="font-weight:700;font-size:1rem;color:#fff">📁 Fotos del proyecto</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'rodajePhotosOverlay\').remove()" style="background:rgba(255,255,255,0.15);border:none;border-radius:8px;padding:0.4rem 0.7rem;cursor:pointer;color:#fff;font-size:0.85rem">✕</button>' +
      '</div>' +
      '<div style="padding:1rem 1.4rem;border-bottom:1px solid #e0dbd2;flex-shrink:0">' +
        '<div style="font-size:0.78rem;color:#555;margin-bottom:0.8rem">Sube todas las fotos del rodaje. Claude Vision analizará cada una y creará un mini briefing para que los agentes puedan generar captions sin verlas.</div>' +
        '<label style="display:flex;align-items:center;gap:0.7rem;padding:0.7rem 1rem;background:#f0f4ff;border:2px dashed #2563eb;border-radius:10px;cursor:pointer">' +
          '<span style="font-size:1.3rem">📸</span>' +
          '<span style="font-size:0.82rem;color:#2563eb;font-weight:600">Seleccionar fotos (múltiple)</span>' +
          '<input type="file" id="rodajeFileInput" multiple accept="image/*" style="display:none" onchange="uploadRodajePhotos(this)">' +
        '</label>' +
      '</div>' +
      '<div id="rodajeUploadProgress" style="display:none;padding:0.7rem 1.4rem;background:#f0f4ff;border-bottom:1px solid #e0dbd2;font-size:0.78rem;color:#2563eb;flex-shrink:0"></div>' +
      '<div id="rodajePhotosGrid" style="flex:1;overflow-y:auto;padding:1rem 1.4rem">' +
        '<div style="text-align:center;color:#aaa;padding:2rem;font-size:0.82rem">Cargando fotos guardadas…</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  _loadRodajePhotosGrid(state.clientId, state.projectId);
}

async function _loadRodajePhotosGrid(clientId, projectId) {
  var grid = document.getElementById('rodajePhotosGrid');
  if (!grid) return;
  console.log('[RODAJE] caricamento foto — clientId:', clientId, 'projectId:', projectId);
  try {
    var res  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/rodaje-photos?client_id=' + encodeURIComponent(clientId));
    var data = await res.json();
    console.log('[RODAJE] risposta backend:', data);
    var photos = data.photos || [];
    if (!photos.length) {
      grid.innerHTML = '<div style="text-align:center;color:#aaa;padding:2rem;font-size:0.82rem">Sin fotos aún — sube el material del rodaje.</div>';
      return;
    }
    grid.innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:0.8rem">' +
      photos.map(function(p) {
        return '<div style="border:1.5px solid #e0dbd2;border-radius:10px;overflow:hidden;background:#fafaf8">' +
          '<div style="position:relative;padding-top:66%;background:#f0ece5">' +
            '<img src="' + p.url + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" loading="lazy">' +
          '</div>' +
          '<div style="padding:0.55rem 0.6rem">' +
            '<div style="font-size:0.62rem;font-weight:700;color:#1F2A24;margin-bottom:0.3rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + (p.filename||'') + '">' + (p.filename||'foto') + '</div>' +
            '<div style="font-size:0.68rem;color:#555;line-height:1.45">' + (p.scene_description || '<em style="color:#aaa">Sin análisis</em>') + '</div>' +
          '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  } catch(e) {
    grid.innerHTML = '<div style="color:#c0392b;padding:1rem;font-size:0.8rem">Error al cargar fotos: ' + (e.message||'') + '</div>';
  }
}

async function uploadRodajePhotos(input) {
  var state = _planSuggestState;
  var files = Array.from(input.files || []);
  if (!files.length) return;

  var progress = document.getElementById('rodajeUploadProgress');
  if (progress) progress.style.display = '';

  var ok = 0, fail = 0, lastError = '';
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    if (progress) progress.textContent = '⏳ Analizando foto ' + (i+1) + ' de ' + files.length + ': ' + f.name + '…';
    try {
      var fd = new FormData();
      fd.append('file', f);
      fd.append('client_id', state.clientId);
      var res  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(state.projectId) + '/upload-media', { method:'POST', body:fd });
      var data = await res.json();
      if (data.ok) {
        ok++;
      } else {
        fail++;
        lastError = 'Error en ' + f.name + ': ' + (data.error || data.detail || JSON.stringify(data));
        console.error('[RODAJE UPLOAD] Error response:', data);
      }
    } catch(e) {
      fail++;
      lastError = 'Error de red: ' + e.message;
      console.error('[RODAJE UPLOAD] Excepción:', e);
    }
  }
  if (fail > 0) {
    if (progress) progress.textContent = '❌ ' + lastError + (files.length > 1 ? ' (' + fail + '/' + files.length + ' fallidas)' : '');
  } else {
    if (progress) progress.textContent = '✓ ' + ok + ' fotos analizadas — guardadas en Supabase';
  }
  input.value = '';
  _loadRodajePhotosGrid(state.clientId, state.projectId);
}

async function openBriefingRodaje() {
  var state = _planSuggestState;
  if (!state.cards || !state.cards.length) { showToast('Genera primero el plan'); return; }

  // Crea overlay del briefing
  var existing = document.getElementById('briefingRodajeOverlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'briefingRodajeOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1200;display:flex;align-items:center;justify-content:center;padding:1rem';
  overlay.innerHTML =
    '<div style="background:#fff;border-radius:14px;width:100%;max-width:680px;max-height:88vh;display:flex;flex-direction:column;overflow:hidden">' +
      '<div style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);padding:1.2rem 1.4rem;display:flex;align-items:center;justify-content:space-between">' +
        '<div>' +
          '<div style="color:#C29547;font-size:1rem;font-weight:700">📋 Briefing de rodaje</div>' +
          '<div style="color:#aaa;font-size:0.75rem;margin-top:0.2rem">Preparación para la visita al cliente — todo en una sesión</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'briefingRodajeOverlay\').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1rem">✕</button>' +
      '</div>' +
      '<div id="briefingRodajeBody" style="flex:1;overflow-y:auto;padding:1.4rem">' +
        '<div style="text-align:center;padding:3rem 1rem">' +
          '<div style="font-size:2rem;margin-bottom:0.8rem">📋</div>' +
          '<div style="color:#888;font-size:0.85rem;margin-bottom:1.2rem">Opus analizará las ' + state.cards.length + ' cards del plan y preparará la hoja de rodaje completa para el equipo.</div>' +
          '<button onclick="_generateBriefingRodaje()" style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:8px;padding:0.7rem 1.6rem;cursor:pointer;font-size:0.85rem;font-weight:700">✦ Generar briefing con Opus</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(overlay);

  // Se c'è già un briefing generato, mostralo subito
  if (state.briefing_rodaje) {
    _renderBriefingRodaje(state.briefing_rodaje);
  }
}

async function _generateBriefingRodaje() {
  var state = _planSuggestState;
  var body = document.getElementById('briefingRodajeBody');
  if (!body) return;

  // Legge l'equipo del cliente dalla memoria (caricato da Supabase)
  var equipo = _getClienteEquipo(state.clientId) || {};
  var hasHumanFilmmaker = !!(equipo['Carlos Lage']);

  var loadingMsg = hasHumanFilmmaker
    ? 'Opus está preparando el briefing de rodaje…'
    : 'Opus está generando los prompts de imagen IA para cada card…';

  body.innerHTML = '<div style="text-align:center;padding:3rem 1rem"><div style="font-size:2rem;margin-bottom:0.8rem">✦</div><div style="color:#888;font-size:0.85rem">' + loadingMsg + '<br><span style="color:#bbb;font-size:0.75rem">20-30 segundos</span></div></div>';

  // Responsabile shooting e intervista (usato solo in Flusso A)
  var shootPerson = 'Carlos Lage';
  var interviewPerson = 'Vicente Palazzolo';
  state.team.forEach(function(m) {
    if (!m._agentKey && m.mode === 'human') {
      if (/filmmaker|fotógrafo|carlos/i.test(m.name + m.role)) shootPerson = m.name;
      if (/ceo|sales|vicente/i.test(m.name + m.role)) interviewPerson = m.name;
    }
  });

  try {
    var res = await fetch(AGENT_API + '/api/projects/briefing-rodaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:             state.clientId,
        project_title:         state.proj ? state.proj.title : '',
        cards:                 state.cards,
        team:                  state.team,
        shoot_assignee:        shootPerson,
        interviewer_assignee:  interviewPerson,
        has_human_filmmaker:   hasHumanFilmmaker
      })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.detail || 'Error al generar briefing');
    state.briefing_rodaje = data.briefing_rodaje;
    _renderBriefingRodaje(data.briefing_rodaje);
  } catch(e) {
    body.innerHTML = '<div style="color:#c0392b;padding:1.5rem;text-align:center">❌ ' + (e.message || e) + '</div>';
  }
}

function _renderBriefingRodaje(br) {
  var body = document.getElementById('briefingRodajeBody');
  if (!body || !br) return;

  // ── FLUSSO B: Automatizado — prompt AI per card ───────────────────────────
  if (br.tipo === 'automatizado') {
    var cards = br.cards_ai || [];
    var fmtIcon = { 'Story':'📱', 'Post':'🖼️', 'Reels':'🎬', 'Carousel':'🎠', 'Carrusel':'🎠' };
    var html = '<div style="margin-bottom:0.8rem;padding:0.6rem 0.9rem;background:#f0f7ff;border-radius:8px;border-left:3px solid #2980b9;font-size:0.78rem;color:#2980b9">' +
      '🤖 <strong>Flujo automatizado</strong> — Estos prompts están listos para generar imágenes con Ideogram u otra IA de imagen.' +
    '</div>';
    cards.forEach(function(card) {
      var icon = fmtIcon[card.format] || '📄';
      html += '<div style="border:1px solid #e0dbd2;border-radius:10px;padding:1rem;margin-bottom:0.8rem">' +
        '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.6rem">' +
          '<span style="font-size:1rem">' + icon + '</span>' +
          '<div style="font-weight:700;font-size:0.85rem;color:#1F2A24;flex:1">' + (card.card_title || '') + '</div>' +
          '<span style="font-size:0.68rem;background:#f5f3ef;padding:0.2rem 0.5rem;border-radius:4px;color:#888">' + (card.format || '') + '</span>' +
        '</div>' +
        (card.estilo_visual ? '<div style="font-size:0.72rem;color:#888;margin-bottom:0.5rem;font-style:italic">🎨 Estilo: ' + card.estilo_visual + '</div>' : '') +
        '<div style="background:#1F2A24;border-radius:8px;padding:0.7rem 0.9rem;position:relative">' +
          '<div style="font-size:0.72rem;color:#aaa;margin-bottom:0.3rem;letter-spacing:0.05em;text-transform:uppercase">AI Prompt</div>' +
          '<div style="font-size:0.78rem;color:#e8e4dc;line-height:1.5;font-family:monospace">' + (card.ai_prompt || '') + '</div>' +
          (card.negative_prompt ? '<div style="font-size:0.7rem;color:#c0392b;margin-top:0.4rem">— Evitar: ' + card.negative_prompt + '</div>' : '') +
        '</div>' +
        (card.notas_copy ? '<div style="font-size:0.72rem;color:#555;margin-top:0.5rem;padding:0.5rem 0.7rem;background:#fef9f0;border-radius:6px">✍️ Copy: ' + card.notas_copy + '</div>' : '') +
      '</div>';
    });
    body.innerHTML = html;
    return;
  }

  // ── FLUSSO A: Rodaje con equipo humano ────────────────────────────────────
  var _angleColor = { técnico:'#2980b9', provocador:'#c0392b', humano:'#27ae60', aspiracional:'#8e44ad', seguimiento:'#888' };
  var _angleIcon  = { técnico:'⚙️', provocador:'💥', humano:'❤️', aspiracional:'🚀', seguimiento:'↩️' };

  // Header info
  var header = '<div style="display:flex;gap:1rem;margin-bottom:1.2rem;flex-wrap:wrap">' +
    (br.fecha_sugerida ? '<div style="background:#f5f3ef;border-radius:8px;padding:0.5rem 0.9rem;font-size:0.78rem"><strong>📅 Fecha sugerida</strong><br>' + br.fecha_sugerida + '</div>' : '') +
    (br.duracion_estimada ? '<div style="background:#f5f3ef;border-radius:8px;padding:0.5rem 0.9rem;font-size:0.78rem"><strong>⏱ Duración</strong><br>' + br.duracion_estimada + '</div>' : '') +
    (br.lugar ? '<div style="background:#f5f3ef;border-radius:8px;padding:0.5rem 0.9rem;font-size:0.78rem"><strong>📍 Lugar</strong><br>' + br.lugar + '</div>' : '') +
  '</div>';

  // Sezione filmmaker
  var filmSection = '';
  if (br.filmmaker && br.filmmaker.length) {
    var filmRows = br.filmmaker.map(function(item) {
      var tipoIcon = item.tipo === 'foto' ? '📸' : item.tipo === 'broll' ? '🎬' : '🎥';
      var para = Array.isArray(item.sirve_para) ? item.sirve_para.join(', ') : (item.sirve_para || '');
      return '<div style="padding:0.8rem;border:1px solid #e0dbd2;border-radius:8px;margin-bottom:0.6rem">' +
        '<div style="display:flex;align-items:flex-start;gap:0.6rem">' +
          '<span style="font-size:1rem;flex-shrink:0">' + tipoIcon + '</span>' +
          '<div style="flex:1">' +
            '<div style="font-weight:600;font-size:0.83rem;color:#1F2A24">' + (item.descripcion || '') + '</div>' +
            (para ? '<div style="font-size:0.72rem;color:#C29547;margin-top:0.2rem">→ sirve para: ' + para + '</div>' : '') +
            (item.notas ? '<div style="font-size:0.72rem;color:#888;margin-top:0.3rem;font-style:italic">💡 ' + item.notas + '</div>' : '') +
          '</div>' +
          '<input type="checkbox" style="width:16px;height:16px;accent-color:#1F2A24;flex-shrink:0;margin-top:2px">' +
        '</div>' +
      '</div>';
    }).join('');
    filmSection = '<div style="margin-bottom:1.4rem">' +
      '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;color:#888;margin-bottom:0.6rem;text-transform:uppercase">🎥 Para el Filmmaker / Fotógrafo</div>' +
      filmRows +
    '</div>';
  }

  // Sezione entrevistador
  var interviewSection = '';
  if (br.entrevistador) {
    var introHtml = br.entrevistador.intro
      ? '<div style="background:#fef9f0;border-left:3px solid #C29547;border-radius:0 8px 8px 0;padding:0.7rem 0.9rem;margin-bottom:0.8rem;font-size:0.78rem;color:#555">' + br.entrevistador.intro + '</div>'
      : '';

    var preguntas = (br.entrevistador.preguntas || []).map(function(q) {
      var angulo = (q.angulo || 'técnico').toLowerCase();
      var color = _angleColor[angulo] || '#888';
      var icon = _angleIcon[angulo] || '❓';
      return '<div style="padding:0.8rem;border:1px solid #e0dbd2;border-radius:8px;margin-bottom:0.6rem;border-left:3px solid ' + color + '">' +
        '<div style="display:flex;align-items:flex-start;gap:0.6rem">' +
          '<span style="font-size:0.9rem;flex-shrink:0">' + icon + '</span>' +
          '<div style="flex:1">' +
            '<div style="font-size:0.65rem;font-weight:700;color:' + color + ';text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.25rem">' + angulo + '</div>' +
            '<div style="font-weight:600;font-size:0.83rem;color:#1F2A24">' + (q.pregunta || '') + '</div>' +
            (q.sirve_para && q.sirve_para !== 'general' ? '<div style="font-size:0.72rem;color:#C29547;margin-top:0.2rem">→ ' + q.sirve_para + '</div>' : '') +
            (q.objetivo ? '<div style="font-size:0.71rem;color:#888;margin-top:0.25rem;font-style:italic">' + q.objetivo + '</div>' : '') +
          '</div>' +
          '<input type="checkbox" style="width:16px;height:16px;accent-color:#1F2A24;flex-shrink:0;margin-top:2px">' +
        '</div>' +
      '</div>';
    }).join('');

    interviewSection = '<div>' +
      '<div style="font-size:0.7rem;font-weight:700;letter-spacing:0.08em;color:#888;margin-bottom:0.6rem;text-transform:uppercase">🎙️ Para el Entrevistador (Vicente)</div>' +
      introHtml +
      preguntas +
    '</div>';
  }

  body.innerHTML = header + filmSection + interviewSection;
}

// ── STATI PLAN TASK ──────────────────────────────────────────────────────────
var _PSTAT = {
  todo:   { label:'Pendiente', bg:'#f0ece5', color:'#888',    dot:'🟡' },
  wip:    { label:'En curso',  bg:'#dbeafe', color:'#2563eb', dot:'🔵' },
  review: { label:'Revisión',  bg:'#fef3c7', color:'#b45309', dot:'🟠' },
  done:   { label:'Listo',     bg:'#dcfce7', color:'#16a34a', dot:'🟢' },
};
var _PSTAT_CYCLE = ['todo','wip','review','done'];

function _nextPstat(cur) {
  var i = _PSTAT_CYCLE.indexOf(cur || 'todo');
  return _PSTAT_CYCLE[(i+1) % _PSTAT_CYCLE.length];
}

function planSubtaskCycle(ci, si) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  sub.status = _nextPstat(sub.status);
  // Aggiorna stato card in base alle subtask
  var allDone = card.subtasks.every(function(s){ return s.status==='done'; });
  var anyWip  = card.subtasks.some(function(s){ return s.status==='wip'||s.status==='review'; });
  card.status = allDone ? 'done' : anyWip ? 'wip' : 'todo';
  if (card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ subtasks: card.subtasks, status: card.status })
    }).catch(function(){});
  }
  // Aggiorna solo la sezione detail senza re-render completo
  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  var pill = document.getElementById('plan-card-status-'+ci);
  if (pill) {
    var st = _PSTAT[card.status||'todo'];
    pill.textContent = st.dot+' '+st.label;
    pill.style.background = st.bg; pill.style.color = st.color;
  }
}

function _renderPlanDetail(card, ci) {
  var subs = card.subtasks || [];
  // Trova il primo subtask non completato (quello attivo)
  var firstActive = -1;
  for (var k = 0; k < subs.length; k++) {
    if ((subs[k].status||'todo') !== 'done') { firstActive = k; break; }
  }

  var subtasksHtml = subs.map(function(s, si) {
    // Sezione speciale per varianti caption (Bellavista / upload materiale)
    if (s.phase === 'captions') return _renderCaptionSubtask(s, ci);

    // Risolvi assignee: se è un nome umano non più nel team attivo → sostituisci
    var rawAssignee = s.assignee || '';
    var resolvedAssignee = (function(name) {
      if (!name) return '—';
      var lower = name.toLowerCase();
      if (lower.indexOf('agente') >= 0) return name; // è già un agente AI, ok
      // "Revisión del cliente" → sempre "Tú — Revisor"
      if ((s.name || '').toLowerCase().indexOf('revisión') >= 0 || (s.name || '').toLowerCase().indexOf('revision') >= 0) return 'Tú — Revisor';
      // Cerca nel team attivo
      var activeTeam = (_planSuggestState && _planSuggestState.team) ? _planSuggestState.team : [];
      var member = activeTeam.find(function(m){ return m.name === name; });
      if (!member || member._disabled) return 'Por asignar';
      if (member.mode === 'ai') return '🤖 Agente AI (' + member.role + ')';
      return name;
    })(rawAssignee);

    var isAI    = resolvedAssignee.toLowerCase().indexOf('agente') >= 0 || resolvedAssignee.toLowerCase().indexOf('🤖') >= 0;
    var status  = s.status || 'todo';
    var isDone  = status === 'done';
    var isActive = si === firstActive;
    var isPast  = si < firstActive;
    var isFuture = !isDone && !isActive && si > firstActive;

    // Colori riga
    var rowBg    = isDone ? '#f0fdf4' : isActive ? '#fff' : '#fafaf8';
    var rowBorder= isDone ? '1px solid #bbf7d0' : isActive ? '2px solid #1F2A24' : '1px solid #f0ece5';
    var opacity  = isFuture ? '0.5' : '1';

    // Numero step
    var stepColor  = isDone ? '#16a34a' : isActive ? '#1F2A24' : '#ddd';
    var stepLabel  = isDone ? '✓' : (si+1);
    var stepNum = '<div style="width:26px;height:26px;border-radius:50%;background:'+stepColor+';color:'+(isDone?'#fff':isActive?'#C29547':'#aaa')+';display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;flex-shrink:0">'+stepLabel+'</div>';

    // Queste variabili devono essere dichiarate PRIMA di actionBtn
    var isRevisor     = resolvedAssignee.indexOf('Revisor') >= 0;
    var isDesignerStep = (s.agent_type || rawAssignee.toLowerCase()).indexOf('diseno') >= 0 || rawAssignee.toLowerCase().indexOf('designer') >= 0;
    var isCreativeStep = (s.agent_type || '') === 'shooting' || rawAssignee.toLowerCase().indexOf('creativo') >= 0;

    // Bottone azione
    var actionBtn = '';
    if (isDone) {
      actionBtn = '<span style="font-size:0.72rem;color:#16a34a;font-weight:700">✓ Listo</span>';
    } else if (isActive) {
      if (status === 'wip' && isCreativeStep) {
        // Step creativo in wip = prompt generato, aspetta upload foto
        actionBtn = '<label style="display:inline-flex;align-items:center;gap:0.4rem;background:#2563eb;color:#fff;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">📸 Subir foto creada<input type="file" accept="image/*" style="display:none" onchange="uploadCreativeStepPhoto(this,'+ci+','+si+')"></label>';
      } else if (status === 'wip') {
        actionBtn = '<button onclick="planSubtaskConfirm('+ci+','+si+')" style="background:#16a34a;color:#fff;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">✓ Confirmar</button>';
      } else if (isCreativeStep) {
        actionBtn = '<button onclick="openCreativeStepPanel('+ci+','+si+')" style="background:#1F2A24;color:#C29547;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">📸 Buscar / crear foto</button>';
      } else if (isDesignerStep) {
        actionBtn = '<button onclick="launchDesignerStep('+ci+','+si+')" style="background:#2563eb;color:#fff;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">🎨 Abrir en Agentes</button>';
      } else {
        actionBtn = '<button onclick="planSubtaskStart('+ci+','+si+')" style="background:#1F2A24;color:#C29547;border:none;border-radius:7px;padding:0.35rem 0.8rem;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap">▶ Iniciar</button>';
      }
    } else if (!isDone && !isFuture) {
      actionBtn = '<button onclick="planSubtaskStart('+ci+','+si+')" style="background:transparent;color:#888;border:1px solid #e0dbd2;border-radius:7px;padding:0.3rem 0.7rem;font-size:0.72rem;cursor:pointer">▶ Iniciar</button>';
    }

    // Badge tu turno
    var turnoHtml = isActive && status === 'todo'
      ? '<div style="font-size:0.65rem;font-weight:700;color:#b45309;background:#fef3c7;border-radius:20px;padding:0.1rem 0.5rem;display:inline-block;margin-bottom:0.25rem">👉 Siguiente paso</div>'
      : '';
    var badgeColor = isAI ? '#C29547' : isRevisor ? '#7c3aed' : '#555';
    var badgeBg    = isAI ? '#1F2A24' : isRevisor ? '#faf5ff' : '#f0ece5';
    var badgeIcon  = isAI ? '🤖 ' : isRevisor ? '👁 ' : '👤 ';
    var assigneeBadge = '<span style="font-size:0.67rem;font-weight:600;color:'+badgeColor+';background:'+badgeBg+';border-radius:10px;padding:0.15rem 0.5rem">'+badgeIcon+resolvedAssignee+'</span>';

    // Badge fase (PRE / RODAJE / POST / PUB)
    var phaseBadge = '';
    if (s.phase === 'pre')         phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#eff6ff;color:#2563eb;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">PRE</span>';
    else if (s.phase === 'rodaje') phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#fef3c7;color:#b45309;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">🎬 RODAJE</span>';
    else if (s.phase === 'post')   phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#f0fdf4;color:#16a34a;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">POST</span>';
    else if (s.phase === 'pub')    phaseBadge = '<span style="font-size:0.58rem;font-weight:700;background:#faf5ff;color:#7c3aed;border-radius:4px;padding:0.12rem 0.4rem;margin-right:0.4rem;vertical-align:middle">PUB</span>';

    return '<div style="display:flex;gap:0.7rem;align-items:flex-start;padding:0.7rem 0.8rem;margin-bottom:0.4rem;border-radius:9px;border:'+rowBorder+';background:'+rowBg+';opacity:'+opacity+';transition:all 0.2s">' +
      stepNum +
      '<div style="flex:1;min-width:0">' +
        turnoHtml +
        '<div style="font-size:0.8rem;font-weight:600;color:#1F2A24;margin-bottom:0.2rem">'+phaseBadge+(s.name||s.title||'')+'</div>' +
        '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-bottom:'+(s.tip?'0.3rem':'0')+'">' +
          assigneeBadge +
          (s.date ? '<span style="font-size:0.65rem;color:#aaa">📅 '+s.date+'</span>' : '') +
        '</div>' +
        (s.tip && !isFuture ? '<div style="font-size:0.7rem;color:#888;font-style:italic;line-height:1.4;border-top:1px solid #f0ece5;padding-top:0.3rem">💡 '+s.tip+'</div>' : '') +
        (isDone && s.output ? (function(){
          var firstLine = s.output.split('\n').find(function(l){ return l.trim().length>0; }) || '';
          firstLine = firstLine.replace(/^[#\*\-\s]+/,'').substring(0,90);
          var thumb = s.suggested_photo && s.suggested_photo.url
            ? '<img src="'+s.suggested_photo.url+'" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0">'
            : '';
          return '<div style="margin-top:0.4rem;padding:0.35rem 0.5rem;background:#f0fdf4;border-radius:6px;border-left:2px solid #16a34a;display:flex;gap:0.5rem;align-items:center">'+thumb+'<span style="font-size:0.67rem;color:#555;font-style:italic;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1">'+firstLine+'</span></div>';
        })() : '') +
      '</div>' +
      '<div style="flex-shrink:0;display:flex;align-items:center">'+actionBtn+'</div>' +
    '</div>';
  }).join('');

  var materialHtml = (card.material_needed && !card.material_needed.toLowerCase().includes('digital'))
    ? '<div style="display:flex;align-items:center;gap:0.5rem;background:#fef9f0;border:1px solid #fde68a;border-radius:7px;padding:0.5rem 0.8rem;margin-bottom:0.8rem;font-size:0.75rem;color:#92400e"><span>📦</span><span><strong>Material necesario:</strong> '+card.material_needed+'</span></div>'
    : '';
  var noteHtml = card.creative_note
    ? '<div style="font-size:0.75rem;color:#555;font-style:italic;margin-bottom:0.8rem;padding:0.5rem 0.8rem;background:#f9f6f0;border-radius:6px;border-left:3px solid #C29547">'+card.creative_note+'</div>'
    : '';

  // Sezione upload foto + varianti caption (quando la card non ha ancora subtask)
  var uploadHtml = '';
  if (!subs.length) {
    uploadHtml =
      '<div style="background:#f9f6f0;border:1.5px dashed #C29547;border-radius:9px;padding:0.9rem 1rem;text-align:center">' +
        '<div style="font-size:0.78rem;color:#888;margin-bottom:0.7rem">Esta card aún no tiene flujo de trabajo</div>' +
        '<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap">' +
          '<button onclick="planUploadPhoto(' + ci + ')" style="background:#1F2A24;color:#C29547;border:none;border-radius:7px;padding:0.45rem 1rem;font-size:0.75rem;font-weight:700;cursor:pointer">📸 Subir foto + Vision</button>' +
          '<button onclick="showGenSubtasksForm(' + ci + ')" style="background:#f5f3ef;color:#555;border:1.5px solid #e0dbd2;border-radius:7px;padding:0.45rem 1rem;font-size:0.75rem;cursor:pointer">📋 Generar flujo estándar</button>' +
        '</div>' +
      '</div>';
  }

  return noteHtml + materialHtml +
    (subtasksHtml
      ? '<div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Flujo de trabajo</div>' + subtasksHtml
      : uploadHtml);
}

// ─── UPLOAD FOTO + VISION + CAPTION VARIANTS ───────────────────────────────

function planUploadPhoto(ci) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = function() {
    if (!input.files || !input.files[0]) return;
    _doUploadAndAnalyze(ci, input.files[0]);
  };
  input.click();
}

async function _doUploadAndAnalyze(ci, file) {
  var det = document.getElementById('plan-card-detail-' + ci);
  if (!det) return;
  var card = _planSuggestState.cards[ci];
  var state = _planSuggestState;

  // Mostra stato caricamento
  det.innerHTML =
    '<div style="padding:1rem;text-align:center;color:#888;font-size:0.8rem">' +
      '<div style="font-size:1.4rem;margin-bottom:0.5rem">📸</div>' +
      '<div>Subiendo foto y analizando con Vision…</div>' +
      '<div style="margin-top:0.4rem;font-size:0.7rem;color:#bbb">Esto tarda unos segundos</div>' +
    '</div>';

  try {
    var fd = new FormData();
    fd.append('client_id', state.clientId);
    fd.append('file', file);

    var res  = await fetch(BRAVO_API + '/api/projects/' + encodeURIComponent(state.projectId) + '/upload-media', { method: 'POST', body: fd });
    var data = await res.json();

    if (!data.ok) { showToast('⚠️ Error al subir: ' + (data.error || 'desconocido')); return; }

    // Guarda en la card como subtask speciale "captions"
    var captionSub = {
      phase: 'captions',
      name:  'Variantes de caption',
      status: 'todo',
      media_url: data.photo_url,
      scene_description: data.scene_description || '',
      variants: [],
      selected_variant: null,
      date: '',
      assignee: 'Agente Copywriter'
    };

    card.subtasks = [captionSub];
    _patchPlanCard(card);

    // Aggiorna view
    det.innerHTML = _renderPlanDetail(card, ci);
    _updatePlanCardHeader(card, ci);
    showToast('✅ Foto analizada — ' + (data.scene_description ? 'descripción lista' : 'sin Vision'));

  } catch(e) {
    showToast('⚠️ Error de conexión al subir foto');
    det.innerHTML = _renderPlanDetail(card, ci);
  }
}

async function planGenerateCaptions(ci) {
  var card = _planSuggestState.cards[ci];
  var capSub = (card.subtasks || []).find(function(s){ return s.phase === 'captions'; });
  if (!capSub) { showToast('⚠️ Sube primero una foto'); return; }

  var det = document.getElementById('plan-card-detail-' + ci);
  if (det) det.innerHTML =
    '<div style="padding:1rem;text-align:center;color:#888;font-size:0.8rem">' +
      '<div style="font-size:1.4rem;margin-bottom:0.5rem">🤖</div>' +
      '<div>Generando variantes de caption…</div>' +
    '</div>';

  try {
    var numVariants = window._orgVariants || 3;
    var res  = await fetch(BRAVO_API + '/api/projects/' + encodeURIComponent(_planSuggestState.projectId) + '/generate-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:         _planSuggestState.clientId,
        scene_description: capSub.scene_description,
        num_variants:      numVariants
      })
    });
    var data = await res.json();
    if (!data.ok || !data.variants) { showToast('⚠️ Error al generar captions'); return; }

    capSub.variants = data.variants;
    capSub.status   = 'wip';
    _patchPlanCard(card);

    if (det) det.innerHTML = _renderPlanDetail(card, ci);
    showToast('✦ ' + data.variants.length + ' variantes generadas — elige la mejor');

  } catch(e) {
    showToast('⚠️ Error de conexión al generar captions');
    if (det) det.innerHTML = _renderPlanDetail(card, ci);
  }
}

function planSelectCaption(ci, variantIdx) {
  var card   = _planSuggestState.cards[ci];
  var capSub = (card.subtasks || []).find(function(s){ return s.phase === 'captions'; });
  if (!capSub) return;
  capSub.selected_variant = variantIdx;
  capSub.status = 'done';
  card.status = card.subtasks.every(function(s){ return s.status === 'done'; }) ? 'done' : 'wip';
  _patchPlanCard(card);
  var det = document.getElementById('plan-card-detail-' + ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  showToast('✅ Caption seleccionada — lista para publicar');
}

function showGenSubtasksForm(ci) {
  var card = _planSuggestState.cards[ci];
  var sd   = _planSuggestState.shooting_date || '';
  var noteHtml = card.creative_note
    ? '<div style="font-size:0.75rem;color:#555;font-style:italic;margin-bottom:0.8rem;padding:0.5rem 0.8rem;background:#f9f6f0;border-radius:6px;border-left:3px solid #C29547">'+card.creative_note+'</div>'
    : '';
  var det = document.getElementById('plan-card-detail-' + ci);
  if (!det) return;
  det.innerHTML = noteHtml +
    '<div style="background:#f9f6f0;border:1.5px solid #C29547;border-radius:9px;padding:0.9rem 1rem">' +
      '<div style="font-size:0.75rem;font-weight:700;color:#1F2A24;margin-bottom:0.5rem">📋 Generar flujo de trabajo estándar</div>' +
      '<div style="font-size:0.7rem;color:#888;margin-bottom:0.7rem;line-height:1.5">Se crearán los pasos de producción (script, rodaje, edición, caption, revisión, publicación) con fechas calculadas desde la fecha de rodaje.</div>' +
      '<label style="font-size:0.72rem;font-weight:600;color:#555;display:block;margin-bottom:0.3rem">📅 Fecha de rodaje</label>' +
      '<input type="date" id="gsf-sd-'+ci+'" value="'+sd+'" style="padding:0.35rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem;width:100%;margin-bottom:0.8rem;box-sizing:border-box">' +
      '<div style="display:flex;gap:0.5rem;justify-content:flex-end">' +
        '<button onclick="var det=document.getElementById(\'plan-card-detail-'+ci+'\');if(det)det.innerHTML=_renderPlanDetail(_planSuggestState.cards['+ci+'],'+ci+')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:none;border:1px solid #e0dbd2;border-radius:6px;cursor:pointer;color:#888">Cancelar</button>' +
        '<button onclick="_genStandardSubtasks('+ci+')" style="font-size:0.72rem;padding:0.35rem 1rem;background:#1F2A24;color:#C29547;border:none;border-radius:7px;cursor:pointer;font-weight:700">✓ Generar pasos</button>' +
      '</div>' +
    '</div>';
}

function _genStandardSubtasks(ci) {
  var sdInput = document.getElementById('gsf-sd-' + ci);
  var sd = sdInput ? sdInput.value : (_planSuggestState.shooting_date || '');
  if (!sd) { showToast('⚠️ Introduce la fecha de rodaje'); return; }
  var card = _planSuggestState.cards[ci];
  card.subtasks = _buildIndividualSubtasks(sd, card.publish_date);
  _patchPlanCard(card);
  var det = document.getElementById('plan-card-detail-' + ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  showToast('✓ Flujo de trabajo generado');
}

// ─── RENDER speciale per la sezione "captions" dentro _renderPlanDetail ───
// (inserito dinamicamente nel mapping subs della funzione sopra)

function _renderCaptionSubtask(s, ci) {
  var variants  = s.variants || [];
  var hasPic    = !!s.media_url;
  var hasDesc   = !!s.scene_description;
  var hasVars   = variants.length > 0;
  var selected  = s.selected_variant;
  var isDone    = s.status === 'done';

  var photoHtml = hasPic
    ? '<div style="margin-bottom:0.7rem"><img src="'+s.media_url+'" alt="foto" style="width:100%;max-height:160px;object-fit:cover;border-radius:7px;border:1px solid #e0dbd2"></div>'
    : '';

  var descHtml = hasDesc
    ? '<div style="font-size:0.7rem;color:#555;font-style:italic;background:#f9f6f0;border-left:3px solid #C29547;padding:0.4rem 0.7rem;border-radius:0 6px 6px 0;margin-bottom:0.7rem;line-height:1.5">🧠 <strong>Análisis Vision:</strong> '+s.scene_description+'</div>'
    : '';

  var genBtn = !hasVars && !isDone
    ? '<button onclick="planGenerateCaptions('+ci+')" style="width:100%;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;border:none;border-radius:7px;padding:0.5rem;font-size:0.75rem;font-weight:700;cursor:pointer;margin-top:0.3rem">🤖 Generar '+(window._orgVariants||3)+' variantes de caption</button>'
    : '';

  var varsHtml = '';
  if (hasVars) {
    varsHtml = '<div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Variantes de caption</div>';
    variants.forEach(function(v, idx) {
      var isSelected = selected === idx;
      var bg    = isSelected ? '#f0fdf4' : '#fff';
      var bd    = isSelected ? '2px solid #16a34a' : '1px solid #e0dbd2';
      var check = isSelected ? '<span style="color:#16a34a;font-weight:700;font-size:0.72rem">✅ Seleccionada</span>' : '';
      varsHtml +=
        '<div style="border:'+bd+';background:'+bg+';border-radius:8px;padding:0.7rem 0.8rem;margin-bottom:0.5rem">' +
          '<div style="font-size:0.65rem;font-weight:700;color:#C29547;margin-bottom:0.3rem;text-transform:uppercase">'+
            'Variante '+(idx+1)+' · '+(v.persona||'')+'</div>' +
          '<div style="font-size:0.75rem;color:#1F2A24;line-height:1.55;white-space:pre-wrap">'+v.caption+'</div>' +
          (!isDone
            ? '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;justify-content:flex-end">' +
                check +
                '<button onclick="planSelectCaption('+ci+','+idx+')" style="font-size:0.7rem;padding:0.25rem 0.7rem;background:#16a34a;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700">✓ Aprobar</button>' +
              '</div>'
            : '<div style="margin-top:0.4rem">'+check+'</div>') +
        '</div>';
    });
    if (!isDone) {
      varsHtml += '<button onclick="planGenerateCaptions('+ci+')" style="font-size:0.7rem;padding:0.3rem 0.8rem;background:none;border:1px solid #e0dbd2;border-radius:6px;cursor:pointer;color:#888;margin-top:0.2rem">🔄 Regenerar variantes</button>';
    }
  }

  return '<div style="border:1.5px solid #e0dbd2;border-radius:9px;padding:0.8rem;margin-bottom:0.5rem;background:#fff">' +
    '<div style="font-size:0.68rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem">📸 Contenido visual + Caption</div>' +
    photoHtml + descHtml + genBtn + varsHtml +
  '</div>';
}

function planSubtaskStart(ci, si) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  var isAI = (sub.assignee||'').toLowerCase().indexOf('agente') >= 0;

  // Step creativo: pannello dedicato per selezione/upload foto
  if ((sub.agent_type || '') === 'shooting' || (sub.assignee||'').toLowerCase().indexOf('creativo') >= 0) {
    openCreativeStepPanel(ci, si);
    return;
  }

  if (isAI) {
    openAiStepPopup(ci, si);
    return;
  }

  sub.status = 'wip';
  card.status = 'wip';
  _patchPlanCard(card);
  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  showToast('▶ ' + (sub.assignee||'Equipo') + ' — tarea iniciada');
}

// ── AGENTE CREATIVO: pannello selezione/upload foto ──────────────────────────

async function openCreativeStepPanel(ci, si) {
  var card  = _planSuggestState.cards[ci];
  var sub   = card.subtasks[si];
  var state = _planSuggestState;

  var existing = document.getElementById('creative-step-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'creative-step-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1300;display:flex;align-items:center;justify-content:center;padding:1rem';

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:680px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.28)">' +
      '<div style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);padding:1.1rem 1.4rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">' +
        '<div>' +
          '<div style="font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:rgba(255,255,255,0.7);margin-bottom:0.2rem">📸 Agente Creativo</div>' +
          '<div style="font-weight:700;font-size:0.95rem;color:#C29547">' + (card.title||'Selección de foto') + '</div>' +
          '<div style="color:#aaa;font-size:0.72rem;margin-top:0.15rem">' + (card.pillar||'') + (card.creative_note ? ' · ' + card.creative_note.substring(0,60) + '…' : '') + '</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'creative-step-overlay\').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0">✕</button>' +
      '</div>' +
      '<div id="creative-step-body" style="flex:1;overflow-y:auto;padding:1.3rem;min-height:200px">' +
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1rem;gap:1rem">' +
          '<div style="font-size:2rem">📸</div>' +
          '<div style="color:#888;font-size:0.85rem">Buscando fotos del rodaje…</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Carica le foto del rodaje
  try {
    var projectId  = state.projectId;
    var clientIdF  = state.clientId;
    var allPhotos  = [];
    var bestPhoto  = null;
    var aiExplain  = '';

    if (projectId && clientIdF) {
      var pRes  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/rodaje-photos?client_id=' + encodeURIComponent(clientIdF));
      var pData = await pRes.json();
      allPhotos = pData.photos || [];
    }

    var body = document.getElementById('creative-step-body');
    if (!body) return;

    if (allPhotos.length) {
      // Usa match semantico per trovare la foto migliore
      try {
        var cardBrief = [card.title, card.pillar, card.creative_note].filter(Boolean).join(' — ');
        var mRes  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/match-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ client_id: clientIdF, brief: cardBrief })
        });
        var mData = await mRes.json();
        if (mData.ok && mData.photo) {
          bestPhoto = mData.photo;
          aiExplain = mData.photo.why || mData.photo.scene_description || '';
        }
      } catch(e2) {
        bestPhoto = allPhotos[0];
      }

      // Render griglia foto
      var gridHtml = '<div style="margin-bottom:0.8rem;font-size:0.75rem;color:#555;line-height:1.5">' +
        'El Agente Creativo ha analizado el brief de este post y ha seleccionado la mejor foto del archivo. ' +
        'Puedes usar la sugerida o elegir otra.</div>';

      if (bestPhoto) {
        gridHtml +=
          '<div style="margin-bottom:1rem;border:2px solid #C29547;border-radius:10px;overflow:hidden">' +
            '<div style="background:#1F2A24;padding:0.4rem 0.7rem;font-size:0.65rem;font-weight:700;color:#C29547;text-transform:uppercase;letter-spacing:0.08em">✦ Foto sugerida por el Agente</div>' +
            '<div style="display:flex;gap:0.8rem;padding:0.8rem;align-items:flex-start">' +
              '<img src="' + bestPhoto.url + '" style="width:120px;height:90px;object-fit:cover;border-radius:7px;flex-shrink:0">' +
              '<div style="flex:1;min-width:0">' +
                '<div style="font-size:0.75rem;font-weight:600;color:#1F2A24;margin-bottom:0.3rem">' + (bestPhoto.filename||'Foto del rodaje') + '</div>' +
                (aiExplain ? '<div style="font-size:0.7rem;color:#555;line-height:1.45;font-style:italic">' + aiExplain + '</div>' : '') +
              '</div>' +
            '</div>' +
            '<div style="padding:0 0.8rem 0.8rem;display:flex;justify-content:flex-end">' +
              '<button onclick="_confirmCreativePhoto('+ci+','+si+',\''+bestPhoto.url.replace(/'/g,"\\'")+'\',' +
                '\''+encodeURIComponent(bestPhoto.filename||'').replace(/'/g,"\\'")+'\',' +
                '\''+encodeURIComponent((bestPhoto.scene_description||aiExplain).substring(0,400).replace(/'/g,"\\'"))+'\')" ' +
                'style="background:#1F2A24;color:#C29547;border:none;border-radius:7px;padding:0.45rem 1.2rem;font-size:0.78rem;font-weight:700;cursor:pointer">✓ Usar esta foto</button>' +
            '</div>' +
          '</div>';
      }

      if (allPhotos.length > 1) {
        gridHtml += '<div style="font-size:0.65rem;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem">Todas las fotos del archivo</div>';
        gridHtml += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:0.6rem;margin-bottom:1rem">';
        allPhotos.forEach(function(p) {
          var isBest = bestPhoto && p.url === bestPhoto.url;
          gridHtml +=
            '<div style="border:1.5px solid ' + (isBest ? '#C29547' : '#e0dbd2') + ';border-radius:9px;overflow:hidden;cursor:pointer;background:#fafaf8" ' +
            'onclick="_confirmCreativePhoto('+ci+','+si+',\''+p.url.replace(/'/g,"\\'")+'\',\''+encodeURIComponent(p.filename||'').replace(/'/g,"\\'")+'\',\''+encodeURIComponent((p.scene_description||'').substring(0,400).replace(/'/g,"\\'")+'\')') + '">' +
              '<div style="position:relative;padding-top:70%;background:#f0ece5">' +
                '<img src="' + p.url + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover" loading="lazy">' +
              '</div>' +
              '<div style="padding:0.4rem 0.5rem;font-size:0.62rem;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + (p.filename||'foto') + '</div>' +
            '</div>';
        });
        gridHtml += '</div>';
      }

      gridHtml +=
        '<div style="border-top:1px solid #f0ece5;padding-top:0.8rem">' +
          '<div style="font-size:0.72rem;color:#888;margin-bottom:0.4rem">¿Tienes una foto nueva que subir?</div>' +
          '<label style="display:inline-flex;align-items:center;gap:0.5rem;padding:0.4rem 0.9rem;background:#f5f3ef;border:1.5px dashed #e0dbd2;border-radius:7px;cursor:pointer;font-size:0.75rem;color:#555">' +
            '📤 Subir nueva foto' +
            '<input type="file" accept="image/*" style="display:none" onchange="uploadCreativeStepPhoto(this,'+ci+','+si+')">' +
          '</label>' +
        '</div>';

      body.innerHTML = gridHtml;

    } else {
      // Nessuna foto nel rodaje — genera prompt con AI
      body.innerHTML =
        '<div style="padding:1rem;text-align:center;color:#888;font-size:0.8rem">' +
          '<div style="font-size:1.4rem;margin-bottom:0.5rem">🤖</div>' +
          '<div>No hay fotos en el archivo. Generando brief para crear la imagen…</div>' +
        '</div>';

      var projectId2 = state.projectId;
      var previousOutputs = (card.subtasks || []).slice(0, si).filter(function(s){ return s.status==='done'&&s.output; }).map(function(s){ return { step_name:s.name||'', output:s.output }; });
      var res = await fetch(AGENT_API + '/api/projects/execute-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id:        state.clientId,
          project_title:    (state.proj||{}).title || card.title || '',
          card_title:       card.title || '',
          card_format:      card.format || '',
          step_name:        sub.name || '',
          step_phase:       sub.phase || '',
          agent_type:       'shooting',
          previous_outputs: previousOutputs,
          team:             state.team || [],
          rodaje_photos:    []
        })
      });
      var data = await res.json();
      var promptText = (data && (data.output || data.text)) || 'No se pudo generar el brief fotográfico.';

      sub.output = promptText;
      sub.status = 'wip';
      card.status = 'wip';
      _patchPlanCard(card);

      body.innerHTML =
        '<div style="margin-bottom:0.8rem;font-size:0.75rem;color:#555;line-height:1.5">' +
          'No hay fotos del rodaje para este proyecto. El Agente ha generado un brief para que crees la imagen:' +
        '</div>' +
        '<div style="background:#f9f6f0;border-left:3px solid #C29547;border-radius:0 8px 8px 0;padding:0.8rem 1rem;font-size:0.82rem;line-height:1.65;white-space:pre-wrap;margin-bottom:1rem;max-height:220px;overflow-y:auto">' + promptText.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' +
        '<div style="font-size:0.72rem;color:#888;margin-bottom:0.6rem">Crea la foto con el brief anterior (en Ideogram, con fotógrafo, etc.) y luego súbela aquí:</div>' +
        '<label style="display:flex;align-items:center;gap:0.7rem;padding:0.7rem 1rem;background:#f0f4ff;border:2px dashed #2563eb;border-radius:10px;cursor:pointer">' +
          '<span style="font-size:1.3rem">📤</span>' +
          '<span style="font-size:0.82rem;color:#2563eb;font-weight:600">Subir foto creada</span>' +
          '<input type="file" accept="image/*" style="display:none" onchange="uploadCreativeStepPhoto(this,'+ci+','+si+')">' +
        '</label>';

      // Aggiorna la card detail fuori dal popup con il nuovo stato
      var det = document.getElementById('plan-card-detail-'+ci);
      if (det) det.innerHTML = _renderPlanDetail(card, ci);
      _updatePlanCardHeader(card, ci);
      showToast('📸 Brief fotográfico generado — crea la foto y súbela');
    }
  } catch(e) {
    var body2 = document.getElementById('creative-step-body');
    if (body2) body2.innerHTML = '<div style="color:#c0392b;padding:1.5rem;text-align:center">❌ Error: ' + (e.message||e) + '</div>';
  }
}

function _confirmCreativePhoto(ci, si, url, filename, sceneEncoded) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  var scene = '';
  try { scene = decodeURIComponent(sceneEncoded); } catch(e) { scene = sceneEncoded; }
  sub.suggested_photo = { url: url, filename: filename, scene_description: scene };
  sub.output = '📸 FOTO SELECCIONADA: ' + filename + '\n\n🧠 ANÁLISIS VISION:\n' + scene;
  sub.status = 'done';
  card.status = card.subtasks.every(function(s){ return s.status==='done'; }) ? 'done' : 'wip';
  _patchPlanCard(card);
  var overlay = document.getElementById('creative-step-overlay');
  if (overlay) overlay.remove();
  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  var nextSub = card.subtasks[si+1];
  showToast('✓ Foto aprobada' + (nextSub ? ' — siguiente: ' + nextSub.assignee : ''));
}

async function uploadCreativeStepPhoto(input, ci, si) {
  if (!input.files || !input.files[0]) return;
  var file  = input.files[0];
  var card  = _planSuggestState.cards[ci];
  var state = _planSuggestState;

  // Mostra stato nel pannello o nel subtask row
  var body = document.getElementById('creative-step-body');
  var uploading = '<div style="padding:1.5rem;text-align:center;color:#888;font-size:0.82rem"><div style="font-size:1.4rem;margin-bottom:0.5rem">⏳</div><div>Subiendo y analizando con Claude Vision…</div></div>';
  if (body) body.innerHTML = uploading;

  try {
    var fd = new FormData();
    fd.append('client_id', state.clientId);
    fd.append('file', file);

    var res  = await fetch(BRAVO_API + '/api/projects/' + encodeURIComponent(state.projectId) + '/upload-media', { method: 'POST', body: fd });
    var data = await res.json();
    if (!data.ok) { showToast('⚠️ Error al subir: ' + (data.error||'desconocido')); return; }

    // Salva nel subtask e marca done
    _confirmCreativePhoto(ci, si, data.photo_url, file.name, encodeURIComponent(data.scene_description || ''));

    var overlay = document.getElementById('creative-step-overlay');
    if (overlay) overlay.remove();

    showToast('✅ Foto subida y analizada con Vision');
  } catch(e) {
    showToast('⚠️ Error al subir la foto: ' + (e.message||e));
    if (body) body.innerHTML = '<div style="color:#c0392b;padding:1rem;text-align:center">❌ ' + (e.message||e) + '</div>';
  }
}

// ── AGENTE DESIGNER: montaggio post finale (foto + headline/caption + brand kit) ──

function launchDesignerStep(ci, si) {
  alert('launchDesignerStep chiamato: ci=' + ci + ' si=' + si);
  try {
    var card  = _planSuggestState.cards[ci];
    var state = _planSuggestState;

    // Chiude piano + clientePage prima di navigare
    var planOverlay = document.getElementById('planSuggestOverlay');
    if (planOverlay) planOverlay.style.display = 'none';
    var cpEl = document.getElementById('clientePage');
    if (cpEl) cpEl.classList.remove('open');

    // Recupera caption dai passi precedenti
    var captionSub = (card.subtasks || []).find(function(s){ return (s.agent_type||'') === 'caption' && s.output; });
    var captionText = captionSub ? (captionSub.output || '') : '';

    // Attiva la view Agentes direttamente (senza passare per switchTab)
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) { views[i].classList.remove('active'); views[i].style.display = ''; }
    var agenteView = document.getElementById('view-agente');
    if (agenteView) { agenteView.classList.add('active'); agenteView.style.display = 'block'; }

    // Evidenzia tab nav
    var tabs = document.querySelectorAll('.nav-tab');
    for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
    var navTab = document.querySelector('.nav-tab[onclick*="agente"]');
    if (navTab) navTab.classList.add('active');

    // Precompila brief modo "texto libre"
    var briefFree        = document.getElementById('agent-brief-free');
    var briefStructured  = document.getElementById('agent-brief-structured');
    var briefModeBtn     = document.getElementById('agent-brief-mode-btn');
    if (briefStructured) briefStructured.style.display = 'none';
    if (briefFree)       briefFree.style.display = '';
    if (briefModeBtn)    briefModeBtn.textContent = '⊞ Estructurado';

    var briefText = captionText || ('Diseño para: ' + (card.title || '') + '\nFormato: ' + (card.format || '') + '\nProyecto: ' + ((state.proj || {}).title || ''));
    var briefArea = document.getElementById('agent-brief-text');
    if (briefArea) briefArea.value = briefText;

    // Imposta formato
    var formatSel = document.getElementById('agent-format-select');
    if (formatSel && card.format) {
      formatSel.value = card.format;
      if (typeof agentFormatChange === 'function') agentFormatChange();
    }

    // Salva ref per marcare il passo done dopo la generazione
    window._designerPlanRef = { ci: ci, si: si };

    showToast('🎨 Agente Designer — revisa el brief y genera');
  } catch(e) {
    showToast('⚠️ Error: ' + e.message);
    console.error('[launchDesignerStep]', e);
  }
}

function _confirmDesignerStep(ci, si) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  var area = document.getElementById('designer-step-output-area');
  if (area) sub.output = area.value;
  sub.status = 'done';
  var allDone = card.subtasks.every(function(s){ return s.status === 'done'; });
  card.status = allDone ? 'done' : 'wip';
  _patchPlanCard(card);
  var overlay = document.getElementById('designer-step-overlay');
  if (overlay) overlay.remove();
  var det = document.getElementById('plan-card-detail-' + ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  var nextSub = card.subtasks[si + 1];
  if (allDone) showToast('🟢 ¡Todos los pasos completados!');
  else if (nextSub) showToast('✓ Diseño aprobado — siguiente: ' + (nextSub.assignee || 'equipo'));
  else showToast('✓ Diseño aprobado');
}

// Prompt specifico per ogni tipo di step AI

async function openAiStepPopup(ci, si) {
  var card = _planSuggestState.cards[ci];
  var sub  = card.subtasks[si];
  var proj = _planSuggestState.proj;

  var existing = document.getElementById('ai-step-popup-overlay');
  if (existing) existing.remove();

  var overlay = document.createElement('div');
  overlay.id = 'ai-step-popup-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:1300;display:flex;align-items:center;justify-content:center;padding:1rem';

  var phaseBadgeColor = sub.phase==='pre'?'#2563eb': sub.phase==='post'?'#16a34a': sub.phase==='pub'?'#7c3aed':'#b45309';
  var phaseLabel      = sub.phase==='pre'?'PRE': sub.phase==='post'?'POST': sub.phase==='pub'?'PUB':'RODAJE';

  overlay.innerHTML =
    '<div style="background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 24px 80px rgba(0,0,0,0.28)">' +
      '<div style="background:linear-gradient(135deg,#1F2A24,#2d4a3e);padding:1.1rem 1.4rem;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">' +
        '<div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.2rem">' +
            '<span style="font-size:0.62rem;font-weight:700;background:'+phaseBadgeColor+';color:#fff;border-radius:4px;padding:0.1rem 0.4rem">'+phaseLabel+'</span>' +
            '<span style="color:#C29547;font-size:0.95rem;font-weight:700">'+(sub.name||'')+'</span>' +
          '</div>' +
          '<div style="color:#aaa;font-size:0.72rem">🤖 '+(sub.assignee||'Agente AI')+' — generando output…</div>' +
        '</div>' +
        '<button onclick="document.getElementById(\'ai-step-popup-overlay\').remove()" style="background:rgba(255,255,255,0.1);border:none;color:#fff;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1rem;line-height:1;flex-shrink:0">✕</button>' +
      '</div>' +
      '<div id="ai-step-popup-body" style="flex:1;overflow-y:auto;padding:1.3rem;min-height:200px">' +
        '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem 1rem;gap:1rem">' +
          '<div style="font-size:2rem;animation:spin 1s linear infinite">✦</div>' +
          '<div style="color:#888;font-size:0.85rem">El agente está trabajando…</div>' +
        '</div>' +
      '</div>' +
      '<div id="ai-step-popup-footer" style="display:none;padding:1rem 1.4rem;border-top:1.5px solid #f0ece5;display:flex;gap:0.6rem;flex-shrink:0">' +
        '<button onclick="document.getElementById(\'ai-step-popup-overlay\').remove()" style="flex:1;padding:0.6rem;border:1.5px solid #e0dbd2;border-radius:10px;background:#f5f3ef;color:#555;cursor:pointer;font-size:0.85rem">Cancelar</button>' +
        '<button onclick="confirmAiStep('+ci+','+si+')" style="flex:2;padding:0.6rem;border:none;border-radius:10px;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;font-weight:700;cursor:pointer;font-size:0.85rem">✓ Confirmar y continuar</button>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  // Chiama il nuovo endpoint dedicato execute-step
  try {
    // Raccoglie output dei passi precedenti già confermati
    var previousOutputs = (card.subtasks || []).slice(0, si)
      .filter(function(s){ return s.status === 'done' && s.output; })
      .map(function(s){ return { step_name: s.name || '', output: s.output }; });

    // Carica foto rodaje del progetto (per passi POST/caption)
    var rodajePhotos = [];
    var projectId = _planSuggestState.projectId;
    if (projectId) {
      try {
        var pRes  = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(projectId) + '/rodaje-photos?client_id=' + encodeURIComponent(_planSuggestState.clientId));
        var pData = await pRes.json();
        rodajePhotos = (pData.photos || []).map(function(p) {
          return { filename: p.filename, scene_description: p.scene_description, url: p.url };
        });
      } catch(e) { /* non bloccante */ }
    }

    var res = await fetch(AGENT_API + '/api/projects/execute-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:        _planSuggestState.clientId,
        project_title:    proj ? (proj.title||'') : (card.title||''),
        card_title:       card.title || '',
        card_format:      card.format || '',
        step_name:        sub.name || '',
        step_phase:       sub.phase || '',
        agent_type:       sub.agent_type || '',
        previous_outputs: previousOutputs,
        team:             _planSuggestState.team || [],
        rodaje_photos:    rodajePhotos
      })
    });
    var data = await res.json();

    var output = '';
    if (data && data.output)   output = data.output;
    else if (data && data.text) output = data.text;
    else output = JSON.stringify(data, null, 2);

    sub.output = output;
    if (data.suggested_photo) sub.suggested_photo = data.suggested_photo;

    var suggestedPhotoHtml = '';
    if (data.suggested_photo && data.suggested_photo.url) {
      suggestedPhotoHtml =
        '<div style="margin-bottom:0.9rem;border:2px solid #2563eb;border-radius:10px;overflow:hidden">' +
          '<div style="background:#eff6ff;padding:0.4rem 0.7rem;font-size:0.65rem;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:0.08em">📸 Foto sugerida por el agente — preview Instagram</div>' +
          '<div style="width:100%;aspect-ratio:4/5;overflow:hidden;background:#000">' +
            '<img src="' + data.suggested_photo.url + '" style="width:100%;height:100%;object-fit:contain;display:block">' +
          '</div>' +
          '<div style="padding:0.45rem 0.7rem;font-size:0.68rem;color:#555;font-style:italic;background:#f8faff;line-height:1.45">' + (data.suggested_photo.scene_description || '') + '</div>' +
        '</div>';
    }

    var body = document.getElementById('ai-step-popup-body');
    if (body) body.innerHTML =
      '<div style="font-size:0.72rem;font-weight:700;color:#16a34a;margin-bottom:0.8rem;display:flex;align-items:center;gap:0.4rem">✅ Output generado — revisa y edita si necesitas</div>' +
      suggestedPhotoHtml +
      '<textarea id="ai-step-output-area" style="width:100%;min-height:220px;border:1.5px solid #e0dbd2;border-radius:10px;padding:0.8rem;font-size:0.82rem;line-height:1.6;resize:vertical;font-family:inherit;color:#1F2A24;background:#fff;box-sizing:border-box">' + output.replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</textarea>';

    var footer = document.getElementById('ai-step-popup-footer');
    if (footer) footer.style.display = 'flex';

  } catch(e) {
    var body = document.getElementById('ai-step-popup-body');
    if (body) body.innerHTML = '<div style="color:#c0392b;padding:1.5rem;text-align:center">❌ Error: ' + (e.message||e) + '</div>';
    var footer = document.getElementById('ai-step-popup-footer');
    if (footer) footer.style.display = 'flex';
  }
}

function confirmAiStep(ci, si) {
  var card    = _planSuggestState.cards[ci];
  var sub     = card.subtasks[si];
  var area    = document.getElementById('ai-step-output-area');
  if (area) sub.output = area.value;

  // Step creativo senza foto ancora: rimane 'wip' finché non si carica la foto
  var isCreativeNoPhoto = (sub.agent_type === 'shooting') && !sub.suggested_photo;
  sub.status  = isCreativeNoPhoto ? 'wip' : 'done';
  var allDone = card.subtasks.every(function(s){ return s.status==='done'; });
  card.status = allDone ? 'done' : 'wip';
  _patchPlanCard(card);

  // Salva in generated_content con status 'en_revision' se è uno step caption/copywriter
  var stepName = (sub.name || '').toLowerCase();
  if (sub.output && (stepName.indexOf('caption') >= 0 || stepName.indexOf('redacc') >= 0 || stepName.indexOf('copywriter') >= 0)) {
    _saveStepToGeneratedContent(card, sub);
  }

  var overlay = document.getElementById('ai-step-popup-overlay');
  if (overlay) overlay.remove();

  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);

  var nextSub = card.subtasks[si+1];
  if (isCreativeNoPhoto) showToast('📸 Prompt listo — crea la foto y súbela con el botón "Subir foto creada"');
  else if (allDone) showToast('🟢 ¡Todos los pasos completados!');
  else if (nextSub) showToast('✓ Confirmado — siguiente: ' + (nextSub.assignee||'equipo'));
  else showToast('✓ Paso completado');
}

function planSubtaskConfirm(ci, si) {
  var card = _planSuggestState.cards[ci];
  card.subtasks[si].status = 'done';
  // Activa siguiente subtask (si existe)
  var nextSub = card.subtasks[si+1];
  var nextName = nextSub ? nextSub.assignee : null;
  // Recalcula estado card
  var allDone = card.subtasks.every(function(s){ return s.status==='done'; });
  card.status = allDone ? 'done' : 'wip';
  _patchPlanCard(card);
  // Aggiorna anche in _allPlanTasks
  if (window._allPlanTasks) {
    var pt = window._allPlanTasks.find(function(t){ return t.title===card.title && t.client_id===_planSuggestState.clientId; });
    if (pt) { pt.subtasks = card.subtasks; pt.status = card.status; }
  }
  var det = document.getElementById('plan-card-detail-'+ci);
  if (det) det.innerHTML = _renderPlanDetail(card, ci);
  _updatePlanCardHeader(card, ci);
  if (allDone) {
    showToast('🟢 ¡Publicación completada! Todo listo.');
  } else if (nextName) {
    showToast('✓ Confirmado — siguiente: ' + nextName);
  } else {
    showToast('✓ Paso completado');
  }
}

function _patchPlanCard(card) {
  if (card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, {
      method:'PATCH', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ subtasks: card.subtasks, status: card.status })
    }).catch(function(){});
  }
}

function _saveStepToGeneratedContent(card, sub) {
  if (typeof db === 'undefined' || !dbConnected) return;
  var caption = sub.output || '';
  var headline = caption.split('\n').find(function(l){ return l.trim().length > 0; }) || '';
  headline = headline.replace(/^[#\*\-\s]+/, '').substring(0, 120);
  var photo = sub.suggested_photo || null;
  var clientUUID = _planSuggestState.clientId;
  // Se è una chiave breve (es. 'bellavista'), la risolve in UUID
  if (clientUUID && clientUUID.indexOf('-') === -1) {
    try {
      if (typeof clientUUIDFromKey === 'function') {
        clientUUID = clientUUIDFromKey(clientUUID) || clientUUID;
      }
    } catch(e) {}
  }
  console.log('[PLAN] client UUID per generated_content:', clientUUID);

  var payload = {
    client_id:    clientUUID,
    platform:     'Instagram',
    pillar:       card.pillar || '',
    format:       card.format || '',
    content_type: card.title || '',
    headline:     headline,
    caption:      caption,
    agent_notes:  'Piano: ' + (card.title || ''),
    img_b64:      photo ? photo.url : null,
    generated_by: 'plan',
    status:       'en_revision'
  };

  db.from('generated_content').insert(payload).then(function(res) {
    if (res.error) { console.warn('[PLAN] Errore save generated_content:', res.error.message); return; }
    console.log('[PLAN] ✓ Salvato en_revision:', headline);
    if (typeof loadRecentContentFromDB === 'function') loadRecentContentFromDB();
  });
}

function _updatePlanCardHeader(card, ci) {
  var st = _PSTAT[card.status||'todo'];
  var pill = document.getElementById('plan-card-status-'+ci);
  if (pill) { pill.textContent = st.dot+' '+st.label; pill.style.background=st.bg; pill.style.color=st.color; }
  var totalSub = (card.subtasks||[]).length;
  var doneSub  = (card.subtasks||[]).filter(function(s){return s.status==='done';}).length;
  var progPct  = totalSub ? Math.round(doneSub/totalSub*100) : 0;
  var progBar = document.querySelector('#plan-card-'+ci+' .plan-prog-bar');
  if (progBar) { progBar.style.width = progPct+'%'; progBar.style.background = progPct===100?'#16a34a':'#2563eb'; }
}

// Mappa formato → icona e label
var _FORMAT_LABELS = {
  feed:      { icon: '📸', label: 'Feed' },
  story:     { icon: '📱', label: 'Story' },
  reel:      { icon: '▶️', label: 'Reel' },
  carousel:  { icon: '📖', label: 'Carousel' },
  brand_kit: { icon: '🎨', label: 'Brand Kit' },
  logo:      { icon: '✦',  label: 'Logo' },
  tipografia:{ icon: '🔤', label: 'Tipografía' },
  paleta:    { icon: '🎨', label: 'Paleta' },
  manual:    { icon: '📄', label: 'Manual' },
  ads:       { icon: '📣', label: 'Ads' },
  seo:       { icon: '🔍', label: 'SEO' },
};

// Restituisce il numero di settimana del mese (1-4) da una data YYYY-MM-DD
function _weekOfMonth(dateStr) {
  if (!dateStr) return 1;
  var d = new Date(dateStr + 'T12:00:00');
  return Math.ceil(d.getDate() / 7);
}

function _renderPlanCards(cards) {
  // Render organizer header siempre (incluso si no hay cards aún)
  var organizer = _renderRodajeOrganizer(cards);

  if (!cards.length) return organizer + '<div style="color:#888;padding:1rem;text-align:center;font-size:0.85rem">No hay cards generadas</div>';

  var teamOpts = _teamMembers.map(function(m){
    return '<option value="' + m.name + '">' + (m.employment_type === 'agent' ? '🤖 ' : '') + m.name + '</option>';
  }).join('');

  var sharedRef = _findSharedCard(cards);
  var sharedExists = !!sharedRef;
  var sharedDone = _isSharedDone(cards);

  // Render shared card primero (si existe), luego las individuales agrupadas por semana
  var sharedHtml = '';
  cards.forEach(function(card, i) {
    if (card.format !== 'shared') return;
    sharedHtml += _renderSharedCardRow(card, i);
  });

  // Raggruppa solo le card non-shared per settimana
  var weeks = {};
  cards.forEach(function(card, i) {
    if (card.format === 'shared') return;
    var w = _weekOfMonth(card.publish_date);
    if (!weeks[w]) weeks[w] = [];
    weeks[w].push({ card: card, i: i });
  });

  var html = sharedHtml;
  [1,2,3,4].forEach(function(w) {
    if (!weeks[w] || !weeks[w].length) return;
    html += '<div style="margin-bottom:0.4rem;margin-top:' + (w > 1 ? '1.2rem' : '0.8rem') + '">' +
      '<div style="font-size:0.68rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C29547;padding:0.3rem 0;border-bottom:1.5px solid #f0ece5;margin-bottom:0.6rem">Semana ' + w + '</div>' +
    '</div>';

    weeks[w].forEach(function(item) {
      var card = item.card;
      var i    = item.i;

      var fmt   = _FORMAT_LABELS[card.format] || { icon: '📋', label: card.format || 'Contenido' };
      var badge = '<span style="display:inline-flex;align-items:center;gap:0.2rem;font-size:0.65rem;font-weight:700;background:#f0ece5;color:#555;border-radius:20px;padding:0.15rem 0.55rem;margin-right:0.4rem">' + fmt.icon + ' ' + fmt.label + '</span>';

      var dateFormatted = card.publish_date
        ? new Date(card.publish_date + 'T12:00:00').toLocaleDateString('es-ES', {weekday:'short', day:'2-digit', month:'short'})
        : '';

      var isEditing = card._editing;
      var cardSt  = _PSTAT[card.status || 'todo'];
      // Barra progresso subtask
      var totalSub = (card.subtasks||[]).length;
      var doneSub  = (card.subtasks||[]).filter(function(s){ return s.status==='done'; }).length;
      var progPct  = totalSub ? Math.round(doneSub/totalSub*100) : 0;

      // Lock visivo: bloccato finché la shared non è finita (solo si la shared existe)
      var isLocked = totalSub > 0 && sharedExists && !sharedDone;
      var lockBadge = isLocked
        ? '<span style="font-size:0.6rem;font-weight:700;background:#f3f4f6;color:#888;border-radius:4px;padding:0.1rem 0.4rem;margin-left:0.3rem" title="Esperando que termine la producción compartida">🔒</span>'
        : '';
      var cardOpacity = isLocked ? '0.78' : '1';

      var viewMode =
        '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.85rem 1rem;background:#fafaf8;cursor:pointer;opacity:'+cardOpacity+'" onclick="togglePlanCard(' + i + ')">' +
          '<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#C29547;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0">' + (i+1) + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div style="font-weight:600;font-size:0.85rem;color:#1F2A24;margin-bottom:0.15rem">' + badge + (card.title || '') + lockBadge + '</div>' +
            '<div style="font-size:0.72rem;color:#888">' + dateFormatted + ' · ' + (card.assignee || '') + (totalSub ? ' · '+doneSub+'/'+totalSub+' tareas' : '') + '</div>' +
            (totalSub ? '<div style="height:3px;background:#f0ece5;border-radius:2px;margin-top:0.3rem;overflow:hidden"><div class="plan-prog-bar" style="height:100%;width:'+progPct+'%;background:'+(progPct===100?'#16a34a':'#2563eb')+';border-radius:2px;transition:width 0.3s"></div></div>' : '') +
          '</div>' +
          '<div style="display:flex;gap:0.35rem;align-items:center;flex-shrink:0">' +
            '<span id="plan-card-status-'+i+'" onclick="event.stopPropagation()" style="font-size:0.67rem;font-weight:700;background:'+cardSt.bg+';color:'+cardSt.color+';border-radius:20px;padding:0.15rem 0.55rem;white-space:nowrap">'+cardSt.dot+' '+cardSt.label+'</span>' +
            (!isLocked && card.status !== 'done' ? '<button onclick="event.stopPropagation();launchPlanCardInAgentes('+i+')" style="font-size:0.68rem;padding:0.2rem 0.6rem;background:linear-gradient(135deg,#1F2A24,#2d4a3e);border:none;border-radius:5px;cursor:pointer;color:#C29547;font-weight:700;white-space:nowrap">▶ Genera</button>' : '') +
            '<button onclick="event.stopPropagation();planCardEdit('+i+')" style="font-size:0.68rem;padding:0.2rem 0.5rem;background:none;border:1px solid #e0dbd2;border-radius:5px;cursor:pointer;color:#888">✏️</button>' +
            '<button onclick="event.stopPropagation();planCardDelete('+i+')" style="font-size:0.68rem;padding:0.2rem 0.5rem;background:none;border:1px solid #f3c0b8;border-radius:5px;cursor:pointer;color:#c0392b">🗑</button>' +
            '<span style="color:#bbb;font-size:0.75rem">▾</span>' +
          '</div>' +
        '</div>' +
        '<div id="plan-card-detail-' + i + '" style="display:none;padding:0.85rem 1rem;border-top:1px solid #f0ece5">' +
          _renderPlanDetail(card, i) +
        '</div>';

      var editMode =
        '<div style="padding:0.85rem 1rem;background:#fafaf8;display:flex;gap:0.5rem;align-items:center">' +
          '<div style="width:36px;height:36px;border-radius:8px;background:#e0dbd2;color:#888;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.8rem;flex-shrink:0">' + (i+1) + '</div>' +
          '<div style="flex:1;display:flex;flex-direction:column;gap:0.4rem">' +
            '<input id="pce-title-' + i + '" value="' + (card.title||'').replace(/"/g,'&quot;') + '" style="width:100%;padding:0.35rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
            '<div style="display:flex;gap:0.5rem">' +
              '<input type="date" id="pce-date-' + i + '" value="' + (card.publish_date||'') + '" style="flex:1;padding:0.3rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem">' +
              '<select id="pce-assign-' + i + '" style="flex:1;padding:0.3rem 0.5rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem">' + teamOpts + '</select>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;flex-direction:column;gap:0.3rem">' +
            '<button onclick="planCardSaveEdit(' + i + ')" style="font-size:0.7rem;padding:0.25rem 0.6rem;background:#1F2A24;color:#C29547;border:none;border-radius:5px;cursor:pointer">✓</button>' +
            '<button onclick="planCardCancelEdit(' + i + ')" style="font-size:0.7rem;padding:0.25rem 0.6rem;background:none;border:1px solid #e0dbd2;border-radius:5px;cursor:pointer;color:#888">✕</button>' +
          '</div>' +
        '</div>';

      html += '<div id="plan-card-' + i + '" style="border:1.5px solid #e0dbd2;border-radius:10px;margin-bottom:0.6rem;overflow:hidden">' +
        (isEditing ? editMode : viewMode) +
      '</div>';
    });
  });

  return organizer + html +
  '<button onclick="planCardAdd()" style="width:100%;margin-top:0.5rem;padding:0.6rem;background:none;border:1.5px dashed #e0dbd2;border-radius:8px;cursor:pointer;font-size:0.78rem;color:#888">+ Añadir card</button>';
}

// Render della card "Producción compartida" (formato visivo distinto)
function _renderSharedCardRow(card, i) {
  var subs = card.subtasks || [];
  var totalSub = subs.length;
  var doneSub  = subs.filter(function(s){ return s.status==='done'; }).length;
  var progPct  = totalSub ? Math.round(doneSub/totalSub*100) : 0;
  var done = totalSub > 0 && doneSub === totalSub;
  var cardSt = _PSTAT[done ? 'done' : (doneSub > 0 ? 'wip' : 'todo')];

  var rodajeSub = subs.find(function(s){ return s.phase==='rodaje'; });
  var rodajeLabel = rodajeSub && rodajeSub.date ? _fmtDateShort(rodajeSub.date) : '';

  var headerBg = done
    ? 'linear-gradient(135deg,#16a34a,#15803d)'
    : 'linear-gradient(135deg,#1F2A24,#2d4a3e)';

  return '<div id="plan-card-' + i + '" style="border:2px solid #C29547;border-radius:12px;margin-bottom:1rem;overflow:hidden;box-shadow:0 2px 8px rgba(31,42,36,0.08)">' +
    '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.95rem 1rem;background:'+headerBg+';color:#C29547;cursor:pointer" onclick="togglePlanCard(' + i + ')">' +
      '<div style="font-size:1.4rem;flex-shrink:0">🎬</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.6rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#C29547;opacity:0.85;margin-bottom:0.1rem">Flujo compartido</div>' +
        '<div style="font-weight:700;font-size:0.95rem;color:#fff;margin-bottom:0.15rem">'+(card.title||'Producción compartida')+'</div>' +
        '<div style="font-size:0.72rem;color:#C29547;opacity:0.95">'+(rodajeLabel?'🎬 Rodaje '+rodajeLabel+' · ':'')+ doneSub+'/'+totalSub+' pasos completados</div>' +
        (totalSub ? '<div style="height:4px;background:rgba(194,149,71,0.25);border-radius:2px;margin-top:0.4rem;overflow:hidden"><div class="plan-prog-bar" style="height:100%;width:'+progPct+'%;background:#C29547;border-radius:2px;transition:width 0.3s"></div></div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:0.35rem;align-items:center;flex-shrink:0">' +
        '<span id="plan-card-status-'+i+'" onclick="event.stopPropagation()" style="font-size:0.67rem;font-weight:700;background:'+cardSt.bg+';color:'+cardSt.color+';border-radius:20px;padding:0.15rem 0.55rem;white-space:nowrap">'+cardSt.dot+' '+cardSt.label+'</span>' +
        '<button onclick="event.stopPropagation();planCardDelete('+i+')" style="font-size:0.7rem;padding:0.2rem 0.45rem;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.25);border-radius:5px;cursor:pointer;color:#fff;font-weight:700" title="Eliminar de Supabase">✕</button>' +
        '<span style="color:#C29547;font-size:0.85rem">▾</span>' +
      '</div>' +
    '</div>' +
    '<div id="plan-card-detail-' + i + '" style="display:none;padding:0.95rem 1rem;background:#fafaf8;border-top:1px solid #C29547">' +
      _renderPlanDetail(card, i) +
    '</div>' +
  '</div>';
}

function togglePlanCard(i) {
  var detail = document.getElementById('plan-card-detail-' + i);
  if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
}

function planCardDelete(i) {
  var card = _planSuggestState.cards[i];
  var label = card ? (card.title || 'esta tarjeta') : 'esta tarjeta';
  var ok = confirm('¿Eliminar "' + label + '"?\n\nSe borrará definitivamente de Supabase.');
  if (!ok) return;
  // Se ha _db_id, elimina direttamente la riga da Supabase
  if (card && card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, { method: 'DELETE' })
      .catch(function(){});
  }
  _planSuggestState.cards.splice(i, 1);
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  showToast('🗑 "' + label + '" eliminada de Supabase');
}

function planCardEdit(i) {
  _planSuggestState.cards[i]._editing = true;
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  // Pre-seleziona il responsabile nel select
  var sel = document.getElementById('pce-assign-' + i);
  if (sel) sel.value = _planSuggestState.cards[i].assignee || '';
}

function planCardCancelEdit(i) {
  _planSuggestState.cards[i]._editing = false;
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
}

function planCardSaveEdit(i) {
  var card = _planSuggestState.cards[i];
  var titleEl  = document.getElementById('pce-title-' + i);
  var dateEl   = document.getElementById('pce-date-' + i);
  var assignEl = document.getElementById('pce-assign-' + i);
  if (titleEl)  card.title        = titleEl.value.trim();
  if (dateEl)   card.publish_date = dateEl.value;
  if (assignEl) card.assignee     = assignEl.value;
  card._editing = false;
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  // Auto-guarda la card modificada en Supabase
  if (card._db_id) {
    fetch(BRAVO_API + '/api/plan-tasks/' + card._db_id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: card.title, publish_date: card.publish_date, assignee: card.assignee })
    }).catch(function(e){ console.warn('[PLAN] Error al guardar card:', e.message); });
  } else {
    // Card nueva sin _db_id: re-salva todo el plan
    var state = _planSuggestState;
    _savePlanTasksToSupabase(state.clientId, state.projectId, state.proj, state.cards);
  }
}

function planCardAdd() {
  var today = new Date().toISOString().slice(0,10);
  _planSuggestState.cards.push({ title:'Nueva tarea', publish_date: today, assignee:'', format:'', subtasks:[], _editing: true });
  document.getElementById('planSuggestBody').innerHTML = _renderPlanCards(_planSuggestState.cards);
  var i = _planSuggestState.cards.length - 1;
  var sel = document.getElementById('pce-assign-' + i);
  if (sel) sel.value = '';
}

function closePlanSuggest() {
  document.getElementById('planSuggestOverlay').style.display = 'none';
  _planSuggestState = { clientId: null, projectId: null, cards: [] };
}

function confirmPlan() {
  var cards = _planSuggestState.cards;
  var clientId = _planSuggestState.clientId;
  var projectId = _planSuggestState.projectId;
  var proj = _planSuggestState.proj;
  if (!cards.length || !projectId) return;

  if (!KANBAN_DATA[projectId]) {
    KANBAN_DATA[projectId] = { info:[], ideas:[], todo:[], wip:[], done:[], pub:[], meet:[], shoot:[], prop:[] };
  }

  cards.forEach(function(card) {
    var dateFormatted = card.publish_date
      ? new Date(card.publish_date + 'T12:00:00').toLocaleDateString('es-ES', {day:'2-digit', month:'short'})
      : '';
    KANBAN_DATA[projectId]['todo'].push({
      t:        card.title || 'Post',
      m:        (card.assignee || '') + (dateFormatted ? ' · ' + dateFormatted : ''),
      desc:     (card.creative_note || '') + '\n\n' + (card.subtasks||[]).map(function(s){ return '• ' + s.name + ' (' + (s.date||'') + ') — ' + (s.assignee||''); }).join('\n'),
      assign:   card.assignee || '',
      date:     card.publish_date || '',
      priority: 'Normal',
      links:    [],
      comments: ''
    });
  });

  // Salva anche su Supabase
  _savePlanTasksToSupabase(clientId, projectId, proj, cards);

  // Bridge → Hoy toca: aggiungi subtask umane a _equipoTasks
  if (typeof _equipoTasks === 'undefined') window._equipoTasks = {};
  cards.forEach(function(card) {
    (card.subtasks || []).forEach(function(s) {
      var assignee = s.assignee || '';
      if (!assignee || assignee.toLowerCase().indexOf('agente') >= 0) return;
      if (!_equipoTasks[assignee]) _equipoTasks[assignee] = [];
      // Evita duplicati
      var taskLabel = card.title + ' — ' + (s.name || s.title || '');
      var alreadyIn = _equipoTasks[assignee].some(function(t){
        return (typeof t === 'string' ? t : t.t) === taskLabel;
      });
      if (!alreadyIn) _equipoTasks[assignee].push({ t: taskLabel, date: s.date || card.publish_date, status: s.status || 'todo', source: 'plan' });
    });
  });
  if (typeof renderHoyStrip === 'function') renderHoyStrip();

  // Aggiorna cache globale plan tasks per il Tablero Plan
  window._allPlanTasks = (window._allPlanTasks || []).filter(function(t){ return t.project_id !== projectId; });
  cards.forEach(function(card) {
    window._allPlanTasks.push(Object.assign({}, card, { client_id: clientId, project_id: projectId, project_title: proj ? proj.title : '' }));
  });

  showToast('✦ ' + cards.length + ' tarjetas añadidas al plan');
  closePlanSuggest();

  var panel = document.querySelector('.ctab-panel[data-tab="proyectos"]');
  if (panel) panel.innerHTML = renderProyectosSection(clientId);
}

async function _savePlanTasksToSupabase(clientId, projectId, proj, cards) {
  try {
    // Deduplicazione: se ci sono più card "shared", tiene solo la prima
    var seenShared = false;
    cards = cards.filter(function(c) {
      if (c.format === 'shared') {
        if (seenShared) return false;
        seenShared = true;
      }
      return true;
    });
    var tasks = cards.map(function(card) {
      // Genera UUID stabile se la card non ne ha ancora uno
      if (!card._db_id) card._db_id = crypto.randomUUID();
      return {
        id:            card._db_id,       // UUID stabile → UPSERT in-place
        client_id:     clientId,
        project_id:    projectId,
        project_title: proj ? (proj.title || '') : '',
        title:         card.title || 'Tarea',
        assignee:      card.assignee || '',
        publish_date:  card.publish_date || null,
        status:        card.status || 'todo',  // preserva stato reale
        priority:      'Normal',
        format:        card.format || '',
        creative_note: card.creative_note || '',
        subtasks:      card.subtasks || []
      };
    });
    var res = await fetch(BRAVO_API + '/api/plan-tasks/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks: tasks })
    });
    var data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.detail || 'Error al guardar');

    // Aggiorna _db_id in-memory dai task restituiti dal server (già stabili per UPSERT,
    // ma garantisce allineamento se il backend ha generato un id diverso)
    if (data.tasks && Array.isArray(data.tasks)) {
      data.tasks.forEach(function(saved) {
        var match = cards.find(function(c){ return c.title === saved.title && !c._db_id_confirmed; });
        if (match && saved.id) { match._db_id = saved.id; match._db_id_confirmed = true; }
      });
    }

    showToast('✓ Plan guardado en Supabase (' + tasks.length + ' tareas)');
  } catch(e) {
    console.warn('[PLAN TASKS] Salvataggio fallito:', e.message);
    showToast('⚠️ Plan no guardado en Supabase: ' + (e.message || 'error desconocido'));
  }
}

async function saveProgramar() {
  var startEl  = document.getElementById('progInlineStart');
  var endEl    = document.getElementById('progInlineEnd');
  var assignEl = document.getElementById('progInlineAssign');
  var budgetEl = document.getElementById('progInlineBudget');

  var startVal  = startEl  ? startEl.value  : '';
  var endVal    = endEl    ? endEl.value    : '';
  var assignVal = assignEl ? assignEl.value : '';
  var budgetVal = budgetEl ? budgetEl.value : '';

  if (!startVal) { showToast('Selecciona la fecha de inicio'); return; }
  if (!endVal)   { endVal = startVal; }

  var saveBtn = document.querySelector('.cproj-inline-panel .btn-acc');
  if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }

  try {
    // 1. Salva dati progetto (come prima)
    await fetch(AGENT_API + '/api/briefing/projects/' + encodeURIComponent(_programarState.projectId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        status:      'aprobado',
        start_date:  startVal,
        end_date:    endVal,
        assigned_to: assignVal || null,
        budget_eur:  budgetVal ? parseInt(budgetVal) : null
      })
    });

    // 2. Salva tareas — prima elimina quelle vecchie (senza id = nuove), poi crea tutte
    var pId = _programarState.projectId;
    var cId = _programarState.clientId;
    // Elimina le tareas con id (già salvate in precedenza) che non sono più presenti
    var existingIds = _programarTasks.filter(function(t){ return t.id; }).map(function(t){ return t.id; });
    // Crea le nuove (senza id)
    var newTasks = _programarTasks.filter(function(t){ return !t.id; });
    await Promise.all(newTasks.map(function(t, i) {
      return fetch(AGENT_API + '/api/projects/' + encodeURIComponent(pId) + '/tasks', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          client_id:       cId,
          title:           t.title,
          description:     t.description || '',
          role:            t.role || null,
          assigned_to:     t.assigned_to || null,
          start_date:      t.start_date || null,
          end_date:        t.end_date || null,
          priority:        t.priority || 'normal',
          order_index:     i
        })
      });
    }));

    // 3. Aggiorna cache locale progetto
    var arr = _clientProjects[cId];
    if (arr) {
      var proj = arr.find(function(x){ return x.id === pId; });
      if (proj) {
        proj.status      = 'aprobado';
        proj.start_date  = startVal;
        proj.end_date    = endVal;
        proj.assigned_to = assignVal || null;
        proj.budget_eur  = budgetVal ? parseInt(budgetVal) : null;
      }
    }

    // 4. Invalida cache tareas cliente e ricarica
    delete _clientTasksCache[cId];
    _loadClientTasks(cId);

    var savedClientId = cId;
    _programarTasks = [];
    closeProgramarModal();
    var panelCal = document.querySelector('.ctab-panel[data-tab="calendario"]');
    if (panelCal) panelCal.innerHTML = renderCalendarioSection(savedClientId);
    showToast('✅ Proyecto programado con ' + (_programarTasks.length || newTasks.length) + ' tareas');
  } catch(e) {
    showToast('Error al guardar. Intenta de nuevo.');
  }
  if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar'; }
}

// ── PROGRAMAR — HELPERS TAREAS ───────────────────────────────────────────────

function programarRemoveTask(idx) {
  _programarTasks.splice(idx, 1);
  if (_programarExpandedIdx === idx) _programarExpandedIdx = null;
  else if (_programarExpandedIdx > idx) _programarExpandedIdx--;
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarAddTaskRow() {
  var t = { title: 'Nueva tarea', role: 'copy', assigned_to: '', start_date: '', end_date: '', priority: 'normal', _confirmed: false };
  _programarTasks.push(t);
  _programarExpandedIdx = _programarTasks.length - 1; // apre subito il form
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarToggleTask(idx) {
  _programarExpandedIdx = (_programarExpandedIdx === idx) ? null : idx;
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarSetPriority(idx, value) {
  _programarTasks[idx].priority = value;
  var el = document.getElementById('ptask-priority-' + idx);
  if (el) el.value = value;
  // Ricolora i bottoni senza re-render completo
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

function programarConfirmTask(idx) {
  // Legge i valori dal form espanso e li salva nel task
  var t = _programarTasks[idx];
  if (!t) return;
  var get = function(id) { var el = document.getElementById(id); return el ? el.value : ''; };
  t.title       = get('ptask-title-'    + idx) || t.title;
  t.description = get('ptask-desc-'     + idx);
  t.role        = get('ptask-role-'     + idx);
  t.assigned_to = get('ptask-assign-'   + idx);
  t.start_date  = get('ptask-start-'    + idx);
  t.end_date    = get('ptask-end-'      + idx);
  t.priority    = get('ptask-priority-' + idx);
  t._confirmed  = true;
  _programarExpandedIdx = null;
  var listEl = document.getElementById('progTasksList');
  if (listEl) _renderProgramarTasksList(listEl);
}

async function programarSuggestAI() {
  var ps = _programarState;
  var arr = _clientProjects[ps.clientId];
  var proj = arr ? arr.find(function(x){ return x.id === ps.projectId; }) : null;
  if (!proj) return;
  var btn = document.getElementById('progAiBtn');
  if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }
  try {
    // Recupera snippet briefing per contesto più preciso
    var briefingSnippet = '';
    try {
      var br = await fetch(AGENT_API + '/api/briefing/' + encodeURIComponent(ps.clientId));
      var bd = await br.json();
      if (bd.briefing_text) briefingSnippet = bd.briefing_text.slice(0, 1200);
    } catch(e) {}

    var r = await fetch(AGENT_API + '/api/projects/' + encodeURIComponent(ps.projectId) + '/suggest-tasks', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        title:            proj.title || '',
        description:      proj.description || '',
        category:         proj.category || '',
        client_id:        ps.clientId,
        briefing_snippet: briefingSnippet
      })
    });
    var d = await r.json();
    if (d.ok && d.tasks && d.tasks.length) {
      var startBase = new Date();
      d.tasks.forEach(function(t) {
        var s = new Date(startBase);
        s.setDate(s.getDate() + (t.start_offset || 0));
        var e = new Date(s);
        e.setDate(e.getDate() + (t.duration_days || 3));
        _programarTasks.push({
          title:       t.title,
          description: t.description || '',
          role:        t.role || 'gestión',
          assigned_to: t.assigned_to || '',
          start_date:  s.toISOString().slice(0,10),
          end_date:    e.toISOString().slice(0,10),
          priority:    t.priority || 'normal',
          _confirmed:  false
        });
      });
      _programarExpandedIdx = null;
      var listEl = document.getElementById('progTasksList');
      if (listEl) _renderProgramarTasksList(listEl);
      showToast('✦ ' + d.tasks.length + ' tareas sugeridas — revísalas una por una');
    }
  } catch(e) { showToast('Error al contactar IA'); }
  if (btn) { btn.textContent = '✦ Sugerir con IA'; btn.disabled = false; }
}

function _renderProgramarTasksList(listEl) {
  var roleEmoji    = { estrategia:'🧠', copy:'✍️', diseño:'🎨', video:'🎬', ads:'📣', publicación:'📤', reporting:'📊', gestión:'📋' };
  var memberColors = {}; _teamMembers.forEach(function(m){ memberColors[m.name] = m.color; });
  var TEAM_NAMES   = _teamMembers.map(function(m){ return m.name; });
  var ROLES        = ['estrategia','copy','diseño','video','ads','publicación','reporting','gestión'];

  if (!_programarTasks.length) {
    listEl.innerHTML = '<div style="font-size:0.73rem;color:var(--muted2);text-align:center;padding:1rem">' +
      'Sin tareas — usa <strong>✦ Sugerir con IA</strong> o <strong>+ Añadir</strong></div>';
    return;
  }

  var pending   = _programarTasks.filter(function(t){ return !t._confirmed; }).length;
  var confirmed = _programarTasks.length - pending;
  var banner = pending
    ? '<div style="font-size:0.7rem;padding:0.45rem 0.7rem;background:#fff8e1;border:1px solid #ffe082;border-radius:7px;color:#795548;margin-bottom:0.5rem">' +
        '📋 <strong>' + _programarTasks.length + '</strong> tareas — ' +
        '<strong style="color:#C0392B">' + pending + ' por revisar</strong>' +
        (confirmed ? ' · <strong style="color:#2e7d32">' + confirmed + ' confirmadas ✓</strong>' : '') +
        ' — Clica cada tarea para revisarla' +
      '</div>'
    : '<div style="font-size:0.7rem;padding:0.45rem 0.7rem;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:7px;color:#2e7d32;margin-bottom:0.5rem">' +
        '✅ Todas las tareas revisadas y confirmadas — listo para guardar' +
      '</div>';

  var rows = _programarTasks.map(function(t, i) {
    var isExpanded = _programarExpandedIdx === i;
    var col    = memberColors[t.assigned_to] || '#888';
    var emoji  = roleEmoji[t.role] || '📌';
    var isAI   = !t._confirmed;
    var borderColor = t._confirmed ? '#a5d6a7' : (isExpanded ? '#C0392B' : 'var(--border)');
    var bgColor     = t._confirmed ? '#f1f8f1' : (isExpanded ? '#fff8f8' : 'var(--bg)');

    // ── Riga collassata
    var collapsed =
      '<div onclick="programarToggleTask(' + i + ')" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer">' +
        '<span style="font-size:0.9rem;flex-shrink:0">' + emoji + '</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:0.75rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            (t._confirmed ? '<span style="color:#2e7d32">✓ </span>' : '<span style="color:#e65100;font-size:0.65rem">IA · </span>') +
            t.title +
          '</div>' +
          '<div style="font-size:0.67rem;margin-top:0.1rem;color:' + col + '">' +
            (t.assigned_to || '<span style="color:#e65100">Sin asignar</span>') + ' · ' + (t.role || '') +
          '</div>' +
        '</div>' +
        '<div style="font-size:0.62rem;color:var(--muted2);white-space:nowrap;flex-shrink:0">' +
          (t.start_date ? t.start_date.slice(5) : '') + (t.end_date && t.end_date !== t.start_date ? '→' + t.end_date.slice(5) : '') +
        '</div>' +
        '<span style="color:var(--muted2);font-size:0.7rem;flex-shrink:0;padding:0 0.2rem">' + (isExpanded ? '▲' : '▼') + '</span>' +
        '<button onclick="event.stopPropagation();programarRemoveTask(' + i + ')" ' +
          'style="background:none;border:none;cursor:pointer;color:var(--muted2);font-size:1rem;padding:0;flex-shrink:0;line-height:1">×</button>' +
      '</div>';

    // ── Form espanso
    var expanded = !isExpanded ? '' :
      '<div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid var(--border)">' +
        // Titolo
        '<div style="margin-bottom:0.45rem">' +
          '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">TÍTULO</label>' +
          '<input id="ptask-title-' + i + '" type="text" value="' + (t.title||'').replace(/"/g,'&quot;') + '" ' +
            'style="width:100%;font-size:0.75rem;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:6px;background:#fff;box-sizing:border-box">' +
        '</div>' +
        // Descripción
        '<div style="margin-bottom:0.45rem">' +
          '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">DESCRIPCIÓN</label>' +
          '<textarea id="ptask-desc-' + i + '" rows="2" ' +
            'style="width:100%;font-size:0.73rem;padding:0.3rem 0.5rem;border:1px solid var(--border);border-radius:6px;background:#fff;resize:vertical;box-sizing:border-box">' +
            (t.description||'') +
          '</textarea>' +
        '</div>' +
        // Rol + Responsable
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.45rem">' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">ROL</label>' +
            '<select id="ptask-role-' + i + '" style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff">' +
              ROLES.map(function(r){ return '<option value="' + r + '"' + (t.role===r?' selected':'') + '>' + (roleEmoji[r]||'') + ' ' + r + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">RESPONSABLE</label>' +
            '<select id="ptask-assign-' + i + '" style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff">' +
              '<option value="">Sin asignar</option>' +
              TEAM_NAMES.map(function(n){ return '<option value="' + n + '"' + (t.assigned_to===n?' selected':'') + '>' + n.split(' ')[0] + '</option>'; }).join('') +
            '</select>' +
          '</div>' +
        '</div>' +
        // Fechas
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.45rem">' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">FECHA INICIO</label>' +
            '<input id="ptask-start-' + i + '" type="date" value="' + (t.start_date||'') + '" ' +
              'style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff;box-sizing:border-box">' +
          '</div>' +
          '<div>' +
            '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">FECHA FIN</label>' +
            '<input id="ptask-end-' + i + '" type="date" value="' + (t.end_date||'') + '" ' +
              'style="width:100%;font-size:0.73rem;padding:0.3rem 0.4rem;border:1px solid var(--border);border-radius:6px;background:#fff;box-sizing:border-box">' +
          '</div>' +
        '</div>' +
        // Prioridad
        '<div style="margin-bottom:0.6rem">' +
          '<label style="font-size:0.65rem;color:var(--muted2);font-weight:600;display:block;margin-bottom:0.2rem">PRIORIDAD</label>' +
          '<div style="display:flex;gap:0.4rem">' +
            ['alta','normal','baja'].map(function(p){
              var colors = { alta:'#C0392B', normal:'#2980b9', baja:'#7f8c8d' };
              var sel = t.priority === p;
              return '<button type="button" onclick="programarSetPriority(' + i + ',\'' + p + '\')" ' +
                'style="font-size:0.7rem;padding:0.22rem 0.65rem;border-radius:20px;cursor:pointer;border:1px solid ' +
                (sel ? colors[p] : 'var(--border)') + ';background:' + (sel ? colors[p] : 'transparent') + ';' +
                'color:' + (sel ? '#fff' : 'var(--muted2)') + ';font-weight:' + (sel?'700':'400') + '">' + p + '</button>';
            }).join('') +
          '</div>' +
          '<input type="hidden" id="ptask-priority-' + i + '" value="' + (t.priority||'normal') + '">' +
        '</div>' +
        // Bottone Confirmar
        '<button onclick="programarConfirmTask(' + i + ')" ' +
          'style="width:100%;padding:0.45rem;background:#2e7d32;color:#fff;border:none;border-radius:8px;' +
          'font-size:0.75rem;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem">' +
          '✓ Confirmar tarea' +
        '</button>' +
      '</div>';

    return '<div style="padding:0.5rem 0.65rem;background:' + bgColor + ';border-radius:9px;border:1px solid ' + borderColor + ';transition:border-color 0.15s">' +
      collapsed + expanded +
    '</div>';
  }).join('');

  listEl.innerHTML = banner + rows;
}

// ── CARGA TAREAS CLIENTE (para Gantt) ────────────────────────────────────────

async function _loadClientTasks(clientId) {
  try {
    var r = await fetch(AGENT_API + '/api/clients/' + encodeURIComponent(clientId) + '/tasks');
    var d = await r.json();
    if (d.ok) {
      _clientTasksCache[clientId] = d.tasks || [];
      var panelCal = document.querySelector('.ctab-panel[data-tab="calendario"]');
      if (panelCal && panelCal.dataset && panelCal.dataset.clientId === clientId) {
        panelCal.innerHTML = renderCalendarioSection(clientId);
      }
    }
  } catch(e) {}
}

// ── SECCIÓN CALENDARIO (GANTT) ────────────────────────────────────────────────

function renderCalendarioSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">Sin cliente</div>';

  var mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  var TEAM   = _teamMembers.map(function(m){ return { name: m.name, initials: m.initials, color: m.color }; });
  var catColors = {
    CONTENIDO:'#1a6fa8', PUBLICIDAD:'#a81a6f', ALIANZAS:'#1a8a1e',
    'SEO LOCAL':'#a87c1a', CONVERSIÓN:'#6f1aa8', CAMPAÑA:'#a81a1a'
  };
  var catBg = {
    CONTENIDO:'#e8f4fd', PUBLICIDAD:'#fde8f4', ALIANZAS:'#e8fde9',
    'SEO LOCAL':'#fdf5e8', CONVERSIÓN:'#f0e8fd', CAMPAÑA:'#fde8e8'
  };

  // Tareas cargadas
  var tasks = _clientTasksCache[clientId] || [];

  // Si no hay tareas en cache, dispara la carga y muestra estado de espera
  if (!_clientTasksCache.hasOwnProperty(clientId)) {
    _loadClientTasks(clientId);
    return '<div class="ctab-placeholder" style="padding:3rem 1rem;text-align:center">' +
      '<div style="font-size:1.4rem;margin-bottom:0.5rem">⏳</div>' +
      '<strong>Cargando calendario…</strong>' +
    '</div>';
  }

  // Fallback: si no hay tareas, usa fechas de proyectos como antes
  var tasksWithDates = tasks.filter(function(t){ return t.start_date; });
  var allProjects    = _clientProjects[clientId] || [];
  var programmed     = allProjects.filter(function(p){ return p.start_date && p.status !== 'rechazado'; });

  if (!tasksWithDates.length && !programmed.length) {
    return '<div class="ctab-placeholder" style="padding:3rem 1rem;text-align:center">' +
      '<div style="font-size:1.8rem;margin-bottom:0.5rem">📅</div>' +
      '<strong>Sin tareas programadas</strong><br>' +
      '<span style="font-size:0.78rem;color:var(--muted2)">Usa "📅 Programar" en los proyectos aprobados y añade tareas al equipo.</span>' +
    '</div>';
  }

  // Calcola range mesi da tutte le date disponibili (tareas + proyectos)
  var allDates = tasksWithDates.map(function(t){ return new Date(t.start_date); })
    .concat(tasksWithDates.map(function(t){ return new Date(t.end_date || t.start_date); }))
    .concat(programmed.map(function(p){ return new Date(p.start_date); }))
    .concat(programmed.map(function(p){ return new Date(p.end_date || p.start_date); }));
  var minDate = allDates.reduce(function(a,b){ return b < a ? b : a; }, allDates[0]);
  var maxDate = allDates.reduce(function(a,b){ return b > a ? b : a; }, allDates[0]);

  var months = [];
  var cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  var endM = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (cur <= endM) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth(), label: mNames[cur.getMonth()] + ' ' + cur.getFullYear() });
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  while (months.length < 4) {
    var last = months[months.length - 1];
    var nm = new Date(last.year, last.month + 1, 1);
    months.push({ year: nm.getFullYear(), month: nm.getMonth(), label: mNames[nm.getMonth()] + ' ' + nm.getFullYear() });
  }
  var nCols = months.length;

  function monthIdx(dateStr) {
    if (!dateStr) return 0;
    var d = new Date(dateStr);
    var i = months.findIndex(function(m){ return m.year === d.getFullYear() && m.month === d.getMonth(); });
    return i < 0 ? 0 : i;
  }

  function makeBar(label, startStr, endStr, bgColor, borderColor, textColor, tooltip) {
    var sIdx = monthIdx(startStr);
    var eIdx = monthIdx(endStr || startStr);
    if (eIdx < sIdx) eIdx = sIdx;
    var span = eIdx - sIdx + 1;
    var cells = '';
    if (sIdx > 0) cells += '<div style="grid-column:span ' + sIdx + '"></div>';
    cells += '<div title="' + (tooltip||label) + '" style="grid-column:span ' + span + ';' +
      'background:' + bgColor + ';border-left:3px solid ' + borderColor + ';' +
      'color:' + textColor + ';border-radius:4px;padding:0.18rem 0.5rem;' +
      'font-size:0.68rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
      label +
    '</div>';
    var after = nCols - sIdx - span;
    if (after > 0) cells += '<div style="grid-column:span ' + after + '"></div>';
    return '<div style="display:grid;grid-template-columns:repeat(' + nCols + ',1fr);gap:2px;margin-bottom:2px">' + cells + '</div>';
  }

  // Intestazione mesi
  var now = new Date();
  var headerCells = months.map(function(m) {
    var isNow = m.year === now.getFullYear() && m.month === now.getMonth();
    return '<div class="gantt-month-head' + (isNow?' gantt-month-now':'') + '">' + m.label + '</div>';
  }).join('');
  var header = '<div class="gantt-header" style="grid-template-columns:repeat(' + nCols + ',1fr)">' + headerCells + '</div>';

  // KPI rapido
  var totalTasks = tasksWithDates.length;
  var doneCount  = tasks.filter(function(t){ return t.status === 'completado'; }).length;
  var kpi = '<div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap">' +
    '<div style="font-size:0.72rem;color:var(--muted2)">📋 <strong>' + totalTasks + '</strong> tareas programadas</div>' +
    '<div style="font-size:0.72rem;color:var(--muted2)">✅ <strong>' + doneCount + '</strong> completadas</div>' +
    '<div style="font-size:0.72rem;color:var(--muted2)">👥 <strong>' + TEAM.length + '</strong> miembros</div>' +
  '</div>';

  // Una sezione per ogni membro del team
  var sections = TEAM.map(function(member) {
    var memberTasks = tasksWithDates.filter(function(t){ return t.assigned_to === member.name; });
    // Aggiungi anche progetto-livello se assigned_to batte
    var memberProjs = programmed.filter(function(p){ return p.assigned_to === member.name && !memberTasks.find(function(t){ return t.project_id === p.id; }); });

    var taskCount  = memberTasks.length + memberProjs.length;
    var inProgress = memberTasks.filter(function(t){ return t.status === 'en_progreso'; }).length;
    var overloaded = taskCount >= 5;

    var bars = memberTasks.map(function(t) {
      var proj = allProjects.find(function(p){ return p.id === t.project_id; });
      var cat  = proj ? (proj.category || 'CONTENIDO') : 'CONTENIDO';
      var bg   = catBg[cat]    || '#f0f0f0';
      var col  = catColors[cat] || '#888';
      var statusDot = t.status === 'completado' ? '✅ ' : t.status === 'en_progreso' ? '🔄 ' : '⏳ ';
      return makeBar(statusDot + t.title, t.start_date, t.end_date, bg, col, col, (proj ? proj.title + ' — ' : '') + t.title);
    }).join('');

    // Fallback: barre progetto se nessuna task specifica
    bars += memberProjs.map(function(p) {
      var bg  = catBg[p.category]    || '#f0f0f0';
      var col = catColors[p.category] || '#888';
      return makeBar('📁 ' + p.title, p.start_date, p.end_date, bg, col, col, p.title + ' (proyecto)');
    }).join('');

    return '<div style="margin-bottom:1.2rem">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.4rem">' +
        '<div style="width:26px;height:26px;border-radius:50%;background:' + member.color + ';color:#fff;' +
          'font-size:0.62rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' +
          member.initials +
        '</div>' +
        '<div style="font-size:0.78rem;font-weight:700;color:var(--text)">' + member.name + '</div>' +
        '<div style="font-size:0.67rem;color:var(--muted2)">' + taskCount + ' tareas' + (inProgress ? ' · ' + inProgress + ' en progreso' : '') + '</div>' +
        (overloaded ? '<div style="font-size:0.62rem;background:#fff3cd;color:#856404;padding:0.1rem 0.45rem;border-radius:10px;font-weight:600">⚠️ Carga alta</div>' : '') +
      '</div>' +
      (bars || '<div style="font-size:0.7rem;color:var(--muted2);padding:0.3rem 0;font-style:italic">Sin tareas asignadas este período</div>') +
    '</div>';
  }).join('');

  return '<div class="gantt-wrap">' +
    kpi +
    header +
    '<div style="margin-top:0.6rem">' + sections + '</div>' +
  '</div>';
}

var _clienteEquipoEditing = {}; // { clientId: bool } — true = modalità modifica

function renderClienteEquipoSection(clientId, clientKey) {
  var eqState  = _getClienteEquipo(clientId) || {};
  var active   = Object.keys(eqState).filter(function(k){ return eqState[k]; });
  var isEditing = !!_clienteEquipoEditing[clientId];
  var isSaved   = active.length > 0 && !isEditing;

  var humans = _teamMembers.filter(function(m){ return m.employment_type !== 'agent'; });
  var agents = _teamMembers.filter(function(m){ return m.employment_type === 'agent'; });

  // ── STATO SALVATO ─────────────────────────────────────────────
  if (isSaved) {
    var chips = active.map(function(name) {
      var m = _teamMembers.find(function(x){ return x.name === name; });
      var color = m ? m.color : '#888';
      var initials = m ? m.initials : name.slice(0,2).toUpperCase();
      return '<div style="display:flex;align-items:center;gap:0.4rem;padding:0.35rem 0.65rem;border-radius:20px;background:var(--card);border:1px solid var(--border);font-size:0.78rem">' +
        '<div style="width:22px;height:22px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:0.55rem;font-weight:700;color:#fff">' + initials + '</div>' +
        '<span style="font-weight:600;color:var(--text)">' + name + '</span>' +
        '</div>';
    }).join('');

    return '<div style="padding:1rem 0.5rem">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.8rem">' +
        '<div style="display:flex;align-items:center;gap:0.5rem">' +
          '<span style="font-size:1rem">✅</span>' +
          '<span style="font-size:0.88rem;font-weight:700;color:var(--text)">Equipo configurado</span>' +
          '<span style="font-size:0.75rem;color:var(--muted2)">(' + active.length + ' miembros)</span>' +
        '</div>' +
        '<button onclick="_editarClienteEquipo(\'' + clientId + '\')" style="padding:0.3rem 0.8rem;background:transparent;border:1.5px solid var(--border);border-radius:8px;font-size:0.75rem;font-weight:600;cursor:pointer;color:var(--text)">✏️ Modificar</button>' +
      '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:0.5rem">' + chips + '</div>' +
    '</div>';
  }

  // ── STATO MODIFICA / PRIMO ACCESSO ────────────────────────────
  function memberRow(m) {
    var isOn = !!eqState[m.name];
    var safeId = m.name.replace(/\s/g,'_');
    return '<div style="display:flex;align-items:center;gap:0.75rem;padding:0.65rem 0.85rem;border-radius:8px;background:var(--card);margin-bottom:0.4rem;border:1px solid var(--border)">' +
      '<div style="width:34px;height:34px;border-radius:50%;background:' + m.color + ';display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;flex-shrink:0">' + m.initials + '</div>' +
      '<div style="flex:1;min-width:0">' +
        '<div style="font-size:0.82rem;font-weight:600;color:var(--text)">' + m.name + '</div>' +
        '<div style="font-size:0.72rem;color:var(--muted2)">' + m.role + '</div>' +
      '</div>' +
      '<button id="ceq-toggle-' + safeId + '" onclick="toggleClienteEquipoMember(\'' + clientId + '\',\'' + m.name + '\')" ' +
        'class="ceq-toggle ' + (isOn ? 'ceq-on' : 'ceq-off') + '" ' +
        'style="font-size:0.7rem;font-weight:700;padding:0.25rem 0.65rem;border-radius:20px;border:none;cursor:pointer;' +
        (isOn ? 'background:#22c55e;color:#fff' : 'background:var(--border);color:var(--muted2)') + '">' +
        (isOn ? 'ON' : 'OFF') +
      '</button>' +
    '</div>';
  }

  var activeCount = active.length;

  return '<div style="padding:1rem 0.5rem">' +
    '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted2);margin-bottom:0.6rem">Equipo Bravo</div>' +
    humans.map(memberRow).join('') +
    '<div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted2);margin:1rem 0 0.6rem">Agentes AI</div>' +
    agents.map(memberRow).join('') +
    '<div style="margin-top:1.25rem;display:flex;align-items:center;gap:0.75rem">' +
      '<button onclick="confirmarClienteEquipo(\'' + clientId + '\')" ' +
        'style="flex:1;padding:0.6rem 1rem;background:' + (activeCount ? 'var(--accent)' : '#ccc') + ';color:#fff;border:none;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:' + (activeCount ? 'pointer' : 'default') + '">' +
        (activeCount ? '✓ Guardar equipo (' + activeCount + ' seleccionados)' : 'Selecciona al menos un miembro') +
      '</button>' +
    '</div>' +
  '</div>';
}

function _editarClienteEquipo(clientId) {
  _clienteEquipoEditing[clientId] = true;
  var eqPanel = document.querySelector('.ctab-panel[data-tab="equipo"]');
  if (eqPanel) {
    var c = CLIENTS_DATA[_currentClienteIdx];
    eqPanel.innerHTML = renderClienteEquipoSection(clientId, c && c.client_key);
  }
}

// ── PROFILE CACHE: clientId → profile data ──────────────────
var _clientProfiles = {};

function _profileLoading(clientId) {
  return '<div style="padding:2rem;text-align:center;color:var(--muted2);font-size:0.8rem">⏳ Cargando datos del briefing…</div>';
}

function _profileEmpty(clientId) {
  return '<div style="padding:2rem;text-align:center;color:var(--muted2);font-size:0.8rem;line-height:1.7">' +
    'Sin perfil extraído todavía.<br>' +
    '<button onclick="extractClientProfile(\'' + clientId + '\')" class="bk-adopt-btn" style="margin-top:1rem;font-size:0.78rem">✦ Extraer del briefing con IA</button>' +
  '</div>';
}

function renderEstrategiaSection(clientId) {
  if (!clientId) return _profileEmpty('');
  var p = _clientProfiles[clientId];
  if (p === undefined) { _loadClientProfile(clientId, 'estrategia'); return _profileLoading(clientId); }
  if (p === null) return _profileEmpty(clientId);

  var objectives = (p.objectives||[]).map(function(o) {
    return '<div class="cp-list-item"><span class="cp-dot" style="background:#27ae60"></span>' + o + '</div>';
  }).join('') || '<div class="cp-empty">Sin objetivos definidos</div>';

  var scope = (p.scope||[]).map(function(s) {
    return '<div class="cp-list-item"><span class="cp-dot" style="background:#2980b9"></span>' + s + '</div>';
  }).join('') || '<div class="cp-empty">—</div>';

  var outOfScope = (p.out_of_scope||[]).map(function(s) {
    return '<div class="cp-list-item"><span class="cp-dot" style="background:#e74c3c"></span>' + s + '</div>';
  }).join('') || '<div class="cp-empty">—</div>';

  var pillars = (p.editorial_pillars||[]).map(function(pl) {
    return '<div class="cp-pillar">' +
      '<div class="cp-pillar-name">' + pl.name + (pl.percentage ? ' <span style="color:var(--muted2)">· ' + pl.percentage + '%</span>' : '') + '</div>' +
      '<div class="cp-pillar-desc">' + (pl.description||'') + '</div>' +
    '</div>';
  }).join('') || '<div class="cp-empty">—</div>';

  return '<div class="cp-view">' +
    '<div class="cp-topbar">' +
      '<div class="cp-title">◎ Estrategia</div>' +
      '<button onclick="extractClientProfile(\'' + clientId + '\')" class="bk-newkit-btn" style="font-size:0.7rem">↺ Regenerar</button>' +
    '</div>' +

    '<div class="cp-section"><div class="cp-section-label">Obiettivi</div>' + objectives + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Strategia editoriale</div>' +
      '<div class="cp-narrative">' + (p.strategy||'—') + '</div>' +
    '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Pilastri editoriali</div>' + pillars + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Scope BRAVO — Cosa facciamo</div>' + scope + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Fuori scope — Cosa non facciamo</div>' + outOfScope + '</div>' +
  '</div>';
}

function renderPerfilSection(clientId) {
  if (!clientId) return _profileEmpty('');
  var p = _clientProfiles[clientId];
  if (p === undefined) { _loadClientProfile(clientId, 'perfil'); return _profileLoading(clientId); }
  if (p === null) return _profileEmpty(clientId);

  var contacts = (p.key_contacts||[]).map(function(k) {
    return '<div class="cp-contact">' +
      '<div class="cp-contact-av">' + (k.name||'?').split(' ').map(function(w){return w[0];}).join('').slice(0,2) + '</div>' +
      '<div><div class="cp-contact-name">' + (k.name||'') + '</div>' +
        '<div class="cp-contact-role">' + (k.role||'') + '</div>' +
        (k.description ? '<div class="cp-contact-desc">' + k.description + '</div>' : '') +
      '</div>' +
    '</div>';
  }).join('') || '<div class="cp-empty">Sin contactos definidos</div>';

  var partners = (p.partners||[]).map(function(pr) {
    return '<div class="cp-partner">' +
      '<div class="cp-partner-name">' + (pr.name||'') +
        (pr.category ? '<span class="cp-partner-cat">' + pr.category + '</span>' : '') +
      '</div>' +
      '<div class="cp-partner-desc">' + (pr.description||'') + '</div>' +
    '</div>';
  }).join('') || '<div class="cp-empty">Sin partners definidos</div>';

  return '<div class="cp-view">' +
    '<div class="cp-topbar">' +
      '<div class="cp-title">◈ Perfil del cliente</div>' +
      '<button onclick="extractClientProfile(\'' + clientId + '\')" class="bk-newkit-btn" style="font-size:0.7rem">↺ Regenerar</button>' +
    '</div>' +

    '<div class="cp-section"><div class="cp-section-label">Storico</div>' +
      '<div class="cp-narrative">' + (p.history||'—') + '</div>' +
    '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Persone chiave del cliente</div>' + contacts + '</div>' +
    '<div class="cp-section"><div class="cp-section-label">Partner & Marchi</div>' + partners + '</div>' +
  '</div>';
}

async function _loadClientProfile(clientId, rerender) {
  try {
    var res = await fetch(AGENT_API + '/api/briefing/profile/' + clientId);
    var data = await res.json();
    _clientProfiles[clientId] = (data.exists && data.profile) ? data.profile : null;
  } catch(e) {
    _clientProfiles[clientId] = null;
  }
  // Aggiorna direttamente il panel già nel DOM
  var tabName = rerender || 'estrategia';
  var panel = document.querySelector('.ctab-panel[data-tab="' + tabName + '"]');
  if (panel) {
    panel.innerHTML = tabName === 'estrategia'
      ? renderEstrategiaSection(clientId)
      : renderPerfilSection(clientId);
  }
}

async function extractClientProfile(clientId) {
  var btn = event && event.target;
  if (btn) { btn.textContent = '⏳ Estrazione…'; btn.disabled = true; }

  try {
    var res = await fetch(AGENT_API + '/api/briefing/extract-profile/' + clientId, { method: 'POST' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error de extracción');
    _clientProfiles[clientId] = data.profile;

    // Aggiorna anche le assegnazioni team
    var teamBravo = (data.profile.team_bravo || []);
    var cObj = CLIENTS_DATA.find(function(c){ return c.id === clientId; });
    var ckey = cObj ? (cObj.client_key || cObj.id) : clientId;
    teamBravo.forEach(function(m) {
      if (!_equipoAssignments[m.name]) _equipoAssignments[m.name] = [];
      if (_equipoAssignments[m.name].indexOf(ckey) === -1) {
        _equipoAssignments[m.name].push(ckey);
        _equipoSave(m.name);
      }
    });

    if (_currentClienteIdx !== undefined) openClientePage(_currentClienteIdx);
  } catch(e) {
    if (btn) { btn.textContent = '✦ Extraer del briefing con IA'; btn.disabled = false; }
    alert('Error: ' + e.message);
  }
}

async function extractContentTypes(clientId) {
  var btn = document.getElementById('bk-ct-btn');
  if (btn) { btn.textContent = '⏳ Generando…'; btn.disabled = true; }
  var listEl = document.getElementById('bk-ct-list');
  if (listEl) listEl.innerHTML = '<div style="color:var(--muted2);font-size:0.8rem;padding:0.5rem">Chiedo a Claude di analizzare il briefing…</div>';

  try {
    var res = await fetch(AGENT_API + '/api/briefing/extract-content-types/' + encodeURIComponent(clientId), { method: 'POST' });
    var data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Error de extracción');

    var cts = data.content_types || [];
    if (listEl) {
      listEl.innerHTML = cts.length
        ? cts.map(function(ct) {
            return '<div class="bk-ct-item">' +
              '<div class="bk-ct-name">' + ct.name + '</div>' +
              (ct.when_to_use ? '<div class="bk-ct-when">' + ct.when_to_use + '</div>' : '') +
              (ct.example_headline ? '<div class="bk-ct-headline">&ldquo;' + ct.example_headline + '&rdquo;</div>' : '') +
            '</div>';
          }).join('')
        : '<div class="bk-ct-empty">Nessun angolo generato.</div>';
    }
    if (btn) { btn.textContent = '✓ Generato'; btn.disabled = false; }
  } catch(e) {
    if (listEl) listEl.innerHTML = '<div style="color:var(--danger);font-size:0.8rem;padding:0.5rem">Errore: ' + e.message + '</div>';
    if (btn) { btn.textContent = '✦ Genera con IA'; btn.disabled = false; }
  }
}

function closeClientePage() {
  document.getElementById('clientePage').classList.remove('open');
  openClientesPopup();
}

// ── ARCHIVIO CONTENUTI CLIENTE ─────────────────────────────────
var _clienteContentCache  = {};  // clientId → array caricati finora
var _clienteContentOffset = {};  // clientId → offset corrente
var _CONTENT_PAGE_SIZE    = 20;

async function loadClientAllContent(clientId, offset) {
  if (typeof db === 'undefined' || !dbConnected) return [];
  offset = offset || 0;
  var res = await db
    .from('generated_content')
    .select('id,client_id,platform,pillar,headline,img_b64,caption,status,created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .range(offset, offset + _CONTENT_PAGE_SIZE - 1);
  if (res.error) { console.warn('[BRAVO] loadClientAllContent:', res.error.message); return []; }
  var data = res.data || [];
  if (offset === 0) {
    _clienteContentCache[clientId] = data;
  } else {
    _clienteContentCache[clientId] = (_clienteContentCache[clientId] || []).concat(data);
  }
  _clienteContentOffset[clientId] = offset + data.length;
  return data;
}

function loadMoreClientContent(clientId) {
  var btn = document.getElementById('content-load-more-' + clientId);
  if (btn) btn.textContent = 'Cargando...';
  var offset = _clienteContentOffset[clientId] || 0;
  loadClientAllContent(clientId, offset).then(function(newRows) {
    var grid = document.querySelector('.ctab-panel[data-tab="contenido"] .cliente-content-grid');
    if (grid && newRows.length) {
      var tempDiv = document.createElement('div');
      tempDiv.innerHTML = buildClienteContentHtml(newRows, clientId, false);
      var newGrid = tempDiv.querySelector('.cliente-content-grid');
      if (newGrid) {
        Array.from(newGrid.children).forEach(function(card) { grid.appendChild(card); });
      }
    }
    var loadMoreWrap = document.getElementById('content-load-more-wrap-' + clientId);
    if (loadMoreWrap) {
      loadMoreWrap.style.display = newRows.length < _CONTENT_PAGE_SIZE ? 'none' : '';
      if (btn) btn.textContent = 'Cargar 20 más';
    }
  });
}

function _bravoImgSrcFromRecord(rc) {
  if (rc.image_url && rc.image_url.startsWith('http')) return rc.image_url;
  var ref = rc.img_b64 || '';
  if (!ref) return '';
  if (ref.startsWith('http://') || ref.startsWith('https://') || ref.startsWith('data:')) return ref;
  if (ref.startsWith('/9j/') || ref.startsWith('iVBOR')) return 'data:image/jpeg;base64,' + ref;
  return 'data:image/jpeg;base64,' + ref;
}

// ── Helper: parse carosello salvato nel campo caption ──────────
function _parseCarouselCaption(caption) {
  // Formato: __CAROUSEL__[{...}]__||testo_instagram
  if (!caption || !caption.startsWith('__CAROUSEL__')) return null;
  try {
    var inner = caption.slice('__CAROUSEL__'.length);
    var sepIdx = inner.indexOf('__||');
    var jsonPart = sepIdx > -1 ? inner.slice(0, sepIdx) : inner;
    var igCaption = sepIdx > -1 ? inner.slice(sepIdx + 4) : '';
    return { slides: JSON.parse(jsonPart), igCaption: igCaption };
  } catch(e) { return null; }
}

function _buildCarouselCard(rc, carData, del, igBtn, dateStr, platBadge) {
  var slides = carData.slides || [];
  var igCaption = carData.igCaption || '';
  var cardId = 'arc-car-' + rc.id;
  var total = slides.length;

  var slidesHtml = slides.map(function(s, i) {
    var src = s.image_url || (s.img_b64 ? (s.img_b64.startsWith('data:') ? s.img_b64 : 'data:image/jpeg;base64,' + s.img_b64) : '');
    var imgHtml = src
      ? '<img loading="lazy" src="' + src + '" style="width:100%;height:100%;object-fit:cover;display:block" alt="slide ' + (i+1) + '">'
      : '<div style="width:100%;height:100%;background:#e8e4de;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#aaa">Sin imagen</div>';
    return '<div class="arc-car-slide" data-slide="' + i + '" style="width:100%;min-width:100%;height:100%;flex-shrink:0">' + imgHtml + '</div>';
  }).join('');

  var dotsHtml = slides.map(function(_, i) {
    return '<span class="arc-car-dot' + (i===0?' active':'') + '" onclick="event.stopPropagation();arcCarGo(\'' + cardId + '\',' + i + ')"></span>';
  }).join('');

  var captionPreview = igCaption ? '<div class="ig-card-caption">' + igCaption.replace(/</g,'&lt;').replace(/\n/g,' ').slice(0, 80) + '…</div>' : '';

  return '<div class="cliente-content-card ig-card" id="content-card-' + rc.id + '" style="position:relative">' +
    del + igBtn +
    // badge carosello
    '<div style="position:absolute;top:7px;left:7px;z-index:4;background:rgba(0,0,0,.55);color:#fff;font-size:0.6rem;font-weight:700;padding:2px 6px;border-radius:10px;letter-spacing:.04em">🎠 ' + total + '</div>' +
    // slider
    '<div id="' + cardId + '" style="position:relative;width:100%;aspect-ratio:1;overflow:hidden;border-radius:8px 8px 0 0">' +
      '<div class="arc-car-track" style="display:flex;width:100%;height:100%;transition:transform .3s ease">' + slidesHtml + '</div>' +
      (total > 1 ? '<button onclick="event.stopPropagation();arcCarMove(\'' + cardId + '\',-1)" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.8);border:none;border-radius:50%;width:24px;height:24px;font-size:0.85rem;cursor:pointer;z-index:3">‹</button>' : '') +
      (total > 1 ? '<button onclick="event.stopPropagation();arcCarMove(\'' + cardId + '\',1)" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.8);border:none;border-radius:50%;width:24px;height:24px;font-size:0.85rem;cursor:pointer;z-index:3">›</button>' : '') +
      '<div style="position:absolute;bottom:6px;left:0;right:0;display:flex;justify-content:center;gap:4px;z-index:3">' + dotsHtml + '</div>' +
    '</div>' +
    captionPreview +
    '<div class="content-card-meta">' + platBadge + '<span class="content-card-date">' + dateStr + '</span></div>' +
  '</div>';
}

function arcCarMove(cardId, dir) {
  var car = document.getElementById(cardId);
  if (!car) return;
  var track = car.querySelector('.arc-car-track');
  var slides = car.querySelectorAll('.arc-car-slide');
  var dots = car.querySelectorAll('.arc-car-dot');
  var cur = parseInt(car.dataset.cur || '0');
  var next = Math.max(0, Math.min(slides.length - 1, cur + dir));
  car.dataset.cur = next;
  track.style.transform = 'translateX(-' + (next * car.offsetWidth) + 'px)';
  dots.forEach(function(d, i) { d.classList.toggle('active', i === next); });
}
function arcCarGo(cardId, idx) {
  var car = document.getElementById(cardId);
  if (!car) return;
  var track = car.querySelector('.arc-car-track');
  var dots = car.querySelectorAll('.arc-car-dot');
  car.dataset.cur = idx;
  track.style.transform = 'translateX(-' + (idx * car.offsetWidth) + 'px)';
  dots.forEach(function(d, i) { d.classList.toggle('active', i === idx); });
}

function approveContent(id) {
  if (typeof db === 'undefined' || !dbConnected) return;
  db.from('generated_content').update({ status: 'approved' }).eq('id', id).then(function(res) {
    if (res.error) { showToast('Error al aprobar'); return; }
    // Aggiorna UI: rimuovi badge "En revisión" e bottone Aprobar
    var badge = document.getElementById('rev-badge-' + id);
    var btn   = document.getElementById('rev-btn-' + id);
    if (badge) badge.remove();
    if (btn)   btn.remove();
    showToast('✓ Contenido aprobado');
    // Aggiorna cache
    [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
      if (r && r.id === id) r.status = 'approved';
    });
  });
}

function buildClienteContentHtml(content, clientId, showLoadMore) {
  if (!content || !content.length) {
    return '<div class="cliente-content-empty">Sin contenido generado</div>';
  }
  if (showLoadMore === undefined) showLoadMore = true;
  var deleteBtn = '<button class="content-card-delete" onclick="event.stopPropagation();deleteContent(\'__ID__\')" title="Eliminar">✕</button>';

  // Separa "En revisión" dagli altri
  var enRevision = content.filter(function(rc){ return rc.status === 'en_revision'; });
  var approved   = content.filter(function(rc){ return rc.status !== 'en_revision'; });
  var ordenado   = enRevision.concat(approved);

  var buildCard = function(rc) {
    var dateStr = rc.created_at
      ? new Date(rc.created_at).toLocaleDateString('es-ES', {day:'2-digit', month:'short', year:'2-digit'})
      : '';
    var platBadge = rc.platform ? '<span class="content-card-plat">' + rc.platform + '</span>' : '';
    var del = deleteBtn.replace('__ID__', rc.id);
    var igBtn = clientId
      ? '<button id="ig-arc-btn-' + rc.id + '" onclick="event.stopPropagation();igPublishFromArchive(\'' + clientId + '\',\'' + rc.id + '\',this)" ' +
          'style="position:absolute;bottom:36px;right:6px;background:rgba(192,57,43,0.9);color:#fff;border:none;border-radius:6px;font-size:0.65rem;padding:0.2rem 0.45rem;cursor:pointer;font-weight:600;z-index:2" ' +
          'title="Publicar en Instagram">📱 IG</button>'
      : '';
    var revBadge = rc.status === 'en_revision'
      ? '<div id="rev-badge-' + rc.id + '" style="position:absolute;top:6px;left:6px;background:#fef3c7;color:#b45309;font-size:0.58rem;font-weight:700;border-radius:4px;padding:0.1rem 0.4rem;z-index:2;border:1px solid #fde68a">👁 En revisión</div>'
      : '';
    var aprobBtn = rc.status === 'en_revision'
      ? '<button id="rev-btn-' + rc.id + '" onclick="event.stopPropagation();approveContent(\'' + rc.id + '\')" ' +
          'style="position:absolute;bottom:36px;left:6px;background:rgba(22,163,74,0.9);color:#fff;border:none;border-radius:6px;font-size:0.65rem;padding:0.2rem 0.45rem;cursor:pointer;font-weight:600;z-index:2">✓ Aprobar</button>'
      : '';

    // Carosello salvato → render con slider
    var carData = _parseCarouselCaption(rc.caption);
    if (carData) {
      return _buildCarouselCard(rc, carData, del, igBtn, dateStr, platBadge);
    }

    // Post singolo
    var imgSrc = _bravoImgSrcFromRecord(rc);
    var captionHtml = rc.caption
      ? '<div class="ig-card-caption">' + rc.caption.replace(/</g,'&lt;').replace(/\n/g,' ') + '</div>'
      : '';
    if (imgSrc) {
      return '<div class="cliente-content-card ig-card" id="content-card-' + rc.id + '" onclick="openContentPreview(\'' + rc.id + '\')" style="position:relative">' +
        del + igBtn + revBadge + aprobBtn +
        '<div class="ig-card-img"><img loading="lazy" src="' + imgSrc + '" alt="' + (rc.headline||'').replace(/"/g,'') + '" onerror="this.parentElement.innerHTML=\'<div class=ig-card-noimg>&#9632;</div>\'"></div>' +
        captionHtml +
        '<div class="content-card-meta">' + platBadge + '<span class="content-card-date">' + dateStr + '</span></div>' +
      '</div>';
    }
    return '<div class="cliente-content-card ig-card ig-card-text" id="content-card-' + rc.id + '" onclick="openContentPreview(\'' + rc.id + '\')" style="position:relative">' +
      del + igBtn + revBadge + aprobBtn +
      '<div class="ig-card-headline">' + (rc.headline||rc.pillar||'Post').substring(0,60) + '</div>' +
      captionHtml +
      '<div class="content-card-meta">' + platBadge + '<span class="content-card-date">' + dateStr + '</span></div>' +
    '</div>';
  };

  var loadMoreBtn = '';
  if (showLoadMore && clientId && content.length >= _CONTENT_PAGE_SIZE) {
    loadMoreBtn = '<div id="content-load-more-wrap-' + clientId + '" style="grid-column:1/-1;text-align:center;padding:1rem 0">' +
      '<button id="content-load-more-' + clientId + '" onclick="loadMoreClientContent(\'' + clientId + '\')" ' +
      'style="background:#f5f3ef;border:1.5px solid #e0dbd2;border-radius:8px;padding:0.6rem 1.4rem;cursor:pointer;font-size:0.85rem;color:#555">Cargar 20 más</button>' +
    '</div>';
  }

  var revHeader = enRevision.length
    ? '<div style="grid-column:1/-1;display:flex;align-items:center;gap:0.6rem;margin-bottom:0.3rem">' +
        '<span style="font-size:0.72rem;font-weight:700;color:#b45309;background:#fef3c7;border-radius:6px;padding:0.25rem 0.7rem;border:1px solid #fde68a">👁 En revisión — ' + enRevision.length + ' post</span>' +
        '<div style="flex:1;height:1px;background:#fde68a"></div>' +
      '</div>'
    : '';
  var approvedHeader = (enRevision.length && approved.length)
    ? '<div style="grid-column:1/-1;display:flex;align-items:center;gap:0.6rem;margin:0.8rem 0 0.3rem">' +
        '<span style="font-size:0.72rem;font-weight:700;color:#16a34a;background:#f0fdf4;border-radius:6px;padding:0.25rem 0.7rem;border:1px solid #bbf7d0">✓ Aprobados</span>' +
        '<div style="flex:1;height:1px;background:#bbf7d0"></div>' +
      '</div>'
    : '';

  var revCards      = enRevision.map(buildCard).join('');
  var approvedCards = approved.map(buildCard).join('');

  return '<div class="cliente-content-grid ig-grid">' + revHeader + revCards + approvedHeader + approvedCards + loadMoreBtn + '</div>';
}

// ── ELIMINA CONTENUTO ─────────────────────────────────────────
async function deleteContent(contentId) {
  if (!confirm('¿Eliminar este post del archivo?')) return;
  if (typeof db === 'undefined' || !dbConnected) return;

  var res = await db.from('generated_content').delete().eq('id', contentId);
  if (res.error) {
    alert('Error al eliminar: ' + res.error.message);
    return;
  }

  // Rimuovi dalla cache locale
  Object.keys(_clienteContentCache).forEach(function(cid) {
    _clienteContentCache[cid] = (_clienteContentCache[cid] || []).filter(function(r) { return r.id !== contentId; });
  });
  RECENT_CONTENT = (RECENT_CONTENT || []).filter(function(r) { return r.id !== contentId; });

  // Rimuovi la card dal DOM
  var card = document.getElementById('content-card-' + contentId);
  if (card) card.remove();
}

// ── CONTENT PREVIEW MODAL ──────────────────────────────────────
function openContentPreview(contentId) {
  var c = (RECENT_CONTENT||[]).find(function(x){ return x.id === contentId; });
  if (!c) {
    Object.values(_clienteContentCache).forEach(function(arr) {
      if (!c) c = arr.find(function(x){ return x.id === contentId; });
    });
  }
  if (!c) return;

  var overlay = document.createElement('div');
  overlay.id = 'content-preview-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:900;display:flex;align-items:flex-start;justify-content:center;padding:2rem 1rem;overflow-y:auto';
  overlay.onclick = function(e){ if (e.target === overlay) document.body.removeChild(overlay); };

  var imgSrc = _bravoImgSrcFromRecord(c);
  var isRevision = c.status === 'en_revision';

  var captionEscaped = (c.caption || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');

  var actionBtns = isRevision
    ? '<div style="display:flex;gap:0.6rem;margin-top:1rem">' +
        '<button id="prev-save-btn" onclick="saveContentEdit(\'' + c.id + '\')" style="flex:1;padding:0.55rem;background:#2563eb;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.82rem">💾 Guardar cambios</button>' +
        '<button id="prev-approve-btn" onclick="approveContentFromPreview(\'' + c.id + '\')" style="flex:1;padding:0.55rem;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:600;cursor:pointer;font-size:0.82rem">✓ Aprobar</button>' +
      '</div>'
    : '';

  overlay.innerHTML =
    '<div style="max-width:540px;width:100%;background:#1a1a1a;border-radius:14px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,0.6)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.75rem 1rem;border-bottom:1px solid #333">' +
        '<span style="color:#fff;font-weight:700;font-size:0.9rem">' + (isRevision ? '👁 En revisión' : '✓ Aprobado') + '</span>' +
        '<button onclick="document.body.removeChild(document.getElementById(\'content-preview-overlay\'))" style="background:none;border:none;color:#888;font-size:1.2rem;cursor:pointer;line-height:1">×</button>' +
      '</div>' +
      (imgSrc ? '<img src="' + imgSrc + '" style="width:100%;display:block;max-height:340px;object-fit:cover">' : '') +
      '<div style="padding:1rem">' +
        (c.headline ? '<div style="font-weight:700;color:#fff;margin-bottom:0.6rem;font-size:0.95rem">' + c.headline.replace(/</g,'&lt;') + '</div>' : '') +
        '<div style="font-size:0.75rem;color:#666;margin-bottom:0.5rem">' + (c.platform||'') + (c.pillar ? ' · ' + c.pillar : '') + '</div>' +
        (isRevision
          ? '<textarea id="prev-caption-area" style="width:100%;min-height:160px;background:#111;color:#ddd;border:1.5px solid #333;border-radius:8px;padding:0.75rem;font-size:0.8rem;line-height:1.6;resize:vertical;font-family:inherit;box-sizing:border-box">' + captionEscaped + '</textarea>'
          : (c.caption ? '<div style="font-size:0.8rem;color:#ccc;line-height:1.6;white-space:pre-line;background:#111;border-radius:8px;padding:0.75rem">' + c.caption.replace(/</g,'&lt;') + '</div>' : '')
        ) +
        actionBtns +
        '<div id="prev-status-msg" style="font-size:0.75rem;color:#888;margin-top:0.5rem;text-align:center"></div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
}

function saveContentEdit(contentId) {
  var area = document.getElementById('prev-caption-area');
  var msg  = document.getElementById('prev-status-msg');
  if (!area) return;
  var newCaption = area.value;
  if (typeof db === 'undefined' || !dbConnected) return;
  if (msg) msg.textContent = 'Guardando…';
  db.from('generated_content').update({ caption: newCaption }).eq('id', contentId).then(function(res) {
    if (res.error) { if (msg) msg.textContent = '✗ Error al guardar'; return; }
    if (msg) msg.textContent = '✓ Cambios guardados';
    [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
      if (r && r.id === contentId) r.caption = newCaption;
    });
    setTimeout(function(){ if (msg) msg.textContent = ''; }, 2500);
  });
}

function approveContentFromPreview(contentId) {
  var area = document.getElementById('prev-caption-area');
  var msg  = document.getElementById('prev-status-msg');
  if (area) {
    var newCaption = area.value;
    [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
      if (r && r.id === contentId) r.caption = newCaption;
    });
    if (typeof db !== 'undefined' && dbConnected) {
      db.from('generated_content').update({ caption: newCaption, status: 'approved' }).eq('id', contentId).then(function(res) {
        if (res.error) { if (msg) msg.textContent = '✗ Error al aprobar'; return; }
        _afterApproveUI(contentId);
        var overlay = document.getElementById('content-preview-overlay');
        if (overlay) document.body.removeChild(overlay);
        showToast('✓ Contenido aprobado');
      });
      return;
    }
  }
  approveContent(contentId);
  var overlay = document.getElementById('content-preview-overlay');
  if (overlay) document.body.removeChild(overlay);
}

function _afterApproveUI(id) {
  var badge = document.getElementById('rev-badge-' + id);
  var btn   = document.getElementById('rev-btn-' + id);
  if (badge) badge.remove();
  if (btn)   btn.remove();
  [RECENT_CONTENT, ...(Object.values(_clienteContentCache || {}))].flat().forEach(function(r) {
    if (r && r.id === id) r.status = 'approved';
  });
}

// Auto-load sub-modules when this module is first loaded
(function() {
  var subs = ['briefing', 'agenti', 'metricas', 'social', 'assets'];
  subs.forEach(function(m) {
    if (typeof loadModule === 'function') loadModule(m, null);
  });
})();
