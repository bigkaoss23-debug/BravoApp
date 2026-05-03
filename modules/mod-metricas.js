// ============================================================
// MOD-METRICAS — Tab métricas de publicaciones por cliente
// Lazy-loaded quando si apre il tab Métricas
// ============================================================

// ============================================================
// MÉTRICAS — Tab performance post pubblicati
// ============================================================

var _metricasCache = {};  // { clientId: { metrics, aggregates } }
var _metricasFormOpen = {};  // { clientId: bool }

function renderMetricasSection(clientId) {
  if (!clientId) return '<div class="ctab-placeholder">⚠️ Cliente no identificado</div>';

  var cid = clientId;
  var pillars = ['PRODUCTO','AGRONOMIA','EQUIPO','TECNOLOGIA','CLIENTE','CALENDARIO'];
  var platforms = ['instagram','linkedin','facebook'];

  var html =
    '<div class="cliente-section" style="padding:1.25rem;display:flex;flex-direction:column;gap:1.5rem">' +

    // ── Header
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.6rem">' +
      '<div>' +
        '<div class="cliente-section-title" style="margin:0">▲ Métricas de publicaciones</div>' +
        '<div id="met-meta-' + cid + '" style="font-size:0.75rem;color:#888;margin-top:0.15rem">Cargando...</div>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;flex-wrap:wrap">' +
        '<select id="met-days-' + cid + '" onchange="metricasLoad(\'' + cid + '\')" ' +
          'style="padding:0.35rem 0.6rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.78rem;background:#fff">' +
          '<option value="30">Últimos 30 días</option>' +
          '<option value="90" selected>Últimos 90 días</option>' +
          '<option value="180">Últimos 6 meses</option>' +
          '<option value="365">Último año</option>' +
        '</select>' +
        '<button class="bk-adopt-btn" id="met-sync-btn-' + cid + '" onclick="metricasSyncInstagram(\'' + cid + '\')">⟳ Sync Instagram</button>' +
        '<button class="bk-adopt-btn" onclick="metricasToggleForm(\'' + cid + '\')">+ Añadir métrica</button>' +
        '<button class="bk-newkit-btn" onclick="metricasAnalizar(\'' + cid + '\')">✦ Analizar con IA</button>' +
      '</div>' +
    '</div>' +

    // ── Panel análisis IA (oculto hasta que se ejecute)
    '<div id="met-analisis-' + cid + '" style="display:none"></div>' +

    // ── Form aggiunta (collassabile)
    '<div id="met-form-wrap-' + cid + '" style="display:none">' +
      '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1.25rem">' +
        '<div style="font-size:0.85rem;font-weight:600;color:#2a2a2a;margin-bottom:1rem">📊 Registrar métricas de un post</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">' +

          '<div style="grid-column:1/-1">' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Titular del post</label>' +
            '<input id="met-f-headline-' + cid + '" type="text" placeholder="Ej: BRAVERIA — EL ARRANQUE QUE MERECES" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Fecha de publicación</label>' +
            '<input id="met-f-date-' + cid + '" type="date" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Plataforma</label>' +
            '<select id="met-f-platform-' + cid + '" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem;background:#fff">' +
              '<option value="instagram">Instagram</option>' +
              '<option value="linkedin">LinkedIn</option>' +
              '<option value="facebook">Facebook</option>' +
            '</select>' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Pilar</label>' +
            '<select id="met-f-pillar-' + cid + '" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem;background:#fff">' +
              '<option value="">— Sin pilar —</option>' +
              pillars.map(function(p){ return '<option value="' + p + '">' + p + '</option>'; }).join('') +
            '</select>' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">❤️ Likes</label>' +
            '<input id="met-f-likes-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">💬 Comentarios</label>' +
            '<input id="met-f-comments-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">👁️ Alcance (Reach)</label>' +
            '<input id="met-f-reach-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">📊 Impresiones</label>' +
            '<input id="met-f-impressions-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">🔖 Guardados (Saves)</label>' +
            '<input id="met-f-saves-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div>' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">↗️ Compartidos</label>' +
            '<input id="met-f-shares-' + cid + '" type="number" min="0" value="0" ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

          '<div style="grid-column:1/-1">' +
            '<label style="font-size:0.75rem;color:#666;display:block;margin-bottom:0.3rem">Notas (opcional)</label>' +
            '<input id="met-f-notes-' + cid + '" type="text" placeholder="Campaña verano, boost pagado..." ' +
              'style="width:100%;padding:0.5rem 0.7rem;border:1px solid #e0dbd2;border-radius:6px;font-size:0.82rem">' +
          '</div>' +

        '</div>' +
        '<div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem">' +
          '<button class="bk-newkit-btn" onclick="metricasToggleForm(\'' + cid + '\')">Cancelar</button>' +
          '<button class="bk-adopt-btn" id="met-save-btn-' + cid + '" onclick="metricasSave(\'' + cid + '\')">💾 Guardar métricas</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── KPI cards
    '<div id="met-kpi-' + cid + '">' +
      '<div style="color:#888;font-size:0.82rem">Cargando métricas...</div>' +
    '</div>' +

    // ── Grafici
    '<div id="met-charts-' + cid + '" style="display:none">' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">' +
        '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1rem">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#2a2a2a;margin-bottom:0.8rem">❤️ Likes por pilar</div>' +
          '<div id="met-chart-pillar-' + cid + '"></div>' +
        '</div>' +
        '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1rem">' +
          '<div style="font-size:0.78rem;font-weight:600;color:#2a2a2a;margin-bottom:0.8rem">👁️ Alcance por plataforma</div>' +
          '<div id="met-chart-platform-' + cid + '"></div>' +
        '</div>' +
      '</div>' +
    '</div>' +

    // ── Lista post
    '<div>' +
      '<div style="font-size:0.82rem;font-weight:600;color:#2a2a2a;margin-bottom:0.6rem">Publicaciones registradas</div>' +
      '<div id="met-list-' + cid + '">' +
        '<div style="color:#888;font-size:0.82rem">Cargando...</div>' +
      '</div>' +
    '</div>' +

    '</div>';

  setTimeout(function(){ metricasLoad(cid); }, 80);
  // Precompila data oggi nel form
  setTimeout(function(){
    var df = document.getElementById('met-f-date-' + cid);
    if (df) df.value = new Date().toISOString().split('T')[0];
  }, 100);

  return html;
}

function metricasToggleForm(clientId) {
  var wrap = document.getElementById('met-form-wrap-' + clientId);
  if (!wrap) return;
  var open = wrap.style.display !== 'none';
  wrap.style.display = open ? 'none' : 'block';
}

function metricasLoad(clientId) {
  var meta = document.getElementById('met-meta-' + clientId);
  var daysEl = document.getElementById('met-days-' + clientId);
  var days = daysEl ? daysEl.value : 90;
  if (meta) meta.textContent = 'Cargando...';

  // Carica metriche + report IA salvato in parallelo
  Promise.all([
    fetch(BRAVO_API + '/api/metrics/' + encodeURIComponent(clientId) + '?days=' + days).then(function(r){ return r.json(); }),
    fetch(BRAVO_API + '/api/metrics/report/' + encodeURIComponent(clientId)).then(function(r){ return r.json(); })
  ]).then(function(results){
    var d = results[0];
    var rep = results[1];

    if (!d.ok) {
      if (meta) meta.textContent = '❌ Error: ' + d.error;
      return;
    }
    _metricasCache[clientId] = d;
    var total = d.aggregates.total_posts;
    if (meta) meta.textContent = total + ' publicaciones en los últimos ' + days + ' días';
    metricasRenderKPI(clientId, d.aggregates);
    metricasRenderCharts(clientId, d.aggregates);
    metricasRenderList(clientId, d.metrics);

    // Mostra il report IA salvato se disponibile
    if (rep.ok && rep.report) {
      var panel = document.getElementById('met-analisis-' + clientId);
      if (panel && rep.ok && rep.report) {
        panel.style.display = 'block';
        panel.innerHTML = _metricasRenderReport(rep.report, rep.generated_at, clientId);
      }
    }
  }).catch(function(e){
    if (meta) meta.textContent = '❌ Error de conexión';
    console.error('[MET]', e);
  });
}

function metricasRenderKPI(clientId, agg) {
  var el = document.getElementById('met-kpi-' + clientId);
  if (!el) return;

  var bestPillar = '—';
  var bestLikes = 0;
  Object.entries(agg.by_pillar || {}).forEach(function(kv){
    if (kv[1].likes > bestLikes) { bestLikes = kv[1].likes; bestPillar = kv[0]; }
  });

  function kpiCard(icon, label, value, sub) {
    return '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:0.9rem 1.1rem">' +
      '<div style="font-size:0.72rem;color:#888;margin-bottom:0.25rem">' + icon + ' ' + label + '</div>' +
      '<div style="font-size:1.4rem;font-weight:700;color:#2a2a2a;line-height:1">' + value + '</div>' +
      (sub ? '<div style="font-size:0.7rem;color:#aaa;margin-top:0.2rem">' + sub + '</div>' : '') +
    '</div>';
  }

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.8rem;margin-bottom:0.5rem">' +
      kpiCard('📋', 'Posts registrados', agg.total_posts, '') +
      kpiCard('❤️', 'Media likes/post', agg.avg_likes, agg.total_likes + ' totales') +
      kpiCard('👁️', 'Media alcance/post', agg.avg_reach.toLocaleString('es-ES'), agg.total_reach.toLocaleString('es-ES') + ' totales') +
      kpiCard('⭐', 'Mejor pilar', bestPillar, bestLikes + ' likes acumulados') +
    '</div>';
}

function metricasRenderCharts(clientId, agg) {
  var wrap = document.getElementById('met-charts-' + clientId);
  var pillarEl = document.getElementById('met-chart-pillar-' + clientId);
  var platformEl = document.getElementById('met-chart-platform-' + clientId);
  if (!pillarEl || !platformEl) return;

  var pillarColors = {
    PRODUCTO:'#D13B1E', AGRONOMIA:'#2d5c2e', EQUIPO:'#2c5f8a',
    TECNOLOGIA:'#F5A623', CLIENTE:'#6d4c8e', CALENDARIO:'#888'
  };

  // Grafico pillar
  var pData = agg.by_pillar || {};
  var pKeys = Object.keys(pData);
  if (pKeys.length) {
    var maxLikes = Math.max.apply(null, pKeys.map(function(k){ return pData[k].likes || 0; })) || 1;
    pillarEl.innerHTML = pKeys.map(function(k){
      var v = pData[k].likes || 0;
      var pct = Math.round((v / maxLikes) * 100);
      var color = pillarColors[k] || '#C0392B';
      return '<div style="margin-bottom:0.55rem">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:0.2rem">' +
          '<span>' + k + '</span><span>' + v + ' likes · ' + pData[k].posts + ' posts</span>' +
        '</div>' +
        '<div style="background:#f0ece6;border-radius:4px;height:8px;overflow:hidden">' +
          '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;transition:width 0.5s"></div>' +
        '</div>' +
      '</div>';
    }).join('');
    if (wrap) wrap.style.display = '';
  } else {
    pillarEl.innerHTML = '<div style="color:#aaa;font-size:0.78rem">Sin datos</div>';
  }

  // Grafico platform
  var plData = agg.by_platform || {};
  var plKeys = Object.keys(plData);
  var plColors = { instagram:'#C0392B', linkedin:'#0077b5', facebook:'#1877f2' };
  if (plKeys.length) {
    var maxReach = Math.max.apply(null, plKeys.map(function(k){ return plData[k].reach || 0; })) || 1;
    platformEl.innerHTML = plKeys.map(function(k){
      var v = plData[k].reach || 0;
      var pct = Math.round((v / maxReach) * 100);
      var color = plColors[k] || '#888';
      var label = k.charAt(0).toUpperCase() + k.slice(1);
      return '<div style="margin-bottom:0.55rem">' +
        '<div style="display:flex;justify-content:space-between;font-size:0.7rem;color:#555;margin-bottom:0.2rem">' +
          '<span>' + label + '</span><span>' + v.toLocaleString('es-ES') + ' alcance</span>' +
        '</div>' +
        '<div style="background:#f0ece6;border-radius:4px;height:8px;overflow:hidden">' +
          '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:4px;transition:width 0.5s"></div>' +
        '</div>' +
      '</div>';
    }).join('');
  } else {
    platformEl.innerHTML = '<div style="color:#aaa;font-size:0.78rem">Sin datos</div>';
  }
}

function metricasRenderList(clientId, metrics) {
  var el = document.getElementById('met-list-' + clientId);
  if (!el) return;

  if (!metrics || !metrics.length) {
    el.innerHTML =
      '<div style="text-align:center;padding:2.5rem 1rem;color:#aaa">' +
        '<div style="font-size:1.6rem;margin-bottom:0.4rem">📊</div>' +
        '<div style="font-weight:600;color:#888">Sin métricas registradas</div>' +
        '<div style="font-size:0.75rem;margin-top:0.3rem">Usa "+ Añadir métrica" para registrar el rendimiento de un post</div>' +
      '</div>';
    return;
  }

  var platIco = { instagram:'📸', linkedin:'💼', facebook:'👥' };
  var pillarColors = {
    PRODUCTO:'#D13B1E', AGRONOMIA:'#2d5c2e', EQUIPO:'#2c5f8a',
    TECNOLOGIA:'#F5A623', CLIENTE:'#6d4c8e', CALENDARIO:'#888'
  };

  el.innerHTML =
    '<div style="overflow-x:auto">' +
    '<table style="width:100%;border-collapse:collapse;font-size:0.78rem">' +
      '<thead>' +
        '<tr style="border-bottom:2px solid #e0dbd2">' +
          '<th style="text-align:left;padding:0.5rem 0.6rem;color:#888;font-weight:600">Post</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">Fecha</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">❤️</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">💬</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">👁️ Reach</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600">🔖</th>' +
          '<th style="text-align:center;padding:0.5rem 0.4rem;color:#888;font-weight:600"></th>' +
        '</tr>' +
      '</thead>' +
      '<tbody>' +
        metrics.map(function(m){
          var ico = platIco[m.platform] || '📱';
          var pColor = pillarColors[m.pillar] || '#aaa';
          var headline = m.headline || '(sin título)';
          if (headline.length > 48) headline = headline.slice(0, 46) + '…';
          var dateStr = m.published_at ? m.published_at.slice(0, 10) : '—';
          return '<tr style="border-bottom:1px solid #f0ece6;transition:background 0.15s" onmouseover="this.style.background=\'#faf9f7\'" onmouseout="this.style.background=\'\'">' +
            '<td style="padding:0.55rem 0.6rem;max-width:220px">' +
              '<div style="font-weight:600;color:#2a2a2a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + ico + ' ' + headline + '</div>' +
              (m.pillar ? '<div style="display:inline-block;margin-top:0.2rem;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.65rem;font-weight:700;color:#fff;background:' + pColor + '">' + m.pillar + '</div>' : '') +
            '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;color:#666;white-space:nowrap">' + dateStr + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;font-weight:600;color:#2a2a2a">' + (m.likes||0).toLocaleString('es-ES') + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;color:#555">' + (m.comments||0) + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;font-weight:600;color:#2a2a2a">' + (m.reach||0).toLocaleString('es-ES') + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem;color:#555">' + (m.saves||0) + '</td>' +
            '<td style="text-align:center;padding:0.55rem 0.4rem">' +
              '<button onclick="metricasDelete(\'' + clientId + '\',\'' + m.id + '\')" ' +
                'style="background:none;border:none;cursor:pointer;color:#ccc;font-size:0.9rem;padding:0.1rem 0.3rem;border-radius:4px" ' +
                'onmouseover="this.style.color=\'#e74c3c\'" onmouseout="this.style.color=\'#ccc\'" ' +
                'title="Eliminar">✕</button>' +
            '</td>' +
          '</tr>';
        }).join('') +
      '</tbody>' +
    '</table>' +
    '</div>';
}

async function metricasSave(clientId) {
  var btn = document.getElementById('met-save-btn-' + clientId);
  if (btn) { btn.textContent = 'Guardando...'; btn.disabled = true; }

  var get = function(id){ var el = document.getElementById(id); return el ? el.value : ''; };

  var dateVal = get('met-f-date-' + clientId);
  if (!dateVal) {
    showToast('Selecciona una fecha de publicación');
    if (btn) { btn.textContent = '💾 Guardar métricas'; btn.disabled = false; }
    return;
  }

  var payload = {
    client_id:   clientId,
    headline:    get('met-f-headline-' + clientId),
    platform:    get('met-f-platform-' + clientId),
    pillar:      get('met-f-pillar-' + clientId) || null,
    published_at: dateVal,
    likes:       parseInt(get('met-f-likes-' + clientId)) || 0,
    comments:    parseInt(get('met-f-comments-' + clientId)) || 0,
    reach:       parseInt(get('met-f-reach-' + clientId)) || 0,
    impressions: parseInt(get('met-f-impressions-' + clientId)) || 0,
    saves:       parseInt(get('met-f-saves-' + clientId)) || 0,
    shares:      parseInt(get('met-f-shares-' + clientId)) || 0,
    notes:       get('met-f-notes-' + clientId),
    source:      'manual',
  };

  try {
    var resp = await fetch(BRAVO_API + '/api/metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');

    showToast('✅ Métricas guardadas');
    metricasToggleForm(clientId);
    // Reset form
    ['headline','notes'].forEach(function(f){
      var el = document.getElementById('met-f-' + f + '-' + clientId);
      if (el) el.value = '';
    });
    ['likes','comments','reach','impressions','saves','shares'].forEach(function(f){
      var el = document.getElementById('met-f-' + f + '-' + clientId);
      if (el) el.value = '0';
    });
    metricasLoad(clientId);
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  } finally {
    if (btn) { btn.textContent = '💾 Guardar métricas'; btn.disabled = false; }
  }
}

async function metricasDelete(clientId, metricId) {
  if (!confirm('¿Eliminar esta métrica?')) return;
  try {
    var resp = await fetch(BRAVO_API + '/api/metrics/' + encodeURIComponent(metricId), { method: 'DELETE' });
    var data = await resp.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    showToast('Métrica eliminada');
    metricasLoad(clientId);
  } catch(e) {
    showToast('❌ Error: ' + e.message);
  }
}

// ============================================================
// MÉTRICAS — Sync Instagram + Analisis IA
// ============================================================

async function metricasSyncInstagram(clientId) {
  var btn = document.getElementById('met-sync-btn-' + clientId);
  if (btn) { btn.textContent = '⏳ Sincronizando...'; btn.disabled = true; }
  try {
    var res = await fetch(BRAVO_API + '/api/instagram/sync-metrics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error al sincronizar');
    showToast('✅ ' + (data.imported || 0) + ' nuevos · ' + (data.updated || 0) + ' actualizados desde Instagram');
    metricasLoad(clientId);
  } catch(e) {
    showToast('❌ ' + e.message);
  } finally {
    if (btn) { btn.textContent = '⟳ Sync Instagram'; btn.disabled = false; }
  }
}

async function metricasAnalizar(clientId) {
  var panel = document.getElementById('met-analisis-' + clientId);
  if (!panel) return;
  panel.style.display = 'block';
  panel.innerHTML =
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1.25rem">' +
      '<div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.8rem">' +
        '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">✦ Análisis IA — Generando...</div>' +
        '<div style="width:14px;height:14px;border:2px solid #C0392B;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite"></div>' +
      '</div>' +
      '<div style="font-size:0.78rem;color:#aaa">El agente está analizando las métricas y el Brand Kit del cliente...</div>' +
    '</div>';
  try {
    var res = await fetch(BRAVO_API + '/api/metrics/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId })
    });
    var data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error');
    panel.innerHTML = _metricasRenderReport(data.report, null, clientId);
  } catch(e) {
    panel.innerHTML =
      '<div style="background:#fff8f8;border:1px solid #f5c6c6;border-radius:10px;padding:1rem;font-size:0.82rem;color:#c0392b">' +
        '❌ ' + e.message +
      '</div>';
  }
}

function _metricasRenderReport(r, generatedAt, clientId) {
  var fechaStr = generatedAt ? new Date(generatedAt).toLocaleDateString('es-ES', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'}) : '';
  var tendenciaColor = r.tendencia === 'subiendo' ? '#1a6b1e' : r.tendencia === 'bajando' ? '#c0392b' : '#7a5c00';
  var tendenciaIcon  = r.tendencia === 'subiendo' ? '▲' : r.tendencia === 'bajando' ? '▼' : '→';

  return (
    '<div style="background:#fff;border:1px solid #e0dbd2;border-radius:10px;padding:1.25rem;display:flex;flex-direction:column;gap:1rem">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem">' +
        '<div style="display:flex;align-items:center;gap:0.6rem">' +
          '<div style="font-size:0.88rem;font-weight:600;color:#2a2a2a">✦ Análisis IA</div>' +
          (r.tendencia ? '<span style="font-size:0.72rem;font-weight:700;color:' + tendenciaColor + '">' + tendenciaIcon + ' ' + r.tendencia.toUpperCase() + '</span>' : '') +
          (fechaStr ? '<span style="font-size:0.7rem;color:#aaa">· ' + fechaStr + '</span>' : '') +
        '</div>' +
        '<button onclick="document.getElementById(\'met-analisis-' + clientId + '\').style.display=\'none\'" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:0.9rem">✕</button>' +
      '</div>' +

      // Resumen
      '<div style="background:#fafaf8;border-radius:8px;padding:1rem;font-size:0.82rem;color:#2a2a2a;line-height:1.6">' + (r.resumen || '') + '</div>' +

      // Funciona / Mejorar
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem">' +
        '<div style="background:#f0fdf0;border:1px solid #b6f0b8;border-radius:8px;padding:0.9rem">' +
          '<div style="font-size:0.75rem;font-weight:700;color:#1a6b1e;margin-bottom:0.5rem">✓ LO QUE FUNCIONA</div>' +
          '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.5">' + (r.funciona || '—') + '</div>' +
        '</div>' +
        '<div style="background:#fff8f0;border:1px solid #f5d87a;border-radius:8px;padding:0.9rem">' +
          '<div style="font-size:0.75rem;font-weight:700;color:#7a4e00;margin-bottom:0.5rem">⚠ LO QUE MEJORAR</div>' +
          '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.5">' + (r.mejorar || '—') + '</div>' +
        '</div>' +
      '</div>' +

      // Voz del público (audience_insights) — card destacada
      (r.audience_insights ?
        '<div style="background:#f0f8ff;border:1px solid #a8d4f5;border-radius:8px;padding:0.9rem">' +
          '<div style="font-size:0.75rem;font-weight:700;color:#1a4e8a;margin-bottom:0.5rem">💬 VOZ DEL PÚBLICO (de los comentarios)</div>' +
          '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.6">' + r.audience_insights + '</div>' +
        '</div>'
      : '') +

      // Ideas
      '<div style="background:#f8f4ff;border:1px solid #d0b8ff;border-radius:8px;padding:0.9rem">' +
        '<div style="font-size:0.75rem;font-weight:700;color:#6b1a9e;margin-bottom:0.5rem">💡 IDEAS PARA STUDIO BRAVO</div>' +
        '<div style="font-size:0.78rem;color:#2a2a2a;line-height:1.6">' + (r.ideas || '—') + '</div>' +
      '</div>' +

    '</div>'
  );
}

