require('dotenv').config(); // Load environment variables

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const axios = require('axios');
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
const app = express();
const PORT = 3000;
const DATA_FILE = './users.json';
const ADMIN_LOG_FILE = './admin-logs.json';

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('.'));
app.use(session({
    secret: 'your-very-secret-key', // change this to something secure
    resave: false,
    saveUninitialized: false
}));

// Helper to read/write data
function readData() {
    if (!fs.existsSync(DATA_FILE)) return [];
    return JSON.parse(fs.readFileSync(DATA_FILE));
}
function writeData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readAdminLogs() {
    if (!fs.existsSync(ADMIN_LOG_FILE)) return [];
    return JSON.parse(fs.readFileSync(ADMIN_LOG_FILE));
}
function writeAdminLogs(logs) {
    fs.writeFileSync(ADMIN_LOG_FILE, JSON.stringify(logs, null, 2));
}

// Admin: Add or update user (append application results and merge notes)
app.post('/api/users', async (req, res) => {
  const { username, userId, notes } = req.body;
  await pool.query(
    `INSERT INTO users (username, user_id, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET username = $1, notes = $3`,
    [username, userId, notes]
  );
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'profile_update', $2, $3)`,
    [userId, `Updated profile for ${username}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

// Admin login endpoint
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === process.env.ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        res.json({ success: true });
    } else {
        res.json({ success: false, error: 'Incorrect password' });
    }
});

// User search endpoint
app.get('/api/users/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json([]);
  const result = await pool.query(
    'SELECT * FROM users WHERE user_id = $1 OR LOWER(username) = LOWER($1) LIMIT 1',
    [q]
  );
  res.json(result.rows);
});

// Admin: Get all users (for admin panel)
app.get('/api/users', (req, res) => {
    res.json(readData());
});

app.get('/api/auth/discord', (req, res) => {
    const params = new URLSearchParams({
        client_id: '1387208510156177458',
        redirect_uri: 'https://uwu23-production.up.railway.app/api/auth/discord/callback',
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
            redirect_uri: 'https://uwu23-production.up.railway.app/api/auth/discord/callback',
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
        res.redirect(`/index.html?userId=${user.id}`);
    } catch (err) {
        console.error('Discord OAuth2 error:', err.response ? err.response.data : err);
        res.status(500).send('Discord authentication failed.');
    }
});

app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json(req.session.user);
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

// New session endpoint
app.get('/api/auth/session', (req, res) => {
    // Example: req.session.user = { id, username, roles: [roleId1, roleId2], ... }
    // You must set this in your Discord OAuth callback!
    res.json({
        user: req.session.user || null,
        discordRoleId: process.env.DISCORD_ROLE_ID
    });
});

// Endpoint to get admin logs
app.get('/api/admin/logs', (req, res) => {
    res.json(readAdminLogs());
});

// Edit Note
app.post('/api/users/edit-note', async (req, res) => {
  const { userId, noteIndex, newNote } = req.body;
  if (!userId || typeof noteIndex !== 'number' || typeof newNote !== 'string') {
    return res.status(400).json({ error: 'Missing data' });
  }
  const userResult = await pool.query('SELECT notes FROM users WHERE user_id = $1', [userId]);
  let notes = userResult.rows[0]?.notes || [];
  if (!notes[noteIndex]) return res.status(404).json({ error: 'Note not found' });
  notes[noteIndex] = newNote;
  await pool.query('UPDATE users SET notes = $1 WHERE user_id = $2', [notes, userId]);
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'edit_note', $2, $3)`,
    [userId, `Edited note #${noteIndex + 1}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

// Delete Note
app.post('/api/users/delete-note', async (req, res) => {
  const { userId, noteIndex, reason } = req.body;
  if (!userId || typeof noteIndex !== 'number') {
    return res.status(400).json({ error: 'Missing data' });
  }
  const userResult = await pool.query('SELECT notes FROM users WHERE user_id = $1', [userId]);
  let notes = userResult.rows[0]?.notes || [];
  if (!notes[noteIndex]) return res.status(404).json({ error: 'Note not found' });
  const deletedNote = notes[noteIndex];
  notes.splice(noteIndex, 1);
  await pool.query('UPDATE users SET notes = $1 WHERE user_id = $2', [notes, userId]);
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'delete_note', $2, $3)`,
    [userId, `Deleted note #${noteIndex + 1}: ${deletedNote}. Reason: ${reason || 'N/A'}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

// Edit Application
app.post('/api/users/edit-app', async (req, res) => {
  const { userId, appIndex, newStatus, newReason } = req.body;
  if (!userId || typeof appIndex !== 'number' || typeof newStatus !== 'string' || typeof newReason !== 'string') {
    return res.status(400).json({ error: 'Missing data' });
  }
  const userResult = await pool.query('SELECT applications FROM users WHERE user_id = $1', [userId]);
  let applications = userResult.rows[0]?.applications || [];
  if (!applications[appIndex]) return res.status(404).json({ error: 'Application not found' });
  applications[appIndex].status = newStatus;
  applications[appIndex].reason = newReason;
  await pool.query('UPDATE users SET applications = $1 WHERE user_id = $2', [JSON.stringify(applications), userId]);
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'edit_application', $2, $3)`,
    [userId, `Edited application #${appIndex + 1}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

// Delete Application
app.post('/api/users/delete-app', async (req, res) => {
  const { userId, appIndex, reason } = req.body;
  if (!userId || typeof appIndex !== 'number') {
    return res.status(400).json({ error: 'Missing data' });
  }
  const userResult = await pool.query('SELECT applications FROM users WHERE user_id = $1', [userId]);
  let applications = userResult.rows[0]?.applications || [];
  if (!applications[appIndex]) return res.status(404).json({ error: 'Application not found' });
  const deletedApp = applications[appIndex];
  applications.splice(appIndex, 1);
  await pool.query('UPDATE users SET applications = $1 WHERE user_id = $2', [JSON.stringify(applications), userId]);
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'delete_application', $2, $3)`,
    [userId, `Deleted application #${appIndex + 1}: ${JSON.stringify(deletedApp)}. Reason: ${reason || 'N/A'}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

app.post('/api/users/ban', async (req, res) => {
  const { username, userId, platform, reason } = req.body;
  await pool.query(
    `UPDATE users SET banned = TRUE, ban_reason = $1 WHERE user_id = $2`,
    [reason, userId]
  );
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'ban', $2, $3)`,
    [userId, `Platform: ${platform}, Reason: ${reason}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

app.post('/api/users/revoke-ban', async (req, res) => {
  const { userId, reason } = req.body;
  await pool.query(
    `UPDATE users SET banned = FALSE, ban_reason = NULL WHERE user_id = $1`,
    [userId]
  );
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'ban_revoked', $2, $3)`,
    [userId, `Ban revoked: ${reason}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

app.post('/api/users/application', async (req, res) => {
  const { username, userId, status, improve } = req.body;
  const userResult = await pool.query('SELECT applications FROM users WHERE user_id = $1', [userId]);
  let applications = userResult.rows[0]?.applications || [];
  applications.push({
    status,
    reason: improve,
    date: new Date().toISOString()
  });
  await pool.query(
    `UPDATE users SET applications = $1 WHERE user_id = $2`,
    [applications, userId] // <-- use applications array directly
  );
  await pool.query(
    `INSERT INTO logs (user_id, action, details, admin)
     VALUES ($1, 'application', $2, $3)`,
    [userId, `Application: ${status}, Improve: ${improve}`, req.session?.user?.username || 'system']
  );
  res.json({ success: true });
});

app.get('/api/logs', async (req, res) => {
  const result = await pool.query('SELECT * FROM logs ORDER BY date DESC LIMIT 100');
  res.json(result.rows);
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
