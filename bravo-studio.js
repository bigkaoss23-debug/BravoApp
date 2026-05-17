/* bravo-studio.js — Fase 1C frontend
 *
 * Flusso "Studio · 3 finalistas":
 *   1. Click bottone "Estudio" → POST /api/v2/post/propose
 *   2. Backend ritorna 3 finalistas (archetipi diversi + copy + critic)
 *   3. Mostriamo 3 card PARI GRADO (manifesto: il sistema osserva, non decide)
 *   4. Click "Elegir esta" → POST /api/v2/post/finalize → render finale
 *
 * Manifesto in EDITORIAL_SYSTEM_PLAN.md:
 *   «Non stiamo ottimizzando distribuzione.
 *    Stiamo preservando la possibilità dell'ossessione.»
 *
 * Implicazioni concrete su questa UI:
 *   - Le 3 card NON sono ordinate per critic_rank
 *   - Il rank non è in primo piano (al massimo un piccolo badge a hover)
 *   - voice_score e repetition_risk sono discreti, non dominanti
 *   - Il commento del Critic è un post-it accanto, non un giudizio
 *   - Bravo sceglie come vuole, anche la "rank 3"
 */

(function() {
  'use strict';

  // ── Stato ────────────────────────────────────────────────────────────────
  var _proposalSet = null;          // {proposal_set_id, proposals[], brief_meta}
  var _isProposing = false;
  var _isFinalizing = false;
  var _lastClientId = '';           // per reject-copy → failure_memory
  var _decisionsCache = {};         // proposal_set_id → {content_id:[entries]}

  // ── Entry point ──────────────────────────────────────────────────────────

  /**
   * Lanciato dal bottone "Estudio · 3 finalistas".
   * Riusa lo stesso brief + foto del form Agente.
   */
  async function studioPropose() {
    if (_isProposing) return;

    // Recupera brief + foto + slot dal form esistente
    var slot = _readSlotFromForm();
    if (!slot) return;

    var photoFile = (typeof agentPhotos !== 'undefined' && agentPhotos.length > 0)
      ? agentPhotos[0].file
      : null;

    if (!photoFile) {
      _showToast('Estudio necesita al menos una foto');
      return;
    }

    var clientId = (typeof agClientKey !== 'undefined' && agClientKey)
      ? agClientKey
      : (typeof agClientId !== 'undefined' ? agClientId : '');
    if (!clientId) {
      _showToast('Cliente no seleccionado');
      return;
    }

    await _sendPropose(clientId, slot, photoFile, _readUserNote());
  }

  /**
   * Entrata "dal catálogo": parte da uno slot del piano editoriale
   * (editorial_plans). NESSUN upload foto — il backend la risolve dal
   * catálogo via slot.id. slot deve contenere id + pillar/angle/persona/
   * format/scheduled_date.
   */
  async function studioProposeFromSlot(clientId, slot) {
    if (_isProposing) return;
    if (!clientId) { _showToast('Cliente no seleccionado'); return; }
    if (!slot || (!slot.pillar && !slot.angle)) { _showToast('Slot sin pillar/angle'); return; }
    await _sendPropose(clientId, slot, null, slot.user_note || '');
  }

  // Core condiviso: photoFile può essere null (→ foto dal catálogo)
  async function _sendPropose(clientId, slot, photoFile, userNote) {
    _isProposing = true;
    _showStudioOverlay('loading');
    try {
      var fd = new FormData();
      fd.append('client_id',         clientId);
      fd.append('slot_json',         JSON.stringify(slot));
      if (photoFile) fd.append('photo', photoFile);
      fd.append('user_note',         userNote || '');
      fd.append('scene_description', '');

      var res = await fetch(BACKEND_URL + '/api/v2/post/propose', {
        method: 'POST',
        body:   fd
      });

      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        throw new Error(err.detail || ('HTTP ' + res.status));
      }

      var data = await res.json();
      _proposalSet = data;
      _lastClientId = clientId;
      _renderProposals(data);
    } catch (e) {
      console.error('[STUDIO] propose error:', e);
      _showStudioOverlay('error', e.message || String(e));
    } finally {
      _isProposing = false;
    }
  }

  // ── Lettura form (riusa input della tab Agente) ─────────────────────────

  function _readSlotFromForm() {
    // Costruisce uno slot {pillar, angle, persona, scheduled_date, format}.
    // Tre fonti possibili, in ordine di priorità:
    //   1. _pendingDesignerStep (se siamo arrivati qui dal piano editoriale)
    //   2. Campi diretti del form Agente (DaKady-style)
    //   3. Defaults tolleranti (il backend tollererà pillar vuoto se l'angle c'è)
    var pds = window._pendingDesignerStep || {};

    var pillar  = pds.cardPillar  || _val('agent-pillar')  || '';
    var angle   = pds.cardTitle   || _val('agent-angle')   || '';
    var persona = pds.persona     || _val('agent-persona') || '';
    var date    = pds.scheduledDate || _val('agent-scheduled-date') || _todayIso();
    var fmt     = pds.cardFormat  || _val('agent-format-select') || 'post_instagram';

    if (!pillar && !angle) {
      _showToast('Estudio necesita un brief (pillar o angle del piano editorial)');
      return null;
    }

    return {
      pillar:         pillar,
      angle:          angle,
      persona:        persona,
      scheduled_date: date,
      format:         _formatLabel(fmt),
      platform:       'instagram'
    };
  }

  function _readUserNote() {
    var s = _val('agent-situacion') || _val('agent-brief-text') || '';
    return s.trim();
  }

  function _val(id) {
    var el = document.getElementById(id);
    return el ? (el.value || '') : '';
  }

  function _todayIso() {
    var d = new Date();
    return d.toISOString().slice(0, 10);
  }

  function _formatLabel(value) {
    var map = {
      post_instagram:  'Post 1:1',
      story_instagram: 'Story 9:16',
      carousel:        'Carosello',
      reel_instagram:  'Portada Reel',
      post_linkedin:   'Post 1:1',
      post_facebook:   'Post 1:1'
    };
    return map[value] || 'Post 1:1';
  }

  // ── Render: overlay 3 card pari grado ───────────────────────────────────

  function _showStudioOverlay(mode, payload) {
    var overlay = _ensureOverlay();
    var body = overlay.querySelector('.studio-body');

    if (mode === 'loading') {
      body.innerHTML = '<div class="studio-loading">' +
        '<div class="studio-spinner"></div>' +
        '<div class="studio-loading-text">Estudio pensando · 3 finalistas en camino…</div>' +
        '<div class="studio-loading-sub">Layout Selector · Copy Agent × 3 · Critic — toma su tiempo</div>' +
        '</div>';
    } else if (mode === 'error') {
      body.innerHTML = '<div class="studio-error">' +
        '<div class="studio-error-title">Estudio no pudo proponer</div>' +
        '<div class="studio-error-msg">' + _escape(payload) + '</div>' +
        '<button class="studio-btn-secondary" onclick="StudioFlow.close()">Cerrar</button>' +
        '</div>';
    }

    overlay.style.display = 'flex';
  }

  function _renderProposals(data) {
    var overlay = _ensureOverlay();
    var body = overlay.querySelector('.studio-body');

    var props = data.proposals || [];
    if (props.length === 0) {
      _showStudioOverlay('error', 'No se generaron propuestas');
      return;
    }

    // PARI GRADO — niente sort. Le proposte sono come arrivate dal backend
    // (ordine del Layout Selector, non del Critic).
    var cardsHtml = props.map(function(p, i) {
      return _renderCard(p, i, data.proposal_set_id);
    }).join('');

    var brief = data.brief_meta || {};
    var rotation = data.rotation_used || {};
    var memInfo = '';
    if (rotation.decisions_count > 0) {
      memInfo = '<span class="studio-mem">memoria: ' + rotation.decisions_count + ' posts recientes consultados</span>';
    }

    body.innerHTML =
      '<div class="studio-header">' +
        '<div class="studio-header-title">3 finalistas para tu post</div>' +
        '<div style="font-size:0.74rem;color:#9c8a5f;margin:0.15rem 0 0.3rem">Paso 1/3 · <b>Copywriter</b> (voz) — eliges la voz · después: Diseño → Montaje</div>' +
        '<div class="studio-header-meta">' +
          (brief.pillar ? '<span>' + _escape(brief.pillar) + '</span>' : '') +
          (brief.angle  ? '<span> · ' + _escape(brief.angle) + '</span>' : '') +
          (memInfo ? ' · ' + memInfo : '') +
        '</div>' +
        '<button class="studio-close-x" onclick="StudioFlow.close()" aria-label="Cerrar">×</button>' +
      '</div>' +
      '<div class="studio-cards-grid">' + cardsHtml + '</div>' +
      '<div class="studio-footer-note">Cada propuesta es una voz diferente. Elige la que sientes — no necesariamente la "mejor puntuada".</div>';
  }

  function _renderCard(p, index, proposalSetId) {
    var archetype = p.archetype || '';
    var headline = p.headline || '';
    var whisper = p.whisper || '';
    var caption = p.caption || '';
    var captionPreview = caption.length > 220 ? caption.slice(0, 220) + '…' : caption;
    var voice = (p.critic_voice_score != null) ? Number(p.critic_voice_score).toFixed(2) : '';
    var rep = p.critic_repetition_risk || '';
    var comment = p.critic_comment || '';
    var contentId = p.content_id || '';

    // mixed_type può avere \n nella headline → mostra a 2 righe
    var headlineHtml = _escape(headline).replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
    // {italic} → <em class="studio-italic-accent">...</em>
    headlineHtml = headlineHtml.replace(/\{([^}]*)\}/g, '<em class="studio-italic-accent">$1</em>');

    var repClass = ({low:'studio-rep-low', medium:'studio-rep-medium', high:'studio-rep-high'})[rep] || '';

    return '<div class="studio-card" data-content-id="' + _escape(contentId) + '" data-proposal-set="' + _escape(proposalSetId) + '">' +
      '<div class="studio-card-header">' +
        '<span class="studio-archetype">' + _escape(archetype) + '</span>' +
      '</div>' +
      '<div class="studio-headline">' + headlineHtml + '</div>' +
      (whisper ? '<div class="studio-whisper">' + _escape(whisper) + '</div>' : '') +
      '<div class="studio-divider"></div>' +
      '<div class="studio-caption-preview">' + _escape(captionPreview) + '</div>' +
      '<div class="studio-critic-note">' +
        '<div class="studio-critic-meta">' +
          (voice ? '<span class="studio-voice">voz ' + voice + '</span>' : '') +
          (rep ? '<span class="studio-rep ' + repClass + '">repetición: ' + _escape(rep) + '</span>' : '') +
        '</div>' +
        (comment ? '<div class="studio-critic-comment">' + _escape(comment) + '</div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:0.4rem;margin:0.5rem 0 0.3rem;flex-wrap:wrap">' +
        '<button onclick="StudioFlow.why(\'' + contentId + '\',\'' + proposalSetId + '\',this)" style="font-size:0.7rem;font-weight:600;border:1px solid #d8cdb5;background:#fff;color:#7a6a3f;border-radius:6px;padding:0.28rem 0.6rem;cursor:pointer">¿Por qué?</button>' +
        '<button onclick="StudioFlow.rejectCopy(\'' + contentId + '\',\'' + proposalSetId + '\')" style="font-size:0.7rem;font-weight:600;border:1px solid #e3c9c4;background:#fff;color:#c0392b;border-radius:6px;padding:0.28rem 0.6rem;cursor:pointer">✗ Rechazar con motivo</button>' +
      '</div>' +
      '<div class="studio-why" id="why-' + _escape(contentId) + '" style="display:none;font-size:0.74rem;background:#faf7f0;border:1px solid #ece1c8;border-radius:8px;padding:0.5rem 0.65rem;margin-bottom:0.45rem;line-height:1.5"></div>' +
      '<button class="studio-btn-elegir" onclick="StudioFlow.choose(\'' + contentId + '\', \'' + proposalSetId + '\')">' +
        'Elegir esta' +
      '</button>' +
    '</div>';
  }

  // ── Trasparenza · pannello "¿Por qué?" + reject copy ────────────────────
  var _AG_LABEL = { copy_agent: 'Copywriter', layout_selector: 'Layout Selector', critic: 'Critic' };

  function _renderReason(obj) {
    if (obj == null) return '';
    if (typeof obj !== 'object') return _escape(String(obj));
    var out = [];
    Object.keys(obj).forEach(function(k) {
      var v = obj[k];
      if (v == null || v === '') return;
      if (Array.isArray(v)) {
        var items = v.map(function(it) {
          if (it && typeof it === 'object') {
            return (it.option || it.opcion || '') + (it.reason || it.razon ? ' — ' + _escape(it.reason || it.razon) : '');
          }
          return _escape(String(it));
        }).filter(Boolean);
        if (items.length) out.push('<b>' + _escape(k) + ':</b> ' + items.join(' · '));
      } else if (typeof v === 'object') {
        out.push('<b>' + _escape(k) + ':</b> ' + _renderReason(v));
      } else {
        out.push('<b>' + _escape(k) + ':</b> ' + _escape(String(v)));
      }
    });
    return out.join('<br>');
  }

  async function studioWhy(contentId, proposalSetId, btn) {
    var panel = document.getElementById('why-' + contentId);
    if (!panel) return;
    if (panel.style.display !== 'none') { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    panel.innerHTML = '⏳ Cargando el razonamiento de los agentes…';
    try {
      var cache = _decisionsCache[proposalSetId];
      if (!cache) {
        var res = await fetch(BACKEND_URL + '/api/v2/post/decisions/' + encodeURIComponent(proposalSetId));
        var j = await res.json();
        if (!res.ok) { panel.innerHTML = '❌ ' + _escape((j && j.detail) || res.status); return; }
        cache = j.por_contenido || {};
        _decisionsCache[proposalSetId] = cache;
      }
      var entries = cache[contentId] || [];
      if (!entries.length) { panel.innerHTML = 'Sin registro de decisiones para esta propuesta.'; return; }
      var order = { layout_selector: 0, copy_agent: 1, critic: 2 };
      entries.sort(function(a, b) { return (order[a.agente] || 9) - (order[b.agente] || 9); });
      var html = entries.map(function(e) {
        var p = e.payload || {};
        var label = _AG_LABEL[e.agente] || e.agente;
        var block = '<div style="margin-bottom:0.5rem"><div style="font-weight:700;color:#1F2A24">' + _escape(label) +
          (e.archetype ? ' <span style="color:#9c8a5f;font-weight:500">· ' + _escape(e.archetype) + '</span>' : '') + '</div>';
        if (p.decision != null) block += '<div style="color:#5a5440">› ' + _renderReason(p.decision) + '</div>';
        if (p.reasoning != null) block += '<div style="color:#7a6a3f;margin-top:0.15rem">' + _renderReason(p.reasoning) + '</div>';
        return block + '</div>';
      }).join('');
      panel.innerHTML = html + '<div style="font-size:0.66rem;color:#a89a72;border-top:1px solid #ece1c8;padding-top:0.3rem">Quién hizo el trabajo y por qué — datos guardados por cada agente.</div>';
    } catch (e) {
      panel.innerHTML = '❌ ' + _escape(e.message || String(e));
    }
  }

  async function studioRejectCopy(contentId, proposalSetId) {
    var reason = window.prompt('¿Por qué rechazas este copy? (queda en la memoria de errores, en español)');
    if (!reason || !reason.trim()) return;
    var prop = ((_proposalSet && _proposalSet.proposals) || []).filter(function(x) { return (x.content_id || '') === contentId; })[0] || {};
    var bm = (_proposalSet && _proposalSet.brief_meta) || {};
    try {
      var res = await fetch(BACKEND_URL + '/api/v2/post/reject-copy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: contentId, client_id: _lastClientId, reason: reason.trim(),
          archetype: prop.archetype || '', pillar: bm.pillar || '',
          angle: bm.angle || '', headline: prop.headline || ''
        })
      });
      var j = await res.json();
      if (!res.ok) { _showToast('Error: ' + ((j && j.detail) || res.status)); return; }
      _showToast('Copy rechazado · guardado en memoria de errores');
    } catch (e) {
      _showToast('Error: ' + (e.message || String(e)));
    }
  }

  // ── Click "Elegir esta" → finalize ──────────────────────────────────────

  async function studioChoose(contentId, proposalSetId) {
    if (_isFinalizing) return;
    if (!contentId || !proposalSetId) return;

    _isFinalizing = true;

    var overlay = _ensureOverlay();
    var body = overlay.querySelector('.studio-body');
    body.innerHTML = '<div class="studio-loading">' +
      '<div class="studio-spinner"></div>' +
      '<div class="studio-loading-text">Montando tu elección…</div>' +
      '<div class="studio-loading-sub">Art Director + Renderer en marcha</div>' +
      '</div>';

    try {
      var fd = new FormData();
      fd.append('content_id',        contentId);
      fd.append('proposal_set_id',   proposalSetId);
      fd.append('scene_description', '');

      var res = await fetch(BACKEND_URL + '/api/v2/post/finalize', {
        method: 'POST',
        body:   fd
      });

      if (!res.ok) {
        var err = await res.json().catch(function() { return {}; });
        throw new Error(err.detail || ('HTTP ' + res.status));
      }

      var data = await res.json();
      _renderFinalResult(data);
    } catch (e) {
      console.error('[STUDIO] finalize error:', e);
      _showStudioOverlay('error', e.message || String(e));
    } finally {
      _isFinalizing = false;
    }
  }

  function _renderFinalResult(data) {
    var overlay = _ensureOverlay();
    var body = overlay.querySelector('.studio-body');

    var imgSrc = data.image_url || ('data:image/jpeg;base64,' + (data.img_b64 || ''));

    body.innerHTML =
      '<div class="studio-header">' +
        '<div class="studio-header-title">Tu elección — montada</div>' +
        '<button class="studio-close-x" onclick="StudioFlow.close()">×</button>' +
      '</div>' +
      '<div class="studio-final">' +
        '<img class="studio-final-img" src="' + imgSrc + '" alt="post">' +
        '<div class="studio-final-info">' +
          '<div class="studio-final-archetype">' + _escape(data.archetype || '') + '</div>' +
          '<div class="studio-final-headline">' + _escape(data.headline || '') + '</div>' +
          '<div class="studio-final-caption">' + _escape(data.caption || '') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="studio-final-actions">' +
        '<button class="studio-btn-secondary" onclick="StudioFlow.close()">Cerrar</button>' +
      '</div>';

    // Notifica all'app per ricaricare l'eventuale lista contenuti
    try {
      if (typeof window._onContentGenerated === 'function') {
        window._onContentGenerated(data);
      }
    } catch (_) {}
  }

  // ── Overlay container ───────────────────────────────────────────────────

  function _ensureOverlay() {
    var existing = document.getElementById('studio-overlay');
    if (existing) return existing;

    var ov = document.createElement('div');
    ov.id = 'studio-overlay';
    ov.className = 'studio-overlay';
    ov.innerHTML = '<div class="studio-modal"><div class="studio-body"></div></div>';
    ov.addEventListener('click', function(e) {
      if (e.target === ov) studioClose();  // click sul backdrop chiude
    });
    document.body.appendChild(ov);
    return ov;
  }

  function studioClose() {
    var ov = document.getElementById('studio-overlay');
    if (ov) ov.style.display = 'none';
  }

  // ── Utils ────────────────────────────────────────────────────────────────

  function _escape(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function _showToast(msg) {
    if (typeof showToast === 'function') {
      showToast(msg);
    } else {
      console.log('[STUDIO]', msg);
    }
  }

  // ── Espone API ───────────────────────────────────────────────────────────
  window.StudioFlow = {
    propose:         studioPropose,
    proposeFromSlot: studioProposeFromSlot,
    choose:          studioChoose,
    why:             studioWhy,
    rejectCopy:      studioRejectCopy,
    close:           studioClose
  };
})();
