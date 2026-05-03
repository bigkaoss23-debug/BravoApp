// ============================================================
// MOD-CALENDAR — Calendario eventi con dati da Supabase
// Lazy-loaded quando si apre il tab Calendario
// ============================================================

var calYear  = 2026;
var calMonth = 3;
var calEvents = {};

var monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
var dayNames   = ['Lun','Mar','Mie','Jue','Vie','Sab','Dom'];

async function loadCalendarFromSupabase() {
  try {
    var res   = await fetch(BRAVO_API + '/api/plan-tasks');
    var data  = await res.json();
    var tasks = data.tasks || [];
    calEvents = {};
    var colorMap = {};
    _teamMembers.forEach(function(m) {
      colorMap[m.name] = m.employment_type === 'agent' ? 'ce-purple'
        : m.color === '#D13B1E' ? 'ce-red'
        : m.color === '#2c5f8a' ? 'ce-blue'
        : m.color === '#2d7a4f' ? 'ce-green'
        : m.color === '#B8860B' ? 'ce-gold'
        : 'ce-blue';
    });
    tasks.forEach(function(t) {
      if (!t.publish_date) return;
      var d   = new Date(t.publish_date + 'T12:00:00');
      var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
      if (!calEvents[key]) calEvents[key] = [];
      var cls = colorMap[t.assignee] || 'ce-blue';
      calEvents[key].push({ t: t.title || 'Tarea', cls: cls });
    });
    renderCalendar();
  } catch (e) {
    console.warn('[CALENDARIO] Errore caricamento:', e.message);
  }
}

function renderCalendar() {
  var titleEl = document.getElementById('calTitle');
  if (titleEl) titleEl.textContent = monthNames[calMonth] + ' ' + calYear;
  var grid = document.getElementById('calGrid');
  if (!grid) return;
  grid.innerHTML = '';

  for (var di = 0; di < dayNames.length; di++) {
    var h = document.createElement('div');
    h.className = 'cal-day-head';
    h.textContent = dayNames[di];
    grid.appendChild(h);
  }

  var firstDay    = new Date(calYear, calMonth, 1).getDay();
  var startOffset = (firstDay === 0 ? 6 : firstDay - 1);
  var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  var daysInPrev  = new Date(calYear, calMonth, 0).getDate();
  var today       = new Date();

  for (var i = startOffset - 1; i >= 0; i--) {
    var d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.innerHTML = '<span class="day-num">' + (daysInPrev - i) + '</span>';
    grid.appendChild(d);
  }

  for (var day = 1; day <= daysInMonth; day++) {
    var d = document.createElement('div');
    d.className = 'cal-day';
    if (today.getFullYear() === calYear && today.getMonth() === calMonth && today.getDate() === day) {
      d.classList.add('today');
    }
    var key  = calYear + '-' + (calMonth + 1) + '-' + day;
    var evs  = calEvents[key] || [];
    var html = '<span class="day-num">' + day + '</span>';
    for (var ei = 0; ei < evs.length; ei++) {
      html += '<div class="cal-event ' + evs[ei].cls + '" onclick="showToast(\'' + evs[ei].t + '\')">' + evs[ei].t + '</div>';
    }
    d.innerHTML = html;
    grid.appendChild(d);
  }

  var total     = startOffset + daysInMonth;
  var remaining = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (var i = 1; i <= remaining; i++) {
    var d = document.createElement('div');
    d.className = 'cal-day other-month';
    d.innerHTML = '<span class="day-num">' + i + '</span>';
    grid.appendChild(d);
  }
}

function changeMonth(dir) {
  calMonth += dir;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  renderCalendar();
}
