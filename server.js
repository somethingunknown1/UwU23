require('dotenv').config(); // Load environment variables

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bodyParser = require('body-parser');
const pg = require('pg');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const app = express();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));
app.use(session({
  store: new pgSession({
    pool: pool, // your existing pg Pool
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// --- Discord OAuth endpoints (simplified) ---
app.get('/api/auth/discord', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID,
    redirect_uri: process.env.DISCORD_REDIRECT_URI,
    response_type: 'code',
    scope: 'identify guilds.members.read'
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params.toString()}`);
});

app.get('/api/auth/discord/callback', async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).send('No code provided from Discord.');

    try {
        // Exchange code for token
        const tokenRes = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: '1387208510156177458',
            client_secret: 'Yx8sPXybWUp4GMfUCqLfUtB2F2Sc6QYa',
            grant_type: 'authorization_code',
            code,
            redirect_uri: 'http://localhost:3000/api/auth/discord/callback',
            scope: 'identify guilds.members.read'
        }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const { access_token, token_type } = tokenRes.data;

        // Get user info
        const userRes = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `${token_type} ${access_token}` }
        });
        const user = userRes.data;

        // Get member info for your guild
                const guildMemberRes = await axios.get(
            `https://discord.com/api/users/@me/guilds/1383451713540980906/member`,
            { headers: { Authorization: `${token_type} ${access_token}` } }
                );
        const member = guildMemberRes.data;

                // Check for required role
        const hasAdminRole = member.roles.includes('1387209090631208972');

        // Save to session
        req.session.user = {
            username: user.username,
            userId: user.id,
            hasAdminRole
        };

        // Redirect to homepage (or search panel)
        res.redirect('/');
    } catch (err) {
        console.error('Discord OAuth2 error:', err.response ? err.response.data : err);
        res.status(500).send('Discord authentication failed.');
    }
});

// --- User session info ---
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  res.json(req.session.user);
});

// --- User profile ---
app.get('/api/me/profile', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { id } = req.session.user;
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// --- User bans ---
app.get('/api/me/bans', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { id } = req.session.user;
  const { rows } = await pool.query('SELECT * FROM ban_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1', [id]);
  if (!rows[0]) return res.json({ banned: false });
  res.json({ banned: true, reason: rows[0].changes?.reason || 'N/A' });
});

// --- User applications ---
app.get('/api/me/applications', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const { id } = req.session.user;
  const { rows } = await pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY date DESC', [id]);
  res.json(rows);
});

// --- Profile lookup ---
app.get('/api/users/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing search query' });
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE id::text = $1 OR LOWER(username) = LOWER($1) LIMIT 1', [q]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// Admin: Add or update user (requires adminPassword)
app.post('/api/users', (req, res) => {
    const { username, userId, notes, applications, adminUsername } = req.body;
    // No password check!
    if (!username || !userId) return res.status(400).json({ error: 'Missing username or userId' });
    let data = readData();
    let user = data.find(u => u.userId === userId);
    let action = '';
    let changes = {};
    if (user) {
        action = 'updated';
        if (user.username !== username) changes.username = { from: user.username, to: username };
        if (JSON.stringify(user.notes) !== JSON.stringify(notes)) changes.notes = { from: user.notes, to: notes };
        if (JSON.stringify(user.applications) !== JSON.stringify(applications)) changes.applications = { from: user.applications, to: applications };
        user.username = username;
        user.notes = notes || user.notes;
        user.applications = applications || user.applications;
    } else {
        action = 'added';
        user = { id: uuidv4(), username, userId, notes: notes || [], applications: applications || [] };
        data.push(user);
        changes = { username, userId, notes, applications };
    }
    writeData(data);

    // Log the action
    const logs = readAdminLogs();
    logs.push({
        timestamp: new Date().toISOString(),
        action,
        userId,
        admin: adminUsername || 'unknown',
        changes
    });
    writeAdminLogs(logs);

    res.json({ success: true, user });
});

// Admin: Get all users (for admin panel)
app.get('/api/users', (req, res) => {
    res.json(readData());
});

// Update a user profile in the JSON file
app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { username, notes, applications } = req.body;
  let data = readData();
  let user = data.find(u => u.id === id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  if (username) user.username = username;
  if (notes) user.notes = notes;
  if (applications) user.applications = applications;
  writeData(data);

  // Optionally log the update
  const logs = readAdminLogs();
  logs.push({
    timestamp: new Date().toISOString(),
    action: 'updated',
    userId: user.userId,
    admin: req.session?.user?.username || 'unknown',
    changes: { username, notes, applications }
  });
  writeAdminLogs(logs);

  res.json({ success: true, user });
});
app.put('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  const { username, notes } = req.body;
  try {
    await pool.query(
      'UPDATE users SET username = $1, notes = $2 WHERE id = $3',
      [username, notes, id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a ban log
app.post('/api/ban_logs', async (req, res) => {
  const { user_id, admin, action, changes } = req.body;
  try {
    await pool.query(
      'INSERT INTO ban_logs (user_id, admin, action, changes) VALUES ($1, $2, $3, $4)',
      [user_id, admin, action, changes]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add an application
app.post('/api/applications', async (req, res) => {
  const { user_id, status, reason } = req.body;
  try {
    await pool.query(
      'INSERT INTO applications (user_id, status, reason) VALUES ($1, $2, $3)',
      [user_id, status, reason]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
