// ── Login / Logout ─────────────────────────────────────────────────────────

function doLogin() {
    var token = document.getElementById('i-token').value;
    setToken(token);

    // Test auth with a benign call
    api('lookup-player', { playFabId: 'test' })
        .catch(function (e) { return e; })
        .then(function (r) {
            if (r instanceof Error && r.message === 'Unauthorized') {
                document.getElementById('login-err').textContent = 'Invalid token.';
                setToken('');
                return;
            }

            document.getElementById('login').style.display = 'none';
            document.getElementById('app').style.display = 'flex';

            // Initial loads
            loadCatalog();
            loadPanicState();
        });
}

function doLogout() {
    setToken('');
    document.getElementById('login').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    document.getElementById('i-token').value = '';
    document.getElementById('login-err').textContent = '';
}

// ── Navigation ─────────────────────────────────────────────────────────────

function showPage(name) {
    // Match each nav tab by its own onclick value, not by index position.
    // This is safe even if the panic button or other non-tab elements are in the nav.
    document.querySelectorAll('.nav-tab').forEach(function (t) {
        var onclick = t.getAttribute('onclick') || '';
        t.classList.toggle('active', onclick.indexOf("'" + name + "'") > -1);
    });

    document.querySelectorAll('.page').forEach(function (p) {
        p.classList.toggle('active', p.id === 'page-' + name);
    });

    if (name === 'panic') loadPanicState();
    if (name === 'compose') initComposePage();
    if (name === 'announce') loadAnnouncements();
    if (name === 'popup') loadCurrentPopup();
}