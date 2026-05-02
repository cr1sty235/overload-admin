// ── State ──────────────────────────────────────────────────────────────────
var allCatalogItems  = [];
var selectedItemIds  = new Set();
var catalogTypeFilter = 'all';

// ── Load catalog ───────────────────────────────────────────────────────────

function loadCatalog() {
    document.getElementById('catalog-items').innerHTML =
        '<div class="empty" style="grid-column:1/-1">Loading catalog…</div>';

    api('get-catalog', { catalogVersion: '' })
        .then(function(d) {
            allCatalogItems = (d.data && d.data.Catalog) || [];
            updateCatalogCounts();
            filterCatalog();
        })
        .catch(function() {
            document.getElementById('catalog-items').innerHTML =
                '<div class="empty" style="grid-column:1/-1">Failed to load catalog</div>';
        });
}

function updateCatalogCounts() {
    var types = ['all', 'skin', 'wrap', 'charm', 'crate', 'other'];
    types.forEach(function(t) {
        var el = document.getElementById('cnt-' + t);
        if (el) {
            el.textContent = t === 'all'
                ? allCatalogItems.length
                : allCatalogItems.filter(function(i) { return itemType(i.ItemId) === t; }).length;
        }
    });
}

function setCatalogFilter(type) {
    catalogTypeFilter = type;
    document.querySelectorAll('.cat-filter').forEach(function(el) {
        el.classList.toggle('active', el.getAttribute('onclick').indexOf("'" + type + "'") > -1);
    });
    filterCatalog();
}

function filterCatalog() {
    var q = (document.getElementById('catalog-search') && document.getElementById('catalog-search').value || '').toLowerCase();

    var items = allCatalogItems;
    if (catalogTypeFilter !== 'all') items = items.filter(function(i) { return itemType(i.ItemId) === catalogTypeFilter; });
    if (q) items = items.filter(function(i) {
        return i.ItemId.toLowerCase().indexOf(q) > -1 || (i.DisplayName || '').toLowerCase().indexOf(q) > -1;
    });

    var el = document.getElementById('catalog-items');
    if (!el) return;

    if (!items.length) {
        el.innerHTML = '<div class="empty" style="grid-column:1/-1">No items match</div>';
        return;
    }

    el.innerHTML = items.map(function(item) {
        var type     = itemType(item.ItemId);
        var selected = selectedItemIds.has(item.ItemId);
        var vc       = item.VirtualCurrencyPrices;
        var price    = vc ? Object.keys(vc).map(function(c) { return vc[c] + ' ' + c; }).join(' / ') : '';

        return '<div class="catalog-card' + (selected ? ' selected' : '') + '" onclick="toggleCatalogItem(\'' + item.ItemId + '\')">' +
            '<div class="catalog-check">✓</div>' +
            tagHTML(type) +
            '<div class="catalog-card-name">' + escapeHtml(item.DisplayName || item.ItemId) + '</div>' +
            '<div class="catalog-card-id">'   + escapeHtml(item.ItemId) + '</div>' +
            (price ? '<div class="catalog-card-price">💰 ' + price + '</div>' : '') +
        '</div>';
    }).join('');

    var lbl = document.getElementById('selection-label');
    if (lbl) lbl.textContent = selectedItemIds.size ? selectedItemIds.size + ' selected' : '';
}

function toggleCatalogItem(itemId) {
    if (selectedItemIds.has(itemId)) selectedItemIds.delete(itemId);
    else                             selectedItemIds.add(itemId);
    filterCatalog();
}

function clearSelection() {
    selectedItemIds.clear();
    filterCatalog();
}

function grantSelected() {
    if (!selectedItemIds.size) { toast('Select at least one item', 'warn'); return; }

    var pfid    = document.getElementById('cat-pfid').value.trim();
    var catalog = document.getElementById('cat-ver').value.trim();

    if (!pfid) { toast('Enter a PlayFab ID in the sidebar', 'warn'); return; }

    var ids = Array.from(selectedItemIds);

    api('grant-items', { playFabId: pfid, itemIds: ids, catalogVersion: catalog })
        .then(function(d) {
            if (d.code === 200) {
                toast('Granted ' + ids.length + ' item(s) to ' + pfid);
                clearSelection();
            } else {
                toast(d.errorMessage, 'err');
            }
        })
        .catch(function(e) { toast(e.message, 'err'); });
}
