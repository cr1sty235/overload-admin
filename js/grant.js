// ── State ──────────────────────────────────────────────────────────────────
var grantMode = 'single';       // single | selected | online | all
var grantSingleId = null;           // { playFabId, displayName }
var grantRecipients = [];             // [{ playFabId, displayName }] for 'selected'
var grantOnlinePlayers = [];           // [{ playFabId, displayName }] for 'online'
var grantSelectedItems = new Set();    // item IDs
var allGrantCatalog = [];             // full catalog cache

// ── Init ───────────────────────────────────────────────────────────────────

function initGrantPage() {
    if (!allGrantCatalog.length) loadGrantCatalog();
    updateGrantSummary();
}

// ── Mode switching ─────────────────────────────────────────────────────────

function setGrantMode(mode) {
    grantMode = mode;

    var modes = ['single', 'selected', 'online', 'all'];
    modes.forEach(function (m) {
        var btn = document.getElementById('gmode-' + m);
        var panel = document.getElementById('grant-' + m + '-panel');
        if (btn) btn.classList.toggle('active', m === mode);
        if (panel) panel.style.display = m === mode ? 'block' : 'none';
    });

    if (mode === 'online') loadOnlinePlayers();
    updateGrantSummary();
}

// ── Single player search ───────────────────────────────────────────────────

function grantSearchSingle() {
    var q = document.getElementById('grant-single-search').value.trim();
    var el = document.getElementById('grant-single-result');
    if (!q) return;

    el.innerHTML = '<div class="empty">Searching…</div>';

    var isHex = /^[0-9A-Fa-f]{12,20}$/.test(q);
    var searchFn = isHex
        ? api('lookup-player', { playFabId: q })
        : api('search-players', { query: q });

    if (isHex) {
        api('lookup-player', { playFabId: q }).then(function (d) {
            var profile = d.data && d.data.PlayerProfile;
            if (!profile) { el.innerHTML = '<div class="empty">Not found</div>'; return; }
            renderSingleResult(el, profile.PlayerId || q, profile.DisplayName || 'Unknown');
        }).catch(function () { el.innerHTML = '<div class="empty">Search failed</div>'; });
    } else {
        api('search-players', { query: q }).then(function (d) {
            var results = d.data || [];
            if (!results.length) { el.innerHTML = '<div class="empty">No players found</div>'; return; }
            el.innerHTML = results.map(function (p) {
                return '<div class="grant-recipient-item" style="cursor:pointer" onclick="selectSinglePlayer(\'' + p.playFabId + '\',\'' + escapeHtml(p.displayName) + '\')">' +
                    '<div style="flex:1"><div class="gr-name">' + escapeHtml(p.displayName) + '</div><div class="gr-id">' + p.playFabId + '</div></div>' +
                    '<button class="btn-primary btn-sm">Select</button>' +
                    '</div>';
            }).join('');
        }).catch(function () { el.innerHTML = '<div class="empty">Search failed</div>'; });
    }
}

function renderSingleResult(el, pfid, name) {
    el.innerHTML = '<div class="grant-recipient-item" style="cursor:pointer" onclick="selectSinglePlayer(\'' + pfid + '\',\'' + escapeHtml(name) + '\')">' +
        '<div style="flex:1"><div class="gr-name">' + escapeHtml(name) + '</div><div class="gr-id">' + pfid + '</div></div>' +
        '<button class="btn-primary btn-sm">Select</button>' +
        '</div>';
}

function selectSinglePlayer(pfid, name) {
    grantSingleId = { playFabId: pfid, displayName: name };
    var el = document.getElementById('grant-single-result');
    el.innerHTML = '<div class="grant-recipient-item" style="background:var(--accent-d);border:1px solid var(--accent)">' +
        '<div style="flex:1"><div class="gr-name">✓ ' + escapeHtml(name) + '</div><div class="gr-id">' + pfid + '</div></div>' +
        '<button class="btn-ghost btn-sm" onclick="grantSingleId=null;document.getElementById(\'grant-single-result\').innerHTML=\'\'">✕</button>' +
        '</div>';
    updateGrantSummary();
}

// ── Multi player search ────────────────────────────────────────────────────

function grantSearchMulti() {
    var q = document.getElementById('grant-multi-search').value.trim();
    var el = document.getElementById('grant-multi-results');
    if (!q) return;

    el.innerHTML = '<div class="empty">Searching…</div>';

    var isHex = /^[0-9A-Fa-f]{12,20}$/.test(q);

    if (isHex) {
        api('lookup-player', { playFabId: q }).then(function (d) {
            var profile = d.data && d.data.PlayerProfile;
            if (!profile) { el.innerHTML = '<div class="empty">Not found</div>'; return; }
            renderMultiResults(el, [{ playFabId: profile.PlayerId || q, displayName: profile.DisplayName || 'Unknown' }]);
        }).catch(function () { el.innerHTML = '<div class="empty">Search failed</div>'; });
    } else {
        api('search-players', { query: q }).then(function (d) {
            var results = d.data || [];
            if (!results.length) { el.innerHTML = '<div class="empty">No players found</div>'; return; }
            renderMultiResults(el, results);
        }).catch(function () { el.innerHTML = '<div class="empty">Search failed</div>'; });
    }
}

function renderMultiResults(el, results) {
    el.innerHTML = results.map(function (p) {
        var already = grantRecipients.some(function (r) { return r.playFabId === p.playFabId; });
        return '<div class="grant-recipient-item">' +
            '<div style="flex:1"><div class="gr-name">' + escapeHtml(p.displayName) + '</div><div class="gr-id">' + p.playFabId + '</div></div>' +
            (already
                ? '<span style="font-size:11px;color:var(--green)">✓ Added</span>'
                : '<button class="btn-primary btn-sm" onclick="addGrantRecipient(\'' + p.playFabId + '\',\'' + escapeHtml(p.displayName) + '\')">Add</button>') +
            '</div>';
    }).join('');
}

function addGrantRecipient(pfid, name) {
    if (grantRecipients.some(function (r) { return r.playFabId === pfid; })) return;
    grantRecipients.push({ playFabId: pfid, displayName: name });
    renderGrantRecipients();
    updateGrantSummary();
    // Refresh search results to show checkmark
    var q = document.getElementById('grant-multi-search').value.trim();
    if (q) grantSearchMulti();
}

function removeGrantRecipient(pfid) {
    grantRecipients = grantRecipients.filter(function (r) { return r.playFabId !== pfid; });
    renderGrantRecipients();
    updateGrantSummary();
}

function clearGrantRecipients() {
    grantRecipients = [];
    renderGrantRecipients();
    updateGrantSummary();
}

function renderGrantRecipients() {
    var el = document.getElementById('grant-recipients-list');
    var count = document.getElementById('grant-selected-count');
    if (count) count.textContent = grantRecipients.length;

    if (!grantRecipients.length) {
        el.innerHTML = '<div class="empty">No players selected</div>';
        return;
    }

    el.innerHTML = grantRecipients.map(function (p) {
        return '<div class="grant-recipient-item">' +
            '<div style="flex:1"><div class="gr-name">' + escapeHtml(p.displayName) + '</div><div class="gr-id">' + p.playFabId + '</div></div>' +
            '<button class="btn-ghost btn-sm" onclick="removeGrantRecipient(\'' + p.playFabId + '\')">✕</button>' +
            '</div>';
    }).join('');
}

// ── Online players ─────────────────────────────────────────────────────────

function loadOnlinePlayers() {
    var el = document.getElementById('grant-online-list');
    if (!el) return;
    el.innerHTML = '<div class="empty">Loading…</div>';

    api('get-online-players', {}).then(function (d) {
        grantOnlinePlayers = d.data || [];
        if (!grantOnlinePlayers.length) {
            el.innerHTML = '<div class="empty">No players currently online</div>';
            return;
        }
        el.innerHTML = grantOnlinePlayers.map(function (p) {
            return '<div class="online-player-item">' +
                '<div class="online-dot"></div>' +
                '<div style="flex:1"><div class="gr-name">' + escapeHtml(p.displayName || p.playFabId) + '</div><div class="gr-id">' + p.playFabId + '</div></div>' +
                '</div>';
        }).join('');
        updateGrantSummary();
    }).catch(function () {
        el.innerHTML = '<div class="empty">Failed to load — is OnlinePlayers TitleData key set up?</div>';
    });
}

// ── Catalog ────────────────────────────────────────────────────────────────

function loadGrantCatalog() {
    var el = document.getElementById('grant-catalog-grid');
    if (el) el.innerHTML = '<div class="empty">Loading…</div>';

    api('get-catalog', { catalogVersion: '' }).then(function (d) {
        allGrantCatalog = (d.data && d.data.Catalog) || [];
        filterGrantCatalog();
    }).catch(function () {
        if (el) el.innerHTML = '<div class="empty">Failed to load catalog</div>';
    });
}

function filterGrantCatalog() {
    var el = document.getElementById('grant-catalog-grid');
    if (!el) return;

    var q = (document.getElementById('grant-item-search') && document.getElementById('grant-item-search').value || '').toLowerCase();
    var items = allGrantCatalog;
    if (q) items = items.filter(function (i) {
        return i.ItemId.toLowerCase().indexOf(q) > -1 || (i.DisplayName || '').toLowerCase().indexOf(q) > -1;
    });

    if (!items.length) { el.innerHTML = '<div class="empty">No items match</div>'; return; }

    el.innerHTML = items.map(function (item) {
        var sel = grantSelectedItems.has(item.ItemId);
        return '<div class="grant-catalog-card' + (sel ? ' selected' : '') + '" onclick="toggleGrantItem(\'' + item.ItemId + '\')">' +
            '<div class="gc-chk">✓</div>' +
            tagHTML(itemType(item.ItemId)) +
            '<div class="gc-name">' + escapeHtml(item.DisplayName || item.ItemId) + '</div>' +
            '<div class="gc-id">' + escapeHtml(item.ItemId) + '</div>' +
            '</div>';
    }).join('');
}

function toggleGrantItem(itemId) {
    if (grantSelectedItems.has(itemId)) grantSelectedItems.delete(itemId);
    else grantSelectedItems.add(itemId);
    filterGrantCatalog();
    renderGrantSelectedItems();
    updateGrantSummary();
}

function clearGrantItems() {
    grantSelectedItems.clear();
    filterGrantCatalog();
    renderGrantSelectedItems();
    updateGrantSummary();
}

function renderGrantSelectedItems() {
    var el = document.getElementById('grant-selected-items');
    var count = document.getElementById('grant-items-count');
    if (count) count.textContent = grantSelectedItems.size;

    if (!grantSelectedItems.size) {
        el.innerHTML = '<div class="empty" style="padding:10px">No items selected</div>';
        return;
    }

    el.innerHTML = Array.from(grantSelectedItems).map(function (id) {
        return '<div class="grant-selected-item">' +
            tagHTML(itemType(id)) +
            '<div class="gsi-name">' + escapeHtml(id) + '</div>' +
            '<button class="btn-ghost btn-sm" onclick="toggleGrantItem(\'' + id + '\')">✕</button>' +
            '</div>';
    }).join('');
}

// ── Summary ────────────────────────────────────────────────────────────────

function updateGrantSummary() {
    var el = document.getElementById('grant-summary');
    if (!el) return;

    var items = Array.from(grantSelectedItems);
    var curCode = (document.getElementById('grant-cur-code') && document.getElementById('grant-cur-code').value || '').trim();
    var curAmt = parseInt(document.getElementById('grant-cur-amount') && document.getElementById('grant-cur-amount').value || '0') || 0;

    var who = '';
    if (grantMode === 'single') who = grantSingleId ? '1 player: ' + grantSingleId.displayName : 'No player selected';
    if (grantMode === 'selected') who = grantRecipients.length + ' selected player(s)';
    if (grantMode === 'online') who = grantOnlinePlayers.length + ' online player(s)';
    if (grantMode === 'all') who = 'ALL players (via broadcast mail)';

    var what = [];
    if (items.length) what.push(items.length + ' item(s)');
    if (curCode && curAmt > 0) what.push(curAmt + ' ' + curCode);

    el.textContent = '→ Grant ' + (what.length ? what.join(' + ') : 'nothing') + ' to ' + who;
}

// ── Execute grant ──────────────────────────────────────────────────────────

function executeGrant() {
    var items = Array.from(grantSelectedItems);
    var curCode = (document.getElementById('grant-cur-code').value || '').trim();
    var curAmt = parseInt(document.getElementById('grant-cur-amount').value || '0') || 0;
    var cv = (document.getElementById('grant-catalog-version').value || '').trim();

    if (!items.length && (!curCode || !curAmt)) {
        toast('Select at least one item or enter a currency amount', 'warn');
        return;
    }

    if (grantMode === 'single') {
        if (!grantSingleId) { toast('Select a player first', 'warn'); return; }
        doGrant([grantSingleId], items, curCode, curAmt, cv);
    }

    else if (grantMode === 'selected') {
        if (!grantRecipients.length) { toast('Add at least one player', 'warn'); return; }
        doGrant(grantRecipients, items, curCode, curAmt, cv);
    }

    else if (grantMode === 'online') {
        if (!grantOnlinePlayers.length) { toast('No online players loaded', 'warn'); return; }
        if (!confirm('Grant to ' + grantOnlinePlayers.length + ' online player(s)?')) return;
        doGrant(grantOnlinePlayers, items, curCode, curAmt, cv);
    }

    else if (grantMode === 'all') {
        var subject = (document.getElementById('grant-all-subject').value || '').trim();
        var message = (document.getElementById('grant-all-message').value || '').trim();
        if (!subject) { toast('Enter a broadcast subject', 'warn'); return; }
        if (!confirm('Broadcast to ALL players?')) return;
        doGrantAll(subject, message, items, curCode, curAmt);
    }
}

// ── Grant to a list of players ─────────────────────────────────────────────

function doGrant(recipients, items, curCode, curAmt, cv) {
    var total = recipients.length;
    var done = 0;
    var failed = 0;

    grantLog('Granting to ' + total + ' player(s)…', 'info');

    recipients.forEach(function (p) {
        var calls = [];

        if (items.length) {
            calls.push(api('grant-items', { playFabId: p.playFabId, itemIds: items, catalogVersion: cv }));
        }

        if (curCode && curAmt > 0) {
            calls.push(api('add-currency', { playFabId: p.playFabId, currencyCode: curCode, amount: curAmt }));
        }

        Promise.all(calls).then(function (results) {
            var allOk = results.every(function (r) { return r.code === 200; });
            if (allOk) {
                grantLog('✓ ' + p.displayName + ' (' + p.playFabId + ')', 'ok');
            } else {
                failed++;
                grantLog('✗ ' + p.displayName + ': ' + (results.find(function (r) { return r.code !== 200; }) || {}).errorMessage, 'err');
            }
            done++;
            if (done === total) {
                var msg = 'Done — ' + (total - failed) + '/' + total + ' succeeded.';
                grantLog(msg, failed > 0 ? 'err' : 'ok');
                toast(msg, failed > 0 ? 'warn' : 'ok');
            }
        }).catch(function (e) {
            failed++;
            done++;
            grantLog('✗ ' + p.displayName + ': ' + e.message, 'err');
        });
    });
}

// ── Grant to all via broadcast mail ───────────────────────────────────────

function doGrantAll(subject, message, items, curCode, curAmt) {
    api('broadcast-mail', {
        subject: subject,
        body: message,
        itemIds: items,
        currencyCode: curCode,
        currencyAmt: curAmt,
    }).then(function (d) {
        if (d.code === 200) {
            grantLog('✓ Broadcast sent to all players', 'ok');
            toast('Broadcast sent!');
        } else {
            grantLog('✗ ' + d.errorMessage, 'err');
            toast(d.errorMessage, 'err');
        }
    }).catch(function (e) { grantLog('✗ ' + e.message, 'err'); toast(e.message, 'err'); });
}

// ── Log ────────────────────────────────────────────────────────────────────

function grantLog(msg, cls) {
    cls = cls || 'info';
    var el = document.getElementById('grant-log');
    if (!el) return;
    var t = new Date().toLocaleTimeString();
    el.innerHTML += '<br><span class="' + cls + '">[' + t + '] ' + escapeHtml(msg) + '</span>';
    el.scrollTop = el.scrollHeight;
}