// ── State ──────────────────────────────────────────────────────────────────
var composeMode = 'search';  // search | online | all
var messageType = 'mail';    // mail | grant | announcement
var onlineFilter = 'online';  // online | offline | both
var composeRecipients = [];        // [{ playFabId, displayName }]
var composeItems = new Set(); // item IDs
var onlinePlayers = [];        // from TitleData
var allComposeCatalog = [];
var composeSearchTimer = null;

// ── Init ───────────────────────────────────────────────────────────────────

function initComposePage() {
    if (!allComposeCatalog.length) loadComposeCatalog();
    loadComposeSentHistory();
    updateComposeSummary();
}

// ── Compose mode ───────────────────────────────────────────────────────────

function setComposeMode(mode) {
    composeMode = mode;
    var modes = ['search', 'online', 'all'];
    modes.forEach(function (m) {
        var btn = document.getElementById('cmode-' + m);
        var panel = document.getElementById('cmode-' + m + '-panel');
        if (btn) btn.classList.toggle('active', m === mode);
        if (panel) panel.style.display = m === mode ? 'block' : 'none';
    });
    if (mode === 'online') loadOnlineList();
    updateComposeSummary();
}

// ── Message type ───────────────────────────────────────────────────────────

function setMessageType(type) {
    messageType = type;
    var types = ['mail', 'grant', 'announcement'];
    types.forEach(function (t) {
        var btn = document.getElementById('mtype-' + t);
        if (btn) btn.classList.toggle('active', t === type);
    });

    var attachCard = document.getElementById('compose-attachments-card');
    if (attachCard) attachCard.style.display = type === 'grant' ? 'block' : 'none';

    var annNote = document.getElementById('mtype-announcement-note');
    if (annNote) annNote.style.display = type === 'announcement' ? 'block' : 'none';

    updateComposeSummary();
}

// ── Live search as you type ────────────────────────────────────────────────

function onComposeSearchInput() {
    clearTimeout(composeSearchTimer);
    var q = document.getElementById('compose-search-input').value.trim();

    if (!q) {
        document.getElementById('compose-search-results').innerHTML = '';
        return;
    }

    // Debounce 400ms so we don't hammer the API on every keystroke
    composeSearchTimer = setTimeout(function () { doComposeSearch(); }, 400);
}

function doComposeSearch() {
    var q = document.getElementById('compose-search-input').value.trim();
    var el = document.getElementById('compose-search-results');
    if (!q) return;

    el.innerHTML = '<div class="empty" style="padding:6px">Searching…</div>';

    var isHex = /^[0-9A-Fa-f]{12,20}$/.test(q);

    if (isHex) {
        api('lookup-player', { playFabId: q })
            .then(function (d) {
                var profile = d.data && d.data.PlayerProfile;
                if (!profile) { el.innerHTML = '<div class="empty" style="padding:6px">Not found</div>'; return; }
                renderComposeSearchResults(el, [{ playFabId: profile.PlayerId || q, displayName: profile.DisplayName || 'Unknown' }]);
            })
            .catch(function () { el.innerHTML = '<div class="empty" style="padding:6px">Search failed</div>'; });
    } else {
        api('search-players', { query: q })
            .then(function (d) {
                var results = d.data || [];
                if (!results.length) { el.innerHTML = '<div class="empty" style="padding:6px">No players found</div>'; return; }
                renderComposeSearchResults(el, results);
            })
            .catch(function () { el.innerHTML = '<div class="empty" style="padding:6px">Search failed</div>'; });
    }
}

function renderComposeSearchResults(el, results) {
    el.innerHTML = results.map(function (p) {
        var already = composeRecipients.some(function (r) { return r.playFabId === p.playFabId; });
        return '<div class="compose-result-item" onclick="' + (already ? '' : 'addComposeRecipient(\'' + p.playFabId + '\',\'' + escapeHtml(p.displayName) + '\')') + '">' +
            '<div style="flex:1">' +
            '<div class="cr-name">' + escapeHtml(p.displayName) + '</div>' +
            '<div class="cr-id">' + p.playFabId + '</div>' +
            '</div>' +
            (already
                ? '<span style="font-size:11px;color:var(--green)">✓</span>'
                : '<span style="font-size:11px;color:var(--accent)">+ Add</span>') +
            '</div>';
    }).join('');
}

// ── Recipients ─────────────────────────────────────────────────────────────

function addComposeRecipient(pfid, name) {
    if (composeRecipients.some(function (r) { return r.playFabId === pfid; })) return;
    composeRecipients.push({ playFabId: pfid, displayName: name });
    renderComposeRecipients();
    updateComposeSummary();
    // Refresh results to show checkmark
    var q = document.getElementById('compose-search-input').value.trim();
    if (q) doComposeSearch();
}

function removeComposeRecipient(pfid) {
    composeRecipients = composeRecipients.filter(function (r) { return r.playFabId !== pfid; });
    renderComposeRecipients();
    updateComposeSummary();
}

function clearComposeRecipients() {
    composeRecipients = [];
    renderComposeRecipients();
    updateComposeSummary();
}

function renderComposeRecipients() {
    var el = document.getElementById('compose-recipients-list');
    var count = document.getElementById('compose-recipients-count');
    if (count) count.textContent = composeRecipients.length;

    if (!composeRecipients.length) {
        el.innerHTML = '<div class="empty">No recipients selected</div>';
        return;
    }

    el.innerHTML = composeRecipients.map(function (p) {
        return '<div class="compose-recipient-item">' +
            '<div style="flex:1;min-width:0">' +
            '<div class="cr-name">' + escapeHtml(p.displayName) + '</div>' +
            '<div class="cr-id">' + p.playFabId + '</div>' +
            '</div>' +
            '<button class="btn-ghost btn-sm" onclick="removeComposeRecipient(\'' + p.playFabId + '\')">✕</button>' +
            '</div>';
    }).join('');
}

// ── Online players ─────────────────────────────────────────────────────────

var onlineFilter = 'online';

function setOnlineFilter(filter) {
    onlineFilter = filter;
    var filters = ['online', 'offline', 'both'];
    filters.forEach(function (f) {
        var btn = document.getElementById('online-filter-' + f);
        if (btn) btn.classList.toggle('active', f === filter);
    });
    renderOnlineList();
}

function loadOnlineList() {
    var el = document.getElementById('compose-online-list');
    if (!el) return;
    el.innerHTML = '<div class="empty">Loading…</div>';

    api('get-online-players', {}).then(function (d) {
        onlinePlayers = d.data || [];
        renderOnlineList();
    }).catch(function () {
        el.innerHTML = '<div class="empty">Failed — is OnlinePlayers TitleData key configured?</div>';
    });
}

function renderOnlineList() {
    var el = document.getElementById('compose-online-list');
    if (!el) return;

    if (!onlinePlayers.length) {
        el.innerHTML = '<div class="empty">No players found</div>';
        return;
    }

    el.innerHTML = onlinePlayers.map(function (p) {
        var already = composeRecipients.some(function (r) { return r.playFabId === p.playFabId; });
        return '<div class="compose-result-item" onclick="' + (already ? '' : 'addComposeRecipient(\'' + p.playFabId + '\',\'' + escapeHtml(p.displayName) + '\')') + '">' +
            '<div class="online-dot" style="width:7px;height:7px;background:var(--green);border-radius:50%;flex-shrink:0"></div>' +
            '<div style="flex:1;min-width:0">' +
            '<div class="cr-name">' + escapeHtml(p.displayName || p.playFabId) + '</div>' +
            '<div class="cr-id">' + p.playFabId + '</div>' +
            '</div>' +
            (already
                ? '<span style="font-size:11px;color:var(--green)">✓</span>'
                : '<span style="font-size:11px;color:var(--accent)">+ Add</span>') +
            '</div>';
    }).join('');
}

// ── Catalog items ──────────────────────────────────────────────────────────

function loadComposeCatalog() {
    var el = document.getElementById('compose-item-grid');
    if (el) el.innerHTML = '<div class="empty" style="grid-column:1/-1">Loading…</div>';

    api('get-catalog', { catalogVersion: '' }).then(function (d) {
        allComposeCatalog = (d.data && d.data.Catalog) || [];
        filterComposeItems();
    }).catch(function () {
        if (el) el.innerHTML = '<div class="empty" style="grid-column:1/-1">Failed</div>';
    });
}

function filterComposeItems() {
    var el = document.getElementById('compose-item-grid');
    if (!el) return;

    var q = (document.getElementById('compose-item-search') && document.getElementById('compose-item-search').value || '').toLowerCase();
    var items = allComposeCatalog;
    if (q) items = items.filter(function (i) {
        return i.ItemId.toLowerCase().indexOf(q) > -1 || (i.DisplayName || '').toLowerCase().indexOf(q) > -1;
    });

    if (!items.length) { el.innerHTML = '<div class="empty" style="grid-column:1/-1">No items</div>'; return; }

    el.innerHTML = items.slice(0, 50).map(function (item) {  // limit to 50 shown at once
        var sel = composeItems.has(item.ItemId);
        return '<div class="grant-catalog-card' + (sel ? ' selected' : '') + '" onclick="toggleComposeItem(\'' + item.ItemId + '\')">' +
            '<div class="gc-chk">✓</div>' +
            tagHTML(itemType(item.ItemId)) +
            '<div class="gc-name">' + escapeHtml(item.DisplayName || item.ItemId) + '</div>' +
            '<div class="gc-id">' + escapeHtml(item.ItemId) + '</div>' +
            '</div>';
    }).join('');
}

function toggleComposeItem(itemId) {
    if (composeItems.has(itemId)) composeItems.delete(itemId);
    else composeItems.add(itemId);
    filterComposeItems();
    renderComposeAttached();
    updateComposeSummary();
}

function clearComposeItems() {
    composeItems.clear();
    filterComposeItems();
    renderComposeAttached();
    updateComposeSummary();
}

function renderComposeAttached() {
    var el = document.getElementById('compose-attached-items');
    var count = document.getElementById('compose-items-count');
    if (count) count.textContent = composeItems.size;

    if (!composeItems.size) {
        el.innerHTML = '<div class="empty" style="padding:8px">None</div>';
        return;
    }

    el.innerHTML = Array.from(composeItems).map(function (id) {
        return '<div class="grant-selected-item">' +
            tagHTML(itemType(id)) +
            '<div class="gsi-name">' + escapeHtml(id) + '</div>' +
            '<button class="btn-ghost btn-sm" onclick="toggleComposeItem(\'' + id + '\')">✕</button>' +
            '</div>';
    }).join('');
}

// ── Summary ────────────────────────────────────────────────────────────────

function updateComposeSummary() {
    var el = document.getElementById('compose-summary');
    if (!el) return;

    var who = '';
    if (composeMode === 'search') who = composeRecipients.length ? composeRecipients.length + ' player(s)' : 'nobody selected';
    if (composeMode === 'online') who = 'online players';
    if (composeMode === 'all') who = 'ALL players (broadcast)';

    var type = messageType === 'grant' ? 'grant mail' : messageType === 'announcement' ? 'announcement' : 'mail';

    var curCode = (document.getElementById('compose-cur-code') && document.getElementById('compose-cur-code').value || '').trim();
    var curAmt = parseInt(document.getElementById('compose-cur-amount') && document.getElementById('compose-cur-amount').value || '0') || 0;

    var what = [];
    if (messageType === 'grant') {
        if (composeItems.size) what.push(composeItems.size + ' item(s)');
        if (curCode && curAmt > 0) what.push(curAmt + ' ' + curCode);
    }

    el.textContent = '→ Send ' + type + (what.length ? ' with ' + what.join(' + ') : '') + ' to ' + who;
}

// ── Execute Send ───────────────────────────────────────────────────────────

function executeSend() {
    var subject = (document.getElementById('compose-subject').value || '').trim();
    var body = (document.getElementById('compose-body').value || '').trim();
    var items = Array.from(composeItems);
    var curCode = (document.getElementById('compose-cur-code') && document.getElementById('compose-cur-code').value || '').trim();
    var curAmt = parseInt(document.getElementById('compose-cur-amount') && document.getElementById('compose-cur-amount').value || '0') || 0;

    if (!subject) { toast('Enter a subject', 'warn'); return; }

    // ── Announcement — fires popup immediately, optionally also mails ──
    if (messageType === 'announcement') {
        api('add-announcement', { title: subject, body: body })
            .then(function (d) {
                if (d.code === 200) {
                    composeLog('✓ Announcement posted', 'ok');
                    toast('Announcement posted!');
                    loadComposeSentHistory();
                } else {
                    composeLog('✗ ' + (d.errorMessage || 'failed'), 'err');
                    toast(d.errorMessage || 'Failed', 'err');
                }
            })
            .catch(function (e) { composeLog('✗ ' + e.message, 'err'); toast(e.message, 'err'); });
        return;
    }

    // ── Broadcast (All Players) ────────────────────────────────────────────
    if (composeMode === 'all') {
        if (!confirm('Send broadcast to ALL players?')) return;
        api('broadcast-mail', { subject: subject, body: body, itemIds: items, currencyCode: curCode, currencyAmt: curAmt })
            .then(function (d) {
                if (d.code === 200) {
                    composeLog('✓ Broadcast sent to all players', 'ok');
                    toast('Broadcast sent!');
                    resetComposeForm();
                    loadComposeSentHistory();
                } else {
                    composeLog('✗ ' + (d.errorMessage || 'failed'), 'err');
                    toast(d.errorMessage || 'Failed', 'err');
                }
            })
            .catch(function (e) { composeLog('✗ ' + e.message, 'err'); toast(e.message, 'err'); });
        return;
    }

    // ── Online players ─────────────────────────────────────────────────────
    var recipients = [];
    if (composeMode === 'online') {
        recipients = onlinePlayers;
        if (!recipients.length) { toast('No online players loaded — click Refresh', 'warn'); return; }
        if (!confirm('Send to ' + recipients.length + ' online player(s)?')) return;
    } else {
        recipients = composeRecipients;
        if (!recipients.length) { toast('Add at least one recipient', 'warn'); return; }
    }

    // ── Send to each recipient ─────────────────────────────────────────────
    var total = recipients.length;
    var done = 0;
    var failed = 0;

    composeLog('Sending to ' + total + ' player(s)…', 'info');

    recipients.forEach(function (p) {
        api('send-mail', {
            playFabId: p.playFabId,
            subject: subject,
            body: body,
            itemIds: items,
            currencyCode: curCode,
            currencyAmt: curAmt,
        }).then(function (d) {
            if (d.code === 200) {
                composeLog('✓ ' + p.displayName + ' (' + p.playFabId + ')', 'ok');
            } else {
                failed++;
                composeLog('✗ ' + p.displayName + ': ' + (d.errorMessage || 'failed'), 'err');
            }
            done++;
            if (done === total) {
                var msg = 'Done — ' + (total - failed) + '/' + total + ' sent.';
                composeLog(msg, failed > 0 ? 'err' : 'ok');
                toast(msg, failed > 0 ? 'warn' : 'ok');
                loadComposeSentHistory();
                if (failed === 0) resetComposeForm();
            }
        }).catch(function (e) {
            failed++;
            done++;
            composeLog('✗ ' + p.displayName + ': ' + e.message, 'err');
        });
    });
}

// ── Sent history ───────────────────────────────────────────────────────────

function loadComposeSentHistory() {
    var el = document.getElementById('compose-sent-history');
    if (!el) return;

    api('get-sent-log', {}).then(function (d) {
        var log = d.data || [];
        if (!log.length) { el.innerHTML = '<div class="empty">No history yet</div>'; return; }

        el.innerHTML = log.map(function (entry) {
            var badge = entry.type === 'broadcast'
                ? '<span class="broadcast-badge">BROADCAST</span> '
                : '';
            return '<div class="sent-history-item">' +
                '<div class="sh-subject">' + badge + escapeHtml(entry.subject) + '</div>' +
                '<div class="sh-meta">To: ' + escapeHtml(entry.to) + ' · ' + formatDate(entry.sentAt) + '</div>' +
                '</div>';
        }).join('');
    }).catch(function () {
        if (el) el.innerHTML = '<div class="empty">Failed to load</div>';
    });
}

// ── Reset form ─────────────────────────────────────────────────────────────

function resetComposeForm() {
    var subj = document.getElementById('compose-subject');
    var body = document.getElementById('compose-body');
    if (subj) subj.value = '';
    if (body) body.value = '';
    clearComposeItems();
    clearComposeRecipients();
    var cc = document.getElementById('compose-cur-code');
    var ca = document.getElementById('compose-cur-amount');
    if (cc) cc.value = '';
    if (ca) ca.value = '';
    updateComposeSummary();
}

// ── Log ────────────────────────────────────────────────────────────────────

function composeLog(msg, cls) {
    cls = cls || 'info';
    var el = document.getElementById('compose-log');
    if (!el) return;
    var t = new Date().toLocaleTimeString();
    el.innerHTML += '<br><span class="' + cls + '">[' + t + '] ' + escapeHtml(msg) + '</span>';
    el.scrollTop = el.scrollHeight;
}