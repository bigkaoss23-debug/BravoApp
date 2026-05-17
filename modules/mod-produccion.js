/* mod-produccion.js — Control Tower dentro l'app vera (M2).
 * Overlay per cliente: Producciones (L2) → Flujo (L3) → Mesa (L4).
 * Selettore modello foto, Cancello 1 (prompt) e Cancello 2 (foto).
 * Usa AGENT_API (stesso backend Railway). Niente localhost/mockup.
 * Entrata: openProduccion(clientId) da Proyectos.
 */
(function () {
  var ST = { client: null, mes: null, lvl: 2, pid: null, macro: null };
  var _lastPrompts = [];

  function api() { return (typeof AGENT_API !== 'undefined' ? AGENT_API : '').replace(/\/+$/, ''); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function H(o, h, t) { return esc(o[h] || o[t] || ''); }
  var EST = {
    bloqueada: ['p-block', 'Bloqueada — te necesita'], bloqueado: ['p-block', 'Bloqueado — te necesita'],
    en_curso: ['p-fly', 'En curso'], hecho: ['p-ok', 'Hecho'], completada: ['p-ok', 'Completada'],
    en_cola: ['p-idle', 'En cola'], sin_datos: ['p-idle', 'Sin datos'],
    proposed: ['p-wait', 'Propuesto'], prompt_approved: ['p-ok', 'Aprobado'],
    generated: ['p-fly', 'Generada'], photo_confirmed: ['p-ok', 'En catálogo'], rejected: ['p-block', 'Rechazado']
  };
  function estLabel(e) { return (EST[e] || ['p-idle', e])[1]; }
  function estPill(e) { return (EST[e] || ['p-idle', e])[0]; }
  function estDot(e) { return ({ bloqueada: 'd-block', bloqueado: 'd-block', en_curso: 'd-ok', hecho: 'd-ok', completada: 'd-ok', generated: 'd-ok' })[e] || 'd-idle'; }

  function injectStyle() {
    if (document.getElementById('ct-style')) return;
    var st = document.createElement('style');
    st.id = 'ct-style';
    st.textContent =
      '#ctOv{position:fixed;inset:0;background:rgba(20,26,22,0.55);z-index:4000;display:flex;align-items:flex-start;justify-content:center;padding:1.2rem;overflow:auto}' +
      '#ctW{max-width:1000px;width:100%;font-family:inherit}' +
      '.ct-top{display:flex;align-items:center;justify-content:space-between;background:#1F2A24;color:#C29547;border-radius:13px 13px 0 0;padding:0.85rem 1.15rem}' +
      '.ct-cr{font-size:0.74rem;color:#cdbb8f}.ct-top h1{font-size:0.98rem;font-weight:700;margin:0.12rem 0 0}' +
      '.ct-bk{background:rgba(255,255,255,0.14);border:none;color:#fff;border-radius:8px;padding:0.38rem 0.78rem;font-size:0.78rem;cursor:pointer;font-family:inherit;margin-left:0.4rem}' +
      '.ct-pn{background:#fff;border:1px solid #e0dbd2;border-top:none;border-radius:0 0 13px 13px;padding:1.15rem;min-height:160px}' +
      '.ct-lvl{font-size:0.66rem;font-weight:700;letter-spacing:0.08em;color:#888;text-transform:uppercase;margin-bottom:0.7rem}' +
      '.ct-pill{display:inline-block;font-size:0.63rem;font-weight:700;border-radius:20px;padding:0.16rem 0.6rem;color:#fff}' +
      '.p-ok{background:#16a34a}.p-wait{background:#d9952b}.p-block{background:#c0392b}.p-idle{background:#9aa0a6}.p-fly{background:#2563eb}' +
      '.ct-row{display:flex;align-items:center;gap:0.85rem;border:1px solid #e0dbd2;border-radius:11px;padding:0.85rem 0.95rem;margin-bottom:0.55rem;background:#fff;cursor:pointer}' +
      '.ct-row:hover{border-color:#C29547}.ct-row.calm{opacity:0.6}.ct-row .t{font-size:0.9rem;font-weight:700}.ct-row .s{font-size:0.75rem;color:#888;margin-top:0.18rem}' +
      '.ct-row .r{margin-left:auto;text-align:right;white-space:nowrap}' +
      '.ct-dot{width:11px;height:11px;border-radius:50%;flex:none}.d-ok{background:#16a34a}.d-wait{background:#d9952b}.d-block{background:#c0392b}.d-idle{background:#9aa0a6}' +
      '.ct-need{color:#c0392b;font-weight:700}.ct-ar{color:#aaa;font-size:1.05rem}' +
      '.ct-g{display:flex;gap:0.6rem;align-items:center;border-radius:10px;padding:0.7rem 0.95rem;margin-bottom:1rem;font-size:0.86rem;font-weight:700}' +
      '.ct-gc{background:#eef6f0;border:1px solid #cfe6d6;color:#1c6b3f}.ct-ga{background:#fdecea;border:1px solid #f1c8c2;color:#a23528}' +
      '.ct-node{display:flex;align-items:center;gap:0.7rem;border:1px solid #e0dbd2;border-radius:10px;padding:0.7rem 0.85rem;background:#fff;cursor:pointer;margin-bottom:0.45rem}' +
      '.ct-node:hover{border-color:#C29547}.ct-node .nm{font-size:0.86rem;font-weight:700}.ct-node .tc{font-size:0.68rem;color:#aaa}' +
      '.ct-conn{color:#aaa;font-size:0.85rem;text-align:center;margin:0.1rem 0}.ct-par{display:flex;gap:0.5rem}.ct-par .ct-node{flex:1}' +
      '.ct-next{background:linear-gradient(135deg,#1F2A24,#2d4a3e);color:#fff;border-radius:12px;padding:1rem 1.1rem;margin-bottom:1rem}' +
      '.ct-next .l{font-size:0.66rem;font-weight:700;letter-spacing:0.08em;color:#C29547;text-transform:uppercase}' +
      '.ct-next .ti{font-size:1.05rem;font-weight:700;margin:0.25rem 0}.ct-next .de{font-size:0.82rem;color:#d8d2c2;margin-bottom:0.7rem}' +
      '.ct-next select{font-family:inherit;font-size:0.78rem;padding:0.3rem 0.5rem;border-radius:7px;border:none;margin-bottom:0.7rem}' +
      '.ct-next button{font-family:inherit;font-size:0.85rem;font-weight:700;border:none;border-radius:9px;padding:0.6rem 1.2rem;cursor:pointer;background:#C29547;color:#1F2A24}' +
      '.ct-next button:disabled{opacity:0.55;cursor:not-allowed}.ct-next .so{font-size:0.7rem;color:#bdb38f;margin-top:0.5rem}' +
      '.ct-grid{display:grid;grid-template-columns:1fr 1fr;gap:0.8rem}@media(max-width:760px){.ct-grid{grid-template-columns:1fr}.ct-par{flex-direction:column}}' +
      '.ct-box{border:1px solid #e0dbd2;border-radius:11px;padding:0.85rem 1rem;background:#fcfbf8}' +
      '.ct-box h3{font-size:0.66rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#888;margin:0 0 0.5rem}' +
      '.ct-kv{font-size:0.85rem;margin-bottom:0.3rem}.ct-kv b{color:#1F2A24}' +
      '.ct-mem{font-size:0.78rem;padding:0.4rem 0.55rem;border-left:3px solid #c0392b;background:#fff;border-radius:0 6px 6px 0;margin-bottom:0.38rem}' +
      '.ct-mem .c{font-size:0.62rem;font-weight:700;color:#c0392b;text-transform:uppercase}' +
      '.ct-pr{border:1px solid #e0dbd2;border-radius:10px;padding:0.7rem 0.85rem;margin-bottom:0.55rem;background:#fff}' +
      '.ct-pr .m{font-size:0.72rem;color:#888;display:flex;justify-content:space-between;gap:0.5rem}' +
      '.ct-pr .x{font-size:0.8rem;color:#2a2a2a;margin:0.35rem 0;line-height:1.45}' +
      '.ct-pr .a{display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem}' +
      '.ct-pr .a button{font-family:inherit;font-size:0.72rem;font-weight:700;border-radius:7px;padding:0.32rem 0.7rem;cursor:pointer;border:1.5px solid #e0dbd2;background:#fff}' +
      '.b-ok{color:#16a34a;border-color:#bfe3cb!important}.b-ed{color:#2563eb;border-color:#c2d4f1!important}.b-no{color:#c0392b;border-color:#e3c9c4!important}' +
      '.ct-ld{text-align:center;color:#888;font-size:0.85rem;padding:2rem}.ct-er{background:#fdecea;border:1px solid #f1c8c2;color:#a23528;font-size:0.82rem;border-radius:9px;padding:0.7rem 0.9rem}' +
      '.ct-det summary{font-size:0.76rem;color:#888;cursor:pointer;margin-top:0.4rem}';
    document.head.appendChild(st);
  }

  function shell() {
    var ov = document.getElementById('ctOv');
    if (ov) ov.remove();
    ov = document.createElement('div');
    ov.id = 'ctOv';
    ov.innerHTML =
      '<div id="ctW">' +
      '<div class="ct-top"><div><div class="ct-cr" id="ctCr"></div><h1 id="ctTi">Producciones</h1></div>' +
      '<div><button class="ct-bk" id="ctBk" style="display:none">← Volver</button>' +
      '<button class="ct-bk" onclick="ProduccionCT.close()">✕ Cerrar</button></div></div>' +
      '<div class="ct-pn" id="ctPn"><div class="ct-ld">⏳ Cargando…</div></div></div>';
    document.body.appendChild(ov);
    document.getElementById('ctBk').onclick = back;
  }
  function el(id) { return document.getElementById(id); }
  function fail(m) { el('ctPn').innerHTML = '<div class="ct-er">❌ ' + esc(m) + '</div>'; }

  async function loadL2() {
    ST.lvl = 2; el('ctBk').style.display = 'none';
    el('ctTi').textContent = 'Producciones'; el('ctCr').textContent = 'Cliente ›';
    el('ctPn').innerHTML = '<div class="ct-ld">⏳ Cargando producciones…</div>';
    try {
      var r = await fetch(api() + '/api/clients/' + encodeURIComponent(ST.client) + '/producciones?mes=' + encodeURIComponent(ST.mes));
      if (!r.ok) { fail('Backend respondió ' + r.status); return; }
      var j = await r.json(), prods = j.producciones || [];
      var bloq = prods.some(function (p) { return p.estado === 'bloqueada'; });
      var h = '<div class="ct-lvl">Producciones del cliente · ' + esc(ST.mes) + '</div>';
      h += bloq ? '<div class="ct-g ct-ga">🔴 <span>Hay producción detenida — necesita tu intervención</span></div>'
                : '<div class="ct-g ct-gc">🟢 <span>Todo fluye — nada que hacer ahora</span></div>';
      if (!prods.length) h += '<div class="ct-ld">Sin producciones para este cliente/mes.</div>';
      prods.forEach(function (p) {
        var c = p.carga || {}, calm = (p.estado !== 'bloqueada');
        var s = 'Motor: ' + H(p, 'motor_humano', 'motor_agente');
        if ((c.total || 0) > 0) s += ' · ' + c.total + ' contenidos';
        if (p.estado === 'bloqueada') s += ' · <span class="ct-need">' + (c.bloqueados || 0) + ' sin foto</span>';
        h += '<div class="ct-row ' + (calm ? 'calm' : '') + '" onclick="ProduccionCT._l3(\'' + p.producion_id + '\',\'' + H(p, 'macro_humano', 'macro_dominio') + '\')">' +
          '<span class="ct-dot ' + estDot(p.estado) + '"></span>' +
          '<div><div class="t">' + esc(ST.mes) + ' · ' + H(p, 'macro_humano', 'macro_dominio') + '</div><div class="s">' + s + '</div></div>' +
          '<div class="r"><span class="ct-pill ' + estPill(p.estado) + '">' + esc(estLabel(p.estado)) + '</span></div><div class="ct-ar">›</div></div>';
      });
      el('ctPn').innerHTML = h;
    } catch (e) { fail('No se pudo conectar: ' + (e.message || e)); }
  }

  async function loadL3(pid, macroLbl) {
    ST.lvl = 3; ST.pid = pid; ST.macro = macroLbl; el('ctBk').style.display = '';
    el('ctTi').textContent = 'Flujo · ' + macroLbl; el('ctCr').textContent = 'Cliente · Producciones ›';
    el('ctPn').innerHTML = '<div class="ct-ld">⏳ Cargando flujo…</div>';
    try {
      var r = await fetch(api() + '/api/producciones/' + encodeURIComponent(pid) + '/flujo');
      if (!r.ok) { fail('flujo: backend ' + r.status); return; }
      var j = await r.json();
      var h = '<div class="ct-lvl">Cadena de agentes</div>';
      h += (j.estado === 'bloqueada') ? '<div class="ct-g ct-ga">🔴 <span>Producción detenida — mira el paso en rojo</span></div>'
                                      : '<div class="ct-g ct-gc">🟢 <span>Sin bloqueos</span></div>';
      (j.pasos || []).forEach(function (s, i) {
        if (i) h += '<div class="ct-conn">↓</div>';
        h += s.paralelo ? '<div class="ct-par">' + s.paralelo.map(nodeH).join('') + '</div>' : nodeH(s);
      });
      el('ctPn').innerHTML = h;
    } catch (e) { fail('flujo: ' + (e.message || e)); }
  }
  function nodeH(n) {
    return '<div class="ct-node" onclick="ProduccionCT._l4(\'' + esc(n.paso) + '\')">' +
      '<span class="ct-dot ' + estDot(n.estado) + '"></span>' +
      '<div><div class="nm">' + H(n, 'agente_humano', 'paso') + '</div><div class="tc">' + esc(n.agente_tecnico || n.paso) + '</div></div>' +
      '<span class="ct-pill ' + estPill(n.estado) + '" style="margin-left:auto">' + esc(estLabel(n.estado)) + '</span></div>';
  }

  async function loadL4(paso) {
    ST.lvl = 4; ST.paso = paso; el('ctBk').style.display = '';
    el('ctTi').textContent = 'Mesa de trabajo'; el('ctCr').textContent = 'Cliente · ' + ST.macro + ' ›';
    el('ctPn').innerHTML = '<div class="ct-ld">⏳ Cargando…</div>';
    try {
      var r = await fetch(api() + '/api/producciones/' + encodeURIComponent(ST.pid) + '/paso/' + encodeURIComponent(paso));
      if (!r.ok) { fail('paso: backend ' + r.status); return; }
      var j = await r.json();
      var agH = H(j, 'agente_paso_humano', 'motor_agente'), agT = j.agente_paso_tecnico || paso;
      var moH = H(j, 'motor_produccion_humano', 'motor_agente');
      var h = '';
      if (j.siguiente_paso) {
        var sp = j.siguiente_paso;
        h += '<div class="ct-next"><div class="l">Próximo paso</div><div class="ti">' + esc(sp.titulo) + '</div>' +
          '<div class="de">' + esc(sp.detalle) + '</div>' +
          '<div style="font-size:0.78rem;color:#d8d2c2">Herramienta foto: ' +
          '<select id="ctMod"><option value="location">Location · editorial (Higgsfield)</option>' +
          '<option value="realista">Realista · fiel (Nano Banana)</option>' +
          '<option value="auto">Automático por tipo</option></select></div>' +
          '<button ' + (sp.disponible ? 'onclick="ProduccionCT._proponer()"' : 'disabled') + '>' + esc(sp.titulo) + '</button>' +
          '<div class="so">⚠ ' + esc(sp.nota || '') + '</div></div>';
      } else if (j.bloqueo) {
        h += '<div class="ct-g ct-ga">🔴 <span>' + esc(j.bloqueo.motivo) + '</span></div>';
      } else {
        h += '<div class="ct-g ct-gc">🟢 <span>Este paso no necesita nada de ti ahora</span></div>';
      }
      var summary = '';
      if (j.bloqueo && j.bloqueo.slots) {
        var bf = {}; j.bloqueo.slots.forEach(function (s) { var f = s.format || '?'; bf[f] = (bf[f] || 0) + 1; });
        summary = Object.keys(bf).map(function (f) { return bf[f] + ' ' + esc(f); }).join(' · ');
      }
      h += '<div class="ct-grid"><div class="ct-box"><h3>Qué pasa aquí</h3>' +
        '<div class="ct-kv"><b>Responsable del paso:</b> ' + esc(agH) + ' <span style="color:#aaa;font-size:0.74rem">(' + esc(agT) + ')</span></div>' +
        '<div class="ct-kv"><b>Motor de la producción:</b> ' + esc(moH) + '</div>' +
        '<div class="ct-kv"><b>Producción:</b> ' + H(j, 'macro_humano', 'macro_dominio') + ' · ' + esc(j.mes) + '</div>' +
        (summary ? '<div class="ct-kv"><b>Falta:</b> <span class="ct-need">' + summary + '</span></div>' : '') +
        '<div style="font-size:0.72rem;color:#aaa;margin-top:0.4rem">' + esc(j.nota || '') + '</div></div>' +
        '<div class="ct-box"><h3>Memoria · errores (' + (j.memoria_errores || []).length + ')</h3>' +
        (!(j.memoria_errores || []).length ? '<div style="font-size:0.76rem;color:#aaa">Sin reglas registradas todavía.</div>' :
          j.memoria_errores.map(function (m) { return '<div class="ct-mem"><span class="c">' + esc(m.categoria) + '</span><br>' + esc(m.motivo) + ' (×' + esc(m.veces) + ')</div>'; }).join('')) +
        '</div></div>';
      if (paso === 'photoneeds') h += '<div id="ctPrompts"><div class="ct-ld">⏳ Cargando prompts…</div></div>';
      el('ctPn').innerHTML = h;
      if (paso === 'photoneeds') loadPrompts();
    } catch (e) { fail('paso: ' + (e.message || e)); }
  }

  async function loadPrompts() {
    var box = el('ctPrompts'); if (!box) return;
    box.innerHTML = '<div class="ct-ld">⏳ Cargando prompts…</div>';
    try {
      var r = await fetch(api() + '/api/producciones/' + encodeURIComponent(ST.pid) + '/paso/photoneeds/prompts');
      var j = await r.json();
      if (!r.ok) { box.innerHTML = '<div class="ct-er">❌ prompts: ' + esc((j && j.detail) || r.status) + '</div>'; return; }
      var ps = j.prompts || [];
      _lastPrompts = ps;
      var h = '<div class="ct-lvl" style="margin-top:1rem">Prompts de foto (' + (j.total || 0) + ') ' +
        Object.keys(j.por_estado || {}).map(function (k) { return '· ' + esc(k) + ' ' + j.por_estado[k]; }).join(' ') + '</div>';
      if (!ps.length) h += '<div style="font-size:0.8rem;color:#999">Aún no hay prompts. Pulsa el botón de arriba para que el Fotógrafo los proponga.</div>';
      ps.forEach(function (p) {
        var fmt = ({ '9:16': 'Story 9:16', '1:1': 'Post 1:1' })[p.aspect_ratio] || p.aspect_ratio || '';
        var ml = ({ 'soul_location': 'Location', 'nano_banana_2': 'Realista' })[p.model] || p.model || '';
        h += '<div class="ct-pr"><div class="m"><span>' + esc(p.scheduled_date || '') + ' · ' + esc(p.pillar || '') + ' · ' + esc(p.angle || '') +
          (fmt ? ' · <b>' + esc(fmt) + '</b>' : '') + (ml ? ' · 🛠 ' + esc(ml) : '') + '</span>' +
          '<span class="ct-pill ' + estPill(p.status) + '">' + esc(estLabel(p.status)) + '</span></div>' +
          '<div class="x">' + esc(p.prompt_es || p.prompt || '') + '</div>' +
          '<details class="ct-det"><summary>Ver prompt en inglés (el que se usa para generar)</summary>' +
          '<div class="x" style="color:#666;font-size:0.76rem">' + esc(p.prompt || '') + '</div></details>' +
          (p.rejection_reason ? '<div style="color:#c0392b;font-size:0.76rem;margin-top:0.3rem">✗ ' + esc(p.rejection_reason) + '</div>' : '') +
          (p.status === 'proposed' ? ('<div class="a">' +
            '<button class="b-ok" onclick="ProduccionCT._g1(\'' + p.id + '\',\'approve\')">✓ Aprobar</button>' +
            '<button class="b-ed" onclick="ProduccionCT._g1(\'' + p.id + '\',\'edit\')">✎ Editar</button>' +
            '<button class="b-no" onclick="ProduccionCT._g1(\'' + p.id + '\',\'reject\')">✗ Rechazar</button></div>') : '') +
          (p.status === 'prompt_approved' ? '<div style="font-size:0.76rem;color:#16a34a;margin-top:0.4rem">✓ Aprobado · ⏳ esperando generación</div>' : '') +
          (p.status === 'generated' && p.result_url ? ('<div style="margin-top:0.5rem">' +
            '<img src="' + esc(p.result_url) + '" style="width:100%;max-width:320px;border-radius:9px;display:block;border:1px solid #e0dbd2">' +
            '<div class="a"><button class="b-ok" onclick="ProduccionCT._g2(\'' + p.id + '\',\'confirm\')">✓ Confirmar (al catálogo)</button>' +
            '<button class="b-no" onclick="ProduccionCT._g2(\'' + p.id + '\',\'reject\')">✗ Rechazar foto</button></div></div>') : '') +
          (p.status === 'photo_confirmed' ? ('<div style="margin-top:0.5rem;font-size:0.78rem;color:#16a34a">✓ En catálogo · <b>listo para el feed</b>' +
            (p.result_url ? '<br><img src="' + esc(p.result_url) + '" style="width:110px;border-radius:7px;margin-top:0.3rem">' : '') + '</div>' +
            (p.plan_slot_id ? '<div class="a"><button class="b-ok" onclick="ProduccionCT._avanzar(\'' + p.id + '\')" title="Abre el Estudio para este slot (independiente de los demás)">✦ Avanzar al Estudio</button></div>' : '')) : '') +
          '</div>';
      });
      box.innerHTML = h;
      var sm = el('ctMod');
      if (sm && j.modelo_sugerido) { sm.value = ({ 'soul_location': 'location', 'nano_banana_2': 'realista' })[j.modelo_sugerido] || sm.value; }
    } catch (e) { box.innerHTML = '<div class="ct-er">❌ ' + esc(e.message || e) + '</div>'; }
  }

  async function proponer() {
    if (!confirm('Esto llama a PhotoNeeds (Claude · usa créditos) y propone un prompt por cada slot sin foto. ¿Continuar?')) return;
    var sm = el('ctMod'); var mod = sm ? sm.value : 'location';
    var box = el('ctPrompts'); if (box) box.innerHTML = '<div class="ct-ld">⏳ PhotoNeeds está proponiendo… (puede tardar)</div>';
    try {
      var r = await fetch(api() + '/api/producciones/' + encodeURIComponent(ST.pid) + '/paso/photoneeds/proponer?modelo=' + encodeURIComponent(mod), { method: 'POST' });
      var j = await r.json();
      if (!r.ok) { if (box) box.innerHTML = '<div class="ct-er">❌ ' + esc((j && j.detail) || r.status) + '</div>'; return; }
      loadPrompts();
    } catch (e) { if (box) box.innerHTML = '<div class="ct-er">❌ ' + esc(e.message || e) + '</div>'; }
  }

  async function gate(id, kind, gateN) {
    var dec, isG2 = (gateN === 2);
    if (kind === 'approve') dec = 'approve';
    else if (kind === 'confirm') dec = 'confirm';
    else if (kind === 'reject') { var m = prompt('Motivo del rechazo (queda en memoria de errores):'); if (!m) return; dec = { reject: m }; }
    else if (kind === 'edit') { var t = prompt('Nuevo prompt:'); if (!t) return; dec = { edit_prompt: t }; }
    try {
      var ep = isG2 ? 'gate2' : 'gate1';
      var r = await fetch(api() + '/api/producciones/' + encodeURIComponent(ST.pid) + '/paso/photoneeds/' + ep,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decisions: { [id]: dec } }) });
      var j = await r.json();
      if (!r.ok) { alert('Gate: ' + ((j && j.detail) || r.status)); return; }
      loadPrompts();
    } catch (e) { alert('Gate: ' + (e.message || e)); }
  }

  // Slot con foto confermata → avanza al Estudio reale (bravo-studio.js).
  // Indipendente dagli altri slot: niente muro tutto-o-niente.
  function avanzar(id) {
    var p = null;
    for (var i = 0; i < _lastPrompts.length; i++) { if (_lastPrompts[i].id === id) { p = _lastPrompts[i]; break; } }
    if (!p || !p.plan_slot_id) { alert('Este slot aún no se puede avanzar.'); return; }
    if (!window.StudioFlow || typeof StudioFlow.proposeFromSlot !== 'function') { alert('Estudio no disponible.'); return; }
    var fmt = ({ '9:16': 'Story 9:16', '1:1': 'Post 1:1' })[p.aspect_ratio] || 'Post 1:1';
    var slot = {
      id: p.plan_slot_id, pillar: p.pillar || '', angle: p.angle || '',
      persona: '', scheduled_date: p.scheduled_date || '', format: fmt, platform: 'instagram'
    };
    window.ProduccionCT.close();
    StudioFlow.proposeFromSlot(ST.client, slot);
  }

  function back() { ST.lvl === 4 ? loadL3(ST.pid, ST.macro) : loadL2(); }

  window.ProduccionCT = {
    open: function (clientId) {
      ST.client = clientId;
      ST.mes = new Date().toISOString().slice(0, 7);
      injectStyle(); shell(); loadL2();
    },
    close: function () { var o = document.getElementById('ctOv'); if (o) o.remove(); },
    _l3: loadL3, _l4: loadL4, _proponer: proponer, _avanzar: avanzar,
    _g1: function (id, k) { gate(id, k, 1); },
    _g2: function (id, k) { gate(id, k, 2); }
  };
})();
