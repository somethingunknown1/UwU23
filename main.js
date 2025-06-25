document.addEventListener('DOMContentLoaded', function() {
    // Discord login
    const btn = document.getElementById('discord-login-btn-home');
    if (btn) {
        btn.onclick = function() {
            window.location.href = '/api/auth/discord';
        };
    }

    // Auto-search after Discord login
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    if (userId) {
        document.getElementById('search-query').value = userId;
        document.getElementById('search-form').dispatchEvent(new Event('submit'));
    }

    // Admin sign in panel logic
    const adminSigninBtn = document.getElementById('admin-signin-btn');
    const adminSigninPanel = document.getElementById('admin-signin-panel');
    const adminPanel = document.getElementById('admin-panel');
    if (adminSigninBtn) {
        adminSigninBtn.onclick = function() {
            adminSigninPanel.style.display = '';
            adminPanel.style.display = 'none';
        };
    }

    // Admin login
    const adminSignInForm = document.getElementById('admin-signin-form');
    if (adminSignInForm) {
        adminSignInForm.onsubmit = async function(e) {
            e.preventDefault();
            const password = document.getElementById('admin-signin-password').value;
            const res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (data.success) {
                adminPanel.style.display = '';
                adminSigninPanel.style.display = 'none';
                document.getElementById('admin-warning').style.display = '';
            } else {
                document.getElementById('admin-signin-message').textContent = data.error || 'Login failed';
            }
        };
    }

    // Admin panel: load notes and app history on blur
    async function loadAdminUserData() {
        const username = document.getElementById('admin-username').value.trim();
        const userId = document.getElementById('admin-userid').value.trim();
        if (!username && !userId) return;
        let query = userId || username;
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        const users = await res.json();
        if (users && users.length > 0) {
            const user = users[0];
            document.getElementById('admin-notes').value = Array.isArray(user.notes) ? user.notes.join(', ') : (user.notes || '');
            let appHistory = '';
            if (user.applications && user.applications.length > 0) {
                appHistory = '<strong>Application History:</strong><ul>' +
                    user.applications.map((a, i) =>
                        `<li>#${i + 1}: <b>${a.status ? a.status.toUpperCase() : ''}</b> - ${a.reason || ''} ${a.date ? '(' + new Date(a.date).toLocaleString() + ')' : ''}</li>`
                    ).join('') +
                    '</ul>';
            } else {
                appHistory = '<strong>Application History:</strong> None';
            }
            document.getElementById('admin-app-history').innerHTML = appHistory;
        } else {
            document.getElementById('admin-notes').value = '';
            document.getElementById('admin-app-history').innerHTML = '<strong>Application History:</strong> None';
        }
    }
    document.getElementById('admin-username').addEventListener('blur', loadAdminUserData);
    document.getElementById('admin-userid').addEventListener('blur', loadAdminUserData);

    // Admin form submit
    const adminForm = document.getElementById('admin-form');
    if (adminForm) {
        adminForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value;
            const userId = document.getElementById('admin-userid').value;
            const notes = document.getElementById('admin-notes').value.split(',').map(n => n.trim()).filter(Boolean);
            const appStatus = document.getElementById('admin-app-status').value;
            const appReason = document.getElementById('admin-app-reason').value;
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username,
                    userId,
                    notes,
                    appStatus,
                    appReason
                })
            });
            const data = await res.json();
            document.getElementById('admin-message').textContent = data.success ? 'User saved!' : (data.error || 'Error');
            adminForm.reset();
        };
    }

    // Search and Keycode logic
    let lastSearchedUser = null;
    const searchForm = document.getElementById('search-form');
    const keycodeBtn = document.getElementById('keycode-btn');
    const keycodePanel = document.getElementById('keycode-panel');
    const keycodeResults = document.getElementById('keycode-results');
    const searchResults = document.getElementById('search-results');

    function showKeycodeButton(show) {
        if (keycodeBtn) keycodeBtn.style.display = show ? '' : 'none';
    }

    if (searchForm) {
        searchForm.onsubmit = async (e) => {
            e.preventDefault();
            const q = document.getElementById('search-query').value;
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
            const users = await res.json();
            if (!users.length) {
                searchResults.textContent = 'No user found.';
                showKeycodeButton(false);
                keycodePanel.style.display = 'none';
                lastSearchedUser = null;
                return;
            }
            const user = users[0];
            lastSearchedUser = user;
            showKeycodeButton(true);
            keycodePanel.style.display = 'none';
            let html = `<strong>Username:</strong> ${user.username}<br>`;
            html += `<strong>User ID:</strong> ${user.userId}<br>`;
            html += `<strong>Notes:</strong> <ul>${(user.notes||[]).map(n => `<li>${n}</li>`).join('')}</ul>`;
            if (user.applications && user.applications.length > 0) {
                html += `<strong>Applications:</strong><ul>`;
                user.applications.forEach((app, i) => {
                    html += `<li>#${i + 1}: <b>${app.status ? app.status.toUpperCase() : ''}</b> - ${app.reason || ''} ${app.date ? '(' + new Date(app.date).toLocaleString() + ')' : ''}</li>`;
                });
                html += `</ul>`;
            } else {
                html += `<strong>Applications:</strong> None<br>`;
            }
            searchResults.innerHTML = html;
        };
    }

    if (keycodeBtn) {
        keycodeBtn.onclick = function() {
            if (!lastSearchedUser) return;
            keycodePanel.style.display = '';
            let notesHtml = `<strong>Notes:</strong><ul>`;
            (lastSearchedUser.notes||[]).forEach((n, i) => {
                notesHtml += `<li>
                    <span id="note-text-${i}">${n}</span>
                    <button onclick="editNote(${i})">Edit</button>
                    <button onclick="deleteNote(${i})">Delete</button>
                </li>`;
            });
            notesHtml += `</ul>`;
            let appsHtml = `<strong>Applications:</strong><ul>`;
            (lastSearchedUser.applications||[]).forEach((a, i) => {
                appsHtml += `<li>
                    <span id="app-text-${i}"><b>${a.status ? a.status.toUpperCase() : ''}</b> - ${a.reason || ''} ${a.date ? '(' + new Date(a.date).toLocaleString() + ')' : ''}</span>
                    <button onclick="editApp(${i})">Edit</button>
                    <button onclick="deleteApp(${i})">Delete</button>
                </li>`;
            });
            appsHtml += `</ul>`;
            keycodeResults.innerHTML = notesHtml + appsHtml;
        };
    }

    // Helper functions for edit/delete (using window so inline onclick works)
    window.deleteNote = function(idx) {
        const reason = prompt("Why are you deleting this note?");
        if (!reason) return;
        if (!lastSearchedUser) return;
        fetch('/api/users/delete-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: lastSearchedUser.userId, noteIndex: idx, reason })
        }).then(() => location.reload());
    };
    window.editNote = function(idx) {
        const newNote = prompt("Edit note:", lastSearchedUser.notes[idx]);
        if (newNote === null) return;
        if (!lastSearchedUser) return;
        fetch('/api/users/edit-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: lastSearchedUser.userId, noteIndex: idx, newNote })
        }).then(() => location.reload());
    };
    window.deleteApp = function(idx) {
        const reason = prompt("Why are you deleting this application entry?");
        if (!reason) return;
        if (!lastSearchedUser) return;
        fetch('/api/users/delete-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: lastSearchedUser.userId, appIndex: idx, reason })
        }).then(() => location.reload());
    };
    window.editApp = function(idx) {
        const app = lastSearchedUser.applications[idx];
        const newStatus = prompt("Edit status (Pass/Fail):", app.status);
        if (newStatus === null) return;
        const newReason = prompt("Edit reason:", app.reason);
        if (newReason === null) return;
        if (!lastSearchedUser) return;
        fetch('/api/users/edit-app', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: lastSearchedUser.userId, appIndex: idx, newStatus, newReason })
        }).then(() => location.reload());
    };
});
