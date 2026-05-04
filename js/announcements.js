function postAnnouncement() {
    var title = document.getElementById('ann-title').value.trim();
    var body = document.getElementById('ann-body').value.trim();
    var imageUrl = document.getElementById('ann-img').value.trim();

    if (!title || !body) { toast('Enter title and body', 'warn'); return; }

    api('add-announcement', { title: title, body: body, imageUrl: imageUrl })
        .then(function (d) {
            if (d.code === 200) {
                toast('Patch notes posted!');
                document.getElementById('ann-title').value = '';
                document.getElementById('ann-body').value = '';
                document.getElementById('ann-img').value = '';
                loadAnnouncements();
            } else {
                toast(d.errorMessage || 'Failed', 'err');
            }
        })
        .catch(function (e) { toast(e.message, 'err'); });
}

function loadAnnouncements() {
    var el = document.getElementById('ann-list');
    if (!el) return;
    el.innerHTML = '<div class="empty">Loading…</div>';

    api('get-announcements', {})
        .then(function (d) {
            var notes = d.data || [];

            if (!notes.length) {
                el.innerHTML = '<div class="empty">No patch notes yet</div>';
                return;
            }

            el.innerHTML = notes.map(function (n) {
                var bodyHtml = escapeHtml(n.body).replace(/\n/g, '<br>');
                var imgHtml = n.imageUrl
                    ? '<img src="' + escapeHtml(n.imageUrl) + '" style="max-width:100%;border-radius:6px;margin-top:8px">'
                    : '';

                return '<div class="announcement-item">' +
                    '<div class="ann-title-display">' + escapeHtml(n.title) + '</div>' +
                    '<div class="ann-body-display">' + bodyHtml + '</div>' +
                    imgHtml +
                    '<div class="ann-meta" style="display:flex;align-items:center;justify-content:space-between;margin-top:8px">' +
                    '<span>' + formatDate(n.postedAt) + '</span>' +
                    '<button class="btn-danger btn-sm" onclick="deleteAnnouncement(\'' + n.id + '\')">Delete</button>' +
                    '</div>' +
                    '</div>';
            }).join('');
        })
        .catch(function () {
            if (el) el.innerHTML = '<div class="empty">Failed to load</div>';
        });
}

function deleteAnnouncement(id) {
    if (!confirm('Delete this patch note?')) return;
    api('delete-announcement', { id: id })
        .then(function (d) {
            if (d.code === 200) { toast('Deleted', 'warn'); loadAnnouncements(); }
            else { toast(d.errorMessage || 'Failed', 'err'); }
        })
        .catch(function (e) { toast(e.message, 'err'); });
}