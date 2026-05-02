// ── Login / Logout ─────────────────────────────────────────────────────────

function doLogin() {
    var token = document.getElementById('i-token').value;
    setToken(token);

    // Test auth with a benign call
    api('lookup-player', { playFabId: 'test' })
        .catch(function(e) { return e; })
        .then(function(r) {
            if (r instanceof Error && r.message === 'Unauthorized') {
                document.getElementById('login-err').textContent = 'Invalid token.';
                setToken('');
                return;
            }

            document.getElementById('login').style.display = 'none';
            document.getElementById('app').style.display   = 'flex';

            // Initial loads
            loadCatalog();
            loadPanicState();
        });
}

function doLogout() {
    setToken('');
    document.getElementById('login').style.display = 'flex';
    document.getElementById('app').style.display   = 'none';
    document.getElementById('i-token').value       = '';
    document.getElementById('login-err').textContent = '';
}

// ── Navigation ─────────────────────────────────────────────────────────────

var pageNames = ['players', 'catalog', 'mail', 'announce', 'popup', 'panic'];

function showPage(name) {
    // Update nav tabs
    var tabs = document.querySelectorAll('.nav-tab');
    for (var i = 0; i < tabs.length; i++) {
        tabs[i].classList.toggle('active', pageNames[i] === name);
    }

    // Update pages
    var pages = document.querySelectorAll('.page');
    for (var j = 0; j < pages.length; j++) {
        pages[j].classList.toggle('active', pages[j].id === 'page-' + name);
    }

    // Page-specific init
    if (name === 'panic')    loadPanicState();
    if (name === 'mail')     { loadSentHistory(); loadBroadcasts(); renderMailSection('compose'); }
    if (name === 'announce') loadAnnouncements();
    if (name === 'popup')    loadCurrentPopup();
}
