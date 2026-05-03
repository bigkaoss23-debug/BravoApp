// ============================================================
// MOD-HISTORIAL — Log decisioni, filtri, statistiche
// Lazy-loaded quando si apre il tab Historial
// ============================================================

var decisions = [
  { type:'green', action:'Logo Rossi Srl aprobado', detail:'Cliente satisfecho, avance al 78%. Se notifico al equipo.', tags:['Rossi Srl','Lucia F.'], time:'Ayer 14:22' },
  { type:'blue',  action:'Notificacion enviada a Bianchi & Co', detail:'Recordatorio de aprobacion pendiente del brief Q2 v2.', tags:['Bianchi & Co','Sara M.'], time:'Ayer 11:05' },
  { type:'gold',  action:'Revision solicitada — Copy Newsletter', detail:'Tono demasiado formal. Se pidio ajuste al equipo creativo.', tags:['Ferretti SpA'], time:'28 mar 16:40' },
  { type:'red',   action:'Escalacion — Paleta Colores retrasada', detail:'Verde Fashion sin respuesta en 3 dias. Escalado a direccion.', tags:['Verde Fashion','Marco R.'], time:'27 mar 09:15' },
  { type:'green', action:'Brief Campana Q2 aprobado', detail:'Aprobado con observaciones menores. Equipo informado.', tags:['Bianchi & Co','Sara M.'], time:'26 mar 17:30' },
  { type:'blue',  action:'Reunion de kickoff confirmada', detail:'Kickoff Newsletter Abril con Ferretti SpA el 1 de abril.', tags:['Ferretti SpA'], time:'25 mar 10:00' },
  { type:'gold',  action:'Fecha limite desplazada — Social Q2', detail:'Movida de 25 abr a 2 may por peticion del cliente.', tags:['Bianchi & Co'], time:'24 mar 15:20' },
  { type:'green', action:'Moodboard Rossi Srl aprobado', detail:'Primera entrega aprobada sin cambios. Excelente trabajo.', tags:['Rossi Srl','Lucia F.'], time:'18 mar 13:00' },
];

var histFilter = 'all';

var typeConfig = {
  red:   { ico:'!',  bg:'var(--red-dim)',   col:'var(--red)',   label:'Escalacion' },
  green: { ico:'OK', bg:'var(--green-dim)', col:'var(--green)', label:'Aprobacion' },
  gold:  { ico:'~',  bg:'var(--gold-dim)',  col:'var(--gold)',  label:'Revision'   },
  blue:  { ico:'@',  bg:'var(--blue-dim)',  col:'var(--blue)',  label:'Notificacion'},
};

function logDecision(action, type, detail) {
  var now  = new Date();
  var time = 'Hoy ' + now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  decisions.unshift({ type: type, action: action, detail: detail || 'Accion registrada por BRAVO.', tags: [], time: time });
  updateHistStats();
}

function updateHistStats() {
  var appr = 0, esc = 0, rev = 0, notif = 0;
  for (var i = 0; i < decisions.length; i++) {
    if      (decisions[i].type === 'green') appr++;
    else if (decisions[i].type === 'red')   esc++;
    else if (decisions[i].type === 'gold')  rev++;
    else if (decisions[i].type === 'blue')  notif++;
  }
  var hsAppr  = document.getElementById('hs-appr');
  var hsEsc   = document.getElementById('hs-esc');
  var hsRev   = document.getElementById('hs-rev');
  var hsNotif = document.getElementById('hs-notif');
  if (hsAppr)  hsAppr.textContent  = appr;
  if (hsEsc)   hsEsc.textContent   = esc;
  if (hsRev)   hsRev.textContent   = rev;
  if (hsNotif) hsNotif.textContent = notif;
}

function renderHistory() {
  var feed = document.getElementById('histFeed');
  if (!feed) return;
  feed.innerHTML = '';
  var list = histFilter === 'all' ? decisions : decisions.filter(function(d) { return d.type === histFilter; });
  var countEl = document.getElementById('histCount');
  if (countEl) countEl.textContent = list.length + ' registros';
  for (var i = 0; i < list.length; i++) {
    var d   = list[i];
    var cfg = typeConfig[d.type];
    var el  = document.createElement('div');
    el.className = 'hist-item';
    el.style.animationDelay = (i * 0.04) + 's';
    var tagsHtml = '';
    for (var j = 0; j < d.tags.length; j++) {
      tagsHtml += '<span class="hist-tag" style="background:' + cfg.bg + ';color:' + cfg.col + '">' + d.tags[j] + '</span>';
    }
    el.innerHTML =
      '<div class="hist-ico" style="background:' + cfg.bg + ';color:' + cfg.col + '">' + cfg.ico + '</div>' +
      '<div class="hist-content">' +
        '<div class="hist-top"><div class="hist-action">' + d.action + '</div><div class="hist-time">' + d.time + '</div></div>' +
        '<div class="hist-detail">' + d.detail + '</div>' +
        (tagsHtml ? '<div class="hist-tags">' + tagsHtml + '</div>' : '') +
      '</div>';
    feed.appendChild(el);
  }
}

function filterHist(type, el) {
  histFilter = type;
  var chips = document.querySelectorAll('.hist-filters .filter-chip');
  for (var i = 0; i < chips.length; i++) chips[i].classList.remove('active');
  el.classList.add('active');
  renderHistory();
}

// Auto-mark as loaded when included as static script
if (typeof _loadedModules === 'object' && _loadedModules) _loadedModules['historial'] = true;
