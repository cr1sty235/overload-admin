// ── Section switching ──────────────────────────────────────────────────────

var mailSections = ['compose', 'broadcast', 'history', 'broadcasts'];

function showMailSection(name) {
    mailSections.forEach(function(s) {
        var btn   = document.getElementById('msec-' + s);
        if (btn) btn.classList.toggle('active', s === name);
    });

    renderMailSection(name);

    if (name === 'history')    loadSentHistory();
    if (name === 'broadcasts') loadBroadcasts();
}

function renderMailSection(name) {
    var el = document.getElementById('mail-main');
    if (!el) return;

    if (name === 'compose')    el.innerHTML = composeHTML();
    if (name === 'broadcast')  el.innerHTML = broadcastHTML();
    if (name === 'history')    el.innerHTML = historyHTML();
    if (name === 'broadcasts') el.innerHTML = broadcastsHTML();
}

// ── Compose HTML ───────────────────────────────────────────────────────────

function composeHTML() {
    return '<div class="card">' +
        '<div class="card-title">Send Mail to Single Player</div>' +
        '<div class="field"><label>Player PlayFab ID</label><input id="m-pfid" placeholder="PlayFab ID"></div>' +
        '<div class="field"><label>Subject</label><input id="m-sub" placeholder="Subject line"></div>' +
        '<div class="field"><label>Message Body</label><textarea id="m-body" style="min-height:130px" placeholder="Write your message…"></textarea></div>' +
        '<div class="divider"></div>' +
        '<div class="card-title">Attach Grants (optional)</div>' +
        '<div class="field"><label>Item IDs to grant (comma separated)</label><input id="m-items" placeholder="RPG_Skin_RedDragon, crate_common"></div>' +
        '<div class="row-2">' +
            '<div class="field"><label>Currency Code</label><input id="m-cc" placeholder="GD"></div>' +
            '<div class="field"><label>Currency Amount</label><input id="m-ca" type="number" placeholder="0" min="0"></div>' +
        '</div>' +
        '<button class="btn-success" onclick="sendMail()">✉ Send Mail</button>' +
    '</div>';
}

// ── Broadcast HTML ─────────────────────────────────────────────────────────

function broadcastHTML() {
    return '<div class="card">' +
        '<div class="card-title">Broadcast Mail to ALL Players</div>' +
        '<div class="success-box">This mail will appear in every player\'s inbox. Use for events, rewards, and server-wide announcements.</div>' +
        '<div class="field"><label>Subject</label><input id="b-sub" placeholder="Subject line"></div>' +
        '<div class="field"><label>Message Body</label><textarea id="b-body" style="min-height:130px" placeholder="Write your message…"></textarea></div>' +
        '<div class="divider"></div>' +
        '<div class="card-title">Attach Grants (optional — all players who claim receive this)</div>' +
        '<div class="field"><label>Item IDs to grant (comma separated)</label><input id="b-items" placeholder="crate_common"></div>' +
        '<div class="row-2">' +
            '<div class="field"><label>Currency Code</label><input id="b-cc" placeholder="GD"></div>' +
            '<div class="field"><label>Currency Amount</label><input id="b-ca" type="number" placeholder="0" min="0"></div>' +
        '</div>' +
        '<button class="btn-success" onclick="broadcastMail()">📡 Broadcast to All Players</button>' +
    '</div>';
}

// ── History HTML ───────────────────────────────────────────────────────────

function historyHTML() {
    return '<div class="card">' +
        '<div class="card-title">Sent History <button class="btn-ghost btn-sm" onclick="loadSentHistory()">↻ Refresh</button></div>' +
        '<div id="sent-log-list"><div class="empty">Loading…</div></div>' +
    '</div>';
}

// ── Active Broadcasts HTML ─────────────────────────────────────────────────

function broadcastsHTML() {
    return '<div class="card">' +
        '<div class="card-title">Active Broadcasts <button class="btn-ghost btn-sm" onclick="loadBroadcasts()">↻ Refresh</button></div>' +
        '<div id="broadcasts-list"><div class="empty">Loading…</div></div>' +
    '</div>';
}

// ── Send single mail ───────────────────────────────────────────────────────

function sendMail() {
    var pfid  = document.getElementById('m-pfid').value.trim();
    var sub   = document.getElementById('m-sub').value.trim();
    var body  = document.getElementById('m-body').value.trim();
    var items = document.getElementById('m-items').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var cc    = document.getElementById('m-cc').value.trim();
    var ca    = parseInt(document.getElementById('m-ca').value) || 0;

    if (!pfid || !sub) { toast('Enter player ID and subject', 'warn'); return; }

    api('send-mail', { playFabId: pfid, subject: sub, body: body, itemIds: items, currencyCode: cc, currencyAmt: ca })
        .then(function(d) {
            if (d.code === 200) {
                toast('Mail sent to ' + pfid);
                document.getElementById('m-pfid').value  = '';
                document.getElementById('m-sub').value   = '';
                document.getElementById('m-body').value  = '';
                document.getElementById('m-items').value = '';
                document.getElementById('m-cc').value    = '';
                document.getElementById('m-ca').value    = '';
            } else {
                toast(d.errorMessage, 'err');
            }
        })
        .catch(function(e) { toast(e.message, 'err'); });
}

// ── Broadcast mail ─────────────────────────────────────────────────────────

function broadcastMail() {
    var sub   = document.getElementById('b-sub').value.trim();
    var body  = document.getElementById('b-body').value.trim();
    var items = document.getElementById('b-items').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var cc    = document.getElementById('b-cc').value.trim();
    var ca    = parseInt(document.getElementById('b-ca').value) || 0;

    if (!sub) { toast('Enter a subject', 'warn'); return; }
    if (!confirm('Broadcast to ALL players?\n\nSubject: ' + sub)) return;

    api('broadcast-mail', { subject: sub, body: body, itemIds: items, currencyCode: cc, currencyAmt: ca })
        .then(function(d) {
            if (d.code === 200) {
                toast('Broadcast sent to all players!');
                document.getElementById('b-sub').value  = '';
                document.getElementById('b-body').value = '';
            } else {
                toast(d.errorMessage, 'err');
            }
        })
        .catch(function(e) { toast(e.message, 'err'); });
}

// ── Sent history ───────────────────────────────────────────────────────────

function loadSentHistory() {
    var el = document.getElementById('sent-log-list');
    if (!el) return;

    api('get-sent-log', {})
        .then(function(d) {
            var log = d.data || [];
            if (!log.length) { el.innerHTML = '<div class="empty">No sent mail yet</div>'; return; }

            el.innerHTML = log.map(function(entry) {
                var badge = entry.type === 'broadcast'
                    ? '<span class="broadcast-badge">BROADCAST</span> '
                    : '';
                return '<div class="sent-item">' +
                    badge +
                    '<div class="sent-to">'      + escapeHtml(entry.to) + '</div>' +
                    '<div class="sent-subject">' + escapeHtml(entry.subject) + '</div>' +
                    '<div class="sent-time">'    + formatDate(entry.sentAt) + '</div>' +
                '</div>';
            }).join('');
        })
        .catch(function() { if (el) el.innerHTML = '<div class="empty">Failed to load</div>'; });
}

// ── Active broadcasts ──────────────────────────────────────────────────────

function loadBroadcasts() {
    var el = document.getElementById('broadcasts-list');
    if (!el) return;

    api('get-broadcasts', {})
        .then(function(d) {
            var list = d.data || [];
            if (!list.length) { el.innerHTML = '<div class="empty">No active broadcasts</div>'; return; }

            el.innerHTML = list.map(function(b) {
                var grants = b.grants && b.grants.itemIds && b.grants.itemIds.length
                    ? ' | Items: ' + b.grants.itemIds.join(', ')
                    : '';
                return '<div class="announcement-item">' +
                    '<div class="ann-title-display">' + escapeHtml(b.subject) + '</div>' +
                    '<div class="ann-body-display">'  + escapeHtml(b.body)    + '</div>' +
                    '<div class="ann-meta">Sent: ' + formatDate(b.sentAt) + grants + '</div>' +
                    '<div class="btn-row" style="margin-top:8px">' +
                        '<button class="btn-danger btn-sm" onclick="deleteBroadcast(\'' + b.id + '\')">Delete</button>' +
                    '</div>' +
                '</div>';
            }).join('');
        })
        .catch(function() { if (el) el.innerHTML = '<div class="empty">Failed to load</div>'; });
}

function deleteBroadcast(id) {
    if (!confirm('Delete this broadcast? Players who haven\'t claimed it yet will lose access.')) return;

    api('delete-broadcast', { id: id })
        .then(function(d) {
            if (d.code === 200) { toast('Broadcast deleted', 'warn'); loadBroadcasts(); }
            else                { toast(d.errorMessage, 'err'); }
        });
}
