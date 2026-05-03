// ============================================================
// MOD-CLIENTES — Popup lista clienti, nuovo cliente
// Precaricato al boot (popup richiamato da nav)
// ============================================================

function openClientesPopup() {
  var overlay = document.getElementById('clientesOverlay');
  var popup   = document.getElementById('clientesPopup');
  if (!overlay || !popup) return;
  renderClientesPopupList();
  overlay.classList.add('open');
  popup.classList.add('open');
  var tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(function(t) { t.classList.remove('active'); });
  var ct = document.querySelector('.nav-tab[onclick*="clientes"]');
  if (ct) ct.classList.add('active');
}

function closeClientesPopup() {
  var overlay = document.getElementById('clientesOverlay');
  var popup   = document.getElementById('clientesPopup');
  if (overlay) overlay.classList.remove('open');
  if (popup)   popup.classList.remove('open');
}

function renderClientesPopupList() {
  var list = document.getElementById('clientesPopupList');
  if (!list) return;
  if (!CLIENTS_DATA.length) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted2);font-size:0.8rem">Sin clientes cargados</div>';
    return;
  }
  list.innerHTML = CLIENTS_DATA.map(function(c, i) {
    var initials = (c.name || '').split(' ').map(function(w) { return w[0] || ''; }).join('').toUpperCase().slice(0, 2);
    var color    = CLIENT_COLORS[i % CLIENT_COLORS.length];
    var projs    = CUENTAS.filter(function(p) {
      return p.cliente && p.cliente.toLowerCase().indexOf((c.name || '').split(' ')[0].toLowerCase()) >= 0;
    });
    return '<div class="clientes-popup-item" onclick="openClientePage(' + i + ')">' +
      '<div class="clientes-popup-av" style="background:' + color + '">' + initials + '</div>' +
      '<div class="clientes-popup-info">' +
        '<div class="clientes-popup-name">' + (c.name || '') + '</div>' +
        '<div class="clientes-popup-sub">' + (c.sector || '') + ' · ' + projs.length + ' proy.</div>' +
      '</div>' +
      '<div class="clientes-popup-arrow">›</div>' +
    '</div>';
  }).join('') +
  '<div class="clientes-popup-add" onclick="openNuevoClienteModal()">+ Aggiungi cliente</div>';
}

function openNuevoClienteModal() {
  closeClientesPopup();
  if (document.getElementById('nuevoClienteModal')) return;
  var modal = document.createElement('div');
  modal.id = 'nuevoClienteModal';
  modal.className = 'bk-modal-overlay';
  modal.innerHTML =
    '<div class="bk-modal" style="max-width:480px">' +
      '<div class="bk-modal-head">' +
        '<div class="bk-modal-title">Nuovo cliente</div>' +
        '<button class="bk-modal-close" onclick="closeNuevoClienteModal()">✕</button>' +
      '</div>' +
      '<div class="bk-modal-body" style="padding:1.5rem;display:flex;flex-direction:column;gap:1rem">' +
        '<input id="nc-name"      class="bk-modal-input" placeholder="Nome (es. Pizzería Roma)" autocomplete="off">' +
        '<input id="nc-sector"    class="bk-modal-input" placeholder="Settore (es. Restaurazione / Pizzeria)">' +
        '<input id="nc-city"      class="bk-modal-input" placeholder="Città">' +
        '<input id="nc-instagram" class="bk-modal-input" placeholder="Instagram (es. @pizzeriaroma)">' +
        '<input id="nc-key"       class="bk-modal-input" placeholder="ID breve senza spazi (es. pizzeriaroma)">' +
        '<div id="nc-error" style="color:#D13B1E;font-size:0.8rem;min-height:1rem"></div>' +
        '<button class="bk-adopt-btn" onclick="saveNuevoCliente()" style="width:100%;justify-content:center">Crear cliente →</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
  setTimeout(function() { document.getElementById('nc-name').focus(); }, 50);

  document.getElementById('nc-name').addEventListener('input', function() {
    var key = this.value.toLowerCase()
      .replace(/[àáâãäå]/g,'a').replace(/[èéêë]/g,'e')
      .replace(/[ìíîï]/g,'i').replace(/[òóôõö]/g,'o')
      .replace(/[ùúûü]/g,'u').replace(/[^a-z0-9]/g,'');
    document.getElementById('nc-key').value = key;
  });
}

function closeNuevoClienteModal() {
  var m = document.getElementById('nuevoClienteModal');
  if (m) m.remove();
}

async function saveNuevoCliente() {
  var name      = (document.getElementById('nc-name').value || '').trim();
  var sector    = (document.getElementById('nc-sector').value || '').trim();
  var city      = (document.getElementById('nc-city').value || '').trim();
  var instagram = (document.getElementById('nc-instagram').value || '').trim();
  var key       = (document.getElementById('nc-key').value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  var errEl     = document.getElementById('nc-error');

  if (!name) { errEl.textContent = 'Il nome è obbligatorio.'; return; }
  if (!key)  { errEl.textContent = 'L\'ID breve è obbligatorio (solo lettere/numeri).'; return; }
  errEl.textContent = '';

  var btn = document.querySelector('#nuevoClienteModal .bk-adopt-btn');
  btn.disabled = true;
  btn.textContent = 'Creando…';

  try {
    var res = await fetch(AGENT_API + '/api/clients/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, sector: sector, city: city, instagram: instagram, client_key: key })
    });
    var data = await res.json();
    if (!res.ok) {
      errEl.textContent = data.detail || 'Error al crear el cliente.';
      btn.disabled = false;
      btn.textContent = 'Crear cliente →';
      return;
    }
    CLIENTS_DATA.push(data.client);
    closeNuevoClienteModal();
    openClientePage(CLIENTS_DATA.length - 1);
  } catch (e) {
    errEl.textContent = 'Error de red: ' + e.message;
    btn.disabled = false;
    btn.textContent = 'Crear cliente →';
  }
}
