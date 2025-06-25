document.addEventListener('DOMContentLoaded', function() {
    // --- Discord login auto-search ---
    const params = new URLSearchParams(window.location.search);
    const userId = params.get('userId');
    if (userId) {
        document.getElementById('search-query').value = userId;
        document.getElementById('search-form').dispatchEvent(new Event('submit'));
    }

    // --- Admin sign in ---
    const adminSignInForm = document.getElementById('admin-signin-form');
    const adminPanel = document.getElementById('admin-panel');
    const adminSigninPanel = document.getElementById('admin-signin-panel');
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

    // --- Search ---
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
});
