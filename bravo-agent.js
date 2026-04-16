// ============================================================
// bravo-agent.js — Integrazione backend AI DaKady
// Chiama Railway: https://bravoapp-production.up.railway.app
// ============================================================

var BACKEND_URL = 'https://bravoapp-production.up.railway.app';
var agentGenerating = false;
var lastGeneratedContents = [];

// ── GENERA CONTENUTO ────────────────────────────────────────
async function agentGenerate() {
  if (agentGenerating) return;

  var brief   = document.getElementById('agent-brief').value.trim();
  var platform = document.getElementById('agent-platform').value;
  var num     = parseInt(document.getElementById('agent-num').value) || 3;

  if (!brief) {
    showToast('Scrivi un brief prima di generare');
    return;
  }

  agentGenerating = true;
  agentSetLoading(true);
  document.getElementById('agent-results').innerHTML = '';

  try {
    var res = await fetch(BACKEND_URL + '/api/content/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        brief:          brief,
        client_id:      'dakady',
        platform:       platform,
        num_contents:   num,
        generate_image: false
      })
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    var data = await res.json();
    lastGeneratedContents = data.contents || [];
    agentRenderResults(lastGeneratedContents);
    showToast('Contenuto generato — seleziona e approva');

  } catch (e) {
    document.getElementById('agent-results').innerHTML =
      '<div class="agent-error">Errore connessione backend: ' + (e.message || e) + '</div>';
    console.error('[AGENT] Errore:', e);
  } finally {
    agentGenerating = false;
    agentSetLoading(false);
  }
}

// ── FEEDBACK ────────────────────────────────────────────────
async function agentFeedback(contentId, status, reason) {
  var content = lastGeneratedContents.find(function(c) { return c.content_id === contentId; });
  try {
    await fetch(BACKEND_URL + '/api/content/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content_id:       contentId,
        client_id:        'dakady',
        status:           status,
        rejection_reason: reason || null,
        original_brief:   document.getElementById('agent-brief').value.trim(),
        headline:         content ? content.overlay.headline : null,
        layout_variant:   content ? content.overlay.layout_variant : null,
        pillar:           content ? content.pillar : null,
        caption_preview:  content ? content.caption.slice(0, 120) : null
      })
    });

    var card = document.getElementById('agent-card-' + contentId);
    if (card) {
      if (status === 'approved') {
        card.style.borderColor = 'var(--green, #2d7a4f)';
        card.querySelector('.agent-card-actions').innerHTML =
          '<span style="color:var(--green,#2d7a4f);font-weight:600">Approvato</span>';
        showToast('Approvato e salvato');
      } else {
        card.style.opacity = '0.45';
        card.querySelector('.agent-card-actions').innerHTML =
          '<span style="color:#888">Rifiutato</span>';
        showToast('Feedback salvato — migliorera la prossima generazione');
      }
    }
  } catch (e) {
    console.error('[AGENT] Feedback error:', e);
  }
}

function agentReject(contentId) {
  var reason = prompt('Motivo del rifiuto (opzionale):');
  agentFeedback(contentId, 'rejected', reason);
}

// ── RENDERING ───────────────────────────────────────────────
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
  var spinner = document.getElementById('agent-spinner');
  if (btn)     btn.disabled = on;
  if (spinner) spinner.style.display = on ? 'inline-block' : 'none';
  if (btn)     btn.textContent = on ? 'Generando...' : 'Genera';
}
