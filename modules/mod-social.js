// ============================================================
// MOD-SOCIAL — Tab social: publicar en Instagram desde BRAVO
// Lazy-loaded quando si apre il tab Social
// ============================================================

// ============================================================
// SOCIAL TAB — renderSocialSection + helpers
// ============================================================

function renderSocialSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  setTimeout(function(){ igLoadStatus(clientId); }, 120);

  return (
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.5rem">' +

    // Header
    '<div>' +
      '<div class="cliente-section-title" style="margin:0">📡 Redes Sociales</div>' +
      '<div style="font-size:0.75rem;color:#888;margin-top:0.2rem">Conecta y gestiona las cuentas sociales del cliente</div>' +
    '</div>' +

    // Instagram card
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:12px;overflow:hidden">' +

      // Card header
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;border-bottom:1px solid #f0ece6;background:#fafaf8">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);display:flex;align-items:center;justify-content:center;font-size:1.1rem">📷</div>' +
        '<div>' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">Instagram</div>' +
          '<div style="font-size:0.72rem;color:#888">Cuenta Business / Creator</div>' +
        '</div>' +
        '<span id="ig-status-badge-' + clientId + '" style="margin-left:auto;font-size:0.68rem;padding:0.2rem 0.6rem;border-radius:10px;background:#f0ece6;color:#888">Verificando...</span>' +
      '</div>' +

      // Card body
      '<div id="ig-connect-body-' + clientId + '" style="padding:1rem 1.25rem">' +
        '<div style="color:#aaa;font-size:0.78rem">Cargando...</div>' +
      '</div>' +
    '</div>' +

    // LinkedIn card (próximamente)
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:12px;overflow:hidden;opacity:0.5">' +
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;background:#fafaf8">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:#0077b5;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;font-weight:700;font-size:0.85rem">in</div>' +
        '<div>' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">LinkedIn</div>' +
          '<div style="font-size:0.72rem;color:#888">Página de empresa</div>' +
        '</div>' +
        '<span style="margin-left:auto;font-size:0.68rem;padding:0.2rem 0.6rem;border-radius:10px;background:#f0ece6;color:#aaa">Próximamente</span>' +
      '</div>' +
    '</div>' +

    // Facebook card (próximamente)
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:12px;overflow:hidden;opacity:0.5">' +
      '<div style="display:flex;align-items:center;gap:0.75rem;padding:1rem 1.25rem;background:#fafaf8">' +
        '<div style="width:36px;height:36px;border-radius:8px;background:#1877f2;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#fff;font-weight:700;font-size:0.85rem">f</div>' +
        '<div>' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">Facebook</div>' +
          '<div style="font-size:0.72rem;color:#888">Página de empresa</div>' +
        '</div>' +
        '<span style="margin-left:auto;font-size:0.68rem;padding:0.2rem 0.6rem;border-radius:10px;background:#f0ece6;color:#aaa">Próximamente</span>' +
      '</div>' +
    '</div>' +

    '</div>'
  );
}

// ============================================================
// INSTAGRAM PUBLISHING — funzioni frontend
// ============================================================

// Pubblica direttamente dai risultati dell'Agente (ha l'immagine in memoria)
async function igPublishPost(clientId, variantIdx, btn) {
  if (!btn) return;
  var originalText = btn.textContent;
  btn.textContent  = '⏳ Publicando...';
  btn.disabled     = true;

  try {
    // Recupera i dati della variante dal DOM
    var resultsDiv = document.getElementById('ag-photo-results-' + clientId);
    if (!resultsDiv) throw new Error('No se encontraron los resultados del agente');

    // I dati della variante sono salvati nell'oggetto globale dopo la generazione
    var variants = (window._agCurrentVariants && window._agCurrentVariants[clientId]);
    if (!variants || !variants[variantIdx]) throw new Error('Variante no disponible — regenera el post');

    var v = variants[variantIdx];
    var img_b64 = v.img_b64 || v.image_url || '';
    if (!img_b64) throw new Error('No hay imagen disponible para publicar');

    // Se è un URL pubblico (non base64), lo scarica prima
    var imageB64 = img_b64;
    if (img_b64.startsWith('http')) {
      showToast('⏳ Preparando imagen...');
      var imgResp = await fetch(img_b64);
      var blob    = await imgResp.blob();
      imageB64    = await new Promise(function(res) {
        var reader = new FileReader();
        reader.onloadend = function() { res(reader.result.split(',')[1]); };
        reader.readAsDataURL(blob);
      });
    }

    var caption  = v.caption || '';
    var resp     = await fetch(BRAVO_API + '/api/instagram/publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:  clientId,
        image_b64:  imageB64,
        caption:    caption,
        content_id: v.content_id || '',
      }),
    });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error);

    btn.textContent = '✓ Publicado!';
    btn.style.background = '#27ae60';
    btn.style.color      = '#fff';
    btn.style.border     = 'none';
    showToast('✅ Post publicado en @' + (data.ig_username || 'Instagram'));

  } catch(e) {
    btn.textContent = '📱 Pubblica IG';
    btn.disabled    = false;
    showToast('❌ ' + e.message);
  }
}

// Pubblica dall'archivio Contenido (deve recuperare l'immagine da Supabase)
async function igPublishFromArchive(clientId, contentId, btn) {
  if (!btn) return;
  var originalText = btn.textContent;
  btn.textContent  = '⏳';
  btn.disabled     = true;

  try {
    // Cerca il record in cache locale
    var record = null;
    if (window._clienteContentCache && _clienteContentCache[clientId]) {
      record = _clienteContentCache[clientId].find(function(r){ return r.id === contentId; });
    }
    if (!record && window.RECENT_CONTENT) {
      record = RECENT_CONTENT.find(function(r){ return r.id === contentId; });
    }
    if (!record) throw new Error('Post no encontrado en caché — recarga la página');

    var imgSrc = _bravoImgSrcFromRecord(record);
    if (!imgSrc) throw new Error('Este post no tiene imagen — solo se pueden publicar posts con imagen');

    var caption = record.caption || record.headline || '';
    if (!caption) throw new Error('El post no tiene caption');

    // Converti immagine in base64 se è un URL
    var imageB64 = imgSrc;
    if (imgSrc.startsWith('http') || imgSrc.startsWith('/')) {
      showToast('⏳ Preparando imagen...');
      var imgResp = await fetch(imgSrc);
      var blob    = await imgResp.blob();
      imageB64    = await new Promise(function(res) {
        var reader  = new FileReader();
        reader.onloadend = function() { res(reader.result.split(',')[1]); };
        reader.readAsDataURL(blob);
      });
    } else if (imgSrc.startsWith('data:')) {
      imageB64 = imgSrc.split(',')[1];
    }

    var resp = await fetch(BRAVO_API + '/api/instagram/publish', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        client_id:  clientId,
        image_b64:  imageB64,
        caption:    caption,
        content_id: record.content_id || record.id || '',
      }),
    });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error);

    btn.textContent      = '✓';
    btn.style.background = '#27ae60';
    showToast('✅ Publicado en @' + (data.ig_username || 'Instagram'));

  } catch(e) {
    btn.textContent = '📱 IG';
    btn.disabled    = false;
    showToast('❌ ' + e.message);
  }
}

// Salva varianti generate in memoria per poterle pubblicare dopo
function _agStoreVariants(clientId, variants) {
  if (!window._agLastVariants) window._agLastVariants = {};
  window._agLastVariants[clientId] = variants;
}

