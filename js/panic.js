var panicEnabled = false;

function loadPanicState() {
    api('get-panic', {})
        .then(function(d) {
            panicEnabled = d.data === true;
            updatePanicUI();
        })
        .catch(function() {});
}

function updatePanicUI() {
    var card    = document.getElementById('panic-card');
    var status  = document.getElementById('panic-status');
    var btn     = document.getElementById('panic-toggle-btn');
    var sub     = document.getElementById('panic-sub');
    var navBtn  = document.getElementById('panic-nav-btn');

    if (!card) return;

    if (panicEnabled) {
        card.classList.add('panic-on');
        if (status) { status.className = 'panic-status status-on'; status.textContent = 'SHUTDOWN ACTIVE'; }
        if (btn)    { btn.className = 'panic-toggle-btn on'; btn.textContent = 'Disable Panic Shutdown'; }
        if (sub)    { sub.textContent = 'All players are being disconnected. Disable when ready to restore service.'; }
        if (navBtn) { navBtn.classList.add('panic-on'); }
    } else {
        card.classList.remove('panic-on');
        if (status) { status.className = 'panic-status status-off'; status.textContent = 'ONLINE — All Good'; }
        if (btn)    { btn.className = 'panic-toggle-btn off'; btn.textContent = 'Enable Panic Shutdown'; }
        if (sub)    { sub.textContent = 'System is running normally.'; }
        if (navBtn) { navBtn.classList.remove('panic-on'); }
    }
}

function togglePanic() {
    var newState = !panicEnabled;
    var msg = newState
        ? 'ENABLE PANIC SHUTDOWN?\n\nThis will immediately disconnect ALL players from the game.'
        : 'Disable panic shutdown and restore service?\n\nPlayers will be able to connect again.';

    if (!confirm(msg)) return;

    api('set-panic', { enabled: newState })
        .then(function(d) {
            if (d.code === 200) {
                panicEnabled = newState;
                updatePanicUI();
                toast(
                    newState ? 'Panic shutdown ENABLED' : 'Panic shutdown disabled',
                    newState ? 'err' : 'ok'
                );
            } else {
                toast(d.errorMessage, 'err');
            }
        })
        .catch(function(e) { toast(e.message, 'err'); });
}
