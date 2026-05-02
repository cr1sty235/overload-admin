function updatePopupPreview() {
    var msg = document.getElementById('popup-msg').value;
    var el  = document.getElementById('popup-preview');
    if (el) el.textContent = msg || 'Your message will appear here';
}

function sendPopup() {
    var msg = document.getElementById('popup-msg').value.trim();
    if (!msg) { toast('Enter a message', 'warn'); return; }
    if (!confirm('Send popup to all online players?\n\n"' + msg + '"')) return;

    api('send-popup', { message: msg })
        .then(function(d) {
            if (d.code === 200) { toast('Popup sent!'); loadCurrentPopup(); }
            else                { toast(d.errorMessage, 'err'); }
        })
        .catch(function(e) { toast(e.message, 'err'); });
}

function clearPopup() {
    if (!confirm('Clear the active popup? Players who haven\'t seen it yet won\'t see it.')) return;

    api('clear-popup', {})
        .then(function(d) {
            if (d.code === 200) { toast('Popup cleared', 'warn'); loadCurrentPopup(); }
            else                { toast(d.errorMessage, 'err'); }
        })
        .catch(function(e) { toast(e.message, 'err'); });
}

function loadCurrentPopup() {
    var el = document.getElementById('current-popup');
    if (!el) return;

    api('get-popup', {})
        .then(function(d) {
            var popup = d.data;
            if (!popup || !popup.message) {
                el.innerHTML = '<div class="empty">No active popup</div>';
                return;
            }

            el.innerHTML =
                '<div class="popup-preview">' + escapeHtml(popup.message) + '</div>' +
                '<div style="font-size:11px;color:var(--muted);margin-top:8px">Sent: ' + formatDate(popup.sentAt) + '</div>' +
                '<button class="btn-ghost btn-sm" style="margin-top:8px" onclick="clearPopup()">Clear</button>';
        })
        .catch(function() {
            if (el) el.innerHTML = '<div class="empty">Failed to load</div>';
        });
}
