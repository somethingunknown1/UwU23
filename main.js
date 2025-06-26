document.addEventListener('DOMContentLoaded', function() {
    // Navigation
    function showPanel(panel) {
        [
            'main-content', 'profile-lookup-panel', 'ban-lookup-panel', 'application-lookup-panel',
            'admin-signin-panel', 'admin-panel'
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        if (panel) panel.style.display = '';
    }
    document.getElementById('home-link').onclick = e => { e.preventDefault(); showPanel(document.getElementById('main-content')); };
    document.getElementById('profile-lookup-link').onclick = e => { e.preventDefault(); showPanel(document.getElementById('profile-lookup-panel')); };
    document.getElementById('admin-link').onclick = e => { e.preventDefault(); showPanel(document.getElementById('admin-signin-panel')); };

    // Profile Lookup
    document.getElementById('profile-lookup-form').onsubmit = async function(e) {
        e.preventDefault();
        const q = document.getElementById('profile-lookup-query').value.trim();
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const users = await res.json();
        const resultsDiv = document.getElementById('profile-lookup-results');
        if (!users.length) {
            resultsDiv.textContent = 'No user found.';
            return;
        }
        const user = users[0];
        let html = `<strong>Username:</strong> ${user.username}<br>`;
        html += `<strong>User ID:</strong> ${user.userId}<br>`;
        html += `<strong>Notes:</strong> <ul>${(user.notes||[]).map(n => `<li>${n}</li>`).join('')}</ul>`;
        html += `<strong>Banned:</strong> ${user.banned ? 'Yes' : 'No'}<br>`;
        if (user.banReason) html += `<strong>Ban Reason:</strong> ${user.banReason}<br>`;
        html += `<strong>Applications:</strong><ul>`;
        (user.applications||[]).forEach((app, i) => {
            html += `<li>#${i+1}: <b>${app.status ? app.status.toUpperCase() : ''}</b> - ${app.reason || ''} ${app.date ? '(' + new Date(app.date).toLocaleString() + ')' : ''}</li>`;
        });
        html += `</ul>`;
        resultsDiv.innerHTML = html;
    };

    // Ban/Application Lookup navigation
    document.getElementById('ban-lookup-btn').onclick = () => showPanel(document.getElementById('ban-lookup-panel'));
    document.getElementById('application-lookup-btn').onclick = () => showPanel(document.getElementById('application-lookup-panel'));

    // Ban Lookup
    document.getElementById('ban-lookup-form').onsubmit = async function(e) {
        e.preventDefault();
        const q = document.getElementById('ban-lookup-query').value.trim();
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const users = await res.json();
        const resultsDiv = document.getElementById('ban-lookup-results');
        if (!users.length) {
            resultsDiv.textContent = 'No user found.';
            return;
        }
        const user = users[0];
        resultsDiv.innerHTML = `<strong>Banned:</strong> ${user.banned ? 'Yes' : 'No'}<br>${user.banReason ? `<strong>Ban Reason:</strong> ${user.banReason}` : ''}`;
    };

    // Application Lookup
    document.getElementById('application-lookup-form').onsubmit = async function(e) {
        e.preventDefault();
        const q = document.getElementById('application-lookup-query').value.trim();
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
        const users = await res.json();
        const resultsDiv = document.getElementById('application-lookup-results');
        if (!users.length) {
            resultsDiv.textContent = 'No user found.';
            return;
        }
        const user = users[0];
        let html = `<strong>Applications:</strong><ul>`;
        (user.applications||[]).forEach((app, i) => {
            html += `<li>#${i+1}: <b>${app.status ? app.status.toUpperCase() : ''}</b> - ${app.reason || ''} ${app.date ? '(' + new Date(app.date).toLocaleString() + ')' : ''}</li>`;
        });
        html += `</ul>`;
        resultsDiv.innerHTML = html;
    };

    // Admin Sign In
    document.getElementById('admin-signin-form').onsubmit = async function(e) {
        e.preventDefault();
        const password = document.getElementById('admin-signin-password').value;
        const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (data.success) {
            showPanel(document.getElementById('admin-panel'));
        } else {
            document.getElementById('admin-signin-message').textContent = data.error || 'Login failed';
        }
    };

    // Admin Panel Button Navigation
    document.getElementById('log-ban-btn').onclick = () => {
        hideAdminForms();
        document.getElementById('log-ban-form').style.display = '';
    };
    document.getElementById('log-application-btn').onclick = () => {
        hideAdminForms();
        document.getElementById('log-application-form').style.display = '';
    };
    document.getElementById('update-profile-btn').onclick = () => {
        hideAdminForms();
        document.getElementById('update-profile-form').style.display = '';
    };
    document.getElementById('view-logs-btn').onclick = () => {
        hideAdminForms();
        document.getElementById('logs-panel').style.display = '';
        loadLogs();
    };
    function hideAdminForms() {
        ['log-ban-form', 'log-application-form', 'update-profile-form', 'logs-panel'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    // Log a Ban
    document.getElementById('log-ban-form').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('ban-username').value;
        const userId = document.getElementById('ban-userid').value;
        const platform = document.getElementById('ban-platform').value;
        const reason = document.getElementById('ban-reason').value;
        await fetch('/api/users/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId, platform, reason })
        });
        document.getElementById('admin-message').textContent = 'Ban logged!';
        this.reset();
    };

    // Log an Application
    document.getElementById('log-application-form').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('app-username').value;
        const userId = document.getElementById('app-userid').value;
        const status = document.getElementById('app-status').value;
        const improve = document.getElementById('app-improve').value;
        await fetch('/api/users/application', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId, status, improve })
        });
        document.getElementById('admin-message').textContent = 'Application logged!';
        this.reset();
    };

    // Update a Profile
    document.getElementById('update-username').addEventListener('blur', loadUpdateProfile);
    document.getElementById('update-userid').addEventListener('blur', loadUpdateProfile);
    async function loadUpdateProfile() {
        const username = document.getElementById('update-username').value.trim();
        const userId = document.getElementById('update-userid').value.trim();
        if (!username && !userId) return;
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(userId || username)}`);
        const users = await res.json();
        const notesList = document.getElementById('update-notes-list');
        const banStatusDiv = document.getElementById('ban-status');
        if (!users.length) {
            notesList.innerHTML = '';
            banStatusDiv.innerHTML = '';
            return;
        }
        const user = users[0];
        document.getElementById('update-notes').value = Array.isArray(user.notes) ? user.notes.join(', ') : (user.notes || '');
        notesList.innerHTML = (user.notes||[]).map((note, i) => `
            <li>
                <span>${note}</span>
                <button type="button" onclick="editUpdateNote(${i})">Edit</button>
                <button type="button" onclick="deleteUpdateNote(${i})">Delete</button>
            </li>
        `).join('');
        if (user.banned) {
            banStatusDiv.innerHTML = `<strong>Banned:</strong> Yes <button type="button" id="revoke-ban-btn">Revoke Ban?</button>`;
            document.getElementById('revoke-ban-btn').onclick = async function() {
                const reason = prompt("Reason for revoking ban?");
                if (!reason) return;
                await fetch('/api/users/revoke-ban', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.userId, reason })
                });
                loadUpdateProfile();
            };
        } else {
            banStatusDiv.innerHTML = `<strong>Banned:</strong> No`;
        }
        window._updateUser = user;
    }
    window.editUpdateNote = async function(idx) {
        const user = window._updateUser;
        const newNote = prompt("Edit note:", user.notes[idx]);
        if (newNote === null) return;
        await fetch('/api/users/edit-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, noteIndex: idx, newNote })
        });
        loadUpdateProfile();
    };
    window.deleteUpdateNote = async function(idx) {
        const user = window._updateUser;
        if (!confirm("Delete this note?")) return;
        await fetch('/api/users/delete-note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.userId, noteIndex: idx, reason: "Admin deleted" })
        });
        loadUpdateProfile();
    };
    document.getElementById('update-profile-form').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('update-username').value;
        const userId = document.getElementById('update-userid').value;
        const notes = document.getElementById('update-notes').value.split(',').map(n => n.trim()).filter(Boolean);
        await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId, notes })
        });
        loadUpdateProfile();
        document.getElementById('admin-message').textContent = 'Profile updated!';
    };

    // View Logs
    async function loadLogs() {
        const res = await fetch('/api/logs');
        const logs = await res.json();
        document.getElementById('logs-results').innerHTML = logs.map(log =>
            `<div><b>${log.action}</b> by ${log.admin || 'system'} on ${new Date(log.date).toLocaleString()}<br>${log.details}</div>`
        ).join('<hr>');
    }
});
