// ── Auth token (set on login) ──────────────────────────────────────────────
let ADMIN_TOKEN = '';

function setToken(token) { ADMIN_TOKEN = token; }
function getToken()      { return ADMIN_TOKEN; }

// ── API call ───────────────────────────────────────────────────────────────
function api(endpoint, body) {
    return fetch('/api/' + endpoint, {
        method: 'POST',
        headers: {
            'Content-Type':  'application/json',
            'X-Admin-Token': ADMIN_TOKEN,
        },
        body: JSON.stringify(body || {}),
    }).then(function(r) {
        if (r.status === 401) throw new Error('Unauthorized');
        return r.json();
    });
}

// ── Shared utilities ───────────────────────────────────────────────────────

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function formatDate(s) {
    return s ? new Date(s).toLocaleString() : '—';
}

function itemType(id) {
    if (!id) return 'other';
    var l = id.toLowerCase();
    if (l.indexOf('_skin_')  > -1) return 'skin';
    if (l.indexOf('_wrap_')  > -1) return 'wrap';
    if (l.indexOf('_charm_') > -1) return 'charm';
    if (l.indexOf('crate')   > -1) return 'crate';
    return 'other';
}

function tagHTML(type) {
    var classes = {
        skin:  'tag-skin',
        wrap:  'tag-wrap',
        charm: 'tag-charm',
        crate: 'tag-crate',
        other: 'tag-item',
    };
    var label = type.charAt(0).toUpperCase() + type.slice(1);
    return '<span class="tag ' + (classes[type] || 'tag-item') + '">' + label + '</span>';
}

// ── Toast ──────────────────────────────────────────────────────────────────
var _toastTimer;

function toast(msg, type) {
    type = type || 'ok';
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'show ' + type;
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function() { el.className = ''; }, 3000);
}

// ── Log ────────────────────────────────────────────────────────────────────
function appendLog(msg, cls) {
    cls = cls || 'info';
    var el = document.getElementById('action-log');
    if (!el) return;
    var time = new Date().toLocaleTimeString();
    el.innerHTML += '<br><span class="' + cls + '">[' + time + '] ' + escapeHtml(msg) + '</span>';
    el.scrollTop = el.scrollHeight;
}
