require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const bodyParser = require('body-parser');
const pg = require('pg');
const cors = require('cors');
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
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// --- Discord OAuth endpoints ---
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
      client_id: process.env.DISCORD_CLIENT_ID,
      client_secret: process.env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      scope: 'identify guilds.members.read'
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token, token_type } = tokenRes.data;

    // Get user info
    const userRes = await axios.get('https://discord.com/api/users/@me', {
      headers: { Authorization: `${token_type} ${access_token}` }
    });
    const user = userRes.data;

    // Get member info for your guild
    let hasAdminRole = false;
    try {
      const guildMemberRes = await axios.get(
        `https://discord.com/api/users/@me/guilds/${process.env.DISCORD_GUILD_ID}/member`,
        { headers: { Authorization: `${token_type} ${access_token}` } }
      );
      const member = guildMemberRes.data;
      hasAdminRole = member.roles && member.roles.includes(process.env.DISCORD_ADMIN_ROLE_ID);
    } catch (e) {
      // Not a member or no roles
    }

    // Save to session
    req.session.user = {
      username: user.username,
      avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
      id: user.id,
      hasAdminRole
    };

    // Upsert user in DB
    await pool.query(
      `INSERT INTO users (user_id, username)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username`,
      [user.id, user.username]
    );

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
  const userId = req.session.user.id;
  const { rows } = await pool.query('SELECT * FROM users WHERE user_id = $1', [userId]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  // Check if banned
  const banRows = await pool.query('SELECT * FROM ban_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1', [userId]);
  res.json({
    ...rows[0],
    banned: !!banRows.rows[0]
  });
});

// --- User bans ---
app.get('/api/me/bans', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const userId = req.session.user.id;
  const { rows } = await pool.query('SELECT * FROM ban_logs WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 1', [userId]);
  if (!rows[0]) return res.json({ banned: false });
  res.json({ banned: true, reason: rows[0].changes?.reason || 'N/A' });
});

// --- User applications ---
app.get('/api/me/applications', async (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Not logged in' });
  const userId = req.session.user.id;
  const { rows } = await pool.query('SELECT * FROM applications WHERE user_id = $1 ORDER BY date DESC', [userId]);
  res.json(rows);
});

// --- Profile lookup ---
app.get('/api/users/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing search query' });
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE user_id = $1 OR LOWER(username) = LOWER($1) LIMIT 1', [q]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

// --- Admin session check ---
app.get('/api/admin/session', (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// --- Admin login ---
app.post('/api/admin/login', (req, res) => {
  if (req.body.password === process.env.ADMIN_PASSWORD) {
    req.session.isAdmin = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect password' });
  }
});

// --- Admin logs ---
app.get('/api/admin/logs', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Not authorized' });
  const { rows } = await pool.query('SELECT * FROM ban_logs ORDER BY timestamp DESC LIMIT 100');
  res.json(rows);
});

// --- Admin: Edit a profile ---
app.put('/api/users/:user_id', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Not authorized' });
  const { user_id } = req.params;
  const { username, notes } = req.body;
  try {
    await pool.query(
      'UPDATE users SET username = $1, notes = $2 WHERE user_id = $3',
      [username, notes, user_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin: Add application ---
app.post('/api/applications', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Not authorized' });
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

// --- Admin: Log a ban ---
app.post('/api/ban_logs', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Not authorized' });
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

// --- Serve static files (frontend) ---
app.use(express.static(__dirname));

// --- Start server ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
