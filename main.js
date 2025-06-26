document.addEventListener('DOMContentLoaded', async function() {
  // Panel references (put these near the top, after DOMContentLoaded)
const mainContent = document.getElementById('main-content');
const adminPanel = document.getElementById('admin-panel');
const searchPanel = document.getElementById('search-panel');
const adminSignInPanel = document.getElementById('admin-signin-panel');
const logsPanel = document.getElementById('logs-panel');
const profilePanel = document.getElementById('profile-panel');
const applicationsPanel = document.getElementById('applications-panel');
const bansPanel = document.getElementById('bans-panel');

    // UI elements
    const adminLink = document.getElementById('admin-link');
    const searchLink = document.getElementById('search-link');
    const discordLoginDiv = document.getElementById('discord-login');
    const adminForm = document.getElementById('admin-form');
    const discordLoginBtn = document.getElementById('discord-login-btn');
    const adminSignInBtn = document.getElementById('admin-signin-btn');
    const adminSignInForm = document.getElementById('admin-signin-form');
    const adminSignInMessage = document.getElementById('admin-signin-message');
    // Logs button and panel
    let logsBtn = document.getElementById('logs-btn');
    if (!logsBtn) {
        logsBtn = document.createElement('button');
        logsBtn.id = 'logs-btn';
        logsBtn.textContent = 'Logs';
        logsBtn.style.display = 'none';
        logsBtn.style.marginLeft = '1em';
        document.querySelector('nav').appendChild(logsBtn);
    }
    if (!logsPanel) {
        logsPanel = document.createElement('div');
        logsPanel.id = 'logs-panel';
        logsPanel.className = 'container';
        logsPanel.style.display = 'none';
        logsPanel.innerHTML = `<h2>Admin Logs</h2><div id="logs-content"></div><button id="close-logs-btn" style="margin-top:1em;">Close</button>`;
        document.body.appendChild(logsPanel);
    }

    // Helper to show/hide panels
function showPanel(panel) {
    if (mainContent) mainContent.style.display = panel === 'main' ? '' : 'none';
    if (profilePanel) profilePanel.style.display = panel === 'profile' ? '' : 'none';
    if (applicationsPanel) applicationsPanel.style.display = panel === 'applications' ? '' : 'none';
    if (bansPanel) bansPanel.style.display = panel === 'bans' ? '' : 'none';
    if (adminPanel) adminPanel.style.display = panel === 'admin' ? '' : 'none';
    if (searchPanel) searchPanel.style.display = panel === 'search' ? '' : 'none';
    if (adminSignInPanel) adminSignInPanel.style.display = panel === 'admin-signin' ? '' : 'none';
    if (logsPanel) logsPanel.style.display = panel === 'logs' ? '' : 'none';
}

    // Navigation
    if (searchLink) searchLink.onclick = () => { showPanel('search'); return false; };
    const homeLink = document.querySelector('nav a[href="index.html"]');
    if (homeLink) homeLink.onclick = () => { showPanel('main'); return false; };

    const discordBtn = document.getElementById('discord-login-btn') || document.getElementById('discord-login-btn-home');
    if (discordBtn) {
      discordBtn.onclick = function() {
        window.location.href = '/api/auth/discord';
      };
    }

    // Check if user is logged in (fetch from backend)
    let user = null;
    let hasAdminRole = false;
    try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
            const data = await res.json();
            user = data;
            hasAdminRole = !!data.hasAdminRole;
        }
    } catch (e) {
        // Not logged in or error
    }

    if (user) {
        // Hide login, show search, show admin link if allowed
        if (discordLoginDiv) discordLoginDiv.style.display = 'none';
        if (adminForm) adminForm.style.display = hasAdminRole ? '' : 'none';
        if (adminLink) adminLink.style.display = hasAdminRole ? '' : 'none';
        showPanel('search');
        // Auto-search for the logged-in user
        const resultsDiv = document.getElementById('search-results');
        if (resultsDiv) {
            const res = await fetch(`/api/users/search?q=${encodeURIComponent(user.userId)}`);
            const users = await res.json();
            if (!users.length) {
                resultsDiv.textContent = 'No user found.';
            } else {
                resultsDiv.innerHTML = users.map(u => `
                    <div class="user-profile">
                        <h3>${u.username} (${u.userId})</h3>
                        <strong>Notes:</strong>
                        <ul>${(u.notes||[]).map(n => `<li>${n}</li>`).join('')}</ul>
                        <strong>Applications:</strong>
                        <ul>${(u.applications||[]).map(a => `<li>${a.status} - ${a.reason} (${a.date ? new Date(a.date).toLocaleString() : ''})</li>`).join('')}</ul>
                    </div>
                `).join('');
            }
        }
    } else {
        // Not logged in: show login, hide admin form, show main
        if (discordLoginDiv) discordLoginDiv.style.display = '';
        if (adminForm) adminForm.style.display = 'none';
        if (adminLink) adminLink.style.display = 'none';
        showPanel('main');
    }

    // Admin form submit
    if (adminForm) {
        adminForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value;
            const userId = document.getElementById('admin-userid').value;
            const notes = document.getElementById('admin-notes').value.split(',').map(n => n.trim()).filter(Boolean);
            const appStatus = document.getElementById('admin-app-status').value;
            const appReason = document.getElementById('admin-app-reason').value;
            const adminPassword = document.getElementById('admin-password') ? document.getElementById('admin-password').value : '';
            const applications = appStatus ? [{ status: appStatus, reason: appReason, date: new Date().toISOString() }] : [];
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, userId, notes, applications, adminPassword })
            });
            const data = await res.json();
            document.getElementById('admin-message').textContent = data.success ? 'User saved!' : (data.error || 'Error');
            adminForm.reset();
        };
    }

    // Search form submit
    const searchForm = document.getElementById('search-form');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (searchForm) {
      searchForm.onsubmit = async function (e) {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (!query) return;

        searchResults.textContent = 'Searching...';

        try {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
          if (!res.ok) throw new Error('User not found');
          const user = await res.json();

          // Display user info (customize as needed)
          searchResults.innerHTML = `
            <div class="profile-card">
              <h3>${user.username}</h3>
              <p>User ID: ${user.id}</p>
              <p>Notes: ${user.notes ? user.notes.join(', ') : 'None'}</p>
            </div>
          `;
        } catch (err) {
          searchResults.textContent = 'User not found.';
        }
      };
    }

    let adminSignedIn = false;
    let adminUsername = null;

    if (adminSignInBtn) {
        adminSignInBtn.onclick = () => { showPanel('admin-signin'); };
    }

    if (adminSignInForm) {
        adminSignInForm.onsubmit = async (e) => {
            e.preventDefault();
            const password = document.getElementById('admin-signin-password').value;
            if (password === 'Y$z4@Vq2#Lp1!eMx') {
                adminSignedIn = true;
                adminUsername = prompt("Enter your admin username for logs:", "admin");
                showPanel('admin');
                adminSignInMessage.textContent = '';
                document.getElementById('admin-username-display').textContent = adminUsername || 'admin';
                // Show admin panel and logs button, hide admin sign in button
                if (adminLink) adminLink.style.display = '';
                logsBtn.style.display = '';
                if (adminSignInBtn) adminSignInBtn.style.display = 'none';
                // Optionally, clear the password field
                document.getElementById('admin-signin-password').value = '';
            } else {
                adminSignInMessage.textContent = 'Incorrect password.';
            }
        };
    }

    if (adminLink) {
        adminLink.style.display = 'none';
        adminLink.onclick = () => { showPanel('admin'); return false; };
    }

    // Logs button (only after admin sign in)
    logsBtn.onclick = async () => {
        showPanel('logs');
        // Fetch logs from backend
        const logsContent = document.getElementById('logs-content');
        logsContent.textContent = 'Loading...';
        try {
            const res = await fetch('/api/admin/logs');
            const logs = await res.json();
            if (!logs.length) {
                logsContent.textContent = 'No logs found.';
            } else {
                logsContent.innerHTML = logs.map(log => `
                    <div class="log-entry" style="border-bottom:1px solid #ccc; margin-bottom:1em; padding-bottom:1em;">
                        <div><strong>Time:</strong> ${new Date(log.timestamp).toLocaleString()}</div>
                        <div><strong>Action:</strong> ${log.action}</div>
                        <div><strong>User ID:</strong> ${log.userId}</div>
                        <div><strong>Admin:</strong> ${log.admin}</div>
                        <div><strong>Changes:</strong>
                            <pre style="background:#f4f4f4; padding:0.5em; border-radius:4px;">${JSON.stringify(log.changes, null, 2)}</pre>
                        </div>
                    </div>
                `).join('');
            }
        } catch {
            logsContent.textContent = 'Failed to load logs.';
        }
    };

    // Close logs panel
    document.body.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'close-logs-btn') {
            showPanel('admin');
        }
    });

    // Admin form submit
    if (adminForm) {
        adminForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value;
            const userId = document.getElementById('admin-userid').value;
            const notes = document.getElementById('admin-notes').value.split(',').map(n => n.trim()).filter(Boolean);
            const appStatus = document.getElementById('admin-app-status').value;
            const appReason = document.getElementById('admin-app-reason').value;
            const adminPassword = document.getElementById('admin-password') ? document.getElementById('admin-password').value : '';
            const applications = appStatus ? [{ status: appStatus, reason: appReason, date: new Date().toISOString() }] : [];
            const res = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, userId, notes, applications, adminPassword, adminUsername })
            });
            const data = await res.json();
            document.getElementById('admin-message').textContent = data.success ? 'User saved!' : (data.error || 'Error');
            adminForm.reset();
        };
    }

    document.getElementById('profile-form').onsubmit = async function(e) {
        e.preventDefault();
        const username = document.getElementById('username-input').value;
        const notes = [document.getElementById('notes-input').value]; // Adjust as needed
        const userId = 1; // Replace with the actual user ID

        await fetch(`/api/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, notes })
        });
        // Optionally, show a success message or update the UI
    };

    async function addBanLog(userId, admin, action, changes) {
        try {
            const response = await fetch('/api/ban_logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: userId,      // integer, matches users.id
                    admin: admin,         // string, admin username
                    action: action,       // string, e.g. "Ban"
                    changes: changes      // object, e.g. { reason: "Rule violation" }
                })
            });
            if (response.ok) {
                // Optionally update UI or show a success message
                console.log('Ban log added!');
            } else {
                // Handle error
                console.error('Failed to add ban log');
            }
        } catch (err) {
            console.error('Error:', err);
        }
    }

    // Example usage (call this when a ban is issued)
    addBanLog(1, 'AdminName', 'Ban', { reason: 'Rule violation' });

    const adminTab = document.getElementById('admin-tab');

    if (adminTab && adminPanel) {
      adminTab.onclick = () => {
        // Hide other panels if needed
        mainContent.style.display = 'none';
        searchPanel.style.display = 'none';
        adminPanel.style.display = '';
      };
    }

    // Optionally, add navigation back to main/search
    const navHome = document.getElementById('nav-home');
    if (navHome) {
      navHome.onclick = () => {
        adminPanel.style.display = 'none';
        mainContent.style.display = '';
        searchPanel.style.display = 'none';
      };
    }

    // Run this after a successful login (e.g., after fetching /api/me)
    async function checkLogin() {
        const res = await fetch('/api/me');
        if (res.ok) {
            const user = await res.json();
            // Hide login button
            document.getElementById('discord-login-btn').style.display = 'none';
            // Show profile info
            document.getElementById('profile-menu-btn').style.display = 'flex';
            document.getElementById('profile-avatar').src = user.avatar;
            document.getElementById('profile-username').textContent = user.username;
            // If admin
            if (user.hasAdminRole || user.isAdmin) {
                document.getElementById('admin-panel-link').style.display = 'block';
            }
        } else {
            // Not logged in
            document.getElementById('discord-login-btn').style.display = 'block';
            document.getElementById('profile-menu-btn').style.display = 'none';
            document.getElementById('admin-panel-link').style.display = 'none';
        }
    }

    // Call this on page load
    checkLogin();

    // After fetching user profile:
    const resultsDiv = document.getElementById('search-results');
    if (resultsDiv && user) {
        resultsDiv.innerHTML = `
          <div>
            <strong>Username:</strong> ${user.username}<br>
            <strong>User ID:</strong> ${user.user_id}<br>
            <strong>Notes:</strong> ${user.notes && user.notes.length ? user.notes.join(', ') : 'None'}<br>
            <strong>Banned:</strong> ${user.banned ? 'Yes' : 'No'}<br>
            <strong>Ban Reason:</strong> ${user.ban_reason || 'N/A'}<br>
            <button id="view-apps-btn">View Applications</button>
            <button id="view-bans-btn">View Bans</button>
          </div>
        `;

        document.getElementById('view-apps-btn').onclick = async function() {
            const res = await fetch(`/api/users/${user.user_id}/applications`);
            const apps = await res.json();
            showModal('Applications', apps.length
                ? apps.map(a => `<div><strong>Status:</strong> ${a.status}<br><strong>Reason:</strong> ${a.reason}</div>`).join('<hr>')
                : '<div>No applications found.</div>');
        };
        document.getElementById('view-bans-btn').onclick = async function() {
            const res = await fetch(`/api/users/${user.user_id}/bans`);
            const bans = await res.json();
            showModal('Bans', bans.length
                ? bans.map(b => `<div><strong>Admin:</strong> ${b.admin}<br><strong>Reason:</strong> ${b.changes?.reason || 'N/A'}</div>`).join('<hr>')
                : '<div>No bans found.</div>');
        };
    }
const mainBtn = document.getElementById('main-btn');
if (mainBtn) mainBtn.onclick = () => showPanel('main');

const profileBtn = document.getElementById('profile-btn');
if (profileBtn) profileBtn.onclick = () => showPanel('profile');

const applicationsBtn = document.getElementById('applications-btn');
if (applicationsBtn) applicationsBtn.onclick = () => showPanel('applications');

const bansBtn = document.getElementById('bans-btn');
if (bansBtn) bansBtn.onclick = () => showPanel('bans');

const adminBtn = document.getElementById('admin-btn');
if (adminBtn) adminBtn.onclick = () => showPanel('admin');
});
