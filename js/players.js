// ── State ──────────────────────────────────────────────────────────────────
var currentPlayer    = null;
var recentPlayers    = [];
var allInventory     = [];
var inventoryFilter  = 'all';
var inventorySearch  = '';

// ── Search ─────────────────────────────────────────────────────────────────

function searchPlayer() {
    var id = document.getElementById('player-search').value.trim();
    if (!id) return;

    Promise.all([
        api('lookup-player', { playFabId: id }),
        api('get-account',   { playFabId: id }),
    ]).then(function(results) {
        var profileRes = results[0];
        var accountRes = results[1];

        var profile = profileRes.data && profileRes.data.PlayerProfile;
        if (!profile) { toast('Player not found', 'err'); return; }

        currentPlayer = {
            playFabId:   id,
            displayName: profile.DisplayName || 'Unknown',
            lastLogin:   profile.LastLogin,
            created:     profile.Created,
            account:     accountRes.data && accountRes.data.UserInfo,
        };

        recentPlayers = [currentPlayer]
            .concat(recentPlayers.filter(function(p) { return p.playFabId !== id; }))
            .slice(0, 10);

        renderRecentList();
        renderPlayerDetail();
        toast('Loaded ' + currentPlayer.displayName);

    }).catch(function(e) { toast(e.message, 'err'); });
}

function loadRecentPlayer(pfid) {
    document.getElementById('player-search').value = pfid;
    searchPlayer();
}

// ── Recent list ────────────────────────────────────────────────────────────

function renderRecentList() {
    var el = document.getElementById('player-list');

    if (!recentPlayers.length) {
        el.innerHTML = '<div class="empty">No recent players</div>';
        return;
    }

    el.innerHTML = recentPlayers.map(function(p) {
        var active = currentPlayer && currentPlayer.playFabId === p.playFabId ? ' active' : '';
        return '<div class="list-item' + active + '" onclick="loadRecentPlayer(\'' + p.playFabId + '\')">' +
            '<div class="list-item-icon">' + p.displayName[0].toUpperCase() + '</div>' +
            '<div>' +
                '<div class="list-item-name">' + escapeHtml(p.displayName) + '</div>' +
                '<div class="list-item-sub">'  + p.playFabId + '</div>' +
            '</div>' +
        '</div>';
    }).join('');
}

// ── Player detail ──────────────────────────────────────────────────────────

function renderPlayerDetail() {
    var p   = currentPlayer;
    var det = document.getElementById('player-detail');

    det.innerHTML =
        '<div class="player-header">' +
            '<div class="player-avatar">' + p.displayName[0].toUpperCase() + '</div>' +
            '<div>' +
                '<h2>' + escapeHtml(p.displayName) + '</h2>' +
                '<div class="player-pfid">' + p.playFabId + '</div>' +
            '</div>' +
            '<div class="player-last-login">Last login<br><strong style="color:var(--text)">' + formatDate(p.lastLogin) + '</strong></div>' +
        '</div>' +

        '<div class="tabs">' +
            '<div class="tab active" onclick="switchPlayerTab(\'inv\')">📦 Inventory</div>' +
            '<div class="tab"        onclick="switchPlayerTab(\'cur\')">💰 Currency</div>' +
            '<div class="tab"        onclick="switchPlayerTab(\'ud\')">🗂 UserData</div>' +
            '<div class="tab"        onclick="switchPlayerTab(\'grant\')">🎁 Grant</div>' +
            '<div class="tab"        onclick="switchPlayerTab(\'ban\')">🚫 Bans</div>' +
        '</div>' +

        '<div id="ptab-inv"   class="tab-panel active"></div>' +
        '<div id="ptab-cur"   class="tab-panel"></div>' +
        '<div id="ptab-ud"    class="tab-panel"></div>' +
        '<div id="ptab-grant" class="tab-panel"></div>' +
        '<div id="ptab-ban"   class="tab-panel"></div>' +

        '<div class="card" style="margin-top:12px">' +
            '<div class="card-title">Action Log</div>' +
            '<div class="action-log" id="action-log"><span class="info">Ready.</span></div>' +
        '</div>';

    loadInventoryTab();
    loadCurrencyTab();
    loadUserDataTab();
    loadGrantTab();
    loadBanTab();
}

function switchPlayerTab(name) {
    var names = ['inv', 'cur', 'ud', 'grant', 'ban'];
    document.querySelectorAll('.tab').forEach(function(t, i) {
        t.classList.toggle('active', names[i] === name);
    });
    document.querySelectorAll('.tab-panel').forEach(function(p) {
        p.classList.toggle('active', p.id === 'ptab-' + name);
    });
}

// ── Inventory Tab ──────────────────────────────────────────────────────────

function loadInventoryTab() {
    var el = document.getElementById('ptab-inv');
    if (!el) return;
    el.innerHTML = '<div class="empty">Loading…</div>';

    api('get-inventory', { playFabId: currentPlayer.playFabId })
        .then(function(d) {
            allInventory = (d.data && d.data.Inventory) || [];
            renderInventoryTab();
        })
        .catch(function() {
            if (el) el.innerHTML = '<div class="empty">Failed to load inventory</div>';
        });
}

function renderInventoryTab() {
    var el = document.getElementById('ptab-inv');
    if (!el) return;

    var types = ['all', 'skin', 'wrap', 'charm', 'crate', 'other'];
    var filters = types.map(function(t) {
        var cnt   = t === 'all' ? allInventory.length : allInventory.filter(function(i) { return itemType(i.ItemId) === t; }).length;
        var label = t === 'all' ? 'All' : t.charAt(0).toUpperCase() + t.slice(1);
        var active = inventoryFilter === t ? ' active' : '';
        return '<div class="filter-btn' + active + '" onclick="setInvFilter(\'' + t + '\')">' + label + ' (' + cnt + ')</div>';
    }).join('');

    var items = allInventory;
    if (inventoryFilter !== 'all') items = items.filter(function(i) { return itemType(i.ItemId) === inventoryFilter; });
    if (inventorySearch) items = items.filter(function(i) { return i.ItemId.toLowerCase().indexOf(inventorySearch.toLowerCase()) > -1; });

    var rows = items.map(function(i) {
        return '<div class="inv-item">' +
            tagHTML(itemType(i.ItemId)) +
            '<div style="flex:1;min-width:0">' +
                '<div class="inv-item-name">' + escapeHtml(i.ItemId) + '</div>' +
                '<div class="inv-item-id">'   + i.ItemInstanceId + '</div>' +
            '</div>' +
            '<div class="inv-item-uses">' + (i.RemainingUses != null ? i.RemainingUses : '∞') + '</div>' +
            '<button class="btn-danger btn-sm" onclick="revokeItem(\'' + i.ItemInstanceId + '\')">Revoke</button>' +
        '</div>';
    }).join('');

    el.innerHTML =
        '<div class="card">' +
            '<div class="card-title">Inventory (' + allInventory.length + ' items) ' +
                '<button class="btn-ghost btn-sm" onclick="loadInventoryTab()">↻ Refresh</button>' +
            '</div>' +
            '<div class="inv-filters">' + filters + '</div>' +
            '<input class="inv-search" placeholder="Search items…" oninput="inventorySearch=this.value;renderInventoryTab()" value="' + escapeHtml(inventorySearch) + '">' +
            (rows || '<div class="empty">No items match</div>') +
        '</div>';
}

function setInvFilter(f) { inventoryFilter = f; renderInventoryTab(); }

function revokeItem(instanceId) {
    if (!confirm('Revoke item ' + instanceId + '?')) return;
    api('revoke-item', { playFabId: currentPlayer.playFabId, itemInstanceId: instanceId })
        .then(function(d) {
            if (d.code === 200) { appendLog('Revoked ' + instanceId, 'ok'); toast('Item revoked'); loadInventoryTab(); }
            else                { appendLog('Revoke failed: ' + d.errorMessage, 'err'); toast(d.errorMessage, 'err'); }
        })
        .catch(function(e) { appendLog(e.message, 'err'); });
}

// ── Currency Tab ───────────────────────────────────────────────────────────

function loadCurrencyTab() {
    var el = document.getElementById('ptab-cur');
    if (!el) return;

    var quickAmounts = [100, 500, 1000, 5000, 10000].map(function(a) {
        return '<div class="quick-amount" onclick="document.getElementById(\'cur-amount\').value=' + a + '">' + a.toLocaleString() + '</div>';
    }).join('');

    el.innerHTML =
        '<div class="card">' +
            '<div class="card-title">Balances <button class="btn-ghost btn-sm" onclick="refreshBalances()">↻ Refresh</button></div>' +
            '<div class="currencies" id="currency-balances"><span style="color:var(--muted);font-size:12px">Loading…</span></div>' +
        '</div>' +
        '<div class="card">' +
            '<div class="card-title">Add / Subtract</div>' +
            '<div class="row-2">' +
                '<div class="field"><label>Currency Code</label><input id="cur-code" placeholder="GD"></div>' +
                '<div class="field"><label>Amount</label><input id="cur-amount" type="number" placeholder="100" min="1"></div>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Quick amounts:</div>' +
            '<div class="quick-amounts">' + quickAmounts + '</div>' +
            '<div class="btn-row">' +
                '<button class="btn-success" onclick="changeCurrency(\'add\')">+ Add</button>' +
                '<button class="btn-danger"  onclick="changeCurrency(\'sub\')">− Subtract</button>' +
            '</div>' +
        '</div>';

    refreshBalances();
}

function refreshBalances() {
    var el = document.getElementById('currency-balances');
    if (!el) return;

    api('get-inventory', { playFabId: currentPlayer.playFabId })
        .then(function(d) {
            var vc = (d.data && d.data.VirtualCurrency) || {};
            el.innerHTML = Object.keys(vc).map(function(code) {
                return '<div class="currency-pill">' +
                    '<span class="amount">' + vc[code].toLocaleString() + '</span>' +
                    '<span class="code">' + code + '</span>' +
                '</div>';
            }).join('') || '<span style="color:var(--muted);font-size:12px">No currencies</span>';
        })
        .catch(function() {});
}

function changeCurrency(dir) {
    var code = document.getElementById('cur-code').value.trim();
    var amt  = parseInt(document.getElementById('cur-amount').value);
    if (!code || !amt || amt <= 0) { toast('Enter code and amount', 'warn'); return; }

    var endpoint = dir === 'add' ? 'add-currency' : 'subtract-currency';
    api(endpoint, { playFabId: currentPlayer.playFabId, currencyCode: code, amount: amt })
        .then(function(d) {
            if (d.code === 200) {
                appendLog((dir === 'add' ? 'Added ' : 'Subtracted ') + amt + ' ' + code, 'ok');
                toast((dir === 'add' ? '+' : '-') + amt + ' ' + code);
                refreshBalances();
            } else {
                appendLog(d.errorMessage, 'err');
                toast(d.errorMessage, 'err');
            }
        })
        .catch(function(e) { appendLog(e.message, 'err'); });
}

// ── UserData Tab ───────────────────────────────────────────────────────────

var allUserData = {};

function loadUserDataTab() {
    var el = document.getElementById('ptab-ud');
    if (!el) return;
    el.innerHTML = '<div class="empty">Loading…</div>';

    api('get-userdata', { playFabId: currentPlayer.playFabId })
        .then(function(d) {
            allUserData = (d.data && d.data.Data) || {};
            renderUserDataTab();
        })
        .catch(function() {
            if (el) el.innerHTML = '<div class="empty">Failed to load</div>';
        });
}

function renderUserDataTab() {
    var el = document.getElementById('ptab-ud');
    if (!el) return;

    var keys = Object.keys(allUserData);
    var rows = keys.map(function(k) {
        var v = allUserData[k].Value || '';
        return '<div class="userdata-row">' +
            '<div class="ud-key">' + escapeHtml(k) + '</div>' +
            '<div class="ud-val" onclick="editUserDataKey(\'' + escapeHtml(k) + '\',\'' + escapeHtml(v).replace(/'/g, '&#39;') + '\')">' +
                (v || '<em style="opacity:.4">empty</em>') +
            '</div>' +
            '<button class="btn-ghost btn-sm" onclick="editUserDataKey(\'' + escapeHtml(k) + '\',\'' + escapeHtml(v).replace(/'/g, '&#39;') + '\')">✏️</button>' +
        '</div>';
    }).join('');

    el.innerHTML =
        '<div class="card">' +
            '<div class="card-title">UserData (' + keys.length + ' keys) ' +
                '<button class="btn-ghost btn-sm" onclick="loadUserDataTab()">↻ Refresh</button>' +
            '</div>' +
            (rows || '<div class="empty">No UserData keys</div>') +
        '</div>' +
        '<div class="card">' +
            '<div class="card-title">Set / Update Key</div>' +
            '<div class="row-2">' +
                '<div class="field"><label>Key</label><input id="ud-key" placeholder="e.g. RPG_Skin"></div>' +
                '<div class="field"><label>Value</label><input id="ud-val" placeholder="e.g. RedDragon"></div>' +
            '</div>' +
            '<button class="btn-primary" onclick="setUserDataKey()">Set Key</button>' +
        '</div>';
}

function editUserDataKey(key, val) {
    switchPlayerTab('ud');
    document.getElementById('ud-key').value = key;
    document.getElementById('ud-val').value = val;
}

function setUserDataKey() {
    var key = document.getElementById('ud-key').value.trim();
    var val = document.getElementById('ud-val').value;
    if (!key) { toast('Enter a key', 'warn'); return; }

    var data = {};
    data[key] = val;

    api('set-userdata', { playFabId: currentPlayer.playFabId, data: data })
        .then(function(d) {
            if (d.code === 200) { appendLog('Set ' + key + ' = ' + val, 'ok'); toast('UserData updated'); loadUserDataTab(); }
            else                { appendLog(d.errorMessage, 'err'); toast(d.errorMessage, 'err'); }
        })
        .catch(function(e) { appendLog(e.message, 'err'); });
}

// ── Grant Tab ──────────────────────────────────────────────────────────────

function loadGrantTab() {
    var el = document.getElementById('ptab-grant');
    if (!el) return;

    el.innerHTML =
        '<div class="card">' +
            '<div class="card-title">Grant Items Directly</div>' +
            '<div class="field"><label>Catalog Version (blank = default)</label><input id="grant-cv" placeholder="main"></div>' +
            '<div class="field"><label>Item IDs (comma separated)</label><input id="grant-ids" placeholder="RPG_Skin_RedDragon, crate_common"></div>' +
            '<button class="btn-success" onclick="grantItemsDirect()">Grant Items</button>' +
        '</div>' +
        '<div class="card">' +
            '<div style="font-size:13px;color:var(--muted);line-height:1.6">' +
                '💡 Switch to the <strong style="color:var(--text)">Item Catalog</strong> tab to browse and visually select items to grant.' +
            '</div>' +
        '</div>';
}

function grantItemsDirect() {
    var ids = document.getElementById('grant-ids').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    var cv  = document.getElementById('grant-cv').value.trim();
    if (!ids.length) { toast('Enter at least one item ID', 'warn'); return; }

    api('grant-items', { playFabId: currentPlayer.playFabId, itemIds: ids, catalogVersion: cv })
        .then(function(d) {
            if (d.code === 200) { appendLog('Granted: ' + ids.join(', '), 'ok'); toast('Granted ' + ids.length + ' item(s)'); loadInventoryTab(); }
            else                { appendLog('Grant failed: ' + d.errorMessage, 'err'); toast(d.errorMessage, 'err'); }
        })
        .catch(function(e) { appendLog(e.message, 'err'); toast(e.message, 'err'); });
}

// ── Ban Tab ────────────────────────────────────────────────────────────────

function loadBanTab() {
    var el = document.getElementById('ptab-ban');
    if (!el) return;

    api('get-bans', { playFabId: currentPlayer.playFabId })
        .then(function(d) {
            var bans = ((d.data && d.data.BanData) || []).filter(function(b) { return b.Active; });

            var bansHtml = bans.length ? bans.map(function(b) {
                return '<div class="ban-item">' +
                    '<div style="flex:1">' +
                        '<div>' + escapeHtml(b.Reason || 'No reason') + '</div>' +
                        '<div class="ban-expiry">' + (b.Expires ? 'Expires: ' + formatDate(b.Expires) : 'Permanent') + '</div>' +
                    '</div>' +
                    '<button class="btn-ghost btn-sm" onclick="revokeBan(\'' + b.BanId + '\')">Revoke</button>' +
                '</div>';
            }).join('') : '<div class="empty">No active bans</div>';

            if (el) el.innerHTML =
                '<div class="card">' +
                    '<div class="card-title">Active Bans <button class="btn-ghost btn-sm" onclick="loadBanTab()">↻ Refresh</button></div>' +
                    bansHtml +
                '</div>' +
                '<div class="card">' +
                    '<div class="card-title">Issue Ban</div>' +
                    '<div class="field"><label>Reason</label><input id="ban-reason" placeholder="Cheating, toxicity…"></div>' +
                    '<div class="field"><label>Duration</label>' +
                        '<select id="ban-duration">' +
                            '<option value="0">Permanent</option>' +
                            '<option value="1">1 hour</option>' +
                            '<option value="24">24 hours</option>' +
                            '<option value="72">3 days</option>' +
                            '<option value="168">7 days</option>' +
                            '<option value="720">30 days</option>' +
                        '</select>' +
                    '</div>' +
                    '<button class="btn-danger" onclick="issueBan()">Issue Ban</button>' +
                '</div>';
        })
        .catch(function() {});
}

function revokeBan(banId) {
    api('revoke-ban', { banId: banId })
        .then(function(d) {
            if (d.code === 200) { appendLog('Revoked ban', 'ok'); toast('Ban revoked'); loadBanTab(); }
            else                { toast(d.errorMessage, 'err'); }
        });
}

function issueBan() {
    var reason   = document.getElementById('ban-reason').value.trim();
    var duration = parseInt(document.getElementById('ban-duration').value);
    if (!reason) { toast('Enter a reason', 'warn'); return; }

    var durLabel = duration === 0 ? 'PERMANENT' : duration + 'h';
    if (!confirm('Ban ' + currentPlayer.displayName + '?\nReason: ' + reason + '\nDuration: ' + durLabel)) return;

    api('ban-player', { playFabId: currentPlayer.playFabId, reason: reason, durationInHours: duration || null })
        .then(function(d) {
            if (d.code === 200) { appendLog('Banned ' + currentPlayer.displayName, 'ok'); toast(currentPlayer.displayName + ' banned'); loadBanTab(); }
            else                { appendLog(d.errorMessage, 'err'); toast(d.errorMessage, 'err'); }
        })
        .catch(function(e) { appendLog(e.message, 'err'); });
}
