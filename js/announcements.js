function postAnnouncement() {
    var title = document.getElementById('ann-title').value.trim();
    var body  = document.getElementById('ann-body').value.trim();
    var img   = document.getElementById('ann-img').value.trim();
    var type  = document.getElementById('ann-type').value;

    if (!title || !body) { toast('Enter title and body', 'warn'); return; }

    // Embed image tag so client can parse and render it
    var fullBody = body + (img ? '\n\n[img]' + img + '[/img]' : '');
    var fullTitle = '[' + type + '] ' + title;

    api('add-announcement', { title: fullTitle, body: fullBody })
        .then(function(d) {
            if (d.code === 200) {
                toast('Posted!');
                document.getElementById('ann-title').value = '';
                document.getElementById('ann-body').value  = '';
                document.getElementById('ann-img').value   = '';
                loadAnnouncements();
            } else {
                toast(d.errorMessage, 'err');
            }
        })
        .catch(function(e) { toast(e.message, 'err'); });
}

function loadAnnouncements() {
    var el = document.getElementById('ann-list');
    if (!el) return;
    el.innerHTML = '<div class="empty">Loading…</div>';

    api('get-announcements', {})
        .then(function(d) {
            var news = (d.data && d.data.News) || [];

            if (!news.length) { el.innerHTML = '<div class="empty">No announcements yet</div>'; return; }

            el.innerHTML = news.map(function(n) {
                // Render [img]url[/img] tags as actual images
                var bodyHtml = escapeHtml(n.Body)
                    .replace(/\[img\](.*?)\[\/img\]/g, function(match, url) {
                        return '<br><img src="' + url + '" style="max-width:100%;border-radius:6px;margin-top:8px">';
                    })
                    .replace(/\n/g, '<br>');

                return '<div class="announcement-item">' +
                    '<div class="ann-title-display">' + escapeHtml(n.Title) + '</div>' +
                    '<div class="ann-body-display">'  + bodyHtml + '</div>' +
                    '<div class="ann-meta">'          + formatDate(n.Timestamp) + '</div>' +
                '</div>';
            }).join('');
        })
        .catch(function() {
            if (el) el.innerHTML = '<div class="empty">Failed to load announcements</div>';
        });
}
