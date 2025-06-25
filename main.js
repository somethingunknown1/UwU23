document.addEventListener('DOMContentLoaded', function() {
    // Navigation logic
    const homeLink = document.getElementById('home-link');
    const searchLink = document.getElementById('search-link');
    const adminLink = document.getElementById('admin-link');
    const mainContent = document.getElementById('main-content');
    const searchPanel = document.getElementById('search-panel');
    const adminSigninPanel = document.getElementById('admin-signin-panel');
    const adminPanel = document.getElementById('admin-panel');

    function showPanel(panel) {
        mainContent.style.display = 'none';
        searchPanel.style.display = 'none';
        adminSigninPanel.style.display = 'none';
        adminPanel.style.display = 'none';
        if (panel) panel.style.display = '';
    }

    homeLink.onclick = function(e) { e.preventDefault(); showPanel(mainContent); };
    searchLink.onclick = function(e) { e.preventDefault(); showPanel(searchPanel); };
    adminLink.onclick = function(e) { e.preventDefault(); showPanel(adminSigninPanel); };

    // Discord login
    const discordBtn = document.getElementById('discord-login-btn-home');
    if (discordBtn) {
        discordBtn.onclick = function() {
            window.location.href = '/api/auth/discord';
        };
    }

    // Auto-search after Discord login
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    if (userId) {
        showPanel(searchPanel);
        document.getElementById('search-query').value = userId;
        document.getElementById('search-form').dispatchEvent(new Event('submit'));
    }

    // Admin sign in
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
                showPanel(adminPanel);
            } else {
                document.getElementById('admin-signin-message').textContent = data.error || 'Login failed';
            }
        };
    }

    // Search logic
    const searchForm = document.getElementById('search-form');
    const searchResults = document.getElementById('search-results');
    if (searchForm) {
        searchForm.onsubmit = async function(e) {
            e.preventDefault();
            const q = document.getElementById('search-query').value.trim();
            if (!q) return;
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
            const users = await res.json();
            if (!users.length) {
                searchResults.textContent = 'No user found.';
                return;
            }
            const user = users[0];
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

    function renderKeycodePanel(user) {
        const keycodePanel = document.getElementById('keycode-panel');
        const keycodeResults = document.getElementById('keycode-results');
        keycodePanel.style.display = '';
        // Notes
        let notesHtml = `<strong>Notes:</strong><ul>`;
        (user.notes || []).forEach((n, i) => {
            notesHtml += `<li>
                <span id="note-text-${i}">${n}</span>
                <button onclick="editNote(${i})">Edit</button>
                <button onclick="deleteNote(${i})">Delete</button>
            </li>`;
        });
        notesHtml += `</ul>`;
        // Applications
        let appsHtml = `<strong>Applications:</strong><ul>`;
        (user.applications || []).forEach((a, i) => {
            appsHtml += `<li>
                <span id="app-text-${i}"><b>${a.status ? a.status.toUpperCase() : ''}</b> - ${a.reason || ''} ${a.date ? '(' + new Date(a.date).toLocaleString() + ')' : ''}</span>
                <button onclick="editApp(${i})">Edit</button>
                <button onclick="deleteApp(${i})">Delete</button>
            </li>`;
        });
        appsHtml += `</ul>`;
        keycodeResults.innerHTML = notesHtml + appsHtml;
    }

    document.getElementById('view-all-logs-btn').onclick = async function() {
        const panel = document.getElementById('all-logs-panel');
        const results = document.getElementById('all-logs-results');
        panel.style.display = '';
        const res = await fetch('/api/users');
        const users = await res.json();
        if (!users.length) {
            results.textContent = 'No users found.';
            return;
        }
        results.innerHTML = users.map(user => `
            <div class="user-log">
                <h4>${user.username} (${user.userId})</h4>
                <strong>Notes:</strong>
                <ul>${(user.notes||[]).map(n => `<li>${n}</li>`).join('')}</ul>
                <strong>Applications:</strong>
                <ul>
                    ${(user.applications||[]).map((a, i) =>
                        `<li>#${i+1}: <b>${a.status ? a.status.toUpperCase() : ''}</b> - ${a.reason || ''} ${a.date ? '(' + new Date(a.date).toLocaleString() + ')' : ''}</li>`
                    ).join('')}
                </ul>
            </div>
        `).join('');
    };
});
